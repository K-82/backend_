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

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
})

// ─── Plugins ───────────────────────────────────────────────────────────────

await fastify.register(cors, {
  origin: [
    'https://frontend-flax-ten-15ozbodi2i.vercel.app',
    'https://frontend-git-main-joshanraza711-webs-projects.vercel.app',
    'https://frontend-rmmgb7rbv-joshanraza711-webs-projects.vercel.app',
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
