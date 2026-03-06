import { supabase } from '../services/supabase.js'
import { adminMiddleware } from '../middleware/auth.js'
import { deletePromptFiles } from '../services/storage.js'
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
      .single()

    if (error) return reply.code(400).send({ success: false, error: error.message })
    return reply.code(201).send({ success: true, data })
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
          mode: { type: 'string', enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' },
          ratio: { type: 'string', enum: ['LANDSCAPE', 'PORTRAIT'], default: 'LANDSCAPE' },
          worker_id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { prompt, user_id, mode = 'IMAGE', ratio = 'LANDSCAPE' } = request.body

    // Always queue — assigned_tab_id stays null until queue processor assigns it
    const { data, error } = await supabase
      .from('prompts')
      .insert({
        user_id, prompt, mode, ratio, resolution: '1', model: 'default',
        status: 'pending', download_status: 'not_downloaded', output_urls: [],
        assigned_tab_id: null,
        machine_id: null
      })
      .select()
      .single()

    if (error) return reply.code(400).send({ success: false, error: error.message })

    // Try to assign pending prompts to free workers
    await assignPendingPrompts()

    return reply.code(201).send({ success: true, data })
  })

  // Retry failed prompt — resets it back into the queue
  fastify.patch('/admin/prompts/:id/retry', { preHandler: adminMiddleware }, async (request, reply) => {
    const { id } = request.params

    const { data: prompt } = await supabase.from('prompts').select('id').eq('id', id).single()
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
