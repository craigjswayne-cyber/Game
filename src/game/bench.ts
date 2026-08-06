// The bench economy (F4).
//
// A modern 23 is an argument, not a formality. Six forwards and two backs is a
// bomb squad: you win the last twenty minutes through the middle, and you accept
// that a centre limping off at 62 minutes leaves a flanker in the 13 shirt.
// Four and four is the opposite bargain. Five and three is what everybody does
// because it upsets nobody.
//
// The game had none of this. The bench was a fixed 16-23 with fixed positions,
// eight men who existed to replace tired ones, and the only decision was who
// sat in the seats. So two things are added here:
//
//   The SPLIT reshapes the seats and reshapes the last quarter. It only pays if
//   you actually empty the bench, which is what makes it an economy rather than
//   a slider.
//
//   The BRIEF is what you say to a man as he pulls his shirt on. A finisher sent
//   on to go through them is doing a different job from one sent on to shut the
//   door, and the side plays differently for the twenty minutes he is out there.
//
// Balance note, learned the hard way twice: the default has to be exactly
// neutral and the two alternatives have to be near mirror images, or a new dial
// quietly taxes or subsidises the entire world.

import type { Club, GameState, Player, Pos } from './model'
import { effAt } from './attributes'

export type BenchSplit = '5-3' | '6-2' | '4-4'

export interface BenchSeat { shirt: number; pos: Pos[] }

export interface SplitDef {
  id: BenchSplit
  name: string
  desc: string
  seats: BenchSeat[]
  /** late-quarter reshape, applied once the bench is genuinely on */
  scrum: number
  breakdown: number
  defence: number
  attack: number
}

/** The orthodox bench, and the two arguments against it.
 *
 *  The dials are mirror images on purpose. 6-2 buys set piece and defence and
 *  pays in attacking shape; 4-4 buys shape and pays in set piece. Neither is
 *  free, and across a world that picks both the mean does not move. */
export const SPLITS: SplitDef[] = [
  {
    id: '5-3', name: 'Five and Three',
    desc: 'The orthodox bench. Cover everywhere, a weapon nowhere.',
    seats: [
      { shirt: 16, pos: ['HK'] },
      { shirt: 17, pos: ['LP', 'TP'] },
      { shirt: 18, pos: ['TP', 'LP'] },
      { shirt: 19, pos: ['LK', 'FL'] },
      { shirt: 20, pos: ['FL', 'N8', 'LK'] },
      { shirt: 21, pos: ['SH'] },
      { shirt: 22, pos: ['FH', 'CE'] },
      { shirt: 23, pos: ['CE', 'WG', 'FB', 'FH'] },
    ],
    scrum: 1, breakdown: 1, defence: 1, attack: 1,
  },
  {
    id: '6-2', name: 'Six and Two',
    desc: 'The bomb squad. You win the last twenty up front, and one back injury leaves a forward in the backline.',
    seats: [
      { shirt: 16, pos: ['HK'] },
      { shirt: 17, pos: ['LP', 'TP'] },
      { shirt: 18, pos: ['TP', 'LP'] },
      { shirt: 19, pos: ['LK', 'FL'] },
      { shirt: 20, pos: ['FL', 'N8', 'LK'] },
      { shirt: 21, pos: ['N8', 'FL', 'LK'] },
      { shirt: 22, pos: ['SH'] },
      { shirt: 23, pos: ['FH', 'CE'] },
    ],
    scrum: 1.04, breakdown: 1.02, defence: 1.01, attack: 0.965,
  },
  {
    id: '4-4', name: 'Four and Four',
    desc: 'Width and insurance. Fresh legs out wide and cover for every back, at the cost of the shove.',
    seats: [
      { shirt: 16, pos: ['HK'] },
      { shirt: 17, pos: ['LP', 'TP'] },
      { shirt: 18, pos: ['TP', 'LP'] },
      { shirt: 19, pos: ['LK', 'FL', 'N8'] },
      { shirt: 20, pos: ['SH'] },
      { shirt: 21, pos: ['FH', 'CE'] },
      { shirt: 22, pos: ['CE', 'WG'] },
      { shirt: 23, pos: ['WG', 'FB'] },
    ],
    scrum: 0.97, breakdown: 0.985, defence: 0.99, attack: 1.03,
  },
]

export const SPLIT_BY_ID: Record<string, SplitDef> =
  Object.fromEntries(SPLITS.map(s => [s.id, s]))

export const DEFAULT_SPLIT: BenchSplit = '5-3'

/** Which bench a club names when nobody has told it otherwise.
 *
 *  The first cut read this off tactic.style, which looked right and did nothing:
 *  every AI club in the game sits on style 50 and nothing ever moves it, so all
 *  101 clubs picked 5-3 and the whole mechanic existed only for the user. A dial
 *  the world never turns is a dial you cannot balance.
 *
 *  So it comes off the club id instead: a stable conviction each side keeps, in
 *  roughly the proportions the real game shows - most sides orthodox, a decent
 *  minority loading the bench with forwards, a few backing their width. Batch
 *  seven (coaching philosophies) is where this should eventually come from. */
