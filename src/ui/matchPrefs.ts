/**
 * ---- WHAT THE MATCH VIEW SHOWS (1.8.1) ----
 *
 * The switches in Match Settings, the FM26 layout the owner picked out ("I
 * like the toggle on/off option"). Remembered on this device like the camera
 * and the sound, and all on by default: they are the depth, and a manager who
 * wants the plain pitch turns them off.
 *
 *   overlays   the gainline and offside lines at a breakdown, and the contest
 *              bar at a scrum, lineout or maul
 *   stamina    a ring under every man showing his condition, while play is
 *              stopped
 *   bigText    the commentary at the size FM Mobile sets it (owner: "The size
 *              of the text in fm stands out")
 *   replays    after a try, the lines that led to it again, slower (1.8.0)
 */
export type MatchPrefs = { overlays: boolean; stamina: boolean; bigText: boolean; replays: boolean }
const KEY = 'phase.matchPrefs'
const DEFAULTS: MatchPrefs = { overlays: true, stamina: true, bigText: true, replays: true }

export function readMatchPrefs(): MatchPrefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { ...DEFAULTS } }
}
export function writeMatchPrefs(p: MatchPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode */ }
}
