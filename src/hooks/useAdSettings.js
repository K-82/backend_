import { useState, useEffect } from 'react'
import { api } from '../services/api'

const DEFAULT_SETTINGS = {
  generation_ad: false, // safe default — don't show until confirmed
  download_ad: false
}

/**
 * useAdSettings
 * Fetches the effective ad settings for the logged-in user from the backend.
 * Falls back to all-false on error so ads never break the UI.
 *
 * Returns: { adSettings, adLoading }
 */
export function useAdSettings() {
  const [adSettings, setAdSettings] = useState(DEFAULT_SETTINGS)
  const [adLoading, setAdLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getAdSettings()
      .then(data => {
        if (!cancelled) setAdSettings({ ...DEFAULT_SETTINGS, ...data })
      })
      .catch(() => {
        // On error keep defaults (ads off) — don't break the app
      })
      .finally(() => {
        if (!cancelled) setAdLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { adSettings, adLoading }
}
