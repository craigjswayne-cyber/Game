// ---- WHAT THE LAST FEW MATCHES SAY (1.8.4, tactical memory) ----
//
// The full-time card explains one match, and the follow-up holds it against
// the one before (evidence.ts). Neither says what a run of matches is
// turning into: a call that has become a weapon, a lineout that has come
// right, a defence that has started to leak, an opposition that has started
// to wait for the manager's favourite call. This module says that, in a
// sentence each, off the records the save already keeps (state.tacLoop
// .evidence, the newest six of them): computed on read, nothing new saved.
//
// THE CONCLUSIONS. At most two, on the desk's tactics row:
//   attack       a call in the playbook that has scored in three or more of
//                the recent matches (a strength); line breaks made, older
//                half against newer
//   defence      line breaks conceded, and ball lost at the breakdown
//   set piece    own scrum and lineout ball lost, older half against newer
//   adaptation   a call the opposition have started to be set for: blunted
//                (the tape's or a remembered rematch's adapt) on two runs in
//                five or more lately, and clearly more than before
//
// THE RULES. Club matches only (a Test side is another team). At least
// MIN_MATCHES of them, and a minimum count behind each comparison (the
// feeds, the runs). Every threshold fixed, no rng; a conclusion is said
// only past its threshold, ranked by how far past it is, one a kind.
// The numbers go with the words, so the line is a reading, not a mood.
import type { GameState } from './model'
import type { CausalEvidence, EvSide } from './evidence'
import { calledIds, callsOf, sayKey } from './moves'

/** the records read: the newest six (evidence.ts EVIDENCE_CAP) */
export const WINDOW = 6
/** and no conclusion from fewer club matches than this */
export const MIN_MATCHES = 4
/** a call is a strength when it scored in this many of them, and as many tries */
export const STRONG_MATCHES = 3
/** a set-piece trend: own feeds in each half, and the change in the share lost */
export const SET_FEEDS = 10
export const SET_SHIFT = 0.08
/** a count a match (breaks, ball lost): the change, and the least spread
 *  a match it is read against */
export const RATE_SHIFT = 2
export const RATE_SD = 1.5
/** anticipation: runs lately, the share blunted lately, and the rise on before */
export const READ_RUNS = 6
export const READ_SHARE = 0.4
export const READ_RISE = 0.2

export type TacCat = 'attack' | 'defence' | 'setpiece' | 'adapt'

export interface TacNote {
  cat: TacCat
  k: string
  v: Record<string, string | number>
  /** how far past its threshold, 1 at it */
  score: number
}

/** The recent club matches, oldest first. */
export function recentClubMatches(state: GameState): CausalEvidence[] {
  const list = state.tacLoop?.evidence ?? []
  return list.slice(-WINDOW).filter(e => !!state.clubs[e.oppId] && e.oppId !== state.userClubId)
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0)
const variance = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return sum(a.map(x => (x - m) ** 2)) / (a.length - 1)
}

/** A count a match that is bad when high (or good when `good`), older half
 *  against newer: the conclusion when it moved by RATE_SHIFT or more and by
 *  twice its standard error (the spread of the matches themselves, never
 *  read as less than RATE_SD a match, so three matches that happen to agree
 *  do not make a trend). */
function rateNote(cat: TacCat, key: string, older: CausalEvidence[], newer: CausalEvidence[],
  f: (us: EvSide, them: EvSide) => number, good = false): TacNote | null {
  const xo = older.map(r => f(r.side[0], r.side[1])), xn = newer.map(r => f(r.side[0], r.side[1]))
  const a = mean(xo), b = mean(xn)
  const d = b - a
  const sd = Math.max(RATE_SD, Math.sqrt((variance(xo) + variance(xn)) / 2))
  const se = sd * Math.sqrt(1 / xo.length + 1 / xn.length)
  const z = Math.abs(d) / se
  if (Math.abs(d) < RATE_SHIFT || z < 2) return null
  const better = good ? d > 0 : d < 0
  return {
    cat, k: `desk.mem${key}${better ? 'Better' : 'Worse'}`,
    v: { a: Math.round(a), b: Math.round(b) },
    score: Math.min(Math.abs(d) / RATE_SHIFT, z / 2),
  }
}

