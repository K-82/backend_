import { supabase } from './supabase.js'
import 'dotenv/config'


const BUCKET = 'media'
const SUPABASE_URL = process.env.SUPABASE_URL

export function getPublicUrl(promptId, index, type = 'jpg') {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${promptId}/${promptId}_${index}.${type}`
}

export async function deletePromptFiles(promptId) {
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(String(promptId))

  if (error || !files || files.length === 0) return

  const paths = files.map(f => `${promptId}/${f.name}`)
  await supabase.storage.from(BUCKET).remove(paths)
}

export async function getPromptFileUrls(promptId) {
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(String(promptId))

  if (error || !files) return []

  return files.map(f => ({
    name: f.name,
    url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${promptId}/${f.name}`
  }))
}

// Helper to upload base64 images to Supabase storage
export async function processBase64Image(base64Str) {
  const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data')
  }
  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const filename = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: `image/${extension}`
    })

  if (error) {
    throw new Error('Failed to upload image: ' + error.message)
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return publicUrl
}
