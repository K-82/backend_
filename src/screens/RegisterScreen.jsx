import { useState } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { Loader } from 'lucide-react'

export function RegisterScreen({ navigation }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useAuthStore(s => s.setAuth)

  async function handleRegister() {
    if (!name || !email || !password || !confirm) {
      setError('Please fill in all fields')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await api.register(email, password, name)
      setAuth(data.user, data.token)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-dark-bg font-sans overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto min-h-full">
        <div className="animate-slide-up w-full text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20 shadow-[0_0_20px_rgba(124,58,237,0.15)]">
            <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(124,58,237,0.5)]">✨</span>
          </div>
          <h1 className="text-3xl font-bold font-display text-white mb-2">Create Account</h1>
          <p className="text-dark-text-muted text-sm font-medium mb-10">Join the AI media revolution</p>
        </div>

        <div className="w-full space-y-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
          
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="relative w-full px-5 py-4 rounded-2xl glass-panel text-white placeholder-dark-text-muted focus:outline-none focus:border-primary/50 transition-all text-base shadow-inner"
            />
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="relative w-full px-5 py-4 rounded-2xl glass-panel text-white placeholder-dark-text-muted focus:outline-none focus:border-primary/50 transition-all text-base shadow-inner"
            />
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="relative w-full px-5 py-4 rounded-2xl glass-panel text-white placeholder-dark-text-muted focus:outline-none focus:border-primary/50 transition-all text-base shadow-inner"
            />
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="relative w-full px-5 py-4 rounded-2xl glass-panel text-white placeholder-dark-text-muted focus:outline-none focus:border-primary/50 transition-all text-base shadow-inner"
            />
          </div>

          {error && (
            <div className="px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-fade-in flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleRegister}
              disabled={loading}
              className="group relative w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-500 group-hover:from-primary-light group-hover:to-blue-400 transition-colors"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative flex items-center justify-center gap-2">
                {loading && <Loader size={20} className="spinner" />}
                Create Account
              </div>
            </button>
          </div>

          <button
            onClick={() => navigation.goBack()}
            className="w-full text-center mt-6 text-dark-text-muted text-sm hover:text-white transition-colors"
          >
            Already have an account? <span className="text-primary-light font-semibold hover:underline underline-offset-4">Sign In</span>
          </button>
        </div>
      </div>
    </div>
  )
}
