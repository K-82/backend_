import { useAuthStore } from '../store/useAuthStore'

const BASE_URL = 'https://backend-production-1708.up.railway.app/api'

async function request(path, options = {}) {
  const token = useAuthStore.getState().token
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const data = await res.json()

  if (!data.success) {
    throw new Error(data.error || 'Request failed')
  }
  return data.data
}

export const api = {
  register: (email, password, name) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request('/auth/me'),

  createPrompt: (body) =>
    request('/prompts', { method: 'POST', body: JSON.stringify(body) }),

  getPrompts: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null))
    ).toString()
    return request(`/prompts${qs ? `?${qs}` : ''}`)
  },

  getMyStats: () => request('/prompts/stats'),

  getPrompt: (id) => request(`/prompts/${id}`),

  deletePrompt: (id) => request(`/prompts/${id}`, { method: 'DELETE' }),

  pinPrompt: (id, is_pinned) => 
    request(`/prompts/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ is_pinned }) }),

  getMedia: (promptId) => request(`/media/${promptId}`),

  bulkDownload: (promptIds) =>
    request('/media/bulk-download', { method: 'POST', body: JSON.stringify({ promptIds }) }),

  // Ad settings for the current user
  getAdSettings: () => request('/ads/settings'),

  getWorkers: () => request('/workers'),

  admin: {
    getWorkers: () => request('/admin/workers'),
    addWorker: (body) => request('/admin/workers', { method: 'POST', body: JSON.stringify(body) }),
    deleteWorker: (id) => request(`/admin/workers/${id}`, { method: 'DELETE' }),
    getPrompts: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null))
      ).toString()
      return request(`/admin/prompts${qs ? `?${qs}` : ''}`)
    },
    createPrompt: (body) => request('/admin/prompts', { method: 'POST', body: JSON.stringify(body) }),
    retryPrompt: (id) => request(`/admin/prompts/${id}/retry`, { method: 'PATCH' }),
    deletePrompt: (id) => request(`/admin/prompts/${id}`, { method: 'DELETE' }),
    getStats: () => request('/admin/stats'),

    // Ad management
    getAdSettings: () => request('/admin/ads'),
    setAdSetting: (key, enabled) =>
      request(`/admin/ads/${key}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    getUserAdOverrides: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null))
      ).toString()
      return request(`/admin/ads/users${qs ? `?${qs}` : ''}`)
    },
    setUserAdOverride: (user_id, ad_key, enabled) =>
      request(`/admin/ads/users/${user_id}/${ad_key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
    deleteUserAdOverride: (user_id, ad_key) =>
      request(`/admin/ads/users/${user_id}/${ad_key}`, { method: 'DELETE' })
  }
}
