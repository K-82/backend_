import { StatusBadge } from './StatusBadge'
import { Play, Image as ImageIcon, Check, Trash2, Pin } from 'lucide-react'

export function MediaCard({ item, onPress, onLongPress, isSelected, onPin, onDelete }) {
  const thumbnail = item.output_urls?.[0]
  const isVideo = item.mode === 'VIDEO'
  const isPinned = item.is_pinned

  // Calculate expiration (24h from created_at)
  let expiresText = null
  if (!isPinned && item.status !== 'failed') {
    const createdDate = new Date(item.created_at).getTime()
    const expiresAt = createdDate + 24 * 60 * 60 * 1000
    const hoursLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60)))
    if (hoursLeft > 0) {
      expiresText = `${hoursLeft}h left`
    } else {
      expiresText = 'Expiring soon'
    }
  }

  return (
    <div
      className={`relative w-full h-44 rounded-2xl overflow-hidden transition-all duration-300 ${
        isSelected 
          ? 'border-2 border-primary shadow-[0_0_15px_rgba(124,58,237,0.3)]' 
          : 'border border-dark-border shadow-lg'
      } bg-dark-card group flex flex-col cursor-pointer hover:shadow-2xl hover:-translate-y-1`}
      onClick={onPress}
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress?.()
      }}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-20">
          <div className="relative w-7 h-7 flex items-center justify-center bg-primary rounded-full shadow-lg">
            <Check size={18} className="text-white" />
          </div>
        </div>
      )}

      {/* Action Buttons Overlay (Hidden until hover unless selected/mobile) */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {!isSelected && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); onPin?.(item.id, isPinned) }}
              className={`p-1.5 rounded-full backdrop-blur-md shadow-md transition-colors ${
                isPinned ? 'bg-primary text-white' : 'bg-black/40 text-gray-300 hover:bg-black/60 hover:text-white'
              }`}
              title={isPinned ? 'Unpin snippet' : 'Pin to keep forever'}
            >
              <Pin size={16} className={isPinned ? 'fill-white' : ''} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete?.(item.id) }}
              className="p-1.5 rounded-full bg-black/40 text-red-400 hover:bg-red-500 hover:text-white backdrop-blur-md shadow-md transition-colors"
              title="Delete immediately"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      <div className="w-full h-28 bg-[#0C0C14] relative flex items-center justify-center overflow-hidden">
        {thumbnail ? (
          isVideo ? (
            <video 
              src={thumbnail}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img 
              src={thumbnail} 
              alt={item.prompt} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
            />
          )
        ) : (
          <ImageIcon size={32} className="text-gray-700" />
        )}
        
        {isVideo && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5 shadow-lg border border-white/10">
              <Play size={12} className="text-white fill-white" />
            </div>
          </div>
        )}
        
        {/* Expiration badge */}
        {expiresText && (
          <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-medium text-orange-300 border border-orange-500/20">
            {expiresText}
          </div>
        )}
      </div>
      
      <div className="flex-1 flex flex-col gap-1.5 p-3 overflow-hidden bg-gradient-to-b from-dark-card to-[#0C0C14]">
        <div className="flex justify-between items-start">
          <StatusBadge status={item.status} />
          {isPinned && <Pin size={12} className="text-primary-light fill-primary-light/30" />}
        </div>
        <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed font-medium">{item.prompt}</p>
      </div>
    </div>
  )
}
