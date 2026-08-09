// Getting the game onto the home screen, which on an iPhone is a save-durability
// feature rather than a convenience.
//
// WebKit caps script-writable storage - IndexedDB included - for a site that has
// not been used for about a week. A career lives in IndexedDB. So a manager who
// plays on Safari, goes on holiday and comes back can find the save gone, having
// done nothing wrong and with nothing on screen ever having warned them. A web
// app added to the home screen is exempt from the cap, which makes "add to home
// screen" the difference between a career surviving a fortnight away and not.
//
// Two completely different mechanisms:
//
//   Chrome and Samsung Internet fire beforeinstallprompt, which can be held and
//   replayed from a button. One tap, done.
//
//   iOS Safari has no such event and never will. The only route is Share then
//   Add to Home Screen, done by hand, which means the honest thing to build is
//   instructions rather than a button that cannot work.

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPrompt | null = null
/** Bumped on capture so a mounted cue re-renders once the button becomes real. */
let seq = 0
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  // index.html holds the event on window, because the browser can fire it before
  // this module has evaluated and the event cannot be replayed. Read whatever is
  // already there, then keep listening for both the real event and the handover.
  const held = () => {
    const w = window as Window & { __fabInstall?: InstallPrompt }
    if (!w.__fabInstall || deferred === w.__fabInstall) return
    deferred = w.__fabInstall
    seq++
    for (const fn of listeners) fn()
  }
  held()
  window.addEventListener('fab-install', held)
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e as InstallPrompt
    seq++
    for (const fn of listeners) fn()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    seq++
    for (const fn of listeners) fn()
  })
}

/** Subscribe to install-availability changes. Returns an unsubscribe. */
export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function installSeq(): number { return seq }

/** Already installed: launched from the home screen, so storage is safe. */
export function standalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches === true
    || nav.standalone === true
}

/**
 * An iOS browser, including iPadOS, which reports itself as a Mac.
 *
 * Every browser on iOS is WebKit underneath - Chrome and Firefox included - so
 * the storage cap and the manual Add to Home Screen route apply to all of them.
 */
export function ios(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
}

/** A one-tap install is available right now. */
export function canInstall(): boolean { return deferred !== null }

/** Fire the held prompt. Resolves true if they accepted. */
export async function install(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    if (outcome === 'accepted') { deferred = null; seq++ }
    return outcome === 'accepted'
  } catch { return false }
}

const KEY = 'rm-install-cue'

/**
 * Waved away. Stored as a date rather than a flag: this is a warning about
 * losing a career, so it comes back after a couple of months rather than being
 * silenced for good by one impatient tap.
 */
export function cueHidden(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0)
    return at > 0 && Date.now() - at < 60 * 86400000
  } catch { return false }
}

export function hideCue(): void {
  try { localStorage.setItem(KEY, String(Date.now())) } catch { /* private mode */ }
}

/** Should the Home cue be on screen at all? */
export function showInstallCue(): boolean {
  if (standalone() || cueHidden()) return false
  return ios() || canInstall()
}
