import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { completeTask, retryPrompt, assignPendingPrompts, releaseWorker } from '../services/worker.js'

export default async function workerRoutes(fastify) {
  // ─── List active workers (existing) ──────────────────────────────────────
  fastify.get('/workers', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('status', 'active')
      .order('current_load', { ascending: true })

    if (error) {
      return reply.code(400).send({ success: false, error: error.message })
    }

    const workers = data.map(w => ({
      ...w,
      is_alive: w.last_ping ? new Date(w.last_ping) > new Date(twoMinutesAgo) : false
    }))

    return reply.send({ success: true, data: workers })
  })

  // ─── Heartbeat — worker tabs call this every few seconds ─────────────────
  fastify.post('/workers/heartbeat', {
    schema: {
      body: {
        type: 'object',
        required: ['tab_id'],
        properties: {
          tab_id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { tab_id } = request.body

    const { data, error } = await supabase
      .from('workers')
      .update({
        last_ping: new Date().toISOString(),
        status: 'active'
      })
      .eq('tab_id', tab_id)
      .select()
      .single()

    if (error || !data) {
      return reply.code(404).send({ success: false, error: 'Worker not found for this tab_id' })
    }

    return reply.send({ success: true, data: { tab_id, status: 'alive' } })
  })

  // ─── Poll — worker tab checks for its assigned task ──────────────────────
  fastify.get('/workers/poll/:tabId', async (request, reply) => {
    const { tabId } = request.params

    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('assigned_tab_id', tabId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) {
      return reply.code(400).send({ success: false, error: error.message })
    }

    if (!data || data.length === 0) {
      return reply.send({ success: true, data: null, message: 'No tasks assigned' })
    }

    return reply.send({ success: true, data: data[0] })
  })

  // ─── Complete — worker tab reports task done/failed ──────────────────────
  fastify.post('/workers/complete', {
    schema: {
      body: {
        type: 'object',
        required: ['tab_id', 'prompt_id', 'status'],
        properties: {
          tab_id: { type: 'string' },
          prompt_id: { type: 'number' },
          status: { type: 'string', enum: ['completed', 'failed'] },
          output_urls: { type: 'array', items: { type: 'string' }, default: [] },
          failure_reason: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { tab_id, prompt_id, status, output_urls, failure_reason } = request.body

    const result = await completeTask({ tab_id, prompt_id, status, output_urls, failure_reason })

    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error })
    }

    return reply.send({
      success: true,
      data: result.data,
      message: status === 'failed'
        ? `Task failed: ${failure_reason || 'Unknown error'}. You can retry this prompt.`
        : 'Task completed successfully'
    })
  })

  // ─── Retry — retry a failed prompt (puts it back in queue) ──────────────
  fastify.post('/workers/retry', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt_id'],
        properties: {
          prompt_id: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const { prompt_id } = request.body

    const result = await retryPrompt(prompt_id)

    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error })
    }

    return reply.send({
      success: true,
      data: result.data,
      message: 'Prompt has been re-queued for processing'
    })
  })

  // ─── Release — extension notifies backend that a worker is free ─────────
  // Lightweight: only releases the worker + triggers assignPendingPrompts()
  // Does NOT update prompt data (extension already did that directly in Supabase)
  fastify.post('/workers/release', {
    schema: {
      body: {
        type: 'object',
        required: ['tab_id'],
        properties: {
          tab_id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { tab_id } = request.body

    try {
      await releaseWorker(tab_id)
      console.log(`[Queue] Worker ${tab_id} released by extension — reassigning`)
      return reply.send({ success: true, message: 'Worker released and queue processed' })
    } catch (err) {
      console.error(`[Queue] Release failed for ${tab_id}:`, err.message)
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
