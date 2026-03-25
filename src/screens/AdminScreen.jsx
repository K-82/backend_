import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { Trash2, Plus, Loader, ToggleLeft, ToggleRight, User, X } from 'lucide-react'

const ADMIN_TABS = ['Stats', 'Workers', 'Prompts', 'Inject', 'Ads']

export function AdminScreen() {
  const [activeTab, setActiveTab] = useState('Stats')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [workers, setWorkers] = useState([])
  const [prompts, setPrompts] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [workerType, setWorkerType] = useState('ALL')
  const [injectPrompt, setInjectPrompt] = useState('')
  const [injectUserId, setInjectUserId] = useState('')
  const [injectMode, setInjectMode] = useState('IMAGE')
  const [injectRatio, setInjectRatio] = useState('LANDSCAPE')
  const [injecting, setInjecting] = useState(false)

  // Ads state
  const [adSettings, setAdSettings] = useState([])
  const [adOverrides, setAdOverrides] = useState([])
  const [adLoading, setAdLoading] = useState(false)
  const [overrideUserId, setOverrideUserId] = useState('')
  const [overrideAdKey, setOverrideAdKey] = useState('generation_ad')
  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, w, p] = await Promise.all([
        api.admin.getStats(),
        api.admin.getWorkers(),
        api.admin.getPrompts({ page: 1, limit: 20, status: statusFilter || undefined })
      ])
      setStats(s)
      setWorkers(w)
      setPrompts(p.prompts || [])
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const loadAds = useCallback(async () => {
    setAdLoading(true)
    try {
      const [globalSettings, userOverrides] = await Promise.all([
        api.admin.getAdSettings(),
        api.admin.getUserAdOverrides()
      ])
      setAdSettings(globalSettings || [])
      setAdOverrides(userOverrides || [])
    } catch (e) {
      alert('Error loading ad settings: ' + e.message)
    } finally {
      setAdLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (activeTab === 'Ads') loadAds() }, [activeTab, loadAds])

  async function addWorker() {
    if (!newProjectId.trim()) return
    try {
      await api.admin.addWorker({ project_id: newProjectId.trim(), worker_type: workerType })
      setNewProjectId('')
      loadAll()
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function removeWorker(id) {
    if (!window.confirm('Remove this worker?')) return
    try { await api.admin.deleteWorker(id); loadAll() }
    catch (e) { alert('Error: ' + e.message) }
  }

  async function retryPrompt(id) {
    try { await api.admin.retryPrompt(id); loadAll() }
    catch (e) { alert('Error: ' + e.message) }
  }

  async function deletePrompt(id) {
    if (!window.confirm('Delete this prompt?')) return
    try { await api.admin.deletePrompt(id); loadAll() }
    catch (e) { alert('Error: ' + e.message) }
  }

  async function injectNewPrompt() {
    if (!injectPrompt.trim() || !injectUserId.trim()) { alert('Fill in all fields'); return }
    setInjecting(true)
    try {
      await api.admin.createPrompt({
        prompt: injectPrompt.trim(), user_id: injectUserId.trim(),
        mode: injectMode, ratio: injectRatio
      })
      setInjectPrompt('')
      alert('Prompt injected!')
      loadAll()
    } catch (e) { alert('Error: ' + e.message) }
    setInjecting(false)
  }

  async function toggleGlobalAd(key, currentEnabled) {
    try {
      await api.admin.setAdSetting(key, !currentEnabled)
      setAdSettings(prev => prev.map(s => s.key === key ? { ...s, enabled: !currentEnabled } : s))
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function saveUserOverride() {
    if (!overrideUserId.trim()) { alert('Enter a User ID'); return }
    setSavingOverride(true)
    try {
      await api.admin.setUserAdOverride(overrideUserId.trim(), overrideAdKey, overrideEnabled)
      setOverrideUserId('')
      await loadAds()
    } catch (e) { alert('Error: ' + e.message) }
    finally { setSavingOverride(false) }
  }

  async function deleteOverride(user_id, ad_key) {
    if (!window.confirm(`Remove override for user ${user_id}?`)) return
    try {
      await api.admin.deleteUserAdOverride(user_id, ad_key)
      setAdOverrides(prev => prev.filter(o => !(o.user_id === user_id && o.ad_key === ad_key)))
    } catch (e) { alert('Error: ' + e.message) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-dark-bg">
        <Loader className="w-8 h-8 text-primary spinner" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-dark-bg">
      <div className="p-4 border-b border-dark-border">
        <h1 className="text-2xl font-bold mb-4">Admin</h1>
        <div className="flex gap-2 overflow-x-auto">
          {ADMIN_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap text-sm transition-colors ${
                activeTab === tab ? 'bg-primary text-white' : 'bg-dark-card text-dark-text-muted hover:text-white'
              }`}
            >{tab}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* ── STATS ── */}
        {activeTab === 'Stats' && stats && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Overview</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Today', value: stats.prompts?.today, color: 'text-primary' },
                { label: 'This Week', value: stats.prompts?.week, color: 'text-blue-400' },
                { label: 'All Time', value: stats.prompts?.all_time, color: 'text-green-400' },
                { label: 'Workers', value: stats.active_workers, color: 'text-orange-400' }
              ].map(s => (
                <div key={s.label} className="bg-dark-card border border-dark-border rounded-lg p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? '—'}</p>
                  <p className="text-xs text-dark-text-muted mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <h2 className="text-lg font-bold mt-6 mb-4">Status Breakdown</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(stats.status_breakdown || {}).map(([k, v]) => (
                <div key={k} className="bg-dark-card border border-dark-border rounded-lg p-4">
                  <StatusBadge status={k} />
                  <p className="text-2xl font-bold mt-2">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WORKERS ── */}
        {activeTab === 'Workers' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Add Worker</h2>
            <input type="text" placeholder="Project ID" value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-white placeholder-dark-text-muted focus:outline-none focus:border-primary transition-colors text-sm"
            />
            <div className="flex gap-2">
              {['ALL', 'IMAGE', 'VIDEO'].map(t => (
                <button key={t} onClick={() => setWorkerType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    workerType === t ? 'bg-primary text-white' : 'bg-dark-card border border-dark-border text-dark-text-muted hover:text-white'
                  }`}>{t}</button>
              ))}
            </div>
            <button onClick={addWorker}
              className="w-full py-2 bg-primary hover:bg-primary-light transition-colors text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2">
              <Plus size={16} /> Add Worker
            </button>
            <h2 className="text-lg font-bold mt-6 mb-4">Workers ({workers.length})</h2>
            <div className="space-y-2">
              {workers.map(w => (
                <div key={w.id} className="bg-dark-card border border-dark-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${w.is_alive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <p className="font-semibold text-white text-sm">{w.project_id}</p>
                  </div>
                  <p className="text-xs text-dark-text-muted mb-1">{w.worker_type} · Load: {w.current_load} · {w.machine_id || 'unknown'}</p>
                  <p className="text-xs text-dark-text-muted mb-2">Last ping: {w.last_ping ? new Date(w.last_ping).toLocaleTimeString() : 'never'}</p>
                  <button onClick={() => removeWorker(w.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-1">
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROMPTS ── */}
        {activeTab === 'Prompts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Filter</h2>
            <div className="flex gap-2 overflow-x-auto">
              {['', 'pending', 'processing', 'completed', 'failed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === s ? 'bg-primary text-white' : 'bg-dark-card text-dark-text-muted hover:text-white'
                  }`}>{s || 'All'}</button>
              ))}
            </div>
            <h2 className="text-lg font-bold mt-4 mb-4">Prompts</h2>
            <div className="space-y-2">
              {prompts.map(p => (
                <div key={p.id} className="bg-dark-card border border-dark-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={p.status} />
                    <span className="text-xs text-dark-text-muted">{p.mode}</span>
                  </div>
                  <p className="text-xs text-white mb-2 line-clamp-2">{p.prompt}</p>
                  <div className="flex gap-2">
                    {p.status === 'failed' && (
                      <button onClick={() => retryPrompt(p.id)}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold">Retry</button>
                    )}
                    <button onClick={() => deletePrompt(p.id)}
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INJECT ── */}
        {activeTab === 'Inject' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Inject Prompt</h2>
            <input type="text" placeholder="User ID" value={injectUserId}
              onChange={(e) => setInjectUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-white placeholder-dark-text-muted focus:outline-none focus:border-primary transition-colors text-sm"
            />
            <textarea placeholder="Prompt" value={injectPrompt}
              onChange={(e) => setInjectPrompt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-white placeholder-dark-text-muted focus:outline-none focus:border-primary transition-colors resize-none h-24 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={injectMode} onChange={(e) => setInjectMode(e.target.value)}
                className="px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-white focus:outline-none focus:border-primary transition-colors text-sm">
                <option value="IMAGE">IMAGE</option>
                <option value="VIDEO">VIDEO</option>
              </select>
              <select value={injectRatio} onChange={(e) => setInjectRatio(e.target.value)}
                className="px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-white focus:outline-none focus:border-primary transition-colors text-sm">
                <option value="LANDSCAPE">LANDSCAPE</option>
                <option value="PORTRAIT">PORTRAIT</option>
              </select>
            </div>
            <button onClick={injectNewPrompt} disabled={injecting}
              className="w-full py-2 bg-primary hover:bg-primary-light transition-colors text-white font-semibold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {injecting && <Loader size={16} className="spinner" />}
              Inject
            </button>
          </div>
        )}

        {/* ── ADS ── */}
        {activeTab === 'Ads' && (
          <div className="space-y-6">

            {/* Global toggles */}
            <div>
              <h2 className="text-lg font-bold mb-1">Global Ad Controls</h2>
              <p className="text-xs text-dark-text-muted mb-4">
                Turning a slot OFF disables it for ALL users, regardless of per-user settings.
              </p>
              {adLoading ? (
                <div className="flex justify-center py-8"><Loader className="w-6 h-6 text-primary spinner" /></div>
              ) : (
                <div className="space-y-3">
                  {adSettings.map(s => (
                    <div key={s.key}
                      className="flex items-center justify-between bg-dark-card border border-dark-border rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {s.key === 'generation_ad' ? '🎨 Generation Ad' : '⬇️ Download Ad'}
                        </p>
                        <p className="text-xs text-dark-text-muted mt-0.5">
                          {s.key === 'generation_ad'
                            ? 'Shown after each generation is queued'
                            : 'Shown after each bulk download'}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleGlobalAd(s.key, s.enabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                          s.enabled
                            ? 'bg-green-600/20 text-green-400 border-green-600/30 hover:bg-red-600/20 hover:text-red-400 hover:border-red-600/30'
                            : 'bg-red-600/20 text-red-400 border-red-600/30 hover:bg-green-600/20 hover:text-green-400 hover:border-green-600/30'
                        }`}
                      >
                        {s.enabled ? <><ToggleRight size={14} /> ON</> : <><ToggleLeft size={14} /> OFF</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-user override form */}
            <div>
              <h2 className="text-lg font-bold mb-1">Per-User Override</h2>
              <p className="text-xs text-dark-text-muted mb-4">
                Force a specific ad slot ON or OFF for one user. Only applies when global slot is ON.
              </p>
              <div className="space-y-3 bg-dark-card border border-dark-border rounded-lg p-4">
                <input type="text" placeholder="User ID (UUID)" value={overrideUserId}
                  onChange={(e) => setOverrideUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white placeholder-dark-text-muted focus:outline-none focus:border-primary transition-colors text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select value={overrideAdKey} onChange={(e) => setOverrideAdKey(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white focus:outline-none focus:border-primary transition-colors text-sm">
                    <option value="generation_ad">Generation Ad</option>
                    <option value="download_ad">Download Ad</option>
                  </select>
                  <select value={String(overrideEnabled)} onChange={(e) => setOverrideEnabled(e.target.value === 'true')}
                    className="px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white focus:outline-none focus:border-primary transition-colors text-sm">
                    <option value="true">Enabled (ON)</option>
                    <option value="false">Disabled (OFF)</option>
                  </select>
                </div>
                <button onClick={saveUserOverride} disabled={savingOverride}
                  className="w-full py-2 bg-primary hover:bg-primary-light transition-colors text-white font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingOverride && <Loader size={14} className="spinner" />}
                  <User size={14} /> Save Override
                </button>
              </div>
            </div>

            {/* Existing overrides list */}
            <div>
              <h2 className="text-lg font-bold mb-3">Active User Overrides ({adOverrides.length})</h2>
              {adOverrides.length === 0 ? (
                <p className="text-xs text-dark-text-muted">No per-user overrides set.</p>
              ) : (
                <div className="space-y-2">
                  {adOverrides.map(o => (
                    <div key={`${o.user_id}-${o.ad_key}`}
                      className="flex items-center justify-between bg-dark-card border border-dark-border rounded-lg px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-dark-text-muted truncate">{o.user_id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-white font-semibold">
                            {o.ad_key === 'generation_ad' ? '🎨 Generation' : '⬇️ Download'}
                          </span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            o.enabled ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                          }`}>{o.enabled ? 'ON' : 'OFF'}</span>
                        </div>
                      </div>
                      <button onClick={() => deleteOverride(o.user_id, o.ad_key)}
                        className="ml-3 text-red-400 hover:text-red-300 transition-colors" title="Remove override">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
