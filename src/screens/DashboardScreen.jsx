import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api'
import { MediaCard } from '../components/MediaCard.jsx'
import { SkeletonCard } from '../components/SkeletonCard.jsx'
import { Download, X, Image as ImageIcon, Video, Folder, Hourglass, Pencil, Pin } from 'lucide-react'
import { PropellerAd } from '../components/PropellerAd.jsx'
import { useAdSettings } from '../hooks/useAdSettings.js'

const FILTERS = ['All', 'Images', 'Videos', 'Edits', 'Pending', 'Failed', 'Pinned']
const FILTER_MAP = {
  All: {},
  Images: { mode: 'IMAGE' },
  Videos: { mode: 'VIDEO' },
  Edits: { mode: 'IMAGE_EDIT' },
  Pending: { status: 'pending' },
  Failed: { status: 'failed' },
  Pinned: { is_pinned: true }
}

export function DashboardScreen({ navigation, route }) {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState(route?.params?.filter || 'All')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [stats, setStats] = useState({ 
    total: 0, completed: 0, pending: 0, failed: 0, 
    images: 0, videos: 0, edits: 0, pinned: 0 
  })
  const [showDownloadAd, setShowDownloadAd] = useState(false)
  const pollRef = useRef(null)
  const { adSettings } = useAdSettings()

  useEffect(() => {
    if (route?.params?.filter) {
      setActiveFilter(route.params.filter)
    }
  }, [route?.params?.filter])

  // Fetch stats for the circular menu bubbles
  useEffect(() => {
    api.getMyStats().then(setStats).catch(console.error)
  }, [activeFilter, prompts.length]) // Refresh stats when prompts change

  const fetchPrompts = useCallback(async (pg = 1, reset = false) => {
    if (pg === 1) setLoading(true)
    try {
      const data = await api.getPrompts({ page: pg, limit: 20, ...FILTER_MAP[activeFilter] })
      const newPrompts = data.prompts || []
      setPrompts(prev => reset || pg === 1 ? newPrompts : [...prev, ...newPrompts])
      setHasMore(pg < (data.pagination?.pages || 1))
      setPage(pg)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeFilter])

  useEffect(() => {
    fetchPrompts(1, true)
  }, [activeFilter])

  // Poll for pending prompts every 5s
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const hasPending = prompts.some(p => p.status === 'pending' || p.status === 'processing')
      if (!hasPending) return
      try {
        const data = await api.getPrompts({ page: 1, limit: 20, ...FILTER_MAP[activeFilter] })
        setPrompts(data.prompts || [])
      } catch { }
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [prompts, activeFilter])

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this media?')) return
    try {
      await api.deletePrompt(id)
      setPrompts(prev => prev.filter(p => p.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      // trigger stats refresh implicitly
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  async function handlePin(id, is_pinned) {
    try {
      await api.pinPrompt(id, !is_pinned)
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, is_pinned: !is_pinned } : p))
    } catch (err) {
      alert('Pin failed: ' + err.message)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function enterSelectMode(id) {
    setSelectMode(true)
    setSelectedIds(new Set([id]))
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function bulkDownload() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      const resp = await api.bulkDownload(ids)
      if (resp?.download_url) {
        const a = document.createElement('a')
        a.href = resp.download_url
        a.download = `autoflow-media-${Date.now()}.zip`
        a.click()
        // Show download ad if enabled for this user
        if (adSettings.download_ad) setShowDownloadAd(true)
      }
    } catch (e) {
      alert('Download failed: ' + e.message)
    }
    exitSelectMode()
  }

  // Circular Menu Filter Button helper
  const FilterButton = ({ id, label, icon: Icon, count, customClass, onClick }) => {
    const isActive = activeFilter === id;
    return (
      <div 
        onClick={() => { setActiveFilter(id); if (onClick) onClick(); }}
        className={`absolute flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${customClass} ${isActive ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] filter' : 'hover:scale-105 hover:brightness-125'}`}
      >
        <div className={`relative flex flex-col items-center justify-center w-full h-full`}>
          <Icon size={18} className={isActive ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" : "text-gray-300"} />
          <span className={`text-[9px] font-semibold mt-0.5 ${isActive ? "text-white" : "text-gray-400"}`}>{label}</span>
          
          {count !== undefined && (
            <div className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 text-[8px] font-bold text-white bg-white/15 border border-white/20 rounded-full backdrop-blur-sm">
              {count}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0B0E] text-gray-100 font-sans">
      {/* Propeller Ad — fires once after a download */}
      <PropellerAd show={showDownloadAd} />
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-3 z-30">
        <h2 className="text-xl font-bold font-display text-primary-light drop-shadow-[0_0_10px_rgba(124,58,237,0.5)]">My Media</h2>
        {selectMode && (
          <div className="flex gap-4 items-center animate-fade-in">
            <button
              onClick={() => setSelectedIds(new Set(prompts.map(p => p.id)))}
              className="text-primary-light text-sm font-semibold hover:text-white transition-colors"
            >
              Select All
            </button>
            <button onClick={bulkDownload} className="text-primary-light hover:text-white transition-colors">
              <Download size={20} />
            </button>
            <button onClick={exitSelectMode} className="text-dark-text-muted hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Circular Radial Filter UI — Compact */}
      {!selectMode && (
        <div className="relative w-full max-w-xs mx-auto h-[150px] flex items-center justify-center">
          
          {/* Outer Glowing Ring Container */}
          <div className="relative w-[190px] h-[190px] rounded-full border-[1px] border-white/10 shadow-[inner_0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
            
            {/* The multi-colored segments behind the icons */}
            <div className="absolute inset-0 bg-[conic-gradient(from_270deg,rgba(236,72,153,0.1)_0deg,rgba(56,189,248,0.1)_72deg,rgba(234,179,8,0.1)_144deg,rgba(168,85,247,0.1)_216deg,rgba(236,72,153,0.1)_288deg)] opacity-70"></div>
            
            {/* The dividing lines for the pie chart effect */}
            <div className="absolute inset-0 w-full h-full">
               <div className="absolute top-0 bottom-0 left-[49.5%] w-[1%] bg-[#0B0B0E] transform rotate-[18deg]"></div>
               <div className="absolute top-0 bottom-0 left-[49.5%] w-[1%] bg-[#0B0B0E] transform rotate-[90deg]"></div>
               <div className="absolute top-0 bottom-0 left-[49.5%] w-[1%] bg-[#0B0B0E] transform rotate-[162deg]"></div>
            </div>

            {/* Inner Center Circle ("All") */}
            <div className="absolute w-[60px] h-[60px] rounded-full bg-[#0B0B0E] z-10 flex items-center justify-center border-2 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
               <div 
                  onClick={() => setActiveFilter('All')}
                  className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:scale-105 active:scale-95 transition-all text-white"
               >
                 <Folder size={18} className="mb-0.5 text-purple-400" />
                 <span className="text-[10px] font-bold">All</span>
               </div>
            </div>

            {/* Radial Filter Icons — Compact positions */}
            {/* Top: Images */}
            <FilterButton id="Images" label="Images" icon={ImageIcon} count={stats.images} customClass="top-[5px] w-14 h-14 text-emerald-400" />
            
            {/* Right: Videos */}
            <FilterButton id="Videos" label="Videos" icon={Video} count={stats.videos} customClass="right-[8px] top-[52px] w-14 h-14 text-blue-400" />
            
            {/* Bottom Right: Pinned */}
            <FilterButton id="Pinned" label="Pinned" icon={Pin} count={stats.pinned} customClass="right-[25px] bottom-[8px] w-14 h-14 text-yellow-500" />
            
            {/* Bottom Left: Pending */}
            <FilterButton id="Pending" label="Pending" icon={Hourglass} count={stats.pending} customClass="left-[25px] bottom-[8px] w-14 h-14 text-pink-400" />
            
            {/* Left: Edits */}
            <FilterButton id="Edits" label="Edits" icon={Pencil} count={stats.edits} customClass="left-[8px] top-[52px] w-14 h-14 text-purple-400" />

          </div>
        </div>
      )}

      {/* Info Text */}
      <p className="text-center text-gray-500 text-xs font-medium mb-4">
        Pinned media won't be automatically deleted.
      </p>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && prompts.length === 0 ? (
          <div className="flex flex-wrap justify-center gap-3 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div>
            {prompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-32 gap-4 animate-fade-in">
                <div className="text-6xl filter drop-shadow-[0_0_20px_rgba(124,58,237,0.3)]">✨</div>
                <p className="text-gray-300 font-display font-semibold text-lg">No media yet</p>
                <p className="text-dark-text-muted text-sm text-center max-w-[250px]">
                  Generate your first stunning image or video to see it here!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 p-4 pb-24">
                {prompts.map(item => (
                  <div key={item.id} className="animate-fade-in" style={{ animationDelay: '50ms' }}>
                    <MediaCard
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      onPin={handlePin}
                      onDelete={handleDelete}
                      onPress={() => selectMode
                        ? toggleSelect(item.id)
                        : navigation.navigate('Detail', { promptId: item.id })
                      }
                      onLongPress={() => enterSelectMode(item.id)}
                    />
                  </div>
                ))}
              </div>
            )}
            {hasMore && !loading && (
              <div className="text-center py-4">
                <button
                  onClick={() => fetchPrompts(page + 1)}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-light transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selection Bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[85px] left-0 right-0 max-w-md mx-auto flex items-center justify-between px-5 py-4 glass-panel border-primary/50 shadow-[0_10px_40px_rgba(124,58,237,0.2)] rounded-3xl m-4 animate-slide-up z-50">
          <p className="text-white font-semibold flex items-center gap-2">
            <span className="bg-primary/20 text-primary-light px-2 py-0.5 rounded-md">{selectedIds.size}</span> selected
          </p>
          <button
            onClick={bulkDownload}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-light transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
          >
            <Download size={18} />
            Download
          </button>
        </div>
      )}
    </div>
  )
}
