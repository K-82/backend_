import { useEffect, useRef } from 'react'

/**
 * PropellerAd
 * Injects the Propeller Ads tag script once when mounted.
 * Only renders when `show` is true.
 *
 * Usage:
 *   <PropellerAd show={adSettings.generation_ad} />
 */
export function PropellerAd({ show }) {
  const injected = useRef(false)

  useEffect(() => {
    if (!show) return
    if (injected.current) return
    injected.current = true

    // Replicate the original snippet:
    // (function(s){ s.dataset.zone='10781216', s.src='https://al5sm.com/tag.min.js' })
    //   ([document.documentElement, document.body].filter(Boolean).pop()
    //     .appendChild(document.createElement('script')))
    const container = [document.documentElement, document.body].filter(Boolean).pop()
    const s = document.createElement('script')
    s.dataset.zone = '10781216'
    s.src = 'https://al5sm.com/tag.min.js'
    container.appendChild(s)
  }, [show])

  // This component renders nothing visible — the ad is injected at body level
  return null
}
