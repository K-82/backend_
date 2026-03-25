import { useState } from 'react'
import { api } from '../services/api'
import { Zap, Loader, Image as ImageIcon, Monitor, Phone, Pencil, Upload } from 'lucide-react'
import { PropellerAd } from '../components/PropellerAd.jsx'
import { useAdSettings } from '../hooks/useAdSettings.js'

export function GenerateScreen({ navigation }) {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('IMAGE')
  const [ratio, setRatio] = useState('LANDSCAPE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputImageUrl, setInputImageUrl] = useState('')
  const [showAd, setShowAd] = useState(false)
  const { adSettings } = useAdSettings()

  async function handleSubmit() {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    if (mode === 'IMAGE_EDIT' && !inputImageUrl.trim()) {
      setError('Please provide a source image URL or upload an image')
      return
    }

    setLoading(true)
    setError('')
    try {
      const body = { prompt: prompt.trim(), mode, ratio }
      if (mode === 'IMAGE_EDIT') {
        body.input_image_url = inputImageUrl.trim()
      }
      await api.createPrompt(body)
      // Show generation ad if enabled for this user
      if (adSettings.generation_ad) setShowAd(true)
      setPrompt('')
      setInputImageUrl('')
      alert('✓ Queued! Your prompt has been added to the queue.')
      navigation.navigate('Dashboard')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be less than 8MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setInputImageUrl(event.target.result)
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col h-full bg-dark-bg font-sans overflow-y-auto">
      {/* Propeller Ad — fires once after successful generation */}
      <PropellerAd show={showAd} />
      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <div className="animate-slide-up">
          <h1 className="text-4xl font-bold font-display text-gradient mb-2 drop-shadow-sm">Create</h1>
          <p className="text-dark-text-muted text-base mb-8 font-medium">Bring your imagination to life.</p>
        </div>

        <div className="relative group animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <textarea
            placeholder={mode === 'IMAGE_EDIT'
              ? "Describe what to change, e.g. 'make the background blue'..."
              : "A futuristic city at sunset, neon lights reflecting on rain-soaked streets..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={500}
            className="relative w-full px-5 py-4 rounded-2xl bg-[#08080C]/80 backdrop-blur-xl border border-white/10 text-white placeholder-dark-text-muted focus:outline-none focus:border-primary/50 transition-all resize-none h-36 mb-8 text-lg shadow-inner"
          />
        </div>

        {/* Mode Toggle */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <label className="text-xs text-dark-text-muted uppercase font-bold tracking-widest mb-3 block">Generation Type</label>
          <div className="grid grid-cols-3 gap-3 p-1 glass-panel rounded-2xl">
            {[
              { id: 'IMAGE', label: 'Image', icon: ImageIcon },
              { id: 'VIDEO', label: 'Video', icon: Zap },
              { id: 'IMAGE_EDIT', label: 'Edit', icon: Pencil }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all duration-300 ${mode === m.id
                  ? 'bg-primary/20 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)] border border-primary/30'
                  : 'bg-transparent text-dark-text hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
              >
                <m.icon size={18} className={mode === m.id ? 'text-primary-light' : ''} />
                <span className="text-sm">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Image URL Input — only for IMAGE_EDIT */}
        {mode === 'IMAGE_EDIT' && (
          <div className="mb-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <label className="text-xs text-dark-text-muted uppercase font-bold tracking-widest mb-3 block">Source Image</label>
            <div className="flex gap-2 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
              <div className="relative flex w-full gap-2">
                <input
                  type="text"
                  placeholder="Paste URL or upload"
                  value={inputImageUrl.startsWith('data:image') ? '[Local Image Uploaded]' : inputImageUrl}
                  onChange={(e) => {
                    if (inputImageUrl.startsWith('data:image')) setInputImageUrl('')
                    else setInputImageUrl(e.target.value)
                  }}
                  className={`flex-1 px-5 py-3.5 rounded-2xl glass-panel text-white placeholder-dark-text-muted focus:outline-none focus:border-primary/50 transition-all ${inputImageUrl.startsWith('data:image') ? 'border-primary/50 text-primary-light bg-primary/5' : ''
                    }`}
                />
                <label className="flex items-center justify-center px-4 glass-panel glass-panel-hover rounded-2xl cursor-pointer text-dark-text-muted hover:text-white transition-all shadow-lg" title="Upload Image">
                  <Upload size={22} />
                  <input
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                {inputImageUrl && (
                  <button
                    onClick={() => setInputImageUrl('')}
                    className="flex items-center justify-center px-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-colors text-red-400"
                    title="Clear Image"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {inputImageUrl.startsWith('data:image') && (
              <p className="text-xs text-primary-light mt-3 ml-2 flex items-center gap-1"><Check size={14}/> Image loaded and ready</p>
            )}
          </div>
        )}

        {/* Ratio Toggle */}
        <div className="mb-10 animate-slide-up" style={{ animationDelay: '250ms' }}>
          <label className="text-xs text-dark-text-muted uppercase font-bold tracking-widest mb-3 block">Aspect Ratio</label>
          <div className="grid grid-cols-2 gap-3 p-1 glass-panel rounded-2xl">
            {[{ id: 'LANDSCAPE', label: 'Landscape 16:9', icon: Monitor },
            { id: 'PORTRAIT', label: 'Portrait 9:16', icon: Phone }].map(r => (
              <button
                key={r.id}
                onClick={() => setRatio(r.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all duration-300 border ${ratio === r.id
                  ? 'bg-primary/20 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)] border-primary/30'
                  : 'bg-transparent text-dark-text hover:text-white hover:bg-white/5 border-transparent'
                  }`}
              >
                <r.icon size={18} className={ratio === r.id ? 'text-primary-light' : ''} />
                <span className="text-sm">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-6 animate-fade-in flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="animate-slide-up pb-8" style={{ animationDelay: '300ms' }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="group relative w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all overflow-hidden"
          >
            {/* Button Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-500 group-hover:from-primary-light group-hover:to-blue-400 transition-colors"></div>
            
            {/* Button Glow Component */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity"></div>

            <div className="relative flex items-center justify-center gap-2">
              {loading ? (
                <Loader size={22} className="spinner" />
              ) : (
                <Zap size={22} className="group-hover:scale-110 transition-transform" />
              )}
              {mode === 'IMAGE_EDIT' ? 'Transform Image' : 'Generate Now'}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
