/**
 * ---- WHAT THE MATCH VIEW SHOWS ----
 *
 * The choices in Match Settings, in the FM26 layout the owner picked out.
 * Remembered on this device like the sound.
 *
 *   highlights  which moments bring the pitch on screen (owner, 28 Sep 2026:
 *               "show tries properly, then just commentary only"). 'key' is
 *               tries and tries under review; 'extended' adds kicks at goal
 *               and breaks into the opposition 22.
 *   bigText     the commentary at the size FM Mobile sets it (owner: "The size
 *               of the text in fm stands out")
 *   speed       the commentary pace, 0 Slow, 1 Normal, 2 Fast (owner, 1.8.8:
 *               "I selected fast for in game commentary but it doesn't
 *               remember next time I play it"). Normal until one is chosen.
 *
 * The overlay and condition-ring switches belonged to the always-on pitch and
 * went with it.
 */
export type MatchPrefs = { highlights: 'key' | 'extended'; bigText: boolean; speed: 0 | 1 | 2 }
const KEY = 'phase.matchPrefs'
const DEFAULTS: MatchPrefs = { highlights: 'key', bigText: true, speed: 1 }

export function readMatchPrefs(): MatchPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      highlights: raw.highlights === 'extended' ? 'extended' : 'key',
      bigText: typeof raw.bigText === 'boolean' ? raw.bigText : DEFAULTS.bigText,
      speed: raw.speed === 0 || raw.speed === 2 ? raw.speed : DEFAULTS.speed,
    }
  } catch { return { ...DEFAULTS } }
}
export function writeMatchPrefs(p: MatchPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode */ }
}
