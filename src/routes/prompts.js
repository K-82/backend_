import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { assignPendingPrompts } from '../services/worker.js'
import { deletePromptFiles } from '../services/storage.js'

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
          mode: { type: 'string', enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' },
          ratio: { type: 'string', enum: ['LANDSCAPE', 'PORTRAIT'], default: 'LANDSCAPE' },
          model: { type: 'string', default: 'default' }
        }
      }
    }
  }, async (request, reply) => {
    const { prompt, mode = 'IMAGE', ratio = 'LANDSCAPE', model = 'default' } = request.body
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
          mode: { type: 'string', enum: ['IMAGE', 'VIDEO'] }
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
}
