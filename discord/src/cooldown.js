// ONE BUG REPORT PER MEMBER EVERY TWO MINUTES. /bug opens a forum post for
// anyone in the server; nothing stopped one member opening a hundred. The
// window is long enough to stop a flood and short enough that a second real
// bug found straight after the first is not turned away for long. Kept in
// memory: a restart forgets it, which costs nothing.
export const BUG_COOLDOWN_MS = 2 * 60 * 1000
const last = new Map()

/** Milliseconds this member still has to wait, or 0 when they may report. */
export function bugWait(userId, now = Date.now()) {
  const at = last.get(userId)
  return at == null ? 0 : Math.max(0, at + BUG_COOLDOWN_MS - now)
}

/** Note a report that was filed. */
export function noteBug(userId, now = Date.now()) {
  last.set(userId, now)
  // the map only ever needs the last window's reporters
  if (last.size > 5000) for (const [id, t] of last) if (now - t > BUG_COOLDOWN_MS) last.delete(id)
}

export const bugWaitText = ms => `You have just sent a report. You can send another in ${Math.ceil(ms / 1000)} seconds.`
