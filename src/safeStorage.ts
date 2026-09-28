/**
 * ---- A PAGE WITH NO STORAGE STILL PLAYS (1.8.0) ----
 *
 * Owner, 27 Sep 2026: "Can you make it playable" - the test build published
 * as an Artifact opened on a blank page. An Artifact runs in a sandboxed
 * frame without allow-same-origin, and in such a frame merely READING
 * window.localStorage throws a SecurityError. Forty places in the game read
 * it, several at module load, so the first one took the whole app down before
 * React mounted. Private windows and locked-down browsers do the same.
 *
 * This module is imported first in main.tsx, before anything that might read
 * storage. If storage is usable it does nothing at all. If it is not, it puts
 * an in-memory Storage where localStorage and sessionStorage were, so every
 * setting works for the session and is simply forgotten at the end of it,
 * which is the most a sandbox allows. Saves live in IndexedDB and fail on
 * their own terms (the save banner), never at load.
 */
function usable(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const s = window[name]
    s.setItem('__phase_probe', '1')
    s.removeItem('__phase_probe')
    return true
  } catch {
    return false
  }
}

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear() { m.clear() },
    getItem(k: string) { return m.has(k) ? m.get(k)! : null },
    key(i: number) { return [...m.keys()][i] ?? null },
    removeItem(k: string) { m.delete(k) },
    setItem(k: string, v: string) { m.set(k, String(v)) },
  }
}

if (typeof window !== 'undefined') {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (usable(name)) continue
    try { Object.defineProperty(window, name, { value: memoryStorage(), configurable: true }) } catch { /* nothing else to do */ }
  }
}

export {}
