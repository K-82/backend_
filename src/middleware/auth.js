import { supabase } from '../services/supabase.js'

export async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ success: false, error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return reply.code(401).send({ success: false, error: 'Invalid or expired token' })
  }

  request.user = user
  request.token = token
}

export async function adminMiddleware(request, reply) {
  await authMiddleware(request, reply)
  if (reply.sent) return

  const { data: adminRecord } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', request.user.id)
    .single()

  if (!adminRecord) {
    return reply.code(403).send({ success: false, error: 'Admin access required' })
  }
}
