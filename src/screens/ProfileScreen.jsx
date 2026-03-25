import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { ArrowLeft, Image as ImageIcon, Video, Pencil, Pin, LogOut, Shield } from 'lucide-react'

export function ProfileScreen({ navigation }) {
  const { user, clearAuth } = useAuthStore()
  const [stats, setStats] = useState({
    total: 0, completed: 0, pending: 0, failed: 0,
    images: 0, videos: 0, edits: 0, pinned: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const data = await api.getMyStats()
      setStats(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function handleLogout() {
    if (window.confirm('Are you sure you want to logout?')) {
      clearAuth()
    }
  }

  const avatarLetter = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'
  
  const successRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0
  const pixels = (stats.completed * 5.2).toFixed(1)

  return (
    <div className="flex flex-col h-full bg-dark-bg font-sans overflow-y-auto text-white pb-24">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-4 p-6 pt-8">
        <button onClick={() => navigation.navigate('Dashboard')} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition">
          <ArrowLeft size={20} className="text-gray-300" />
        </button>
        <div>
          <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Account</p>
          <h1 className="text-xl font-bold font-display">Profile</h1>
        </div>
      </div>

      <div className="px-6 max-w-sm mx-auto w-full space-y-8 animate-slide-up">
        
        {/* User Info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl font-bold border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            {avatarLetter}
          </div>
          <div>
            <h2 className="text-lg font-bold">{user?.name || 'AutoFlow User'}</h2>
            <p className="text-xs text-gray-400">Pro Plan • Since Mar 2026</p>
          </div>
        </div>

        {/* Overview */}
        <div>
          <h3 className="text-[10px] text-gray-600 font-bold tracking-widest uppercase mb-3 ml-1">Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'All' })}
              className="glass-panel rounded-2xl p-4 py-5 border border-white/5 bg-[#12121A] cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
            >
              <p className="text-[9px] text-gray-500 uppercase font-bold mb-1 tracking-wider">Total</p>
              <p className="text-2xl font-bold">{loading ? '-' : stats.total}</p>
            </div>
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Completed' })}
              className="glass-panel rounded-2xl p-4 py-5 border border-white/5 bg-[#12121A] cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
            >
              <p className="text-[9px] text-gray-500 uppercase font-bold mb-1 tracking-wider">Completed</p>
              <p className="text-2xl font-bold">{loading ? '-' : stats.completed}</p>
            </div>
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Pending' })}
              className="glass-panel rounded-2xl p-4 py-5 border border-white/5 bg-[#12121A] cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
            >
              <p className="text-[9px] text-gray-500 uppercase font-bold mb-1 tracking-wider">Pending</p>
              <p className="text-2xl font-bold">{loading ? '-' : stats.pending}</p>
            </div>
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Failed' })}
              className="glass-panel rounded-2xl p-4 py-5 border border-white/5 bg-[#12121A] cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
            >
              <p className="text-[9px] text-gray-500 uppercase font-bold mb-1 tracking-wider">Failed</p>
              <p className="text-2xl font-bold">{loading ? '-' : stats.failed}</p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div>
          <h3 className="text-[10px] text-gray-600 font-bold tracking-widest uppercase mb-3 ml-1">Breakdown</h3>
          <div className="glass-panel rounded-3xl border border-white/5 bg-[#12121A] divide-y divide-white/5 overflow-hidden">
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Images' })}
              className="flex items-center justify-between p-4 px-5 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-gray-300">
                <ImageIcon size={16} className="text-gray-500" /> Images
              </div>
              <span className="text-sm font-bold text-gray-300">{loading ? '-' : stats.images}</span>
            </div>
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Videos' })}
              className="flex items-center justify-between p-4 px-5 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-gray-300">
                <Video size={16} className="text-gray-500" /> Videos
              </div>
              <span className="text-sm font-bold text-gray-300">{loading ? '-' : stats.videos}</span>
            </div>
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Edits' })}
              className="flex items-center justify-between p-4 px-5 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-gray-300">
                <Pencil size={16} className="text-gray-500" /> Edits
              </div>
              <span className="text-sm font-bold text-gray-300">{loading ? '-' : stats.edits}</span>
            </div>
            <div 
              onClick={() => navigation.navigate('Dashboard', { filter: 'Pinned' })}
              className="flex items-center justify-between p-4 px-5 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 text-sm font-medium text-gray-300">
                <Pin size={16} className="text-gray-500" /> Pinned
              </div>
              <span className="text-sm font-bold text-gray-300">{loading ? '-' : stats.pinned}</span>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div>
          <h3 className="text-[10px] text-gray-600 font-bold tracking-widest uppercase mb-3 ml-1">Performance</h3>
          <div className="glass-panel rounded-3xl p-5 border border-white/5 bg-[#12121A]">
            <div className="flex justify-between items-end mb-3">
              <span className="text-xs text-gray-500 font-medium">Success Rate</span>
              <span className="text-sm font-bold text-cyan-400">{successRate}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
              <div 
                className="h-full bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-1000" 
                style={{ width: `${successRate}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-white/5 mt-2">
              <div className="pt-3">
                <p className="text-sm font-bold text-white">{pixels}k</p>
                <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mt-1">Pixels</p>
              </div>
              <div className="pt-3">
                <p className="text-sm font-bold text-white">{loading ? '-' : stats.total}</p>
                <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mt-1">Generations</p>
              </div>
              <div className="pt-3">
                <p className="text-sm font-bold text-white">99.8%</p>
                <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mt-1">Uptime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-3 pb-8">
          {user?.is_admin && (
            <button
              onClick={() => navigation.navigate('Admin')}
              className="w-full flex items-center justify-center gap-3 p-4 glass-panel bg-primary/10 border-primary/20 rounded-2xl text-primary-light hover:bg-primary/20 transition-all font-semibold"
            >
              <Shield size={18} />
              <span>Admin Dashboard</span>
              <span>→</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-red-500 font-bold transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

      </div>
    </div>
  )
}
