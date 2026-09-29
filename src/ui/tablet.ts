import { useEffect, useState } from 'react'

/** TABLET MODE (1.8.0): see useTextScale in App.tsx for what it changes.
 *  Lives on its own so MatchDay can ask without importing App. */
//
// 1.8.1: a tablet held upright no longer has to PROVE it is a touch screen.
// The 1.8.0 rule asked for a coarse pointer as well, and an upright tablet
// that reported a fine one (a keyboard case with a trackpad, a stylus as the
// primary pointer, a browser emulating the size without touch) fell back to
// the 560px phone column with dark bars either side, which is exactly what
// the QA pass and the manual still saw. Upright and at least 700px across
// is a tablet whatever it points with: no phone is that wide, and a desktop
// window only gets there by being stood on its end, where the wide layout is
// the better one anyway. On its side the coarse pointer is still required,
// so a landscape desktop browser and a phone on its side are untouched.
export const TABLET_Q = '(pointer: coarse) and (min-width: 700px) and (min-height: 700px), (orientation: portrait) and (min-width: 700px) and (min-height: 700px)'
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