export function splitFor(club: Club | undefined): BenchSplit {
  if (!club) return DEFAULT_SPLIT
  if (club.tactic.bench) return club.tactic.bench
  let h = 2166136261
  for (let i = 0; i < club.id.length; i++) {
    h ^= club.id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const r = (h >>> 0) % 100
  if (r < 25) return '6-2'
  if (r < 40) return '4-4'
  return DEFAULT_SPLIT
}

export function seatsFor(split: BenchSplit | undefined): BenchSeat[] {
  return (split && SPLIT_BY_ID[split] ? SPLIT_BY_ID[split] : SPLIT_BY_ID[DEFAULT_SPLIT]).seats
}

/** The eight seats a club's bench actually has this week. */
export function benchSeats(club: Club | undefined): BenchSeat[] {
  return seatsFor(splitFor(club))
}

const FORWARDS = new Set<Pos>(['LP', 'HK', 'TP', 'LK', 'FL', 'N8'])
export const isForward = (pos: Pos) => FORWARDS.has(pos)

/** Re-seat the bench after a change of split.
 *
 *  Without this, choosing a six-two left a scrum-half sitting in a flanker's
 *  seat and the whole decision was cosmetic: the seats changed shape and the men
 *  in them did not. The XV is left exactly as the manager picked it - only the
 *  eight replacements are re-chosen, best natural cover first, the same
 *  discipline the auto-pick uses. */
export function refillBench(state: GameState, club: Club) {
  const lineup = club.tactic.lineup
  const seats = benchSeats(club)
  const used = new Set<number>()
  for (let i = 0; i < 15; i++) { const id = lineup[i]; if (id != null) used.add(id) }
  const pool = club.players
    .map(id => state.players[id])
    .filter(p => p && !used.has(p.id) && !p.injury && !p.onLoan && p.bans === 0 && !p.natSquad)
  const score = (p: Player, pos: Pos) => effAt(p, pos) * (0.7 + 0.3 * (p.cond / 100))
  const pairs: { seat: number; p: Player; s: number }[] = []
  seats.forEach((seat, i) => {
    for (const p of pool) {
      if (seat.pos.includes(p.pos) || p.alt.some(a => seat.pos.includes(a))) {
        pairs.push({ seat: i, p, s: score(p, seat.pos[0]) })
      }
    }
  })
  pairs.sort((a, b) => b.s - a.s)
  const filled = new Array(8).fill(null) as (number | null)[]
  for (const { seat, p } of pairs) {
    if (filled[seat] != null || used.has(p.id)) continue
    filled[seat] = p.id
    used.add(p.id)
  }
  // any seat nobody natural can fill goes to the best man left standing
  seats.forEach((seat, i) => {
    if (filled[i] != null) return
    let best: Player | null = null
    let bestS = -1
    for (const p of pool) {
      if (used.has(p.id)) continue
      const v = score(p, seat.pos[0])
      if (v > bestS) { bestS = v; best = p }
    }
    if (best) { filled[i] = best.id; used.add(best.id) }
  })
  for (let i = 0; i < 8; i++) lineup[15 + i] = filled[i]
}

// ---------------------------------------------------------------------------
// Finisher briefs
// ---------------------------------------------------------------------------

export type Brief = 'orders' | 'impact' | 'shore' | 'manage'

export interface BriefDef {
  id: Brief
  name: string
  /** what you actually say to him */
  desc: string
  icon: string
}

export const BRIEFS: BriefDef[] = [
  { id: 'orders', name: 'Follow the shirt', icon: '👕', desc: 'Do the job the man you replaced was doing. No change of plan.' },
  { id: 'impact', name: 'Go through them', icon: '💥', desc: 'Twenty minutes flat out. More carry, less cover, and he will be empty at the end.' },
  { id: 'shore', name: 'Shut the door', icon: '🛡', desc: 'Tackles, discipline, no risks. The lead is the only thing that matters.' },
  { id: 'manage', name: 'Play the corners', icon: '🎯', desc: 'Kick the clock away and keep it in their half. Nothing fancy.' },
]

export const BRIEF_BY_ID: Record<string, BriefDef> =
  Object.fromEntries(BRIEFS.map(b => [b.id, b]))

export const DEFAULT_BRIEF: Brief = 'orders'

/** The brief for a bench seat. Unset seats simply follow the shirt. */
export function briefForSeat(club: Club | undefined, seat: number): Brief {
  const b = club?.tactic.briefs?.[seat]
  return b && BRIEF_BY_ID[b] ? (b as Brief) : DEFAULT_BRIEF
}
