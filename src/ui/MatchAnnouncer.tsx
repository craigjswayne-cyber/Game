import { useEffect, useRef, useState } from 'react'
import { eventText, type GameState, type MatchEvent } from '../game/model'
import { teamShort } from '../game/matchEngine'

/** The lines worth interrupting a screen reader for. */
const KEY_TYPES = new Set<MatchEvent['type']>(['TRY', 'YC', 'RC', 'HT', 'FT'])

/**
 * THE MATCH, READ ALOUD AT THE MOMENTS THAT MATTER (WCAG 4.1.3).
 *
 * The commentary feed is aria-live="off" on purpose: it writes a line every
 * second or so, and a screen reader announcing every carry and every ruck
 * would talk over itself for eighty minutes. But off meant a blind manager
 * heard nothing at all, not even a try.
 *
 * This is a second, visually hidden, polite region beside the feed. It speaks
 * only when the score moves or something a manager would look up for happens:
 * a try, a card, half time, full time. The line is the commentary's own,
 * followed by the score. When the ticker jumps (fast forward, Key Moments) it
 * reads the newest of those moments once, not every one it skipped.
 */
export function MatchAnnouncer({ game, shown, homeId, awayId }: {
  game: GameState; shown: MatchEvent[]; homeId: string; awayId: string
}) {
  const [msg, setMsg] = useState('')
  const seen = useRef(shown.length)
  useEffect(() => {
    const from = seen.current
    seen.current = shown.length
    if (shown.length <= from) return
    let pick: MatchEvent | null = null
    for (let i = shown.length - 1; i >= from; i--) {
      const e = shown[i]
      const prev = shown[i - 1]
      const moved = !!prev && (e.homeScore !== prev.homeScore || e.awayScore !== prev.awayScore)
      if (moved || KEY_TYPES.has(e.type)) { pick = e; break }
    }
    if (!pick) return
    const score = `${teamShort(game, homeId)} ${pick.homeScore ?? 0}, ${teamShort(game, awayId)} ${pick.awayScore ?? 0}`
    setMsg(`${pick.min}'. ${eventText(pick)} ${score}`)
  }, [shown.length])
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{msg}</div>
}
