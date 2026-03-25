import 'dotenv/config'
//config()
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

import authRoutes from './routes/auth.js'
import promptRoutes from './routes/prompts.js'
import mediaRoutes from './routes/media.js'
import workerRoutes from './routes/workers.js'
import adminRoutes from './routes/admin.js'
import { assignPendingPrompts } from './services/worker.js'
import { supabase } from './services/supabase.js'
import { deletePromptFiles } from './services/storage.js'

const fastify = Fastify({
  bodyLimit: 10 * 1024 * 1024, // 10MB for base64 image uploads
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
})

// <script>
// (function(s){s.dataset.zone='10781216',
// s.src='https://al5sm.com/tag.min.js'})
// ([document.documentElement, document.body].filter(Boolean).pop().appendChild
// (document.createElement('script')))
// </script>


// ─── Plugins ───────────────────────────────────────────────────────────────

await fastify.register(cors, {
  origin: [
    'https://frontend-app-test-sage.vercel.app',
    'https://frontend-app-test-git-main-joshanraza711-webs-projects.vercel.app',
    'https://frontend-app-test-rdv59pa01-joshanraza711-webs-projects.vercel.app',
    'https://frontendapptest.vercel.app',
    'https://frontendapptest-nd2fceegu-joshanraza711-webs-projects.vercel.app',
    'https://frontend-alpha-three-39.vercel.app',
    'https://labs.google',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
})

await fastify.register(rateLimit, {
  global: false,
  max: 100,
  timeWindow: '1 minute'
})

// ─── Health check ──────────────────────────────────────────────────────────

fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// ─── Routes ────────────────────────────────────────────────────────────────

await fastify.register(authRoutes, { prefix: '/api' })
await fastify.register(promptRoutes, { prefix: '/api' })
await fastify.register(mediaRoutes, { prefix: '/api' })
await fastify.register(workerRoutes, { prefix: '/api' })
await fastify.register(adminRoutes, { prefix: '/api' })





// ─── Background Queue Processor ───────────────────────────────────────────
// Safety net: every 10 seconds, try to assign any pending prompts to free workers
setInterval(async () => {
  try {
    await assignPendingPrompts()
  } catch (err) {
    console.error('[Queue] Background processor error:', err.message)
  }
}, 10_000)

// ─── Auto-Cleanup Processor ───────────────────────────────────────────────
// Run every hour to delete unpinned prompts older than 24h
setInterval(async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Find expired prompts
    const { data: expiredPrompts, error } = await supabase
      .from('prompts')
      .select('id')
      .eq('is_pinned', false)
      .lt('created_at', yesterday)

    if (error) throw error
    if (!expiredPrompts || expiredPrompts.length === 0) return

    console.log(`🧹 Auto-cleanup: Found ${expiredPrompts.length} expired prompts`)

    // Delete files from storage
    for (const prompt of expiredPrompts) {
      await deletePromptFiles(prompt.id)
    }

    // Delete from DB (storage DB cascade isn't guaranteed if we handle files manually)
    const ids = expiredPrompts.map(p => p.id)
    const { error: deleteErr } = await supabase
      .from('prompts')
      .delete()
      .in('id', ids)

    if (deleteErr) throw deleteErr
    console.log(`✅ Auto-cleanup: Deleted ${ids.length} expired prompts`)

  } catch (err) {
    console.error('[Cleanup] Auto-cleanup error:', err.message)
  }
}, 60 * 60 * 1000)

// ─── Error Handler ─────────────────────────────────────────────────────────

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)

  if (error.validation) {
    return reply.code(400).send({
      success: false,
      error: 'Validation error',
      details: error.validation
    })
  }

  return reply.code(error.statusCode || 500).send({
    success: false,
    error: error.message || 'Internal server error'
  })
})

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10)

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\n🚀 Server running on http://localhost:${PORT}`)
  console.log(`📋 Queue processor active — checking every 10s\n`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
