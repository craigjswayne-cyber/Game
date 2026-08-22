/**
 * ---- WHAT THE CAREER LEAVES BEHIND ----
 *
 * Playbook wave 5, the last of them, and the three things it adds are the three
 * ways a long save accumulates meaning that a short one cannot.
 *
 *   THE RECORD BOOK. Marks to beat: the biggest win of your era, the heaviest
 *   defeat, the longest unbeaten run, the record signing. A number you own is
 *   a number you can be asked to beat, which is what turns season nine into
 *   something other than season eight again.
 *
 *   THE PROTEGES. The men you made who are somebody else's now. A manager
 *   remembers the boy he promoted at nineteen long after he has been sold, and
 *   until now the game forgot him the moment the fee cleared.
 *
 *   THE NEMESIS. Not this week's rival - the club that has your number across
 *   the whole career, chosen by the record rather than by reputation, so it is
 *   earned by what actually happened to you.
 *
 * TWO OF THE THREE ARE PURE LENSES over state that already exists (vsBook for
 * the nemesis, the homegrown flag for the proteges), which is why this wave
 * costs almost nothing to carry: nothing to migrate, nothing to keep in sync,
 * and an old save gets its whole history for free the moment it loads. Only the
 * record book needs writing down, because a season's fixtures are wiped every
 * summer and the biggest win of your era is not recoverable afterwards.
 *
 * The engine reads none of it.
 */
import type { GameState, Player } from './model'

export interface RecordBook {
  biggestWin?: { oppId: string; us: number; them: number; season: number }
  worstLoss?: { oppId: string; us: number; them: number; season: number }
  longestUnbeaten?: { n: number; season: number }
  recordSigning?: { playerId: number; fee: number; season: number }
}

/**
 * Offer a result to the book. Called at full time for the user's matches.
 *
 * Returns the headline if a mark fell, so the caller can put it in the news -
 * a record nobody is told about is a record nobody is chasing.
 */
export function offerResult(
  state: GameState, oppId: string, us: number, them: number,
): string | null {
  const r = (state.era ??= {})
  const margin = us - them
  if (margin > 0) {
    const prev = r.biggestWin
    if (!prev || margin > prev.us - prev.them) {
      r.biggestWin = { oppId, us, them, season: state.season }
      if (prev) return `A club record win under you: ${us}-${them}, beating ${prev.us}-${prev.them}.`
    }
  } else if (margin < 0) {
    const prev = r.worstLoss
    if (!prev || margin < prev.us - prev.them) {
      r.worstLoss = { oppId, us, them, season: state.season }
    }
  }
  return null
}

/** Offer an unbeaten run to the book. */
export function offerRun(state: GameState, n: number): void {
  const r = (state.era ??= {})
  if (!r.longestUnbeaten || n > r.longestUnbeaten.n) r.longestUnbeaten = { n, season: state.season }
}

/** Offer a fee to the book. */
export function offerSigning(state: GameState, playerId: number, fee: number): void {
  const r = (state.era ??= {})
  if (!r.recordSigning || fee > r.recordSigning.fee) {
    r.recordSigning = { playerId, fee, season: state.season }
  }
}

/**
 * The men you made who play for somebody else now. A PURE LENS.
 *
 * homegrown is set once at academy promotion and never cleared (rollover.ts),
 * so this is simply everyone carrying it who has moved on and is still playing.
 */
export function proteges(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.homegrown && p.clubId && p.clubId !== state.userClubId && p.stats.apps > 0)
    .sort((a, b) => b.ca - a.ca)
}

/** One line about how the ones that got away are doing. Null when there are none. */
export function protegeLine(state: GameState): string | null {
  const list = proteges(state)
  if (!list.length) return null
  const best = list[0]
  const club = state.clubs[best.clubId!]
  const intl = list.filter(p => p.intl).length
  return `${list.length} of your graduates are playing elsewhere` +
    `${club ? `, the best of them ${best.name} at ${club.short}` : ''}` +
    `${intl ? ` - ${intl} of them capped` : ''}.`
}

export interface Nemesis {
  clubId: string
  played: number
  w: number
  d: number
  l: number
  line: string
}

/**
 * The club that has your number. A PURE LENS over the manager's own book.
 *
 * Chosen by damage done rather than by reputation: enough meetings to mean
 * something, then the worst win rate, then the most losses as the tie-break. A
 * nemesis picked by rep is just "the best team in the league", which everybody
 * already knows and nobody feels.
 */
export function nemesis(state: GameState): Nemesis | null {
  const book = state.vsBook ?? {}
  let best: Nemesis | null = null
  for (const [clubId, rec] of Object.entries(book)) {
    const played = rec.w + rec.d + rec.l
    if (played < 4 || !state.clubs[clubId]) continue
    const rate = rec.w / played
    if (!best || rate < best.w / best.played || (rate === best.w / best.played && rec.l > best.l)) {
      best = { clubId, played, w: rec.w, d: rec.d, l: rec.l, line: '' }
    }
  }
  if (!best || best.w >= best.l) return null // nobody owns you
  const club = state.clubs[best.clubId]
  best.line = `${club?.short ?? best.clubId}: ${best.w}W ${best.d}D ${best.l}L in ${best.played}. ` +
    (best.w === 0
      ? 'You have never beaten them.'
      : 'They have had the better of this for years.')
  return best
}
