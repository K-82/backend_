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