/** Every conclusion the recent matches support, best first, one a kind. */
export function tacticalNotes(state: GameState): TacNote[] {
  const me = state.clubs[state.userClubId]
  if (!me || state.unemployed) return []
  const recs = recentClubMatches(state)
  if (recs.length < MIN_MATCHES) return []
  const h = Math.floor(recs.length / 2)
  const older = recs.slice(0, h), newer = recs.slice(-h)
  const m = recs.length
  const out: TacNote[] = []
  const called = calledIds(callsOf(state, me))

  // ATTACK: a call that keeps scoring
  for (const id of called) {
    const tries = recs.map(r => r.side[0].calls[id]?.[2] ?? 0)
    const scored = tries.filter(t => t > 0).length
    const n = sum(tries)
    if (scored >= STRONG_MATCHES && n >= STRONG_MATCHES) {
      out.push({ cat: 'attack', k: 'desk.memStrong', v: { move_k: sayKey(id), n, m }, score: n / STRONG_MATCHES })
    }
  }
  const made = rateNote('attack', 'BreaksFor', older, newer, us => us.breaks, true)
  if (made) out.push(made)

  // ADAPTATION: a call they have started to wait for
  for (const id of called) {
    const runs = (rs: CausalEvidence[]) => sum(rs.map(r => r.side[0].calls[id]?.[0] ?? 0))
    const blunt = (rs: CausalEvidence[]) => sum(rs.map(r => r.side[0].calls[id]?.[3] ?? 0))
    const rn = runs(newer)
    if (rn < READ_RUNS) continue
    const now = blunt(newer) / rn
    const ro = runs(older)
    const was = ro ? blunt(older) / ro : 0
    if (now >= READ_SHARE && now - was >= READ_RISE) {
      out.push({ cat: 'adapt', k: 'desk.memRead', v: { move_k: sayKey(id), pct: Math.round(now * 100) }, score: now / READ_SHARE })
    }
  }

  // DEFENCE: line breaks against, ball lost
  const brk = rateNote('defence', 'BreaksAgainst', older, newer, (_, them) => them.breaks)
  if (brk) out.push(brk)
  const lost = rateNote('defence', 'TurnLost', older, newer, us => sum(us.turnLost))
  if (lost) out.push(lost)

  // SET PIECE: own ball lost, scrum and lineout
  for (const [i, unit] of [[0, 'scrum'], [1, 'lineout']] as const) {
    const feeds = (rs: CausalEvidence[]) => sum(rs.map(r => r.side[0].setWon[i] + r.side[0].setLost[i]))
    const lostOf = (rs: CausalEvidence[]) => sum(rs.map(r => r.side[0].setLost[i]))
    const fo = feeds(older), fn = feeds(newer)
    if (fo < SET_FEEDS || fn < SET_FEEDS) continue
    const a = lostOf(older) / fo, b = lostOf(newer) / fn
    if (Math.abs(b - a) < SET_SHIFT) continue
    out.push({
      cat: 'setpiece', k: b < a ? 'desk.memSetBetter' : 'desk.memSetWorse',
      v: { unit_k: `oppreport.u_${unit}`, a: Math.round(a * 100), b: Math.round(b * 100), m },
      score: Math.abs(b - a) / SET_SHIFT,
    })
  }

  // best first, one a kind (a stable order for a tie)
  const best = new Map<TacCat, TacNote>()
  for (const n of out) {
    const was = best.get(n.cat)
    if (!was || n.score > was.score) best.set(n.cat, n)
  }
  return [...best.values()].sort((a, b) => b.score - a.score)
}

/** The conclusions the desk shows: at most two. */
export const tacticalMemory = (state: GameState, n = 2): TacNote[] => tacticalNotes(state).slice(0, n)
