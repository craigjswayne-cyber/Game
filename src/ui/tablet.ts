import { useEffect, useState } from 'react'

/** TABLET MODE (1.8.0): see useTextScale in App.tsx for what it changes.
 *  Lives on its own so MatchDay can ask without importing App. */
export const TABLET_Q = '(pointer: coarse) and (min-width: 700px) and (min-height: 700px)'
// read through matchMedia rather than innerWidth: a media query measures the
// viewport, never the zoom this very function is about to set
export const bigTablet = () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1000px)').matches
export function useTablet(): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(TABLET_Q).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(TABLET_Q)
    if (!mq) return
    const f = () => setOn(mq.matches)
    mq.addEventListener?.('change', f)
    window.addEventListener('resize', f)
    return () => { mq.removeEventListener?.('change', f); window.removeEventListener('resize', f) }
  }, [])
  return on
}
