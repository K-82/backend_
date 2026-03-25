import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { getPromptFileUrls } from '../services/storage.js'
import archiver from 'archiver'
import fetch from 'node-fetch'

export default async function mediaRoutes(fastify) {
  // Get media for a prompt
  fastify.get('/media/:promptId', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { promptId } = request.params

    // Verify ownership
    const { data: prompt } = await supabase
      .from('prompts')
      .select('id, output_urls, user_id')
      .eq('id', promptId)
      .eq('user_id', request.user.id)
      .single()

    if (!prompt) {
      return reply.code(404).send({ success: false, error: 'Prompt not found' })
    }

    const storageFiles = await getPromptFileUrls(promptId)

    return reply.send({
      success: true,
      data: {
        promptId,
        output_urls: prompt.output_urls || [],
        files: storageFiles
      }
    })
  })

  // Bulk download as ZIP
  fastify.post('/media/bulk-download', {
    preHandler: authMiddleware,
    schema: {
      body: {
        type: 'object',
        required: ['promptIds'],
        properties: {
          promptIds: { type: 'array', items: { type: 'number' }, minItems: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const { promptIds } = request.body

    // Verify user owns all prompts
    const { data: prompts, error } = await supabase
      .from('prompts')
      .select('id, output_urls')
      .in('id', promptIds)
      .eq('user_id', request.user.id)

    if (error || !prompts || prompts.length === 0) {
      return reply.code(404).send({ success: false, error: 'No prompts found' })
    }

    reply.raw.setHeader('Content-Type', 'application/zip')
    reply.raw.setHeader('Content-Disposition', 'attachment; filename="media-download.zip"')

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.pipe(reply.raw)

    for (const prompt of prompts) {
      const urls = prompt.output_urls || []
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        try {
          const response = await fetch(url)
          if (response.ok) {
            const ext = url.endsWith('.mp4') ? 'mp4' : 'jpg'
            archive.append(response.body, { name: `prompt_${prompt.id}_${i}.${ext}` })
          }
        } catch (e) {
          fastify.log.warn(`Failed to fetch ${url}: ${e.message}`)
        }
      }
    }

    archive.finalize()
  })
}
