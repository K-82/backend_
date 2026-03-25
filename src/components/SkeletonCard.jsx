import { useEffect, useRef } from 'react'

export function SkeletonCard() {
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    let opacity = 0.3
    let increasing = true

    const interval = setInterval(() => {
      if (increasing) {
        opacity += 0.05
        if (opacity >= 1) increasing = false
      } else {
        opacity -= 0.05
        if (opacity <= 0.3) increasing = true
      }
      element.style.opacity = opacity
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <div 
      ref={elementRef}
      className="bg-gray-800 rounded-lg overflow-hidden m-1.5 flex-1 min-w-[calc(50%-12px)]"
      style={{ opacity: 0.3 }}
    >
      <div className="w-full h-32 bg-gray-700"></div>
      <div className="h-3 bg-gray-700 rounded m-2.5 mb-1"></div>
      <div className="h-3 bg-gray-700 rounded m-2.5 w-3/5"></div>
    </div>
  )
}
