import { supabase } from '../services/supabase.js'
import { adminMiddleware } from '../middleware/auth.js'
import { deletePromptFiles, processBase64Image } from '../services/storage.js'
import { assignPendingPrompts, retryPrompt } from '../services/worker.js'

export default async function adminRoutes(fastify) {
  // ─── WORKERS ───────────────────────────────────────────────────

  // Get all workers
  fastify.get('/admin/workers', { preHandler: adminMiddleware }, async (request, reply) => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('workers').select('*').order('created_at', { ascending: false })

    if (error) return reply.code(400).send({ success: false, error: error.message })

    const workers = data.map(w => ({
      ...w,
      is_alive: w.last_ping ? new Date(w.last_ping) > new Date(twoMinutesAgo) : false
    }))

    return reply.send({ success: true, data: workers })
  })

  // Add worker by project_id
  fastify.post('/admin/workers', {
    preHandler: adminMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['project_id'],
        properties: {
          project_id: { type: 'string' },
          worker_type: { type: 'string', enum: ['IMAGE', 'VIDEO', 'ALL'], default: 'ALL' },
          machine_id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { project_id, worker_type = 'ALL', machine_id } = request.body

    const { data, error } = await supabase
      .from('workers')
      .upsert({ project_id, worker_type, machine_id: machine_id || project_id, status: 'active', tab_id: project_id })
      .select()
      // .single()

      const row = Array.isArray(data ? data[0] :data)
    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.code(201).send({ success: true, data: row })
  })

  // Delete worker
  fastify.delete('/admin/workers/:id', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params
    const { error } = await supabase.from('workers').delete().eq('id', id)
    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.send({ success: true, data: { deleted: true } })
  })

  // ─── PROMPTS ───────────────────────────────────────────────────

  // All prompts (all users, paginated, filterable)
  fastify.get('/admin/prompts', {
    preHandler: adminMiddleware,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 },
          status: { type: 'string' },
          mode: { type: 'string' },
          user_id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20, status, mode, user_id } = request.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('prompts')
      .select(`*, users!prompts_user_id_fkey(name)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (mode) query = query.eq('mode', mode)
    if (user_id) query = query.eq('user_id', user_id)

    const { data, error, count } = await query
    if (error) return reply.code(400).send({ success: false, error: error.message })

    return reply.send({
      success: true,
      data: {
        prompts: data,
        pagination: { page, limit, total: count, pages: Math.ceil(count / limit) }
      }
    })
  })

  // Create prompt for any user (manual injection)
  fastify.post('/admin/prompts', {
    preHandler: adminMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['prompt', 'user_id'],
        properties: {
          prompt: { type: 'string' },
          user_id: { type: 'string' },
          mode: { type: 'string', enum: ['IMAGE', 'VIDEO', 'IMAGE_EDIT'], default: 'IMAGE' },
          ratio: { type: 'string', enum: ['LANDSCAPE', 'PORTRAIT'], default: 'LANDSCAPE' },
          worker_id: { type: 'string' },
          input_image_url: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { prompt, user_id, mode = 'IMAGE', ratio = 'LANDSCAPE', input_image_url } = request.body

    // Always queue — assigned_tab_id stays null until queue processor assigns it
    const promptData = {
      user_id, prompt, mode, ratio, resolution: '1', model: 'default',
      status: 'pending', download_status: 'not_downloaded', output_urls: [],
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
      // .single()

    if (error) return reply.code(400).send({ success: false, error: error.message })

    // Try to assign pending prompts to free workers
    await assignPendingPrompts()

    return reply.code(201).send({ success: true, data })
  })

  // Retry failed prompt — resets it back into the queue
  fastify.patch('/admin/prompts/:id/retry', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params

    const { data: prompt } = await supabase
    .from('prompts').select('id').eq('id', id).single()
    if (!prompt) return reply.code(404).send({ success: false, error: 'Prompt not found' })

    const result = await retryPrompt(id)

    if (!result.success) return reply.code(400).send({ success: false, error: result.error })
    return reply.send({ success: true, data: result.data })
  })

  // Delete any prompt (admin)
  fastify.delete('/admin/prompts/:id', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params
    await deletePromptFiles(id)
    const { error } = await supabase.from('prompts').delete().eq('id', id)
    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.send({ success: true, data: { deleted: true } })
  })

  // ─── ADS ────────────────────────────────────────────────────────

  // GET all global ad settings
  fastify.get('/admin/ads', { preHandler: adminMiddleware }, async (request, reply) => {
    const { data, error } = await supabase
      .from('ad_settings')
      .select('*')
      .order('key')
    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.send({ success: true, data })
  })

  // PATCH global ad setting on/off
  fastify.patch('/admin/ads/:key', {
    preHandler: adminMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['enabled'],
        properties: { enabled: { type: 'boolean' } }
      }
    }
  }, async (request, reply) => {
    const { key } = request.params
    const { enabled } = request.body

    const validKeys = ['generation_ad', 'download_ad']
    if (!validKeys.includes(key)) {
      return reply.code(400).send({ success: false, error: `key must be one of: ${validKeys.join(', ')}` })
    }

    const { data, error } = await supabase
      .from('ad_settings')
      .update({ enabled, updated_by: request.user.id })
      .eq('key', key)
      .select()

    if (error) return reply.code(400).send({ success: false, error: error.message })
    const row = Array.isArray(data) ? data[0] : data
    return reply.send({ success: true, data: row })
  })

  // GET all per-user overrides (optionally filter)
  fastify.get('/admin/ads/users', {
    preHandler: adminMiddleware,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          user_id: { type: 'string' },
          ad_key: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    let query = supabase
      .from('user_ad_overrides')
      .select('*')
      .order('updated_at', { ascending: false })

    if (request.query.user_id) query = query.eq('user_id', request.query.user_id)
    if (request.query.ad_key)  query = query.eq('ad_key', request.query.ad_key)

    const { data, error } = await query
    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.send({ success: true, data })
  })

  // PUT upsert user-level ad override
  fastify.put('/admin/ads/users/:user_id/:ad_key', {
    preHandler: adminMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['enabled'],
        properties: { enabled: { type: 'boolean' } }
      }
    }
  }, async (request, reply) => {
    const { user_id, ad_key } = request.params
    const { enabled } = request.body

    const validKeys = ['generation_ad', 'download_ad']
    if (!validKeys.includes(ad_key)) {
      return reply.code(400).send({ success: false, error: `ad_key must be one of: ${validKeys.join(', ')}` })
    }

    // Try update first (exists), then insert (new) — avoids RLS issues with upsert
    const { data: existing } = await supabase
      .from('user_ad_overrides')
      .select('id')
      .eq('user_id', user_id)
      .eq('ad_key', ad_key)
      .maybeSingle()

    let result
    if (existing) {
      result = await supabase
        .from('user_ad_overrides')
        .update({ enabled, updated_by: request.user.id })
        .eq('user_id', user_id)
        .eq('ad_key', ad_key)
        .select()
    } else {
      result = await supabase
        .from('user_ad_overrides')
        .insert({ user_id, ad_key, enabled, updated_by: request.user.id })
        .select()
    }

    if (result.error) return reply.code(400).send({ success: false, error: result.error.message })
    const row = Array.isArray(result.data) ? result.data[0] : result.data
    return reply.send({ success: true, data: row })
  })

  // DELETE user-level override (reverts to global)
  fastify.delete('/admin/ads/users/:user_id/:ad_key', { preHandler: adminMiddleware }, async (request, reply) => {
    const { user_id, ad_key } = request.params
    const { error } = await supabase
      .from('user_ad_overrides')
      .delete()
      .eq('user_id', user_id)
      .eq('ad_key', ad_key)
    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.send({ success: true, data: { deleted: true } })
  })

  // ─── STATS ─────────────────────────────────────────────────────

  fastify.get('/admin/stats', { preHandler: adminMiddleware }, async (request, reply) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const [
      { count: totalAll },
      { count: totalToday },
      { count: totalWeek },
      { count: completed },
      { count: failed },
      { count: pending },
      { count: processing },
      { count: activeWorkers }
    ] = await Promise.all([
      supabase.from('prompts').select('*', { count: 'exact', head: true }),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('workers').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('last_ping', twoMinutesAgo)
    ])

    return reply.send({
      success: true,
      data: {
        prompts: { today: totalToday, week: totalWeek, all_time: totalAll },
        status_breakdown: { completed, failed, pending, processing },
        active_workers: activeWorkers
      }
    })
  })
}
