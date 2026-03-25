import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { assignPendingPrompts } from '../services/worker.js'
import { deletePromptFiles, processBase64Image } from '../services/storage.js'

export default async function promptRoutes(fastify) {
  // Create prompt — always queued, queue processor assigns to a free worker
  fastify.post('/prompts', {
    preHandler: authMiddleware,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1 },
          mode: { type: 'string', enum: ['IMAGE', 'VIDEO', 'IMAGE_EDIT'], default: 'IMAGE' },
          ratio: { type: 'string', enum: ['LANDSCAPE', 'PORTRAIT'], default: 'LANDSCAPE' },
          model: { type: 'string', default: 'default' },
          input_image_url: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { prompt, mode = 'IMAGE', ratio = 'LANDSCAPE', model = 'default', input_image_url } = request.body
    const userId = request.user.id

    // Insert into queue — assigned_tab_id stays null until queue processor assigns it
    const promptData = {
      user_id: userId,
      prompt,
      mode,
      ratio,
      resolution: '1',
      model,
      status: 'pending',
      download_status: 'not_downloaded',
      output_urls: [],
      assigned_tab_id: null,
      machine_id: null
    }

    // Save input image URL for IMAGE_EDIT mode
    if (mode === 'IMAGE_EDIT' && input_image_url) {
      if (input_image_url.startsWith('data:image/')) {
        try {
          promptData.input_image_url = await processBase64Image(input_image_url)
        } catch (err) {
          return reply.code(400).send({ success: false, error: err.message })
        }
      } else {
        promptData.input_image_url = input_image_url
      }
    }

    const { data, error } = await supabase
      .from('prompts')
      .insert(promptData)
      .select()
      .single()

    if (error) {
      return reply.code(400).send({ success: false, error: error.message })
    }

    // Try to assign this and any other pending prompts to free workers
    await assignPendingPrompts()

    return reply.code(201).send({ success: true, data })
  })

  // List user prompts (paginated, filterable)
  fastify.get('/prompts', {
    preHandler: authMiddleware,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
          status: { type: 'string' },
          mode: { type: 'string', enum: ['IMAGE', 'VIDEO', 'IMAGE_EDIT'] }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20, status, mode } = request.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('prompts')
      .select('*', { count: 'exact' })
      .eq('user_id', request.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (mode) query = query.eq('mode', mode)

    const { data, error, count } = await query

    if (error) {
      return reply.code(400).send({ success: false, error: error.message })
    }

    return reply.send({
      success: true,
      data: {
        prompts: data,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    })
  })

  // Get user stats for Profile Screen
  fastify.get('/prompts/stats', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const userId = request.user.id

    const { data: prompts, error } = await supabase
      .from('prompts')
      .select('status, mode, is_pinned')
      .eq('user_id', userId)

    if (error) {
      return reply.code(400).send({ success: false, error: error.message })
    }

    const stats = {
      total: prompts.length,
      completed: 0,
      failed: 0,
      pending: 0,
      images: 0,
      videos: 0,
      edits: 0,
      pinned: 0
    }

    for (const p of prompts) {
      if (p.status === 'completed') stats.completed++
      else if (p.status === 'failed') stats.failed++
      else stats.pending++
      
      if (p.mode === 'IMAGE') stats.images++
      else if (p.mode === 'VIDEO') stats.videos++
      else if (p.mode === 'IMAGE_EDIT') stats.edits++

      if (p.is_pinned) stats.pinned++
    }

    return reply.send({ success: true, data: stats })
  })

  // Get single prompt
  fastify.get('/prompts/:id', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { id } = request.params

    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', id)
      .eq('user_id', request.user.id)
      .single()

    if (error || !data) {
      return reply.code(404).send({ success: false, error: 'Prompt not found' })
    }

    return reply.send({ success: true, data })
  })

  // Delete prompt
  fastify.delete('/prompts/:id', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { id } = request.params

    // Verify ownership
    const { data: prompt } = await supabase
      .from('prompts')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', request.user.id)
      .single()

    if (!prompt) {
      return reply.code(404).send({ success: false, error: 'Prompt not found' })
    }

    // Delete storage files
    await deletePromptFiles(id)

    // Delete prompt record
    const { error } = await supabase.from('prompts').delete().eq('id', id)
    if (error) {
      return reply.code(400).send({ success: false, error: error.message })
    }

    return reply.send({ success: true, data: { deleted: true } })
  })

  // Toggle Pin/Keep status
  fastify.patch('/prompts/:id/pin', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['is_pinned'],
        properties: {
          is_pinned: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params
    const { is_pinned } = request.body
    const userId = request.user.id

    // 1. Verify ownership and get mode
    const { data: prompt, error: fetchErr } = await supabase
      .from('prompts')
      .select('id, mode')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchErr || !prompt) {
      return reply.code(404).send({ success: false, error: 'Prompt not found' })
    }

    if (is_pinned) {
      // 2. Check limits if pinning
      const isImage = prompt.mode === 'IMAGE' || prompt.mode === 'IMAGE_EDIT'
      const limit = isImage ? 10 : 5
      
      let query = supabase
        .from('prompts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_pinned', true)

      if (isImage) {
        query = query.in('mode', ['IMAGE', 'IMAGE_EDIT'])
      } else {
        query = query.eq('mode', 'VIDEO')
      }

      const { count, error: countErr } = await query

      if (countErr) {
        return reply.code(500).send({ success: false, error: 'Failed to verify limits' })
      }

      if (count >= limit) {
        return reply.code(400).send({ 
          success: false, 
          error: `Pin limit reached. You can only pin up to ${limit} ${isImage ? 'images' : 'videos'}.` 
        })
      }
    }

    // 3. Update status
    const { data, error: updateErr } = await supabase
      .from('prompts')
      .update({ is_pinned })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      return reply.code(500).send({ success: false, error: updateErr.message })
    }

    return reply.send({ success: true, data })
  })
}
