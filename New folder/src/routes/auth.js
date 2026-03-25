import { supabase } from '../services/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import bcrypt from 'bcryptjs'

export default async function authRoutes(fastify) {
  // Register
  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, name } = request.body

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      return reply.code(400).send({ success: false, error: authError.message })
    }

    // Also insert into public.users table (matches their schema)
    const hashedPassword = await bcrypt.hash(password, 10)
    const { error: userError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, name, password: hashedPassword })

    if (userError) {
      // Cleanup auth user if insert fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return reply.code(400).send({ success: false, error: userError.message })
    }

    // Sign in to get token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      return reply.code(400).send({ success: false, error: signInError.message })
    }

    return reply.code(201).send({
      success: true,
      data: {
        user: { id: authData.user.id, email, name },
        token: signInData.session.access_token
      }
    })
  })

  // Login
  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return reply.code(401).send({ success: false, error: 'Invalid credentials' })
    }

    // Get user name from public.users
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', data.user.id)
      .single()

    // Check admin status
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .single()

    return reply.send({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userData?.name || '',
          is_admin: !!adminRecord
        },
        token: data.session.access_token
      }
    })
  })

  // Me
  fastify.get('/auth/me', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { data: userData } = await supabase
      .from('users')
      .select('name, created_at')
      .eq('id', request.user.id)
      .single()

    // Check admin status
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', request.user.id)
      .single()

    return reply.send({
      success: true,
      data: {
        id: request.user.id,
        email: request.user.email,
        name: userData?.name || '',
        is_admin: !!adminRecord,
        created_at: userData?.created_at
      }
    })
  })
}
