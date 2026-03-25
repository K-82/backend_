import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { Download, Share2, AlertCircle, Loader } from 'lucide-react'

export function DetailScreen({ route, navigation }) {
  const { promptId } = route.params
  const [prompt, setPrompt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    loadPrompt()
  }, [promptId])

  async function loadPrompt() {
    try {
      const data = await api.getPrompt(promptId)
      setPrompt(data)
    } catch (e) {
      alert('Error: ' + e.message)
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!prompt?.output_urls?.[0]) return
    setDownloading(true)
    try {
      const url = prompt.output_urls[0]
      const a = document.createElement('a')
      a.href = url
      a.download = `autoflow-${promptId}${url.endsWith('.mp4') ? '.mp4' : '.jpg'}`
      a.click()
    } catch (e) {
      alert('Download failed: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  async function handleShare() {
    if (!prompt?.output_urls?.[0]) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AutoFlow Media',
          text: prompt.prompt,
          url: prompt.output_urls[0]
        })
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(prompt.output_urls[0])
        alert('Link copied to clipboard!')
      }
    } catch (e) {
      console.error('Share failed:', e)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-dark-bg">
        <Loader className="w-8 h-8 text-primary spinner" />
      </div>
    )
  }

  if (!prompt) return null

  const imageUrl = prompt.output_urls?.[0]

  return (
    <div className="flex flex-col h-full bg-dark-bg overflow-y-auto">
      {/* Media Display */}
      <div className="w-full bg-dark-card border-b border-dark-border flex items-center justify-center" style={{ aspectRatio: '1' }}>
        {imageUrl ? (
          prompt.mode === 'VIDEO' ? (
            <video 
              src={imageUrl} 
              className="w-full h-full object-contain"
              autoPlay
              loop
              controls
              playsInline
            />
          ) : (
            <img 
              src={imageUrl} 
              alt={prompt.prompt}
              className="w-full h-full object-contain"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-6xl">🖼️</div>
            <p className="text-dark-text-muted">
              {prompt.status === 'pending' || prompt.status === 'processing'
                ? 'Generating...' 
                : 'No output yet'}
            </p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 space-y-4">
        <div className="bg-dark-card rounded-2xl p-4 border border-dark-border space-y-3">
          <div className="flex justify-between items-center">
            <StatusBadge status={prompt.status} />
            <span className="text-xs text-dark-text-muted">{prompt.mode} · {prompt.ratio}</span>
          </div>
          
          <p className="text-sm text-white leading-relaxed">{prompt.prompt}</p>
          
          <p className="text-xs text-dark-text-muted">
            Created {new Date(prompt.created_at).toLocaleString()}
          </p>

          {prompt.failure_reason && (
            <div className="flex gap-2 bg-red-900/20 border border-red-900 rounded-lg p-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{prompt.failure_reason}</p>
            </div>
          )}
        </div>

        {imageUrl && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-light active:bg-primary-light transition-colors text-white font-semibold rounded-xl disabled:opacity-60"
            >
              {downloading ? <Loader size={18} className="spinner" /> : <Download size={18} />}
              Download
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-700 transition-colors text-white font-semibold rounded-xl"
            >
              <Share2 size={18} />
              Share
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
