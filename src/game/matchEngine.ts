import type { Club, Fixture, GameState, MatchEvent, Player, Pos, Weather } from './model'
import { ROLE_FX, rolesForSlot } from './roles'
import { BENCH_SLOTS, CHEM_SLOTS, XV_SLOTS, addGrudge, chemKey, demandCeiling, facLevel, fmtMoney, formGuide, grudgeBetween, inRedZone, oldBoyApps, trustFactor, unbeatenRun } from './model'
import { standing } from './authority'
import { analystShift, archetypeOf, loudestDial, repetitionFatigue } from './oppcoach'
import { updateNatRank } from './natrank'
import { bigMatchTemper, consistency, effAt } from './attributes'
import { nationName, nationNameIn, nationVars } from './nations'
import { derbyName, isDerby } from './rivalries'
import { analystEdge, settleAnalyst } from './analyst'
import { t, tIn } from './i18n'
import { venueEffect } from './venue'
import { clamp, gauss, mulberry32, wpick, type Rng } from './rng'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, ROUTINE_BY_ID, playbookOf, routineEffect } from './playbook'
import {


  SPLIT_BY_ID, actualSplit, briefForSeat, isForward, seatsFor, splitFor,
  type BenchSplit,
} from './bench'

/**
 * How many replacements a side may make in a match.
 *
 * Five was wrong. Union allows a side to use its whole bench: eight replacements
 * from a 23, front-row cover included, and the only real limits are the Law 3
 * front-row rules the engine already models and the fact that a man who comes off
 * cannot come back (except for blood and front-row cover). Reported from live play:
 * "all 8 subs should be able to be used in a match, dont limit it to 5."
 *
 * This is a BALANCE change as well as a rules fix - three more sets of fresh legs
 * in the last quarter is more late scoring - so it is one number, in one place,
 * and simtest is the check on what it does to the game.
 */
export const MAX_SUBS = 8

/** Seasonal weather: wetter and colder through the winter weeks. */
export function rollWeather(week: number, rng: Rng): Weather {
  const winter = week >= 13 && week <= 29
  const r = rng()
  if (winter) {
    if (r < 0.04) return 'Snow'
    if (r < 0.38) return 'Rain'
    if (r < 0.52) return 'Wind'
    return 'Dry'
  }
  if (r < 0.16) return 'Rain'
  if (r < 0.28) return 'Wind'
  return 'Dry'
}

// ------------------------------------------------------------------
// Selection
// ------------------------------------------------------------------

export function availablePlayers(state: GameState, ids: number[], forNation = false): Player[] {
  return ids
    .map(id => state.players[id])
    .filter(p => p && !p.injury && !p.onLoan && p.bans === 0 && (forNation || !p.natSquad))
}

/** The assistant's eye when he names the side for you.
 *
 *  A judgement factor per man, multiplied into autoSelect's score: 1.0 is a
 *  perfect read, and each man is misread by up to the amplitude for the
 *  assistant's level - 12% with nobody hired, down to 2% with a level-3
 *  assistant. Misreads are symmetric around the truth (no thumb on the scale,
 *  just blur), but selection takes the top of a blurred ranking, so the named
 *  side is a little worse than the true best side, and worse more often the
 *  cheaper the man doing the naming. That gap IS the price of not picking the
 *  team yourself.
 *
 *  Deterministic on (seed, season, week, player): the same week always misreads
 *  the same men by the same amount, so the Selection screen, the match and a
 *  reload all show one side - and it draws nothing from the shared match rng,
 *  so a world where the manager picks every week is bit-identical to one where
 *  this function never runs. */
export function assistantJudgement(state: GameState): (p: Player) => number {
  const lvl = Math.min(3, Math.max(0, state.staff?.assistant ?? 0))
  const amp = [0.12, 0.08, 0.05, 0.02][lvl]
  const base = ((Math.abs(state.seed) * 31 + state.season * 53 + state.week * 17) >>> 0)
  return (p: Player) => {
    const r = mulberry32(((base * 97 + p.id * 613) >>> 0) || 1)()
    return 1 + amp * (2 * r - 1)
  }
}

/** Pick the best legal 23 from a pool. Returns array of 23 player ids (or null).
 *
 *  The bench seats depend on the split (F4): a 6-2 wants a sixth forward where a
 *  5-3 wants a third back, so the auto-pick has to know which bench it is
 *  filling or the split would be a label with nothing behind it. */
export function autoSelect(state: GameState, pool: Player[], split?: BenchSplit, judge?: (p: Player) => number): (number | null)[] {
  const BENCH = seatsFor(split)
  // academy players are a second squad - only raided when the seniors run dry
  const seniors = pool.filter(p => !p.acad)
  if (seniors.length >= 23) pool = seniors
  const used = new Set<number>()
  const lineup: (number | null)[] = new Array(23).fill(null)
  // `judge` is a caller's read on each man layered over the true score - the
  // assistant's imperfect eye when he names the side (see assistantJudgement).
  // No judge means the honest ranking, which is what every AI club and the
  // Selection screen's own auto-pick button get.
  const score = (p: Player, pos: Pos) =>
    effAt(p, pos) * (0.7 + 0.3 * (p.cond / 100)) * (0.85 + 0.03 * p.form) * (judge ? judge(p) : 1)

  // phase one: every shirt to a natural first, best men first.
  //
  // This used to be one pass over naturals AND alts together, ranked by score,
  // and that was wrong in a way the user saw immediately: effAt rates an alt at
  // 0.92 of ability, so an 87 scrum-half scores 80 on the wing and outranks a
  // natural 78 winger. He took the 11 shirt, and the 9 shirt - with nobody
  // natural left - fell through to the shoehorn pass and landed on a centre.
  // Northampton lined up with a centre at 9, a winger at 10 and Alex Mitchell
  // at 11. Measured across 909 club XVs, it happened 92 times.
  //
  // A coach does not do that. He picks his scrum-half at 9 and then works out
  // who plays on the wing. Two passes, naturals then alts, and the ordering
  // inside each pass still weighs what a man is worth, so the best available
  // natural gets the shirt when several can wear it.
  const fill = (eligible: (p: Player, pos: Pos) => boolean) => {
    const pairs: { slot: number; p: Player; s: number }[] = []
    for (let i = 0; i < 15; i++) {
      if (lineup[i] != null) continue
      const pos = XV_SLOTS[i].pos
      for (const p of pool) {
        if (!used.has(p.id) && eligible(p, pos)) pairs.push({ slot: i, p, s: score(p, pos) })
      }
    }
    pairs.sort((a, b) => b.s - a.s)
    for (const { slot, p } of pairs) {
      if (lineup[slot] != null || used.has(p.id)) continue
      lineup[slot] = p.id
      used.add(p.id)
    }
  }
  fill((p, pos) => p.pos === pos)
  fill((p, pos) => p.alt.includes(pos))
  // phase two: any shirt nobody natural can wear goes to the best shoehorn
  for (let i = 0; i < 15; i++) {
    if (lineup[i] != null) continue
    const pos = XV_SLOTS[i].pos
    let best: Player | null = null
    let bestS = -1
    for (const p of pool) {
      if (used.has(p.id)) continue
      const s = score(p, pos)
      if (s > bestS) { bestS = s; best = p }
    }
    if (best) { lineup[i] = best.id; used.add(best.id) }
  }
  // bench: same discipline as the XV - real cover first (a bench slot is a
  // promise about who can come on where), shoehorn only into empty seats
  {
    const pairs: { b: number; p: Player; s: number }[] = []
    for (let b = 0; b < 8; b++) {
      const slots = BENCH[b].pos
      for (const p of pool) {
        if (slots.includes(p.pos) || p.alt.some(a => slots.includes(a))) {
          pairs.push({ b, p, s: score(p, slots[0]) })
        }
      }
    }
    pairs.sort((a, b) => b.s - a.s)
    for (const { b, p } of pairs) {
      if (lineup[15 + b] != null || used.has(p.id)) continue
      lineup[15 + b] = p.id
      used.add(p.id)
    }
  }
  for (let b = 0; b < 8; b++) {
    if (lineup[15 + b] != null) continue
    const slots = BENCH[b].pos
    let best: Player | null = null
    let bestS = -1
    for (const p of pool) {
      if (used.has(p.id)) continue
      const s = score(p, slots[0]) * (slots.includes(p.pos) ? 1.1 : 1)
      if (s > bestS) { bestS = s; best = p }
    }
    if (best) { lineup[15 + b] = best.id; used.add(best.id) }
  }
  return lineup
}

/**
 * Repair a team sheet without replacing it.
 *
 * ---- the bug this exists to kill ----
 *
 * Reported from live play, in two messages: "I'm not sure if you make changes to
 * the match day 23 it's actually putting those players on the pitch", and "just
 * made a load of changes in a match and there's players I can sub in and out that
 * weren't selected".
 *
 * A stored sheet was judged valid or invalid as a whole, and an invalid one was
 * answered by calling autoSelect from scratch. So ONE unavailable man - a Test
 * call-up, a hamstring on the Thursday - threw away the entire twenty-three.
 * Measured before this function existed: losing one man left only 13 to 16 of the
 * other 22 in the shirts their manager gave them, dropped a selected man out of
 * the squad altogether, and brought in one or two nobody had picked. That is
 * exactly the two reports, and it had nothing to do with substitutions.
 *
 * A repair should cost one shirt. Every named man who can play keeps the number
 * he was given; only the slots whose occupant cannot play are filled, and they
 * are filled with the same naturals-first discipline the auto-pick uses, drawn
 * from the men not already named.
 */
export function repairSheet(
  state: GameState,
  club: Club,
  lu: (number | null)[],
  split?: BenchSplit,
): (number | null)[] {
  const canPlay = (id: number) => {
    const p = state.players[id]
    return !!p && !p.injury && !p.onLoan && p.bans === 0 && !p.natSquad && p.clubId === club.id
  }
  const out: (number | null)[] = new Array(23).fill(null)
  const used = new Set<number>()
  for (let i = 0; i < 23; i++) {
    const id = lu?.[i]
    if (id != null && !used.has(id) && canPlay(id)) { out[i] = id; used.add(id) }
  }
  const holes = out.some(x => x == null)
  if (!holes) return out

  // the auto-pick's own answer for the shirts still empty, chosen only from the
  // men the manager did not name, so filling a hole cannot displace anybody
  const rest = availablePlayers(state, club.players.filter(id => !used.has(id)), false)
  const filler = autoSelect(state, rest, split)
  for (let i = 0; i < 23; i++) {
    if (out[i] != null) continue
    const cand = filler[i]
    if (cand != null && !used.has(cand)) { out[i] = cand; used.add(cand); continue }
    // last resort: the best free man in the building, so no shirt goes empty
    const pos = i < 15 ? XV_SLOTS[i].pos : null
    let best: Player | null = null
    let bestS = -1
    for (const p of rest) {
      if (used.has(p.id)) continue
      const s = pos ? effAt(p, pos) : p.ca
      if (s > bestS) { bestS = s; best = p }
    }
    if (best) { out[i] = best.id; used.add(best.id) }
  }
  return out
}

export interface Units {
  scrum: number; lineout: number; breakdown: number
  attack: number; defence: number; kicking: number
  goal: number; overall: number
  kickerId: number | null
}

const avg = (ns: number[]) => ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 8

export function teamUnits(state: GameState, lineup: (number | null)[], day?: { fxId: number; big: boolean }): Units {
  const xv = lineup.slice(0, 15).map(id => (id != null ? state.players[id] : null))
  const P = (i: number) => xv[i]
  // THE MATCH-DAY WOBBLE (25D-2). With `day` set - only ever by the live sim,
  // never by a preview, which is the fog of war - each man gets one hidden
  // multiplier for THIS fixture: zero-mean noise whose width is his hidden
  // consistency, plus a big-match temperament shift on finals and derbies.
  // Keyed on (seed, fixture, player) like ratingJitter, so a replayed or
  // resumed match gets identical numbers and no rng draw is spent.
  const dayCache = new Map<number, number>()
  const df = (p: Player) => {
    if (!day) return 1
    let f = dayCache.get(p.id)
    if (f == null) {
      const u = mulberry32((state.seed ^ Math.imul(day.fxId, 2654435761) ^ Math.imul(p.id, 40503)) >>> 0)()
      f = 1 + consistency(state.seed, p.id) * (u - 0.5) * 2
        + (day.big ? bigMatchTemper(state.seed, p.id) * 0.015 : 0)
      dayCache.set(p.id, f)
    }
    return f
  }
  const at = (i: number, k: keyof Player['a']) => {
    const p = P(i)
    if (!p) return 5
    const fit = 0.75 + 0.25 * (p.cond / 100)
    const frm = 0.9 + 0.02 * p.form
    // match sharpness: a player eased back after a layoff is a touch off the pace
    const shp = 0.945 + 0.055 * ((p.sharp ?? 70) / 100)
    return p.a[k] * fit * frm * shp * df(p)
  }
  const fw = [0, 1, 2, 3, 4, 5, 6, 7]
  const bk = [8, 9, 10, 11, 12, 13, 14]
  let scrum = avg([at(0, 'scr'), at(1, 'scr'), at(2, 'scr'), at(3, 'str'), at(4, 'str'), at(0, 'str'), at(2, 'str')])
  let lineout = avg([at(1, 'lin'), at(3, 'lin'), at(4, 'lin'), at(5, 'lin'), at(7, 'lin')])
  let breakdown = avg(fw.map(i => at(i, 'ruc')))
  let attack = avg([
    ...bk.map(i => at(i, 'han')),
    at(9, 'vis') * 1.5, at(8, 'pas') * 1.3, at(11, 'pac'), at(12, 'pac'),
    at(10, 'pac'), at(13, 'pac'), at(14, 'pos'),
  ])
  let defence = avg([...fw.map(i => at(i, 'tac')), ...bk.map(i => at(i, 'tac')), at(14, 'pos') * 1.2])
  let kicking = avg([at(9, 'kic') * 1.6, at(8, 'kic'), at(14, 'kic')])
  // partnership chemistry: combinations that have played together click
  if (state.chem) {
    const games = (i: number, j: number) => {
      const a = lineup[i], b = lineup[j]
      return a != null && b != null ? state.chem![chemKey(a, b)] ?? 0 : 0
    }
    const f = (g: number) => (g >= 50 ? 0.03 : g >= 25 ? 0.02 : g >= 10 ? 0.01 : 0)
    scrum *= 1 + (f(games(0, 1)) + f(games(1, 2))) / 2
    lineout *= 1 + f(games(3, 4))
    attack *= 1 + f(games(8, 9)) * 0.7 + f(games(11, 12)) * 0.3
    defence *= 1 + f(games(11, 12)) * 0.7
    kicking *= 1 + f(games(8, 9)) * 0.5
  }
  // signature traits: small, capped edges from the men who carry them
  let atkT = 1, brkT = 1, scrT = 1
  for (const p of xv) {
    if (!p?.trait) continue
    if (p.trait === 'The Step' || p.trait === 'Offload King') atkT += 0.012
    else if (p.trait === 'Jackal') brkT += 0.02
    else if (p.trait === 'Enforcer') { brkT += 0.012; scrT += 0.01 }
  }
  attack *= Math.min(atkT, 1.05)
  breakdown *= Math.min(brkT, 1.06)
  scrum *= Math.min(scrT, 1.04)
  // best goal kicker on the pitch
  let kickerId: number | null = null
  let goal = 5
  for (const p of xv) {
    if (p && p.a.goa > goal) { goal = p.a.goa; kickerId = p.id }
  }
  const overall = scrum * 0.16 + lineout * 0.12 + breakdown * 0.18 + attack * 0.24 + defence * 0.22 + kicking * 0.08
  return { scrum, lineout, breakdown, attack, defence, kicking, goal, overall, kickerId }
}

// ------------------------------------------------------------------
// Rosters: club or national team
// ------------------------------------------------------------------

export function rosterOf(state: GameState, teamId: string): number[] {
  const club = state.clubs[teamId]
  if (club) return club.players
  return state.natSquads[teamId] ?? []
}

export function teamName(state: GameState, teamId: string): string {
  return state.clubs[teamId]?.name ?? nationName(teamId)
}

export function teamShort(state: GameState, teamId: string): string {
  return state.clubs[teamId]?.short ?? nationName(teamId)
}

export function lineupFor(state: GameState, teamId: string): (number | null)[] {
  const club = state.clubs[teamId]
  // A team sheet that is not an array at all - a save from before the field
  // existed, or one edited by hand - used to throw here on .slice and take the
  // whole match with it. Loading heals it too (see migrate), but a crash in the
  // one function every kick-off goes through is worth closing at both ends.
  // Found by scripts/sheetfuzz.ts.
  if (club && !Array.isArray(club.tactic?.lineup)) {
    club.tactic.lineup = Array.from({ length: 23 }, () => null)
  }
  const isNation = !club
  if (isNation && state.natLineup && state.natLineup.team === teamId) {
    const lu = state.natLineup.lineup
    const squad = state.natSquads[teamId] ?? []
    const valid = lu.slice(0, 15).every(id =>
      id != null && state.players[id] && !state.players[id].injury && squad.includes(id))
    if (valid) return lu
  }
  if (club && teamId === state.userClubId) {
    const lu = club.tactic.lineup
    const valid = lu.slice(0, 15).every(id =>
      id != null && state.players[id] && !state.players[id].injury &&
      state.players[id].bans === 0 && !state.players[id].natSquad &&
      state.players[id].clubId === teamId)
    // A saved team sheet also goes stale. It used to be kept as long as all
    // fifteen men were merely AVAILABLE, so a shirt filled by a pure shoehorn
    // during a crisis kept him in it for the rest of the career - the squad could
    // sign a specialist for that exact position and the sheet would never notice.
    // Caught by the academy round (10G): giving squads real depth turned a
    // once-in-a-while annoyance into a flanker wearing 8 for eighteen straight
    // league games while a 77-rated number eight was not even on the bench.
    //
    // Narrow enough that it cannot overrule a manager who meant it. A shirt is
    // stale when its wearer is not a natural for it AND a natural who would be
    // BETTER in that shirt is available - either left out of the 23 entirely, or
    // sitting on the bench behind him. The comparison is what keeps it honest:
    // playing a stronger man out of position is a tactic, and that survives.
    // Playing a weaker one there while the specialist watches is the bug.
    // A SHEET THE MANAGER PICKED IS NOT STALE. He is allowed to play a man out
    // of position, and the game is not allowed to disagree by re-picking his side
    // on the way to the pitch. The tidy-up below exists for sheets the game chose
    // for him and then outgrew; the answer to a specialist left out of a sheet
    // somebody wrote on purpose is to say so on the Selection screen.
    const managerPicked = club.tactic.userPicked === true
    const stale = !managerPicked && valid && (() => {
      const named = new Set(lu.filter((x): x is number => x != null))
      const onPitch = new Set(lu.slice(0, 15).filter((x): x is number => x != null))
      return lu.slice(0, 15).some((id, i) => {
        const p = state.players[id!]
        const pos = XV_SLOTS[i].pos
        if (p.pos === pos) return false
        const mine = effAt(p, pos)
        return club.players.some(cid => {
          const c = state.players[cid]
          if (!c || c.acad || c.injury || c.bans > 0 || c.natSquad || c.onLoan) return false
          // a man already on the pitch in his own shirt is not cover for another
          if (onPitch.has(c.id) && c.pos === XV_SLOTS[lu.indexOf(c.id)].pos) return false
          if (c.pos !== pos && !(c.alt.includes(pos) && !named.has(c.id))) return false
          return effAt(c, pos) > mine
        })
      })
    })()
    if (valid && !stale) return lu
    if (stale) {
      // Write the tidy-up back, so the Selection screen shows the side that
      // actually played. Only ever reached for a sheet the game itself picked -
      // which means the ASSISTANT is the one naming the replacement side, and
      // his eye (assistantJudgement) comes with him. The first cut of this
      // wave re-picked an unclaimed sheet fresh every week instead, and the
      // difficultyprobe caught it making autopilot BETTER: a weekly form-and-
      // condition refresh is worth far more than a 12% misread costs. The
      // absent manager's real bill is the sheet nobody updates; the misread
      // is the surcharge on the rare day somebody does.
      club.tactic.lineup = autoSelect(state, availablePlayers(state, club.players, false), splitFor(club), assistantJudgement(state))
      return club.tactic.lineup
    }
    // INVALID: somebody in it cannot play. Repair the shirts that need repairing
    // and hand back the rest of his side exactly as he wrote it. Not persisted,
    // deliberately: the injured man's shirt is held for him and comes back when he
    // is fit. It used to call autoSelect on the whole squad here, which is how one
    // hamstring rewrote a manager's entire twenty-three.
    return repairSheet(state, club, lu, splitFor(club))
  }
  const pool = availablePlayers(state, rosterOf(state, teamId), isNation)
  return autoSelect(state, pool, splitFor(club))
}

// ------------------------------------------------------------------
// Simulation
// ------------------------------------------------------------------

export type RefStyle = 'strict' | 'fair' | 'lenient'

/** A referee is four separate opinions, not one dial.
 *
 *  The old model was thirteen names and three buckets, and the only thing a
 *  bucket changed was card risk. So every referee in the game was interchangeable
 *  except for how often somebody got binned, and there was nothing to select
 *  around: you could not pick a jackal-heavy back row because the man with the
 *  whistle was permissive at the tackle, because he had no opinion about it.
 *
 *  Each dial is a multiplier on something the engine already weighs:
 *
 *    scrum      how much he lets the set piece decide things. A pedant rewards a
 *               dominant front row and punishes a weak one; a ref who waves it
 *               away makes your scrum coach's work worth less.
 *    breakdown  jackal tolerance. Permissive means a strong breakdown wins the
 *               ball; fussy means the same actions concede penalties instead.
 *    patience   how many infringements he takes before somebody goes to the bin.
 *    flow       advantage and materiality. High flow means fewer stoppages and
 *               more attacking ball for both sides.
 *
 *  Profiles are fixed per man, not per fixture, so a name means something after
 *  a season of watching him.  */
export interface Referee {
  name: string
  style: RefStyle
  /** 0.85 dismissive of the scrum .. 1.15 pedant */
  scrum: number
  /** 0.9 fussy at the tackle .. 1.1 lets the jackal work */
  breakdown: number
  /** penalties conceded before a bin */
  patience: number
  /** 0.98 stop-start .. 1.04 lets it flow */
  flow: number
  /** card risk multiplier */
  cards: number
}

/** The panel is deliberately MEAN-NEUTRAL on every dial.
 *
 *  The first cut was not, and it cost three and a half points a game: the card
 *  dial averaged 1.03 against the old three-bucket model's effective 1.018, and
 *  breakdown averaged 0.99, so simply adding variety quietly taxed every match in
 *  the world. Scoring came out at 48.9 against a healthy band of 52.5-53.2.
 *
 *  So each column averages to what the old model averaged. A referee should
 *  change WHICH side an afternoon suits, never how much rugby gets played. If you
 *  edit a number here, re-run simtest: the columns have to stay balanced. */
const REF_PANEL: Referee[] = [
  { name: 'L. Pearce', style: 'strict', scrum: 1.10, breakdown: 0.92, patience: 4, flow: 0.99, cards: 1.28 },
  { name: 'K. Dickson', style: 'fair', scrum: 1.00, breakdown: 1.06, patience: 5, flow: 1.03, cards: 1.00 },
  { name: 'M. Carley', style: 'fair', scrum: 1.08, breakdown: 0.98, patience: 5, flow: 1.00, cards: 1.05 },
  { name: 'C. Ridley', style: 'lenient', scrum: 0.90, breakdown: 1.10, patience: 7, flow: 1.04, cards: 0.60 },
  { name: 'A. Gardner', style: 'strict', scrum: 1.10, breakdown: 0.90, patience: 4, flow: 0.98, cards: 1.30 },
  { name: 'N. Amashukeli', style: 'fair', scrum: 1.08, breakdown: 1.00, patience: 5, flow: 1.01, cards: 1.02 },
  { name: 'A. Piardi', style: 'fair', scrum: 0.94, breakdown: 1.04, patience: 6, flow: 1.02, cards: 0.92 },
  { name: 'P. Williams', style: 'strict', scrum: 1.06, breakdown: 0.94, patience: 4, flow: 0.99, cards: 1.24 },
  { name: "B. O'Keeffe", style: 'lenient', scrum: 0.92, breakdown: 1.08, patience: 7, flow: 1.04, cards: 0.58 },
  { name: 'N. Berry', style: 'fair', scrum: 1.02, breakdown: 1.02, patience: 5, flow: 1.01, cards: 0.98 },
  { name: 'H. Davidson', style: 'fair', scrum: 0.96, breakdown: 0.96, patience: 6, flow: 1.00, cards: 1.06 },
  { name: 'A. Brace', style: 'lenient', scrum: 0.88, breakdown: 1.06, patience: 7, flow: 1.03, cards: 0.64 },
  { name: 'P. Brousset', style: 'strict', scrum: 1.10, breakdown: 0.94, patience: 4, flow: 0.98, cards: 1.26 },
]

/** The man (or woman) in the middle - fixed per fixture, big influence. */
export function refFor(fxId: number): Referee {
  const h = (fxId * 2654435761) >>> 0
  return REF_PANEL[h % REF_PANEL.length]
}

/** Law 3: a 23 must be able to replace all three front-row positions.
 *
 *  Six suitably trained front-rowers, in practice two who can play each of
 *  loosehead, hooker and tighthead - a man counts for every position he can
 *  actually cover, so a prop who packs down on both sides is worth two. Come up
 *  short and the referee orders uncontested scrums, which takes the set piece out
 *  of the game entirely: no shove, no scrum penalties, nothing for a dominant
 *  front row to win. That hurts whoever HAD the better scrum, which is why it is
 *  a genuine selection constraint and, in the real game, a genuine controversy -
 *  a side with a poor scrum has an incentive to be short. Comment kept rather
 *  than a sanction built: a front-row shortage already punishes itself when a
 *  tighthead limps off and the bench has no natural cover. */
export function frontRowCover(state: GameState, lineup: (number | null)[]): { LP: number; HK: number; TP: number; legal: boolean } {
  const need = ['LP', 'HK', 'TP'] as const
  const out = { LP: 0, HK: 0, TP: 0, legal: false }
  for (const id of lineup.slice(0, 23)) {
    if (id == null) continue
    const p = state.players[id]
    if (!p || p.injury) continue
    for (const n of need) if (p.pos === n || p.alt.includes(n)) out[n] += 1
  }
  out.legal = out.LP >= 2 && out.HK >= 2 && out.TP >= 2
  return out
}

/** His two loudest opinions, in words, for the pre-match briefing. A tendency
 *  the manager cannot read is a tendency he cannot select around. */
export function refNotes(r: Referee): string[] {
  const out: string[] = []
  // THE ONE PART OF THIS FILE THAT SPEAKS THE PLAYER'S LANGUAGE. Everything else
  // here is commentary, and commentary is written into the match report the save
  // keeps, so it stays English (docs/i18n.md). These notes are read off the
  // referee at render and stored nowhere.
  if (r.scrum >= 1.08) out.push(t('matchday.refScrumTight'))
  else if (r.scrum <= 0.94) out.push(t('matchday.refScrumLoose'))
  if (r.breakdown >= 1.05) out.push(t('matchday.refJackal'))
  else if (r.breakdown <= 0.95) out.push(t('matchday.refFussy'))
  if (r.patience <= 4) out.push(t('matchday.refShortFuse', { n: r.patience }))
  else if (r.patience >= 7) out.push(t('matchday.refPatient', { n: r.patience }))
  if (r.flow >= 1.03) out.push(t('matchday.refFlow'))
  else if (r.flow <= 0.99) out.push(t('matchday.refStopStart'))
  return out
}

/** The complaint is a KEY. It is quoted on the medical screen, in the day
 *  room, in two stories and in the match commentary, and a complaint recorded
 *  as English is English in all five for as long as the lay-off lasts. */
const INJURIES = [
  ['injury.ribs', 1, 2], ['injury.deadLeg', 1, 1], ['injury.ankle', 2, 4],
  ['injury.hamstring', 2, 5], ['injury.concussion', 2, 3], ['injury.shoulder', 3, 8],
  ['injury.kneeLigament', 6, 16], ['injury.brokenHand', 4, 6], ['injury.calf', 2, 4],
  ['injury.groin', 2, 5], ['injury.bicep', 8, 14], ['injury.achilles', 16, 30],
] as const

/** In-match multipliers that must outlive a unit recompute. */
export interface SideMods {
  scrum: number; lineout: number; breakdown: number
  attack: number; defence: number; kicking: number
  tempo: number; card: number
}

const freshMods = (): SideMods => ({
  scrum: 1, lineout: 1, breakdown: 1, attack: 1, defence: 1, kicking: 1, tempo: 1, card: 1,
})

/**
 * The kickable-penalty rate: how physical you are, priced by who is refereeing.
 *
 * ---- WHY THIS IS A FUNCTION AND NOT TWO LINES OF ARITHMETIC ----------------
 *
 * penRisk has to be computed twice. Once in the dial block, which runs before
 * the referee is known and again on every substitution, and once in beginMatch
 * the moment the whistle is appointed. Two copies of a formula is how the
 * refPenF bug happened in the first place, so there is one copy and both call
 * it.
 *
 * ---- WHY AGGRESSION READS THE REFEREE (release audit, Pass 2) --------------
 *
 * scripts/dialweight.ts measured all six tactical dials over four seeds and
 * found aggression worth 1.3 points of difference across a whole season - noise.
 * It was wired up and it did nothing, because the breakdown it bought and the
 * penalties it conceded cancelled almost exactly. That sounds like balance and
 * is actually the absence of a decision: there was no opponent, no scoreline and
 * no referee against which moving it was right.
 *
 * THE ONLY CHANGE HERE IS THE SLOPE. The gain (breakdown 0.06), the base penalty
 * coefficient (0.20) and the card risk (0.006) are exactly what they always were,
 * because the original measurement said that combination is mean-neutral and
 * nothing has been found wrong with it. What is new is that THE COST NOW SCALES
 * WITH THE WHISTLE, and the whistle is on the pre-match briefing:
 *
 *   average referee (rp 1.00)   coefficient 0.20
 *   fussy at the tackle (1.15)  coefficient 0.32 - physicality is expensive
 *   lets a lot go      (0.85)   coefficient 0.08 - physicality is cheap
 *
 * ---- WHY THE MAGNITUDES WERE PUT BACK -----------------------------------
 *
 * They were raised first (breakdown to 0.09, penalties to 0.30, cards to 0.009)
 * on the theory that a louder trade makes a sharper decision. Three measured
 * iterations later that theory had cost more than it bought:
 *
 *   0.30 measured +2.67 / -1.63 either side of the panel, which looked perfect -
 *   but was taken on a build where an assignment in the referee block was wiping
 *   the defensive line's own penalty cost. My bug, caught by splitprobe.
 *   With that restored, the same split read -2.29 / -4.29: never worth doing.
 *   0.20 then read +3.14 / +1.56: always worth doing. Neither straddles zero.
 *
 * And across those same three runs STYLE - which no edit touched - measured
 * +5.16, then +2.09, then -0.10. Sixteen observations an arm cannot pin a dial
 * to better than about two points a match, so all three of those calibrations
 * were chasing noise, and a fourth would have been too.
 *
 * So the magnitudes go back to the values whose mean-neutrality was already
 * measured, and only the slope - the genuinely new idea, and the one that does
 * not depend on the base being any particular size - stays. A smaller change
 * defended by the evidence that exists beats a larger one defended by three
 * readings that disagree with each other.
 *
 * So the same slider is right against one referee and wrong against another, and
 * the panel that has been on the briefing since F1 finally has something to say.
 *
 * MEAN-NEUTRAL ON BOTH COUNTS, which is why the world average cannot move: the
 * panel's tolerances mean exactly 1.0, so E[0.30 + 0.80 * (rp - 1)] is 0.30; and
 * philosophy.ts mirrors every dial pair about 50, so the world's mean aggression
 * is exactly neutral and E[aggF] is 0. Measured, not argued - see disttest.
 */
function aggPenRisk(aggF: number, rp: number): number {
  return 0.115 * rp * (1 + aggF * (0.20 + 0.80 * (rp - 1)))
}

/** Layer a multiplier on a side so that it survives the next substitution. */
function layer(side: SideCtx, k: keyof SideMods, m: number) {
  if (m === 1) return
  side.mods[k] *= m
  if (k === 'tempo') side.tempoF *= m
  else if (k === 'card') side.cardRisk *= m
  else side.units[k] *= m
}

export interface SideCtx {
  teamId: string
  lineup: (number | null)[]
  units: Units
  score: number
  tries: number
  ratings: Map<number, number>
  /** the SETTLED marks, written once at full time.
   *
   *  `ratings` above is the raw in-match accumulator - a try here, a card
   *  there - and MatchDay's full-time panel used to render it straight, so the
   *  mark on screen was missing the result, the margin and the spread that
   *  finalizeMatch adds. A manager saw 6.0 while 6.6 went into the season
   *  average, his form and Player of the Month.
   *
   *  A SECOND MAP RATHER THAN OVERWRITING THE FIRST, deliberately: settling in
   *  place would make finalizeMatch destructive, and a second run over the same
   *  ctx would then feed a settled mark back through the formula and compound
   *  it. This way the operation is idempotent whatever the resume path does.
   *  Absent until full time, which is also what lets the panel show live marks
   *  at half time and settled ones after. */
  finalR?: Map<number, number>
  onPitch: Set<number>
  yellowUntil: Map<number, number>
  /** players currently sitting out a yellow - off the pitch, back in ten.
   *  Before this existed a sin-binned man stayed in onPitch and could score
   *  a try from inside the bin (audit 16D). */
  binned: Set<number>
  sent: number // players lost to RC
  cardRisk: number
  /** per-tick chance of conceding a kickable penalty. Was a flat 0.115 for
   *  every side in the world, which made Physicality a free lunch: the dial
   *  bought breakdown and its only cost was the (6x smaller) card roll. Now
   *  aggression and the referee's tackle tolerance set the rate (audit 16D). */
  penRisk: number
  /** the referee's contribution to penRisk, locked in at kick-off so a unit
   *  recompute can rebuild the dial part without losing the whistle */
  refPenF?: number
  /** f(aggression), -1..1, stashed at build time. penRisk is now computed in two
   *  places - once before the referee is known and again once he is - and both
   *  need the dial. Storing the resolved figure is what stops the two copies of
   *  the formula drifting apart, which is the bug the refPenF comment above was
   *  itself written about. */
  aggF: number
  poss: number // accumulated momentum, for possession stats
  pens: number // penalty goals kicked
  /** penalties conceded - repeated infringements bring the bin into play */
  consPens: number
  /** per-player petrol tank, 0-100 - drains with minutes played */
  energy: Map<number, number>
  /** drain multiplier from tempo tactics */
  tempoF: number
  /** energy-drain multiplier from match preparation (fitness week) */
  drainF: number
  /** the AI coach's one in-match tactical shift has been made */
  shifted?: boolean
  /** repetition-fatigue petrol multiplier, set once at mkSide - survives the
   *  substitution rebuild because nothing ever reassigns it */
  repF?: number
  /** how many times a REACTIVE dugout has changed its picture (max 2) */
  reacted?: number
  /** an active Head Injury Assessment: who went off, who covers, verdict due */
  hia?: { pid: number; subId: number; failed: boolean; returnTick: number }
  /** goal-kicking bonus from the kicking coach */
  goalBonus: number
  /** players in this side facing a former club today - the old boys */
  exIds: Set<number>
  isUser: boolean

  // ---- the bench economy (F4) ----------------------------------------------
  /** Persistent multipliers layered on top of a freshly computed unit set.
   *
   *  recomputeSideUnits rebuilds units from the lineup and re-runs the tactic
   *  modifiers, so anything the match itself layered on gets wiped by the next
   *  substitution. Bench effects live here and applyModifiers puts them back. */
  mods: SideMods
  /** the split this side named its bench under */
  split: BenchSplit
  /** who was sitting on the bench at kick-off. The lineup array is mutated by
   *  every substitution, so this is the only reliable record of the plan. */
  benchIds: Set<number>
  /** bench seat (0-7) each replacement sat in, for looking up his brief */
  seatOf: Map<number, number>
  /** the last-quarter reshape has been applied */
  finisherDone?: boolean
  /** briefed replacements whose instructions have already taken effect */
  briefsUsed?: number
  /** a man is playing out of his depth after a forced positional switch */
  coverBlown?: boolean
}

/** Tactic + weather + coaching modifiers, applied to freshly computed units. */
function applyModifiers(state: GameState, side: SideCtx, weather: Weather | null) {
  const club = state.clubs[side.teamId]
  // a happy dressing room plays for each other; a sour one hesitates
  if (club) {
    const xv = side.lineup.slice(0, 15).map(id => id != null ? state.players[id] : null).filter(Boolean)
    if (xv.length) {
      const avgMor = xv.reduce((s, p) => s + p!.morale, 0) / xv.length
      const mF = 1 + (avgMor - 6.5) * 0.009 // roughly ±3% at the extremes
      side.units.attack *= mF
      side.units.defence *= mF
    }
  }
  if (club) {
    const tac = club.tactic
    /**
     * A dial is a 0-100 number, and every one of them is multiplied into a unit
     * score, then into tempoF, then into how hard the side runs - which is how
     * every player's fitness is spent. So a dial that is not a number does not
     * sit quietly in a field: it turns the whole squad's condition to NaN, for
     * the rest of the save.
     *
     * Two ways to get there, and the second is the one that matters: a corrupted
     * save, or a save written before the field existed, where the dial is simply
     * absent. Found by scripts/sheetfuzz.ts, which broke the dials both ways.
     *
     * Clamping here, at the one place all four are read, beats trusting a dozen
     * call sites to have checked. Anything unreadable reads as the middle of the
     * dial, which is the same as no instruction at all.
     */
    const f = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) - 50 : 0) / 50 // -1..1
    side.units.attack *= 1 + f(tac.style) * 0.06 + f(tac.tempo) * 0.05 - f(tac.kicking) * 0.035
    side.units.scrum *= 1 - f(tac.style) * 0.05
    side.units.breakdown *= 1 + f(tac.aggression) * 0.06 - f(tac.style) * 0.03 - f(tac.kicking) * 0.02
    side.units.kicking *= 1 + f(tac.kicking) * 0.1
    side.units.defence *= 1 - f(tac.tempo) * 0.03
    side.tempoF = 1 + f(tac.tempo) * 0.22
    side.cardRisk = 0.012 + f(tac.aggression) * 0.006
    side.aggF = f(tac.aggression)
    side.penRisk = aggPenRisk(side.aggF, side.refPenF ?? 1)
    // THE WITHOUT-BALL SYSTEM (18D, FM26's split shapes translated). Line
    // speed is a trade priced in the engine's own currencies: a blitz brings
    // pressure (defence up) and gives the referee offside creep to look at
    // (penalties up, a touch more card risk); a passive drift concedes the
    // gain line quietly and keeps the penalty count down. 50 is literally
    // absent - f(50) is zero on every term - so a save that has never touched
    // the dial plays the old game bit for bit, and the fingerprint holds it
    // there. Defensive WIDTH is the other half and lives in beginMatch,
    // because it is a matchup read against the opponent's attacking shape.
    const dl = f(tac.defLine ?? 50)
    side.units.defence *= 1 + dl * 0.04
    side.penRisk *= 1 + dl * 0.12
    side.cardRisk += dl * 0.002

    // The called set-piece routines (F2). What you get is the routine's ceiling
    // scaled by how well drilled it is and how sick of it the analysts are.
    const lo = routineEffect(club, tac.lineoutCall ?? DEFAULT_LINEOUT)
    const sc = routineEffect(club, tac.scrumCall ?? DEFAULT_SCRUM)
    side.units.lineout *= lo.mult
    side.units.scrum *= sc.mult
    for (const [id, e] of [[tac.lineoutCall ?? DEFAULT_LINEOUT, lo], [tac.scrumCall ?? DEFAULT_SCRUM, sc]] as const) {
      const r = ROUTINE_BY_ID[id]
      if (!r) continue
      // a routine that eats time feeds the forwards and starves the backs
      // the side effects follow the same competence curve, so a shape you cannot
      // execute does not hand you its upside either
      if (r.attack) side.units.attack *= 1 + (r.attack - 1) * Math.max(0, e.q)
      if (r.tempo) side.tempoF *= r.tempo
    }

    // The kicking game (F3). A designated kicker is a decision; the automatic
    // pick of whoever has the best attribute is not.
    const named = (tac.kickers ?? []).find(id => id != null && side.onPitch.has(id) && !state.players[id]?.injury)
    if (named != null) side.units.kickerId = named
    // exit strategy: how you play your way out of your own 22
    switch (tac.exit) {
      case 'box': side.units.kicking *= 1.05; side.units.attack *= 0.985; break
      case 'long': side.units.kicking *= 1.03; side.units.defence *= 1.01; side.units.attack *= 0.99; break
      case 'counter': side.units.attack *= 1.03; side.units.defence *= 0.98; break
      case 'fifty22': side.units.kicking *= 1.06; side.units.attack *= 0.97; break
      default: break
    }
  }
  // positional roles: how each shirt is told to play. Every one of them trades
  // something (game/roles.ts ROLE_FX, which the Tactics screen reads too, so the
  // description a manager taps and the effect he gets cannot drift apart).
  if (club?.tactic.roles) {
    for (let i = 0; i < 15; i++) {
      const r = club.tactic.roles[i]
      if (!r || side.lineup[i] == null) continue
      // A ROLE HAS TO BE LEGAL FOR THE SHIRT. rolesForSlot is the rule and it was
      // enforced only in Tactics.tsx, so fifteen jackals were one save-edit away
      // and measured +7.1 points a match. An engine rule a screen can bypass is
      // not a rule - the same standard signFreeAgent's header sets.
      if (!rolesForSlot(i).some(d => d.id === r)) continue
      const fx = ROLE_FX[r]
      if (!fx) continue
      if (fx.scrum) side.units.scrum *= fx.scrum
      if (fx.lineout) side.units.lineout *= fx.lineout
      if (fx.breakdown) side.units.breakdown *= fx.breakdown
      if (fx.attack) side.units.attack *= fx.attack
      if (fx.defence) side.units.defence *= fx.defence
      if (fx.kicking) side.units.kicking *= fx.kicking
      if (fx.card) side.cardRisk *= fx.card
    }
  }

  // hot heads walk the disciplinary tightrope every week
  for (const id of side.lineup.slice(0, 15)) {
    const p = id != null ? state.players[id] : null
    if (p?.trait === 'Hot Head') side.cardRisk += 0.002
  }
  // a proper captain in the XV steadies the ship and keeps discipline;
  // when he's missing, the vice-captain leads at half the effect
  const xvIds = side.lineup.slice(0, 15)
  const leader = club?.captain != null && xvIds.includes(club.captain)
    ? { p: state.players[club.captain], f: 1 }
    : club?.vice != null && xvIds.includes(club.vice)
      ? { p: state.players[club.vice], f: 0.5 }
      : null
  if (leader?.p && leader.p.a.lea >= 12) {
    const f = 1 + (leader.p.a.lea - 11) * 0.0022 * leader.f // up to ~+2% at lea 20
    side.units.attack *= f
    side.units.defence *= f
    side.cardRisk *= 1 - 0.07 * leader.f
  }
  // The leadership group (F11). A portfolio is not extra strength, it is
  // concentration: the man who has taken the lineout calls or the defensive
  // system moves a slice of the side's general leadership onto his own area and
  // off the generic pair. So naming a group is a choice about where
  // responsibility sits, not a free upgrade, and a world where nobody names one
  // is exactly where it was.
  if (club?.leaders) {
    const onField = new Set(side.lineup.slice(0, 15).filter((x): x is number => x != null))
    for (const [area, id] of Object.entries(club.leaders)) {
      if (id == null || !onField.has(id)) continue
      const h = state.players[id]
      if (!h || h.a.lea < 12) continue // authority has to be earned
      const give = 0.009 * clamp((h.a.lea - 11) / 9, 0, 1)
      switch (area) {
        case 'pack':
          side.units.attack *= 1 - give * 0.5
          side.units.defence *= 1 - give * 0.5
          side.units.scrum *= 1 + give * 0.6
          side.units.lineout *= 1 + give * 0.6
          side.units.breakdown *= 1 + give * 0.5
          break
        case 'defence':
          side.units.attack *= 1 - give
          side.units.defence *= 1 + give
          break
        case 'attack':
          side.units.defence *= 1 - give
          side.units.attack *= 1 + give
          break
        case 'culture':
          // no unit moves at all: his portfolio is the room, and it is paid for
          // in the unit portfolio he is therefore not holding
          side.cardRisk *= 1 - 0.09 * clamp((h.a.lea - 11) / 9, 0, 1)
          break
      }
    }
  }
  // ---- EVERY OTHER CLUB HAS COACHES TOO ----
  //
  // Measured by scripts/stackprobe.ts, and it is the reason that probe exists.
  // A manager who used the whole toolbox won the league NINE TIMES OUT OF NINE
  // from a mid-table club, mean finishing position 1.00, on every seed. The
  // cause is directly below: facLevel() reads the user's club and nothing else,
  // and the backroom block is gated on side.isUser, so a full staff and level-5
  // facilities were worth five to ten percent on every unit AGAINST A WORLD
  // WHERE NO CLUB COULD EVER HAVE ANY. The manager was not out-coaching his
  // rivals; he was the only club in the sport with a coaching department.
  //
  // So a professional club now turns up with professional coaches. This is a
  // baseline, not a mirror: it is deliberately FLAT with only a light tilt for
  // reputation, because making it scale hard with rep would amplify the gap
  // between rich and poor and stratify the league - a balance regression wearing
  // a realism costume. Every Premier Division side has an attack coach; what varies
  // between them is less than reputation suggests.
  //
  // What is left as the manager's genuine edge is the part that is a DECISION
  // rather than a purchase: the weekly match preparation below, the analyst's
  // read, and the team sheet. Your staff roughly match theirs. Your choices are
  // yours.
  //
  // KEYED ON THE CLUB, NOT ON side.isUser, and the difference is not academic.
  // A sleepwalking manager's fixtures are simmed through the AI path, where
  // isUser is false for BOTH sides - so gating on the flag handed the manager's
  // own club a free coaching department on exactly the weeks he could not be
  // bothered to turn up. Measured before this line was fixed: a giant's
  // sleepwalk board bottomed at 31.3 instead of 16.3 and sackings fell from 2
  // in 6 to 1 in 6, which is the change making absenteeism SAFER. The user's
  // club is the user's club whoever is pressing the buttons.
  //
  // Deterministic: reputation only, no draw from the shared stream.
  if (side.teamId !== state.userClubId) {
    const rep = state.clubs[side.teamId]?.rep ?? 60
    // 0 at rep 40, 1 at rep 90, so the tilt is gentle and bounded at both ends
    const tilt = clamp((rep - 40) / 50, 0, 1)
    const coach = 0.026 + 0.014 * tilt
    side.units.attack *= 1 + coach
    side.units.defence *= 1 + coach
    side.units.scrum *= 1 + coach * 0.9
    side.units.lineout *= 1 + coach * 0.9
    side.units.kicking *= 1 + coach * 0.8
    side.goalBonus = (side.goalBonus ?? 0) + coach * 0.22
  }

  // your backroom staff sharpen the matchday units (club only - Test
  // weeks mean borrowed players, not your own coaching department)
  if (side.isUser && side.teamId === state.userClubId && state.staff) {
    const s = state.staff
    side.units.attack *= 1 + (s.attack ?? 0) * 0.016
    side.units.defence *= 1 + (s.defence ?? 0) * 0.016
    side.units.scrum *= 1 + (s.scrumCoach ?? 0) * 0.015
    side.units.lineout *= 1 + (s.scrumCoach ?? 0) * 0.015
    side.units.kicking *= 1 + (s.kicking ?? 0) * 0.02
    side.goalBonus = (s.kicking ?? 0) * 0.012 + facLevel(state, 'kicking') * 0.005
    // swagger tax: a squad drunk on its own headlines turns up flat
    if ((state.pressTone ?? 0) >= 4) {
      side.units.attack *= 0.965
      side.units.defence *= 0.965
    }
    // this week's match preparation: a focused edge, always with a trade -
    // and a proper briefing room makes the message stick
    const prepF = 1 + facLevel(state, 'briefing') * 0.15
    switch (state.matchPrep) {
      case 'attack': side.units.attack *= 1 + 0.035 * prepF; side.units.defence *= 0.99; break
      case 'defence': side.units.defence *= 1 + 0.035 * prepF; side.units.attack *= 0.99; break
      case 'setpiece': side.units.scrum *= 1 + 0.04 * prepF; side.units.lineout *= 1 + 0.04 * prepF; side.units.attack *= 0.99; break
      case 'fitness': side.drainF = 0.92 - facLevel(state, 'briefing') * 0.006; break
      case 'recovery': break // its work was done in the training week
    }
    // The analyst's read has to be worth something on the day, or the briefing
    // room, the assistant, the accuracy model and the followed/right/wrong ledger
    // are all decoration. It was decoration: matchPrep handed out the same flat
    // bonus whether the read was sound or nonsense, so the opponent's actual soft
    // spot never entered the match at all. Measured across forty fixtures before
    // this existed, following a sound read scored an aggregate margin of 359 and
    // ignoring it scored 429 - not a small effect, no effect, with the difference
    // being noise around zero.
    //
    // So homework pays, and only when it is right AND acted on. Same week, same
    // opponent, the recommended prep actually set. Deliberately modest: a good
    // week's work on top of the prep bonus, not a cheat code, and it does nothing
    // at all for a manager who follows a read his analyst got wrong.
    const read = state.analyst
    if (read && read.right && read.abs === state.season * 100 + state.week &&
        read.oppId !== side.teamId && state.matchPrep === read.prep) {
      // 0.03 until 16D, when the last-quarter surge quietly raised what a
      // fitness week is worth (fresher legs meet a bigger late-game pot) and
      // the analystprobe measured the homework edge collapsing to +0.9 points
      // a SEASON against always-prep-fitness. Homework has to beat the safe
      // default when the read is sound, or the whole analyst chain is
      // decoration again. Re-measured at 0.045: +36.9 points a season, ahead
      // in 10 of 12 paired seasons.
      const homework = 0.045 * prepF
      if (read.unit === 'defence') side.units.attack *= 1 + homework
      else if (read.unit === 'attack') side.units.defence *= 1 + homework
      else side.units[read.unit] *= 1 + homework
    }
  }
  if (weather === 'Rain' || weather === 'Snow') {
    side.units.attack *= weather === 'Snow' ? 0.86 : 0.90
    side.units.breakdown *= 1.04 // wet weather is forward weather
  }
  if (weather === 'Wind') side.units.kicking *= 0.92
  // Anything the match itself layered on goes back on last. Without this, a
  // substitution in the 68th minute silently erased the bench plan that had
  // just been applied at the 64th, because recomputeSideUnits starts over.
  if (side.mods) {
    side.units.scrum *= side.mods.scrum
    side.units.lineout *= side.mods.lineout
    side.units.breakdown *= side.mods.breakdown
    side.units.attack *= side.mods.attack
    side.units.defence *= side.mods.defence
    side.units.kicking *= side.mods.kicking
    side.tempoF *= side.mods.tempo
    side.cardRisk *= side.mods.card
  }
}

function mkSide(state: GameState, teamId: string, userTeamId: string | null, fxId: number, big: boolean): SideCtx {
  // A COPY, not the club's sheet (user: "if you make subs in matches when it
  // loads back to the first team page - the original starting team should be
  // selected"). lineupFor hands back club.tactic.lineup BY REFERENCE for the
  // user's club, and every substitution, injury cover and finisher writes
  // side.lineup in place - so an afternoon's changes were being written into
  // the saved team sheet, and the Team screen greeted the manager with his
  // finishing XV: the winger who came off the bench standing in the flanker's
  // slot. The match owns its own sheet; the saved one is the manager's.
  const lineup = lineupFor(state, teamId).slice()
  const ratings = new Map<number, number>()
  const onPitch = new Set<number>()
  const energy = new Map<number, number>()
  lineup.slice(0, 15).forEach(id => {
    if (id != null) {
      ratings.set(id, 6 + ratingJitter(fxId, id))
      onPitch.add(id)
      // The 50 floor means a knackered starter kicks off almost as fresh as a
      // rested one, which is half of why the bench is a trap (see eF below).
      // DROPPING IT TO 25 WAS TRIED AND REVERTED: it made results swing hard
      // enough that stanceprobe's board stopped clawing back a broken promise
      // and trustprobe's near-even season lurched 26 -> 6 instead of drifting.
      // The floor is load-bearing for the board's read of a season, which is
      // not something a bench fix should be quietly deciding.
      energy.set(id, Math.max(50, state.players[id]?.cond ?? 85))
    }
  })
  const units = teamUnits(state, lineup, { fxId, big })
  const benchIds = new Set<number>()
  const seatOf = new Map<number, number>()
  lineup.slice(15).forEach((id, seat) => {
    if (id != null) { benchIds.add(id); seatOf.set(id, seat) }
  })
  const side: SideCtx = {
    teamId, lineup, units,
    score: 0, tries: 0, ratings, onPitch, yellowUntil: new Map(), binned: new Set(), sent: 0,
    cardRisk: 0.012, penRisk: 0.115, aggF: 0,
    poss: 0, pens: 0, consPens: 0,
    energy, tempoF: 1, drainF: 1, goalBonus: 0,
    exIds: new Set(),
    isUser: teamId === userTeamId,
    mods: freshMods(),
    // the split the bench ACTUALLY is, not the one that was chosen: five of the
    // eight seats take whoever you put in them, so the men in the shirts decide
    split: actualSplit(state, state.clubs[teamId]),
    benchIds, seatOf,
  }
  applyModifiers(state, side, null)
  // REPETITION FATIGUE (pillar 2): a high-intensity habit held for weeks is
  // paid for in petrol. Set once here - the substitution rebuild re-runs
  // applyModifiers, not mkSide, so this can never compound. 1.0 exactly in a
  // fresh world, which is what keeps the fingerprint on the old stream.
  // the CLUB is the club, whoever pressed the button. isUser is false for both
  // sides when the assistant settles a fixture, so delegating a week skipped the
  // penalty entirely - the same isUser-versus-teamId trap the coaching
  // department comment above was written about.
  if (side.teamId === state.userClubId) side.repF = repetitionFatigue(state)
  return side
}

/**
 * The little jitter on a player's opening match rating.
 *
 * This used to be `let _n = 0; _n = (_n + 1) % 7` - a MODULE-LEVEL COUNTER, and
 * that made the ratings of a match depend on how many matches had been simulated
 * before it in the same process. Two consequences, both found by measuring rather
 * than reading:
 *
 *   - the same fixture played twice in one session produced DIFFERENT ratings
 *     (player 258 opened on 5.90 in one run and 6.00 in the next)
 *   - so ratings could never be reproduced, which is what makes replaying a match
 *     after a page reload impossible: the scoreline would come back identical and
 *     every rating on the page would be subtly wrong
 *
 * scripts/fingerprint.ts never saw it, because the fingerprint compares SCORES
 * and this only reaches ratings. Ratings are not cosmetic though: they feed the
 * season's ratingSum, the average a player is judged on, and Player of the Month.
 *
 * Keyed on the fixture and the man instead, so it is the same every time anybody
 * asks, and no match can disturb another. Same seven values, same mean of zero.
 */
function ratingJitter(fxId: number, pid: number): number {
  let h = (Math.imul(fxId, 2654435761) ^ Math.imul(pid, 40503)) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return ((h >>> 0) % 7 - 3) * 0.05
}

function tryScorer(state: GameState, side: SideCtx, rng: Rng): Player | null {
  const ids = [...side.onPitch]
  const ps = ids.map(id => state.players[id]).filter(Boolean)
  if (!ps.length) return null
  const w = ps.map(p => {
    const posW: Record<string, number> = {
      WG: 5, FB: 3, CE: 3.4, FH: 1.4, SH: 1.8, N8: 2.2, FL: 2.2, HK: 2.0, LK: 1.2, LP: 0.7, TP: 0.7,
    }
    const fresh = 0.55 + 0.45 * ((side.energy.get(p.id) ?? 70) / 100)
    return (posW[p.pos] ?? 1) * (0.5 + p.a.pac / 20) * fresh * (p.trait === 'The Step' ? 1.8 : 1) * (side.exIds.has(p.id) ? 1.25 : 1)
  })
  return wpick(rng, ps, w)
}

export interface SimResult {
  events: MatchEvent[]
  motmId: number | null
}

const TRY_LINES = [
  'comm.try1',
  'comm.try2',
  'comm.try3',
  'comm.try4',
  'comm.try5',
  'comm.try6',
  'comm.try7',
  'comm.try8',
  'comm.try9',
  'comm.try10',
  'comm.try11',
  'comm.try12',
  'comm.try13',
  'comm.try14',
  'comm.try15',
  'comm.try16',
  'comm.try17',
  'comm.try18',
  'comm.try19',
  'comm.try20',
  'comm.try21',
  'comm.try22',
  'comm.try23',
  'comm.try24',
  'comm.try25',
  'comm.try26',
]
const TRY_LINES_WET = [
  'comm.tryWet1',
  'comm.tryWet2',
  'comm.tryWet3',
  'comm.tryWet4',
  'comm.tryWet5',
]
const TRY_LINES_DERBY = [
  'comm.tryDerby1',
  'comm.tryDerby2',
  'comm.tryDerby3',
  'comm.tryDerby4',
  'comm.tryDerby5',
]
const PEN_LINES = [
  'comm.pen1',
  'comm.pen2',
  'comm.pen3',
  'comm.pen4',
  'comm.pen5',
  'comm.pen6',
  'comm.pen7',
  'comm.pen8',
  'comm.pen9',
  'comm.pen10',
  'comm.pen11',
]
const CON_LINES = [
  'comm.con1',
  'comm.con2',
  'comm.con3',
  'comm.con4',
  'comm.con5',
  'comm.con6',
  'comm.con7',
  'comm.con8',
]
const FLAVOR_GRASSROOTS = [
  'comm.flavGrass1',
  'comm.flavGrass2',
  'comm.flavGrass3',
  'comm.flavGrass4',
  'comm.flavGrass5',
  'comm.flavGrass6',
  'comm.flavGrass7',
  'comm.flavGrass8',
]

const FLAVOR_PACIFIC = [
  'comm.flavPac1',
  'comm.flavPac2',
  'comm.flavPac3',
  'comm.flavPac4',
  'comm.flavPac5',
  'comm.flavPac6',
]

const FLAVOR = [
  'comm.flav1',
  'comm.flav2',
  'comm.flav3',
  'comm.flav4',
  'comm.flav5',
  'comm.flav6',
  'comm.flav7',
  'comm.flav8',
  'comm.flav9',
  'comm.flav10',
  'comm.flav11',
  'comm.flav12',
  'comm.flav13',
  'comm.flav14',
  'comm.flav15',
  'comm.flav16',
  'comm.flav17',
  'comm.flav18',
  'comm.flav19',
  'comm.flav20',
  'comm.flav21',
  'comm.flav22',
  'comm.flav23',
  'comm.flav24',
  'comm.flav25',
  'comm.flav26',
]
const FLAVOR_WET = [
  'comm.flavWet1',
  'comm.flavWet2',
  'comm.flavWet3',
  'comm.flavWet4',
  'comm.flavWet5',
  'comm.flavWet6',
]
const FLAVOR_WIND = [
  'comm.flavWind1',
  'comm.flavWind2',
  'comm.flavWind3',
  'comm.flavWind4',
]
const FLAVOR_DERBY = [
  'comm.flavDerby1',
  'comm.flavDerby2',
  'comm.flavDerby3',
  'comm.flavDerby4',
  'comm.flavDerby5',
]
const TIRED_LINES = [
  'comm.tired1',
  'comm.tired2',
  'comm.tired3',
  'comm.tired4',
]

/** Live match context. The match is simulated tick by tick (4 minutes per
 *  tick, 20 ticks) so tactics changes and substitutions genuinely change
 *  what happens next, at any point in the game. */
export interface LiveCtx {
  fx: Fixture
  home: SideCtx
  away: SideCtx
  rng: Rng
  detail: boolean
  weather: Weather
  derby: boolean
  goalPenalty: number
  hfa: number
  events: MatchEvent[]
  lastMin: number
  isUser: boolean
  /** the team the user is coaching in this match (club or national side) */
  userSideId: string | null
  /** next tick to simulate, 0..20 */
  tick: number
  /** 0 = pre-KO, 1 = HT reached, 2 = 60' break reached, 3 = full-time */
  seg: 0 | 1 | 2 | 3
  /** set at HT / 60' until the user resumes play */
  awaiting: 'HT' | 'BRK' | null
  motmId: number | null
  talkUsed: boolean
  subsUsed: number
  /** The last tactical substitution, kept only until play resumes, so a wrong
   *  tap can be taken back at the same stoppage it was made (16B, user: "i
   *  made a substitution but selected the wrong player, i couldnt undo it").
   *  Records whether that change spent a brief or blew the cover charge, so
   *  the undo can give back exactly what the change took. */
  lastSub?: { outId: number; inId: number; blewCover: boolean; briefed: boolean } | null
  preTalk: string | null
  /** a touchline call waiting on the user (kickable penalty etc) */
  decision: { kind: 'penalty'; min: number } | null
  /** momentum, -1 (away camped in our half) .. +1 (home dominant) */
  momo: number
  /** live bad blood between the clubs (reason string) - derby-lite heat */
  grudge?: string | null
  /** per-tick home possession share, for the last-10-minutes graphic */
  momoHist?: number[]
}

/**
 * WHAT A LINE DEPICTS, where a line depicts something the pitch can draw.
 *
 * The mock-up used to work this out by running regular expressions over the
 * commentary itself. That tied a picture to a wording in one language, and it
 * was wrong even in that one: comm.doesPace has an opposition coach promising
 * to "slow every scrum reset", which drew a scrum, and comm.benchFiveThree,
 * comm.doesMiddle and comm.patternWidth all contain the word "wide", which
 * rolled the kick-miss camera over a tactical note.
 *
 * Only lines that SHOW the thing are listed. A coach talking about scrums is
 * not a scrum.
 */
const DEPICTS: Record<string, NonNullable<MatchEvent['fx']>> = {
  'comm.flav4': 'SCRUM',            // monster scrum, penalty advantage
  'comm.flav12': 'SCRUM',           // choke tackle, scrum to the other side
  'comm.flav21': 'SCRUM',           // the scrum inches forward
  'comm.flavWet1': 'SCRUM',         // trudging to another scrum in the rain
  'comm.maulHeldUp': 'SCRUM',       // held up, and they win the scrum
  'comm.uncontested': 'SCRUM',      // the referee orders uncontested scrums
  'comm.flav9': 'LINEOUT',          // steals the lineout against the throw
  'comm.flav13': 'LINEOUT',         // a 50:22 and the lineout that follows
  'comm.flav18': 'LINEOUT',         // a quick lineout taken
  'comm.flavDerby5': 'LINEOUT',     // words exchanged at the lineout
  'comm.flav6': 'MAUL',             // rolling maul eats twenty metres
  'comm.flavGrass1': 'MAUL',        // the back of a collapsing maul
  'comm.maulToCorner': 'MAUL',      // the maul assembles five metres out
  'comm.maulRepelledPenalty': 'MAUL',
  'comm.tryMaulRumbles': 'MAUL',    // and the ones that end in a try
  'comm.try4': 'MAUL',
  'comm.tryWet5': 'MAUL',
  'comm.penWide': 'MISS',           // the kick that misses
  'comm.penWideNamed': 'MISS',
  'comm.conWide': 'MISS',
}

/**
 * A commentary line, filed as a key and its values.
 *
 * This is the one to use. pushEvent below takes finished English and is what
 * every line used to be; scripts/commprobe.ts counts what is left of it and
 * the count may only fall, because a line called as English is English in a
 * French match for ever, including in saves written before the fix.
 *
 * The English is still computed and still stored, because the engine reads its
 * own commentary back - see MatchEvent.text. It is stored, not shown.
 */
function pushLine(
  state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null,
  k: string, v?: Record<string, string | number>, playerId?: number,
) {
  if (!ctx.detail) return
  pushEvent(state, ctx, min, type, side, tIn('en', k, v), playerId, k, v, DEPICTS[k])
}

function pushEvent(
  state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null,
  text: string, playerId?: number, k?: string, v?: Record<string, string | number>,
  fx?: MatchEvent['fx'],
) {
  if (!ctx.detail) return
  if (type !== 'HT' && type !== 'FT') {
    min = Math.max(min, ctx.lastMin)
    ctx.lastMin = Math.min(80, min)
  }
  ctx.events.push({
    min, type, teamId: side?.teamId ?? '',
    playerId, playerName: playerId != null ? state.players[playerId]?.name : undefined,
    text, k, v, fx, homeScore: ctx.home.score, awayScore: ctx.away.score,
  })
}

export function beginMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean, userTeamId: string | null = state.userClubId): LiveCtx {
  const derby = isDerby(fx.homeId, fx.awayId)
  // a big day: a knockout tie or a derby - the matches with an atmosphere
  // that gets inside players' heads (25D-2)
  const big = !!fx.stage || derby
  const home = mkSide(state, fx.homeId, userTeamId, fx.id, big)
  const away = mkSide(state, fx.awayId, userTeamId, fx.id, big)
  const weather = rollWeather(state.week, rng)
  fx.weather = weather
  fx.derby = derby
  let goalPenalty = 0
  const ref = refFor(fx.id)
  for (const side of [home, away]) {
    if (weather === 'Rain' || weather === 'Snow') {
      side.units.attack *= weather === 'Snow' ? 0.86 : 0.90
      side.units.breakdown *= 1.04
    }
    if (weather === 'Wind') side.units.kicking *= 0.92
    if (derby) side.cardRisk *= 1.35
    // The whistle sets the tone, and now it sets four of them. Each dial acts on
    // the unit it is an opinion about, so a scrum pedant makes your front row
    // matter and a permissive ref makes your jackals matter.
    //
    // LAYERED, NOT WRITTEN STRAIGHT ONTO THE UNITS (audit 16D). A substitution
    // rebuilds the units from scratch and re-applies only side.mods, so a direct
    // write here survived exactly until the user's first sub or slider touch -
    // while every AI side, which never recomputes, kept its referee all match.
    layer(side, 'card', ref.cards)
    layer(side, 'attack', ref.flow)
    layer(side, 'scrum', ref.scrum)
    layer(side, 'breakdown', ref.breakdown)
    // "fussy at the tackle - hands off, or it is a penalty": the briefing has
    // claimed this since the panel shipped, and the penalty rate never read
    // the referee at all. A fussy whistle (breakdown 0.90) now blows a tenth
    // more penalties; a lenient one (1.10) a tenth fewer (audit 16D)
    side.refPenF = 2 - ref.breakdown
    // SWAPPED IN AS A RATIO, NOT ASSIGNED. The first version of this wrote
    // `side.penRisk = aggPenRisk(...)` outright, which was wrong in a way only
    // splitprobe caught: by the time we get here the dial block has already
    // multiplied in the defensive line's own penalty cost, and an assignment
    // threw it away. A full blitz stopped paying its 12% and the without-ball
    // system silently went half free.
    //
    // So: divide out the referee-blind aggression price the dial block used and
    // multiply in the referee-aware one. Everything else layered onto penRisk
    // survives untouched, and a later recompute - where the dial block can see
    // refPenF and computes the right price first time - lands on the same
    // number, which is the property that matters.
    side.penRisk *= aggPenRisk(side.aggF, side.refPenF) / aggPenRisk(side.aggF, 1)
  }
  // FAVOURITE PRESSURE (25D-2). On the big day the stronger side carries the
  // weight of expectation and the underdog plays with nothing to lose: the
  // gap closes a touch, scaled to how wide it was (up to 3% each way). Applied
  // as layered ratios so a substitution cannot silently restore the full gap,
  // and zero-sum by construction - one side gives exactly what the other gets.
  if (big) {
    const fav = home.units.overall >= away.units.overall ? home : away
    const dog = fav === home ? away : home
    const gapR = (fav.units.overall - dog.units.overall) / Math.max(1, dog.units.overall)
    const squeeze = Math.min(0.03, gapR * 0.35)
    if (squeeze > 0.001) {
      layer(fav, 'attack', 1 - squeeze)
      layer(fav, 'defence', 1 - squeeze)
      layer(dog, 'attack', 1 + squeeze)
      layer(dog, 'defence', 1 + squeeze)
    }
  }
  // Law 3: if either side cannot cover the front row, nobody contests the scrum.
  // Both sides lose the weapon, so the side with the better pack pays for the
  // other's shortage - which is the real law and the real argument about it.
  const homeFR = frontRowCover(state, home.lineup)
  const awayFR = frontRowCover(state, away.lineup)
  const uncontested = !homeFR.legal || !awayFR.legal
  if (uncontested) {
    // Uncontested means neither side can WIN the scrum, not that the scrum stops
    // existing. Both get the average of the two, so the differential vanishes and
    // the absolute level stays sane.
    //
    // The first cut set both to 1, on the assumption these were multipliers around
    // 1.0. They are not: unit strengths run at 15-20. So instead of neutralising
    // the set piece it deleted it, and because attack weighs scrum while defence
    // does not, world scoring fell from 52.4 to 48.8 points a game on the 7% of
    // matches where a front-row shortage bites. Check the scale before you clamp.
    // Applied as a layered ratio so a substitution does not silently restore a
    // contested scrum (audit 16D): the factors lock the levelling in at kick-off
    // and survive every recompute.
    const level = (home.units.scrum + away.units.scrum) / 2
    const homeF = level / Math.max(1, home.units.scrum)
    const awayF = level / Math.max(1, away.units.scrum)
    layer(home, 'scrum', homeF)
    layer(away, 'scrum', awayF)
  }
  // The analysts were watching. Calling the same move every week is how it stops
  // working, so the tally is kept here, once per match, for both clubs.
  for (const id of [fx.homeId, fx.awayId]) {
    const c = state.clubs[id]
    if (!c) continue
    const pb = playbookOf(c)
    for (const call of [c.tactic.lineoutCall ?? DEFAULT_LINEOUT, c.tactic.scrumCall ?? DEFAULT_SCRUM]) {
      pb.used[call] = (pb.used[call] ?? 0) + 1
    }
  }
  // the analyst's read: if the manager prepared for the weakness he named and
  // the read was sound, it is worth a few percent in that area. If he called
  // it wrong, the week was spent on a problem the opposition do not have.
  if (userTeamId === state.userClubId && (fx.homeId === state.userClubId || fx.awayId === state.userClubId)) {
    const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
    const edge = analystEdge(state, oppId)
    if (edge) {
      if (edge.right) {
        const mine = fx.homeId === state.userClubId ? home : away
        const theirs = fx.homeId === state.userClubId ? away : home
        layer(theirs, edge.unit, 0.955)
        layer(mine, edge.unit, 1.03)
      }
      settleAnalyst(state, oppId)
    }
  }

  // dynamic bad blood: derby-lite heat when there's history between the clubs
  const grudge = !derby ? grudgeBetween(state, fx.homeId, fx.awayId) : null
  if (grudge) { layer(home, 'card', 1.25); layer(away, 'card', 1.25) }
  // old boys: a man facing his former club plays the game of his life
  // (club matches only - career rows never reference national sides)
  let returnee: Player | null = null
  let returneeApps = 0
  if (state.clubs[fx.homeId] && state.clubs[fx.awayId]) {
    for (const side of [home, away]) {
      const oppId = side === home ? fx.awayId : fx.homeId
      for (const id of side.lineup) {
        const p = id != null ? state.players[id] : null
        if (!p || side.exIds.has(p.id)) continue
        const oldApps = oldBoyApps(p, oppId)
        if (!oldApps) continue
        side.exIds.add(p.id)
        if (side.onPitch.has(p.id)) side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) + 0.2)
        if (oldApps > returneeApps) { returnee = p; returneeApps = oldApps }
      }
    }
  }
  // big-game players find another gear when it really matters
  if (fx.stage || derby) {
    for (const side of [home, away]) {
      let n = 0
      for (const id of side.lineup.slice(0, 15)) {
        const p = id != null ? state.players[id] : null
        if (p?.trait === 'Big-Game Player') { n++; side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) + 0.3) }
      }
      layer(side, 'attack', 1 + Math.min(n, 3) * 0.008)
    }
  }
  // THE SCALP (16C, user: "the pressure should be building on the squad...
  // spotlight should be on us and only a good manager should stay unbeaten").
  // A side 8+ competitive games unbeaten this season is everyone's cup final:
  // the chaser lifts, flat, and the holder tightens under the weight - but the
  // nerves tax is discounted by what the manager built. An experienced XV with
  // a good room plays through the noise almost untouched; a young side with a
  // wobbling one feels all of it. Applies to ANY club on a run, both ways in
  // the same match, so it is a law of the world rather than a tax on the user.
  // Deterministic from state like every pre-match dial - no rng is drawn.
  if (state.clubs[fx.homeId] && state.clubs[fx.awayId] && fx.compId !== 'fr') {
    for (const [id, holder, chaser] of [[fx.homeId, home, away], [fx.awayId, away, home]] as [string, SideCtx, SideCtx][]) {
      const run = unbeatenRun(state, id)
      if (run < 8) continue
      const heat = Math.min(run - 7, 9) // grows to a cap at 16 unbeaten
      layer(chaser, 'attack', 1 + heat * 0.004)
      let age = 0, morale = 0, n = 0
      for (const pid of holder.lineup.slice(0, 15)) {
        const p = pid != null ? state.players[pid] : null
        if (!p) continue
        age += p.age; morale += p.morale; n++
      }
      const calm = n
        ? Math.max(0, Math.min(1, ((age / n - 25) / 6) * 0.5 + ((morale / n - 5) / 4) * 0.5))
        : 0.5
      layer(holder, 'attack', 1 - heat * 0.004 * (1 - calm))
    }
  }

  // THE WIDTH MATCHUP (18D). Defensive width is read against the opponent's
  // attacking shape at kick-off: a spread line blunts an expansive attack, a
  // narrow one blunts a forward assault, and the WRONG call pays the other
  // way in equal measure - rock, paper, scissors rather than a free dial.
  // Through layer() so it survives recomputes; 50 (or a save without the
  // dial) multiplies by exactly 1.0 and the fingerprint holds.
  {
    const fT = (v: number | undefined) =>
      (Number.isFinite(v as number) ? Math.max(0, Math.min(100, v as number)) - 50 : 0) / 50
    for (const [mine, theirs] of [[home, away], [away, home]] as const) {
      const myT = state.clubs[mine.teamId]?.tactic
      const oppT = state.clubs[theirs.teamId]?.tactic
      if (!myT || !oppT) continue
      const w = 1 + 0.05 * fT(myT.defWidth) * fT(oppT.style)
      if (w !== 1) layer(mine, 'defence', w)
    }
  }

  if (weather === 'Rain') goalPenalty = 0.09
  if (weather === 'Wind') goalPenalty = 0.09
  if (weather === 'Snow') goalPenalty = 0.1

  // Attendance breathes with success: winning sides pack the ground,
  // struggling ones see gaps - and no two gates are ever identical.
  const hostClub = state.clubs[fx.homeId]
  if (hostClub) {
    // formGuide sorts by week; a raw slice of the fixtures array reads appended
    // cup rounds out of calendar order (the Home pips bug). No rng is drawn
    // here, so the stream and the fingerprint are untouched.
    const recent = formGuide(state, hostClub.id, 4)
    let formPts = 0
    for (const r of recent) formPts += r === 'W' ? 1 : r === 'D' ? 0.5 : 0
    const formF = recent.length ? (formPts / recent.length - 0.5) * 0.16 : 0 // hot streak ±8%
    const confF = (hostClub.boardConfidence - 55) / 800                       // mood around the club
    const fanF = hostClub.id === state.userClubId ? ((state.fanMood ?? 60) - 60) / 900 : 0
    let interest = clamp(
      0.44 + hostClub.rep / 250 + (state.clubs[fx.awayId]?.rep ?? 60) / 430 + formF + confF + fanF + gauss(rng) * 0.05,
      0.24, 0.96)
    if (derby) interest = clamp(interest + 0.16, 0.5, 0.99)
    if (fx.stage) interest = clamp(interest + 0.08, 0.5, 0.99) // knockout fever
    // Nobody fills a ground for a pre-season friendly. The audit found 24,330
    // of 25,849 at Welford Road for one, paying £730k at the gate - a bigger
    // payday than most league Saturdays, for a game that does not count.
    if (fx.compId === 'fr') interest *= 0.38
    // a live count, never a round sell-out figure twice
    const jitter = Math.floor(rng() * Math.max(60, hostClub.capacity * 0.012))
    // seats you can actually shift: the smaller of the ground and the catchment
    let sellable = Math.min(hostClub.capacity, demandCeiling(hostClub))
    // a showpiece final at a neutral ground: two travelling supports plus the
    // neutrals fill a stadium no catchment model applies to. The gauss above
    // is still drawn and folded in, so the rng stream is identical - a final
    // just reads it as the difference between 88% and 99% of Twickenham.
    if (fx.venue) {
      sellable = fx.venue.capacity
      interest = clamp(0.93 + (interest - 0.6) * 0.15, 0.88, 0.99)
    }
    fx.att = Math.max(400, Math.round(sellable * interest) - jitter)
    // a testimonial packs the ground whatever the fixture list says
    if (fx.testimonial != null) fx.att = Math.max(fx.att, sellable - jitter)
  }

  // every match started together deepens a partnership (counted at kick-off,
  // after this match's units were computed from the old familiarity)
  state.chem ??= {}
  for (const side of [home, away]) {
    for (const [i, j] of CHEM_SLOTS) {
      const a = side.lineup[i], b = side.lineup[j]
      if (a != null && b != null) {
        const k = chemKey(a, b)
        state.chem[k] = (state.chem[k] ?? 0) + 1
      }
    }
  }

  // the terraces are worth points: a bouncing home crowd lifts the side,
  // a mutinous one flattens it (user's club only - the AI crowds average out)
  let hfa = state.clubs[fx.homeId] ? 1.06 : 1.03
  // F27: and the trip the other lot made. A flat 1.06 said a bus up the M1 and a
  // flight to the highveld cost a visiting side the same thing, which is nonsense
  // in a world where Belfast and Pretoria are in the same competition. The edge is
  // a REDISTRIBUTION with a mean of exactly 1 (scripts/venueprobe.ts holds it
  // there), so the hard trips take from the easy ones rather than from the away
  // side everywhere: a local derby is now marginally less of a fortress than it
  // was, which is the half of the trade that keeps the books balanced.
  const venue = venueEffect(state, fx.homeId, fx.awayId, fx.week)
  hfa *= venue.edge
  if (fx.homeId === state.userClubId) hfa += ((state.fanMood ?? 60) - 60) * 0.0006
  // a final at a neutral ground has no host: the side listed as home is only
  // the winner of the first semi-final, and Twickenham does not sing for him.
  // Exactly 1.0 - a deterministic gate, no rng consulted, so only finals move.
  if (fx.venue) hfa = 1

  const ctx: LiveCtx = {
    fx, home, away, rng, detail, weather, derby, goalPenalty,
    hfa,
    events: [], lastMin: 0,
    isUser: fx.homeId === userTeamId || fx.awayId === userTeamId,
    userSideId: fx.homeId === userTeamId ? fx.homeId : fx.awayId === userTeamId ? fx.awayId : null,
    tick: 0, seg: 0, awaiting: null, motmId: null, talkUsed: false, subsUsed: 0,
    preTalk: null, decision: null, momo: 0, grudge: grudge?.reason ?? null,
  }

  // THE ANALYST'S HOMEWORK (pillar 2): an analyst-archetype dugout facing the
  // user starts with its plan pulled toward the counter to the user's habit.
  // Layered like the referee - a substitution cannot wash it off - and drawn
  // from no rng: an empty tendency window means nothing happens, which is
  // every calibrated harness and every fresh world.
  for (const side of [home, away]) {
    if (side.isUser || !ctx.isUser) continue
    const shift = analystShift(state, side.teamId)
    if (!shift) continue
    for (const [u, m] of Object.entries(shift.layers)) layer(side, u as keyof SideMods, m)
    pushLine(state, ctx, 0, 'SUB', side, state.clubs[side.teamId]?.coach ? 'comm.oppCoachNamed' : 'comm.oppCoach', {
      coach: state.clubs[side.teamId]?.coach ?? '',
      team: teamShort(state, side.teamId),
      pattern_k: `comm.pattern${shift.pattern[0].toUpperCase()}${shift.pattern.slice(1)}`,
    })
  }
  if (fx.venue) {
    pushLine(state, ctx, 0, 'KO', home, fx.att ? 'comm.koFinalDayGate' : 'comm.koFinalDay',
      { venue: fx.venue.name, city: fx.venue.city, att: fx.att ?? 0 })
  } else if (derby) {
    pushLine(state, ctx, 0, 'KO', home, fx.att ? 'comm.koDerbyGate' : 'comm.koDerby',
      { derby: derbyName(fx.homeId, fx.awayId) ?? '', att: fx.att ?? 0 })
  } else if (grudge) {
    pushLine(state, ctx, 0, 'KO', home, 'comm.koGrudge', { reason_k: grudge.rk ?? 'common.nothing', ...(grudge.rv ?? {}) })
  } else {
    pushLine(state, ctx, 0, 'KO', home, 'comm.koPlain', {
      wx_k: weather === 'Rain' ? 'comm.koRain' : weather === 'Wind' ? 'comm.koWind' : weather === 'Snow' ? 'comm.koSnow' : 'common.nothing',
    })
  }
  if (uncontested) {
    const short = !homeFR.legal
      ? teamShort(state, fx.homeId)
      : teamShort(state, fx.awayId)
    pushLine(state, ctx, 1, 'SUB', null, 'comm.uncontested', { team: short })
  }
  if (fx.homeId === state.userClubId) {
    const mood = state.fanMood ?? 60
    if (mood >= 80) pushLine(state, ctx, 1, 'SUB', home, 'comm.crowdBouncing')
    else if (mood <= 30) pushLine(state, ctx, 1, 'SUB', home, 'comm.crowdFlat')
  }
  if (fx.testimonial != null && state.players[fx.testimonial]) {
    const hero = state.players[fx.testimonial]
    pushLine(state, ctx, 1, 'SUB', home, 'comm.testimonial', { player: hero.name }, hero.id)
  }
  if (returnee && returneeApps >= 10) {
    const exSide = home.exIds.has(returnee.id) ? home : away
    const oldClub = teamShort(state, exSide === home ? fx.awayId : fx.homeId)
    pushLine(state, ctx, 1, 'SUB', exSide, 'comm.oldBoy', {
      player: returnee.name, oldClub, n: returneeApps,
      tail_k: exSide === home ? 'comm.oldBoyKnowsThem' : 'comm.oldBoyPolite',
    }, returnee.id)
  }
  // a landmark afternoon announced at kickoff: the appearance he is about
  // to make sits on the salute ladder
  if (ctx.detail) {
    for (const side of [home, away]) {
      if (side.teamId !== state.userClubId) continue
      for (const id of side.lineup.slice(0, 15)) {
        const p = id != null ? state.players[id] : null
        if (!p) continue
        const cApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0) + 1
        if ([50, 100, 150, 200, 250].includes(cApps)) {
          pushLine(state, ctx, 1, 'SUB', side, 'comm.milestoneApps', { player: p.name, n: cApps }, p.id)
        }
      }
    }
  }
  return ctx
}

/**
 * ---- WHAT THE EIGHTY MINUTES WERE WORTH TO EVERYONE WHO PLAYED ----
 *
 * User, after winning 75-7: "this was the player rating - feels off?" Nine of
 * his fifteen sat on 6.0 while the wing who scored took 9.6.
 *
 * He was right, and the measurement was worse than the impression. Over four
 * seasons at Northampton the banked ratings read:
 *
 *   won by 15-39   mean 6.73   26% rated 7+
 *   won by 1-14    mean 6.68   23% rated 7+
 *   lost by 1-14   mean 5.82    3% rated 7+
 *   lost by 15+    mean 5.81    3% rated 7+
 *
 * A thirty-point win and a one-point win were 0.05 apart. Losing by three and
 * losing by forty were identical. The scoreboard was a win/loss SWITCH and
 * nothing more, because the only thing that meaningfully moved a mark was
 * scoring a try (+0.9) with a trickle for the goal kicker (+0.15). Nothing in
 * the model knew the difference between a hammering and a scrap.
 *
 * Two terms, both shared by every man who got on the pitch:
 *
 *   THE RESULT, which is symmetric. A win is +0.45 and a defeat -0.45, where it
 *   used to be +0.5 against -0.3 with a draw punished as a non-win. Symmetric
 *   means the two sides of any fixture cancel, so the world's mean rating is
 *   held by construction rather than by hoping - and a draw is now neutral,
 *   which is what a draw is.
 *
 *   THE MARGIN, also symmetric, capped so that a cricket score cannot hand out
 *   nines. 28 points is the divisor because that is roughly the gap at which a
 *   game stops being a contest; the cap lands 75-7 on the ceiling, which is
 *   where the manager who asked would put it.
 *
 * WHAT IS DELIBERATELY NOT HERE. A term for winning the scrum or the breakdown
 * was drafted and cut. The unit figures it would read carry the tactical dials,
 * so a rating built on them could be farmed by a slider - and ratings feed form,
 * which feeds selection. That is the free-lunch shape the kicking dial had, and
 * dialweight cannot currently resolve effects that small (docs/audit-handoff).
 * The forwards/backs gap is real and measured (7% of forwards rated 7+ against
 * 18% of backs); it is not closed here, because closing it with a number nobody
 * can validate is how the last three calibrations got reverted.
 */
const RATING_RESULT = 0.45
const RATING_MARGIN_DIV = 28
const RATING_MARGIN_CAP = 0.9
// A HAMMERING OUTRANKS A HANDSOME WIN (user, after the 106-3: "player ratings
// feel better but still a little way off for a 106-3 game"). The main slope
// caps at a 25-point margin so a cricket score cannot hand out nines on its
// own - but capping dead flat meant 31-6 and 106-3 paid every man exactly the
// same. Past the cap the term keeps climbing at about a fifth of the slope,
// to its own hard ceiling: the full extra +0.35 arrives by a 53-point margin.
// Exactly symmetric, so the two sides of any fixture still cancel and the
// world's mean mark holds by construction; and the team term still never
// reaches form, so the difficultyprobe lesson stands untouched.
const RATING_TAIL_DIV = 80
const RATING_TAIL_CAP = 0.35

export function teamRatingTerm(side: SideCtx, other: SideCtx): number {
  const margin = side.score - other.score
  const result = margin > 0 ? RATING_RESULT : margin < 0 ? -RATING_RESULT : 0
  const a = Math.abs(margin)
  const tail = Math.min(RATING_TAIL_CAP, Math.max(0, (a - RATING_MARGIN_CAP * RATING_MARGIN_DIV) / RATING_TAIL_DIV))
  const by = Math.sign(margin) * (Math.min(RATING_MARGIN_CAP, a / RATING_MARGIN_DIV) + tail)
  return result + by
}

/** Average remaining energy of a side's on-pitch players, 0-100. */
export function sideEnergy(side: SideCtx): number {
  let sum = 0, n = 0
  for (const id of side.onPitch) { sum += side.energy.get(id) ?? 70; n++ }
  return n ? sum / n : 70
}

const FW_POS = new Set(['LP', 'HK', 'TP', 'LK', 'FL', 'N8'])

/** Drain the petrol tanks of everyone on the pitch for one tick. */
function drainEnergy(state: GameState, ctx: LiveCtx, side: SideCtx) {
  const wF = ctx.weather === 'Snow' ? 1.1 : 1
  for (const id of side.onPitch) {
    const p = state.players[id]
    if (!p) continue
    const base = (2.0 + (20 - p.a.sta) * 0.14) * (inRedZone(p) ? 1.12 : 1)
    const posF = FW_POS.has(p.pos) ? 1.1 : 1
    const e = side.energy.get(id) ?? 80
    side.energy.set(id, Math.max(0, e - base * side.tempoF * side.drainF * (side.repF ?? 1) * posF * wF))
  }
}

/** No kick at goal is a certainty: base skill, then form (a kicker in a
 *  purple patch is a different animal), confidence (morale) and the day's
 *  conditions all move the needle. Floor drops to 38% on a bad day. */
function kickChance(state: GameState, kicker: Player | null, base: number, div: number, goalPenalty: number, side: SideCtx): number {
  if (!kicker) return 0.5 - goalPenalty + side.goalBonus
  const skill = base + kicker.a.goa / div
  const formF = (kicker.form - 6) * 0.012      // ±5% across the form range
  const confF = (kicker.morale - 6.5) * 0.008  // nerves show from the tee
  const traitB = kicker.trait === 'Siege Gun' ? 0.03 : 0
  const floor = kicker.trait === 'Metronome' ? 0.45 : 0.38
  return clamp(skill + formF + confF - goalPenalty + side.goalBonus + traitB, floor, 0.93)
}

/** Take the three points: roll the kick at goal. */
function takePenaltyShot(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  const { rng, detail, goalPenalty } = ctx
  const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
  const pPen = kickChance(state, kicker, 0.5, 34, ctx.goalPenalty ?? 0, side)
  if (rng() < pPen) {
    side.score += 3
    side.pens += 1
    if (kicker) {
      kicker.stats.pens += 1; kicker.stats.points += 3
      side.ratings.set(kicker.id, (side.ratings.get(kicker.id) ?? 6) + 0.15)
    }
    // The banks hold keys now, and the draw is unchanged: one call to rng(),
    // the same index, the same line. Where a bank's line names the kicker and
    // there is no kicker to name, "The kicker" is a WORD and gets a key of its
    // own rather than being passed in as a variable.
    pushLine(state, ctx, min, 'PEN', side, PEN_LINES[Math.floor(rng() * PEN_LINES.length)],
      { player: kicker?.name ?? tIn('en', 'comm.theKicker') }, kicker?.id)
  } else if (detail && rng() < 0.7) {
    pushLine(state, ctx, min, 'SUB', side, kicker ? 'comm.penWideNamed' : 'comm.penWide',
      { player: kicker?.name ?? '' }, kicker?.id)
  }
}

/** Score a try (+ conversion attempt) for a side - shared by open play and set-piece strikes. */
/** `line`/`lineV` let a set-piece strike supply its own wording - a maul that
 *  rumbles over reads better than the generic bank - and it is a KEY, not a
 *  sentence, for the same reason everything else here is. */
function scoreTry(
  state: GameState, ctx: LiveCtx, side: SideCtx, min: number,
  line?: string, forceScorer?: Player | null, lineV?: Record<string, string | number>,
) {
  const { rng, goalPenalty } = ctx
  const scorer = forceScorer ?? tryScorer(state, side, rng)
  side.score += 5
  side.tries += 1
  if (scorer) {
    // ---- A TRY IS SCORED BY FIFTEEN MEN ----
    //
    // Measured across four seasons: forwards averaged 5.50 and 12% rated 7+,
    // backs 5.68 and 15%, and the cause is directly here. Match ratings are
    // built almost entirely from try credit, and tryScorer weights a wing at
    // 5.0 against a tighthead at 0.7 - so the men who won the ball, held the
    // scrum and cleared the ruck earned nothing for any of it while the man who
    // finished the move took the whole 0.9.
    //
    // So the finisher's credit is now shared with the platform that made it.
    // A REDISTRIBUTION, NOT AN ADDITION: 0.62 to the scorer plus 0.035 to each
    // of the eight forwards on the pitch comes to exactly 0.90, the old flat
    // figure, so the league's mean mark does not move and the world does not
    // quietly drift towards eights. The scorer is still far and away the
    // biggest single beneficiary of his own try, as he should be.
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.62)
    for (const id of side.onPitch) {
      const f = state.players[id]
      if (f && FW_POS.has(f.pos)) side.ratings.set(id, (side.ratings.get(id) ?? 6) + 0.035)
    }
    scorer.stats.tries += 1
    scorer.stats.points += 5
  }
  const wetTry = (ctx.weather === 'Rain' || ctx.weather === 'Snow') && rng() < 0.25
  const derbyTry = ctx.derby && rng() < 0.3
  const tryPool = derbyTry ? TRY_LINES_DERBY : wetTry ? TRY_LINES_WET : TRY_LINES
  // `line` is a set-piece strike's own wording, already a key, and it wins
  // when the caller supplied one.
  if (line) pushLine(state, ctx, min, 'TRY', side, line, lineV, scorer?.id)
  else if (scorer) pushLine(state, ctx, min, 'TRY', side, tryPool[Math.floor(rng() * tryPool.length)], { player: scorer.name }, scorer.id)
  else pushLine(state, ctx, min, 'TRY', side, 'comm.tryPackDrive')
  const cTries = scorer ? scorer.career.reduce((s, c) => s + c.tries, 0) + scorer.stats.tries + (scorer.hist?.tries ?? 0) : 0
  if (scorer && ctx.detail && [25, 50, 75, 100].includes(cTries)) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryCareerMilestone', { n: cTries, player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && [10, 15, 20, 25].includes(scorer.stats.tries)) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.trySeasonCount', { n: scorer.stats.tries, player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && scorer.id === ctx.fx.testimonial) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryAtTestimonial', { player: scorer.name }, scorer.id)
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.3)
  } else if (scorer && ctx.detail && side.exIds.has(scorer.id) && (min + scorer.id) % 4 < 3) {
    // deterministic gates on all detail-only flavour: commentary must never
    // consume the shared rng stream (the EK/ER lesson, applied everywhere)
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryNoCelebration', { player: scorer.name }, scorer.id)
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.2)
  } else if (scorer && ctx.detail && scorer.retiring && (scorer.ca >= 72 || (scorer.caps ?? 0) >= 25) && (min + scorer.id) % 5 < 3) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryRetiringOvation', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && (scorer.rust ?? 0) >= 2 && (min + scorer.id) % 10 < 7) {
    // gate is deterministic (minute + id), not an rng draw: commentary must
    // never move the sim stream - see the EK lesson
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryComeback', { player: scorer.name }, scorer.id)
  }
  const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
  const pCon = kickChance(state, kicker, 0.45, 32, goalPenalty, side)
  if (rng() < pCon) {
    side.score += 2
    if (kicker) { kicker.stats.cons += 1; kicker.stats.points += 2 }
    pushLine(state, ctx, min + 1, 'CON', side, CON_LINES[Math.floor(rng() * CON_LINES.length)],
      { player: kicker?.name ?? tIn('en', 'comm.theKicker') }, kicker?.id)
  } else {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.conWide')
  }
}

/** Resolve the user's touchline call on a kickable penalty. */
export function resolveDecision(state: GameState, ctx: LiveCtx, choice: 'posts' | 'corner' | 'tap'): string {
  const d = ctx.decision
  if (!d) return ''
  ctx.decision = null
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const min = Math.min(79, d.min + 1)
  const rng = ctx.rng
  if (choice === 'posts') {
    takePenaltyShot(state, ctx, mine, min)
    return t('touch.pointsOnBoard')
  }
  if (choice === 'corner') {
    // THE MAUL IS A SET-PIECE CONTEST, so it reads the set piece: your lineout
    // AND your pack against their defence AND their breakdown. It used to read
    // one unit against a defensive average that barely moves on the 1-20 scale,
    // so the corner never climbed out of the low thirties and the boot was the
    // right answer at every club in the game - measured at +2.1 points a match
    // over the corner at a strong club and +4.5 at a weak one. A decision the
    // engine stops the clock for should not have one answer.
    const drive = mine.units.lineout * 0.6 + mine.units.scrum * 0.4
    const stop = opp.units.defence * 0.5 + opp.units.breakdown * 0.5
    const pTry = clamp(0.34 + (drive - stop) * 0.030, 0.15, 0.62)
    pushLine(state, ctx, min, 'SUB', mine, 'comm.maulToCorner')
    if (rng() < pTry) {
      const forwards = mine.lineup.slice(0, 8)
        .map(id => id != null ? state.players[id] : null)
        .filter((p): p is Player => !!p && mine.onPitch.has(p.id))
      const scorer = forwards.length ? forwards[Math.floor(rng() * forwards.length)] : null
      scoreTry(state, ctx, mine, min + 1, scorer ? 'comm.tryMaulRumbles' : undefined, scorer, scorer ? { player: scorer.name } : undefined)
      return t('touch.maulDelivers')
    }
    if (rng() < 0.5) {
      pushLine(state, ctx, min + 1, 'SUB', opp, 'comm.maulHeldUp', { team: teamShort(state, opp.teamId) })
      return t('touch.gambleEmpty')
    }
    mine.poss += 1.2
    pushLine(state, ctx, min + 1, 'SUB', mine, 'comm.maulRepelledPenalty')
    return t('touch.pinnedNoPoints')
  }
  // tap and go
  mine.poss += 1.4
  if (rng() < 0.17) {
    scoreTry(state, ctx, mine, min, undefined)
    return t('touch.quickTapWorks')
  }
  pushLine(state, ctx, min, 'SUB', mine, 'comm.quickTapPhases', { team: teamShort(state, mine.teamId) })
  return t('touch.tempoLifted')
}

/** AI (and injury-forced) bench management: tired starters are replaced. */
/** Best available bench replacement for the man leaving the pitch: judged at
 *  HIS shirt's position, so a felled prop gets the prop cover and not just
 *  whoever sits first on the bench. */
function pickBenchSub(state: GameState, side: SideCtx, outId: number): Player | null {
  const bench = side.lineup.slice(15)
    .map(id => id != null ? state.players[id] : null)
    .filter((s): s is Player => !!s && !side.onPitch.has(s.id) && !s.injury && !side.ratings.has(s.id))
  if (!bench.length) return null
  const slot = side.lineup.indexOf(outId)
  if (slot >= 0 && slot < 15) {
    const pos = XV_SLOTS[slot].pos
    let best: Player | null = null
    let bestS = -1
    for (const s of bench) {
      const v = effAt(s, pos)
      if (v > bestS) { bestS = v; best = s }
    }
    return best
  }
  return bench[0]
}

function aiAutoSubs(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  // the user manages his own bench (except forced injury subs elsewhere)
  if (side.isUser) return
  if (ctx.tick < 11) return
  const bulk = ctx.tick === 15 // classic 55-60' bench emptying
  let made = 0
  for (let slot = 0; slot < 15 && made < (bulk ? 4 : 1); slot++) {
    const outId = side.lineup[slot]
    if (outId == null || !side.onPitch.has(outId)) continue
    const e = side.energy.get(outId) ?? 70
    if (!bulk && e > 32) continue
    if (bulk && e > 55) continue
    const pos = XV_SLOTS[slot].pos
    // best unused bench cover for the slot
    let best: Player | null = null
    let bestS = -1
    for (let b = 15; b < 23; b++) {
      const id = side.lineup[b]
      if (id == null) continue
      const p = state.players[id]
      if (!p || p.injury || side.ratings.has(id) || side.onPitch.has(id)) continue
      const s = effAt(p, pos)
      if (s > bestS) { bestS = s; best = p }
    }
    if (!best) return
    side.onPitch.delete(outId)
    side.onPitch.add(best.id)
    side.ratings.set(best.id, 6)
    side.energy.set(best.id, benchTank(state.players[best.id]))
    const benchSlot = side.lineup.indexOf(best.id)
    side.lineup[slot] = best.id
    if (benchSlot >= 0) side.lineup[benchSlot] = outId
    // the AI coach's bench plan is subject to the same laws (F4)
    applyBrief(state, side, best.id)
    forcedSwitchCost(state, ctx, side, outId, best, min)
    made++
  }
}

/** The last twenty minutes belong to the bench (F4).
 *
 *  A 6-2 reshapes the closing quarter through the middle; a 4-4 reshapes it out
 *  wide. The two are deliberate mirror images so that a world picking both does
 *  not drift, and the orthodox 5-3 is exactly neutral so that doing nothing
 *  costs nothing.
 *
 *  It only pays out in proportion to how much of the bench is actually on the
 *  field. Naming a bomb squad and leaving it sitting changes nothing, which is
 *  what makes this an economy rather than another slider. */
function applyFinishers(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  if (side.finisherDone) return
  side.finisherDone = true
  const def = SPLIT_BY_ID[side.split]
  if (!def || def.id === '5-3') return
  const on = [...side.onPitch].filter(id => side.benchIds.has(id)).length
  const k = Math.min(1, on / 3) // three of the eight is a full commitment
  if (k <= 0) return
  const lerp = (m: number) => 1 + (m - 1) * k
  layer(side, 'scrum', lerp(def.scrum))
  layer(side, 'breakdown', lerp(def.breakdown))
  layer(side, 'defence', lerp(def.defence))
  layer(side, 'attack', lerp(def.attack))
  // one line, and only when the plan is genuinely on the field. Deterministic:
  // no roll of the shared match rng decides whether the manager hears about it.
  if (ctx.detail && side.isUser && on >= 3) {
    pushLine(state, ctx, min, 'SUB', side, def.id === '6-2' ? 'comm.benchSixTwo' : 'comm.benchFiveThree',
      { team: teamShort(state, side.teamId) })
  }
}

/**
 * ---- THE TANK A REPLACEMENT CARRIES ON ----
 *
 * User: "a player who had low energy before the game who was on the bench
 * suddenly had 100% when coming on from the bench."
 *
 * SIX places put a man on the pitch - the AI coach's rotation, an injury
 * replacement, an HIA, the manager's own substitution, a positional swap and a
 * reversal - and five of them wrote `Math.max(60, cond)`. The sixth was not a
 * substitution site at all: applyBrief's 'impact' case ran immediately
 * afterwards and wrote a flat `100`, wiping the figure the substitution had
 * just worked out. A man at 45% came on with a full tank because of what his
 * bench seat had been told to do.
 *
 * The second half of that bug is the more interesting one, and it is why this
 * is a bonus rather than a set: writing 100 absolute REWARDED EXHAUSTION. A
 * fresh replacement on 95 gained 5; a spent one floored at 60 gained 40. The
 * optimal play was to brief your most knackered forward as the impact man,
 * which is the opposite of what a bench is for.
 *
 * So: one function decides what a replacement is worth, every site calls it,
 * and a brief adds a bounded top-up on TOP of it instead of replacing it.
 *
 * The 60 floor is deliberate and stays: a replacement has spent the hour
 * sitting down, so he is fresher than his training-ground condition says. It
 * is a floor on the tank he brings, not a claim that he is fit.
 */
function benchTank(p: Player | null | undefined): number {
  return Math.max(60, Math.min(100, p?.cond ?? 85))
}

/** What a bench brief adds to that tank. Bounded, and applied to whatever the
 *  man actually had, so it can never again be worth more to the tired. */
const IMPACT_TOPUP = 8

/** What the man was told as he pulled the shirt on (F4).
 *
 *  Capped at three briefed replacements a side: eight stacking instructions
 *  would be a bigger swing than any tactic in the game, and a bench is not a
 *  cheat code. Returns the phrase to hang on the substitution line, or null. */
/** The one-line note that comes with a bench instruction, as a KEY - it is
 *  appended to the substitution's commentary, so it has to travel the same way
 *  the commentary does. */
function applyBrief(state: GameState, side: SideCtx, inId: number): string | null {
  const club = state.clubs[side.teamId]
  const seat = side.seatOf.get(inId)
  if (!club || seat == null) return null
  const brief = briefForSeat(club, seat)
  if (brief === 'orders') return null
  if ((side.briefsUsed ?? 0) >= 3) return null
  side.briefsUsed = (side.briefsUsed ?? 0) + 1
  switch (brief) {
    case 'impact':
      layer(side, 'attack', 1.025)
      layer(side, 'defence', 0.99)
      // a top-up on what he brought, never a reset to full (see benchTank)
      side.energy.set(inId, Math.min(100, (side.energy.get(inId) ?? benchTank(state.players[inId])) + IMPACT_TOPUP))
      return 'comm.briefImpact'
    case 'shore':
      layer(side, 'defence', 1.025)
      layer(side, 'attack', 0.99)
      layer(side, 'card', 0.96)
      return 'comm.briefShore'
    case 'manage':
      layer(side, 'kicking', 1.03)
      layer(side, 'attack', 0.995)
      layer(side, 'tempo', 0.97)
      return 'comm.briefManage'
    default:
      return null
  }
}

/** The bill for a man in the wrong half of the team, and it has to be paid on
 *  both sides of the ledger.
 *
 *  The first cut charged attack 0.92 and defence 0.96, which read as a fair
 *  trade and was not: it took 0.4 points a game off the whole world, because
 *  attack carries weight 0.55 in the attacking ratio while defence carries 0.7
 *  in the defending one. Neutrality needs 0.55 * attackLoss == 0.7 * defenceLoss,
 *  so the defensive hole has to be the deeper of the two - which is also the
 *  truer picture. A flanker at 13 does not stop scoring the same way he stops
 *  carrying; he leaks. */
const COVER_ATT = 0.92
const COVER_DEF = 0.937

/** Base try chance per tick at ratio 1. Was a flat 0.115 for the whole match;
 *  the last-quarter surge in simTick spends the difference, so the season's
 *  scoring totals stay on the measured band while the tries move later. */
const TRY_BASE = 0.108

/** The cost of a thin bench: a man in the wrong half of the team.
 *
 *  This is the bill a 6-2 can be presented with. Lose a centre once both your
 *  backs have been used and a flanker finishes the game in the 13 shirt, and no
 *  amount of shove makes up for it. Charged once, to any side, so the risk is
 *  the same law for everybody. */
function forcedSwitchCost(state: GameState, ctx: LiveCtx, side: SideCtx, outId: number, inP: Player, min: number) {
  if (side.coverBlown) return
  const out = state.players[outId]
  if (!out) return
  const slot = side.lineup.indexOf(inP.id)
  const shirtPos: Pos | null = slot >= 0 && slot < 15 ? XV_SLOTS[slot].pos : null
  if (!shirtPos) return
  // a natural fit, or a recognised alternative position, is not a crisis
  if (inP.pos === shirtPos || inP.alt.includes(shirtPos)) return
  if (isForward(inP.pos) === isForward(shirtPos)) return
  side.coverBlown = true
  layer(side, 'attack', COVER_ATT)
  layer(side, 'defence', COVER_DEF)
  if (ctx.detail) {
    pushLine(state, ctx, min, 'SUB', side, 'comm.outOfCover',
      { team: teamShort(state, side.teamId), player: inP.name, pos: inP.pos, shirt: shirtPos }, inP.id)
  }
}

function simTick(state: GameState, ctx: LiveCtx, tick: number) {
  const { rng, detail, derby, goalPenalty, home, away } = ctx
  const min = tick * 4 + Math.floor(rng() * 4) + 1
  const poss0: [number, number] = [home.poss, away.poss]

  // the bin empties: ten minutes served and the man comes back on, unless he
  // was replaced while he sat (his shirt no longer names him) or broke down
  for (const s of [home, away]) {
    if (!s.binned.size) continue
    for (const id of [...s.binned]) {
      if ((s.yellowUntil.get(id) ?? 0) > min) continue
      s.binned.delete(id)
      const p = state.players[id]
      if (p && !p.injury && s.lineup.slice(0, 15).includes(id)) s.onPitch.add(id)
    }
  }

  // The bench has been on since the hour mark: the closing quarter takes the
  // shape the 23 was picked for (F4).
  if (tick === 16) {
    applyFinishers(state, ctx, home, min)
    applyFinishers(state, ctx, away, min)
  }

  drainEnergy(state, ctx, home)
  drainEnergy(state, ctx, away)

  // THE BENCH IS A TRAP, AND THIS BAND IS ONLY HALF THE REASON.
  //
  // An audit measured the inversion: over 77 paired fixtures one or two changes
  // gained about a point, three lost 0.6 and eight lost 2.5 - so the winning
  // play was to leave the bench sitting down, while aiAutoSubs empties it for
  // all 100 AI clubs. The cause is that freshness is capped at 22% of a unit's
  // score, which is less than the quality gap from a starter to a seventh
  // replacement, and MAX_SUBS went to eight without the reward widening.
  //
  // WIDENING THIS BAND WAS TRIED AND REVERTED. At 0.66 + 0.34 the Player of the
  // Month count fell from 18 to 11 across awardprobe's three careers and at
  // 0.72 + 0.28 to 14, against a floor of 15 - because the band changes who
  // survives cup rounds, which changes how many clubs clear the three-match
  // gate in a six-week window. A global multiplier on every unit in every match
  // is too blunt an instrument for a bench problem.
  //
  // THE TANK FLOOR IN mkSide WAS TRIED TOO, and reverted for its own reasons
  // (see there). So both levers that widen the freshness gap are known to break
  // something else that is measured, and NOTHING IN THE ENGINE IS CHANGED HERE:
  // the bench inversion is still real and still open.
  //
  // What was fixed is the part that was actively harmful - coachfix.ts was
  // telling managers to make all eight changes, which measures 2.5 points a
  // match worse than making none.
  //
  // The honest next step is not another multiplier. It is to make a
  // replacement's benefit LOCAL to the shirt he replaces - a fresh tighthead
  // against a spent one, priced on those two men - rather than a side-wide
  // average that every other system reads. Both attempts here failed because a
  // side-wide energy term is load-bearing for ratings, cup progression and the
  // board's read of a season, none of which a bench fix should be deciding.
  const eF = (s: SideCtx) => 0.78 + 0.22 * (sideEnergy(s) / 100)

  for (const [side, opp, adv] of [[home, away, ctx.hfa], [away, home, 1]] as [SideCtx, SideCtx, number][]) {
    const numF = 1 - 0.07 * ([...side.yellowUntil.values()].filter(u => u > min).length + side.sent)
    const oppNumF = 1 - 0.07 * ([...opp.yellowUntil.values()].filter(u => u > min).length + opp.sent)
    const att = (side.units.attack * 0.55 + side.units.breakdown * 0.25 + side.units.scrum * 0.1 + side.units.lineout * 0.1) * eF(side)
    const def = (opp.units.defence * 0.7 + opp.units.breakdown * 0.3) * eF(opp)
    // THE BOOT IS TERRITORY (audit 16D). units.kicking was written by the dial,
    // the exits, two roles, the coach and the wind, and read by nothing - a
    // placebo control. It now tilts where the game is played: a ratio of the
    // two kicking games, symmetric so the world mean cannot move (the home
    // factor and the away factor are exact reciprocals).
    const terr = Math.pow(side.units.kicking / Math.max(1, opp.units.kicking), 0.10)
    let ratio = ((att * adv * numF * terr) / Math.max(1, def * oppNumF))
    if (derby) ratio = Math.pow(ratio, 0.72) // form book out the window
    else if (ctx.grudge) ratio = Math.pow(ratio, 0.85) // needle levels the contest
    side.poss += ratio
    let pTry = clamp(TRY_BASE * Math.pow(ratio, 2.6), 0.01, 0.42)
    // THE LAST QUARTER OPENS UP (audit 16D). Measured before this existed:
    // tries were dead flat across the 80 (11.6-14.0% per ten-minute bucket)
    // because both sides drain together and the mutual exhaustion cancels in
    // eF. Real rugby scores roughly a third of its tries after the hour -
    // tired defences miss first. So from tick 15 the shared fatigue itself
    // raises the try chance for BOTH sides; TRY_BASE is set below what the
    // old flat constant was so the season's totals stay on the band.
    if (tick >= 15) {
      const tired = 1 - (sideEnergy(side) + sideEnergy(opp)) / 200
      if (tired > 0) pTry = Math.min(0.42, pTry * (1 + tired * 0.5))
    }
    // GARBAGE TIME IS REAL (user, after a 106-3 win at a top club: "this would
    // be a tight game in real life - the scores feel well off at present").
    // Past five converted tries of lead nobody keeps the hammer down: the
    // fly-half kicks the corners, the bench gets its run, the skipper points
    // at the posts. The damp sits on the LEADING side's try chance only, so a
    // close game never feels it; the floor keeps a true mismatch a rout
    // rather than a cricket score. Same rng draws either way - the stream is
    // untouched, only the threshold the roll is compared against moves.
    const lead = side.score - opp.score
    if (lead > 35) pTry *= Math.max(0.3, 35 / lead)
    const r = rng()
    if (r < pTry) {
      scoreTry(state, ctx, side, min)
    } else if (r < pTry + opp.penRisk) {
      // a kickable penalty: yours is a touchline decision, theirs is automatic
      opp.consPens += 1
      // repeated infringements: the count climbs, the referee's patience
      // runs out, and somebody takes ten in the bin for the team
      const binAt = refFor(ctx.fx.id).patience
      if ((opp.consPens === binAt || opp.consPens === binAt * 2) && opp.onPitch.size > 13) {
        const ps = [...opp.onPitch].map(id => state.players[id]).filter(Boolean)
        if (ps.length) {
          const p = wpick(rng, ps, ps.map(x => x.a.agg))
          opp.yellowUntil.set(p.id, min + 10)
          opp.onPitch.delete(p.id)
          opp.binned.add(p.id)
          p.stats.yc += 1
          opp.ratings.set(p.id, (opp.ratings.get(p.id) ?? 6) - 0.7)
          pushLine(state, ctx, min, 'YC', opp, 'comm.ycRepeated',
            { n: opp.consPens, team: teamShort(state, opp.teamId), player: p.name }, p.id)
        }
      }
      // A standing instruction answers the call for you (F3). Being asked every
      // time is the right default on a big screen and a nuisance on a phone
      // during a nine-penalty afternoon, so the choice is the manager's.
      const standing = state.clubs[side.teamId]?.tactic.penaltyCall ?? 'ask'
      if (detail && side.isUser && !ctx.decision) {
        ctx.decision = { kind: 'penalty', min }
        if (standing === 'ask') {
          pushLine(state, ctx, min, 'SUB', side, 'comm.penKickableAsk', { team: teamShort(state, side.teamId) })
        } else {
          // resolveDecision reads ctx.decision and works out the side itself, so
          // the instruction goes through exactly the path a tap would take
          resolveDecision(state, ctx, standing)
        }
      } else {
        takePenaltyShot(state, ctx, side, min)
      }
    } else if (r < pTry + opp.penRisk + 0.006) {
      const fh = side.lineup[9] != null ? state.players[side.lineup[9]!] : null
      if (fh && rng() < 0.3 + fh.a.kic / 40) {
        side.score += 3
        fh.stats.drops += 1; fh.stats.points += 3
        pushLine(state, ctx, min, 'DG', side, 'comm.dropGoal', { player: fh.name }, fh.id)
      }
    }

    // atmosphere lines for the live ticker
    if (detail && rng() < 0.3) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(Boolean)
      if (ps.length) {
        const p = ps[Math.floor(rng() * ps.length)]
        const e = side.energy.get(p.id) ?? 70
        if (e < 22 && rng() < 0.5) {
          pushLine(state, ctx, min, 'SUB', side, TIRED_LINES[Math.floor(rng() * TIRED_LINES.length)], { player: p.name }, p.id)
        } else {
          const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow'
          const pool = derby && rng() < 0.3 ? FLAVOR_DERBY
            : ctx.fx.compId === 'natl1' && rng() < 0.3 ? FLAVOR_GRASSROOTS
            : ctx.fx.compId === 'pnc' && rng() < 0.3 ? FLAVOR_PACIFIC
            : wet && rng() < 0.3 ? FLAVOR_WET
            : ctx.weather === 'Wind' && rng() < 0.25 ? FLAVOR_WIND
            : FLAVOR
          pushLine(state, ctx, min, 'SUB', side, pool[Math.floor(rng() * pool.length)],
            { player: p.name, team: teamShort(state, side.teamId) }, p.id)
        }
      }
    }

    // discipline - tired sides give away more
    const tiredCards = sideEnergy(side) < 35 ? 1.25 : 1
    if (rng() < side.cardRisk * tiredCards) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(Boolean)
      if (ps.length) {
        const p = wpick(rng, ps, ps.map(x => x.a.agg))
        if (rng() < 0.06) {
          side.sent += 1
          side.onPitch.delete(p.id)
          p.stats.rc += 1
          p.bans += 2 + Math.floor(rng() * 2)
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
          pushLine(state, ctx, min, 'RC', side, 'comm.redCard', { player: p.name }, p.id)
        } else {
          side.yellowUntil.set(p.id, min + 10)
          // he SITS the ten minutes: off the pitch pools, so a man in the bin
          // cannot score a try, take another card or pull an injury while he
          // sits (audit 16D). numF still charges the missing man's strength.
          side.onPitch.delete(p.id)
          side.binned.add(p.id)
          p.stats.yc += 1
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
          pushLine(state, ctx, min, 'YC', side, 'comm.yellowCard', { player: p.name }, p.id)
        }
      }
    }

    // injury - tired legs and rusty returners break down more, though a
    // true home surface keeps a few of them on their feet
    const surface = side.teamId === state.userClubId && ctx.fx.homeId === state.userClubId
      ? facLevel(state, 'pitch') : 0
    if (rng() < 0.019 * (1 - surface * 0.035)) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(p => p && !p.injury)
      if (ps.length) {
        const w = ps.map(p => {
          const rustF = (p.rust ?? 0) > 0 ? 3.4 : 1
          const tiredF = (side.energy.get(p.id) ?? 70) < 25 ? 1.8 : 1
          const loadF = inRedZone(p) ? 1.5 : 1 // 1,300+ season minutes
          return rustF * tiredF * loadF
        })
        const p = wpick(rng, ps, w)
        const [dk, lo, hi] = INJURIES[Math.floor(rng() * INJURIES.length)]
        let weeks = lo + Math.floor(rng() * (hi - lo + 1))
        if (weeks <= 1 && (p.rust ?? 0) === 0 && rng() < 0.55) {
          // a knock, not a casualty: he plays on with heavy legs
          side.energy.set(p.id, Math.max(5, (side.energy.get(p.id) ?? 70) - 28))
          pushLine(state, ctx, min, 'SUB', side, 'comm.heavyKnock', { player: p.name }, p.id)
        } else {
          if (p.clubId === state.userClubId) {
            // the physio and the recovery centre both shorten a lay-off
            const care = (state.staff?.physio ?? 0) * 0.12 + facLevel(state, 'recovery') * 0.03
            if (care > 0) weeks = Math.max(1, Math.round(weeks * (1 - care)))
          }
          p.injury = { desc: tIn('en', dk), dk, until: state.week + weeks, weeks }
          side.onPitch.delete(p.id)
          pushLine(state, ctx, min, 'INJ', side, 'comm.injuryDown', {
            player: p.name, injury_k: dk,
            rush_k: (p.rust ?? 0) > 0 ? 'comm.injuryRushedBack' : 'common.nothing',
          }, p.id)
          const sub = pickBenchSub(state, side, p.id)
          if (sub) {
            side.onPitch.add(sub.id)
            side.ratings.set(sub.id, 6)
            side.energy.set(sub.id, benchTank(sub))
            const slot = side.lineup.indexOf(p.id)
            const bSlot = side.lineup.indexOf(sub.id)
            if (slot >= 0 && slot < 15) {
              side.lineup[slot] = sub.id
              if (bSlot >= 0) side.lineup[bSlot] = p.id
            }
            const brief = applyBrief(state, side, sub.id)
            pushLine(state, ctx, min, 'SUB', side, 'comm.subComesOn',
              { player: sub.name, brief_k: brief ?? 'common.nothing' }, sub.id)
            // and if the bench had nobody who plays there, the side pays (F4)
            forcedSwitchCost(state, ctx, side, p.id, sub, min)
          }
        }
      }
    }

    // Head Injury Assessment: ~1 per 3 matches. Temporary sub while the
    // doctors work; 40% fail and the replacement becomes permanent.
    if (side.hia && ctx.tick >= side.hia.returnTick) {
      const { pid, subId, failed } = side.hia
      const p = state.players[pid]
      const sub = state.players[subId]
      if (p && sub) {
        if (failed) {
          const rtp = 2 + (((pid + ctx.tick) % 2)) // return-to-play: 12-21 days
          p.injury = { desc: 'concussion (failed HIA)', until: state.week + rtp, weeks: rtp }
          const slot = side.lineup.indexOf(pid)
          const bSlot = side.lineup.indexOf(subId)
          if (slot >= 0 && slot < 15) { side.lineup[slot] = subId; if (bSlot >= 0) side.lineup[bSlot] = pid }
          pushLine(state, ctx, min, 'INJ', side, 'comm.hiaFailed', { player: p.name, sub: sub.name }, pid)
        } else {
          side.onPitch.delete(subId)
          side.onPitch.add(pid)
          pushLine(state, ctx, min, 'SUB', side, 'comm.hiaPassed', { player: p.name }, pid)
        }
      }
      side.hia = undefined
    }
    if (!side.hia && rng() < 0.0085) {
      const ids = [...side.onPitch].filter(id => state.players[id] && !state.players[id].injury)
      const p = ids.length ? state.players[ids[Math.floor(rng() * ids.length)]] : null
      const sub = p ? pickBenchSub(state, side, p.id) : null
      if (p && sub) {
        side.onPitch.delete(p.id)
        side.onPitch.add(sub.id)
        side.ratings.set(sub.id, 6)
        side.energy.set(sub.id, benchTank(sub))
        side.hia = { pid: p.id, subId: sub.id, failed: rng() < 0.4, returnTick: ctx.tick + 3 }
        pushLine(state, ctx, min, 'INJ', side, 'comm.hiaLedAway', { player: p.name, sub: sub.name }, p.id)
      }
    }

    // stupid moments - rugby's comedy reel, momentum goes the other way
    if (rng() < 0.006) {
      const ids = [...side.onPitch]
      const p = ids.length ? state.players[ids[Math.floor(rng() * ids.length)]] : null
      if (p) {
        const lines = ['comm.howler1', 'comm.howler2', 'comm.howler3', 'comm.howler4', 'comm.howler5']
        pushLine(state, ctx, min, 'SUB', side, lines[Math.floor(rng() * lines.length)], { player: p.name }, p.id)
        side.ratings.set(p.id, clamp((side.ratings.get(p.id) ?? 6) - 0.5, 1, 10))
        ctx.momo = clamp(ctx.momo + (side === home ? -0.3 : 0.3), -1, 1)
      }
    }

    aiAutoSubs(state, ctx, side, min)
  }

  // momentum needle: who owned the last few minutes
  const dh = home.poss - poss0[0]
  const da = away.poss - poss0[1]
  ctx.momo = clamp(ctx.momo * 0.62 + (dh - da) * 0.55, -1, 1)
  // rolling possession history: each entry is the home share of one tick,
  // so the live 'LAST 10 MINUTES' graphic can average the recent window
  ;(ctx.momoHist ??= []).push(dh + da > 0 ? dh / (dh + da) : 0.5)
}

/**
 * Simulate the next 4-minute tick. Returns what the clock hit:
 * 'play' (normal), 'HT' (40'), 'BRK' (60'), 'FT' (80', match finalised).
 * At HT/BRK the context waits (`awaiting`) until resumed.
 */
export function stepTick(state: GameState, ctx: LiveCtx): 'play' | 'HT' | 'BRK' | 'FT' {
  if (ctx.tick >= 20) return 'FT'
  // play has resumed: the last substitution has now been played and cannot be
  // taken back (16B)
  ctx.lastSub = null
  simTick(state, ctx, ctx.tick)
  ctx.tick += 1
  aiTacticShift(state, ctx)
  if (ctx.tick === 10) {
    ctx.seg = 1
    ctx.awaiting = 'HT'
    pushLine(state, ctx, 40, 'HT', null, 'comm.halfTime', {
      home: teamShort(state, ctx.fx.homeId), away: teamShort(state, ctx.fx.awayId),
      hs: ctx.home.score, ascore: ctx.away.score,
    })
    const possTotal = ctx.home.poss + ctx.away.poss || 1
    pushLine(state, ctx, 40, 'SUB', null, 'comm.halfTimeNumbers', {
      hposs: Math.round((ctx.home.poss / possTotal) * 100), aposs: Math.round((ctx.away.poss / possTotal) * 100),
      htries: ctx.home.tries, atries: ctx.away.tries, hpens: ctx.home.pens, apens: ctx.away.pens,
    })
    return 'HT'
  }
  if (ctx.tick === 15) {
    ctx.seg = 2
    ctx.awaiting = 'BRK'
    pushLine(state, ctx, 60, 'BRK', null, 'comm.hourMark')
    return 'BRK'
  }
  if (ctx.tick === 20) {
    ctx.seg = 3
    ctx.awaiting = null
    finalizeMatch(state, ctx)
    return 'FT'
  }
  return 'play'
}

/** The opposite number is not a statue: an AI side chasing the game opens
 *  up; an AI side protecting a lead late shuts up shop. Once per match. */
function aiTacticShift(state: GameState, ctx: LiveCtx) {
  for (const side of [ctx.home, ctx.away]) {
    if (side.isUser) continue
    const opp = side === ctx.home ? ctx.away : ctx.home
    const diff = side.score - opp.score
    const min = ctx.tick * 4
    const coach = state.clubs[side.teamId]?.coach
    const who = coach ?? `The ${teamShort(state, side.teamId)} coach`
    // THE REACTIVE DUGOUT (pillar 2): a reactive-archetype coach who is being
    // hurt reads the loudest thing the user is doing and counters it from the
    // touchline - at most twice, each counter a trade rather than a free
    // upgrade, and deterministic on the state of the match. He reads the
    // scoreboard and the picture in front of him, not the tendency file.
    if (opp.isUser && archetypeOf(side.teamId, state.clubs[side.teamId]?.rep ?? 78) === 'reactive' && (side.reacted ?? 0) < 2) {
      const window = (side.reacted ?? 0) === 0 ? ctx.tick >= 5 && diff <= -5 : ctx.tick >= 14 && diff <= -10
      if (window) {
        const loud = loudestDial(state.clubs[opp.teamId]?.tactic ?? { style: 50, tempo: 50, kicking: 50, aggression: 50 })
        if (loud) {
          side.reacted = (side.reacted ?? 0) + 1
          // `what` and `how` are the two halves of a sentence and each is a
          // key: a French coach cannot see the problem in English.
          const say = (what: string, how: string) => pushLine(state, ctx, min, 'SUB', side, 'comm.coachSees',
            { who, what_k: what, how_k: how, team: teamShort(state, side.teamId) })
          if (loud.dial === 'style' && loud.v > 50) {
            layer(side, 'defence', 1.05); layer(side, 'breakdown', 0.96)
            say('comm.seesWidth', 'comm.doesWidth')
          } else if (loud.dial === 'style') {
            layer(side, 'breakdown', 1.06); layer(side, 'defence', 0.97)
            say('comm.seesMiddle', 'comm.doesMiddle')
          } else if (loud.dial === 'kicking' && loud.v > 50) {
            layer(side, 'defence', 1.04); layer(side, 'attack', 0.97)
            say('comm.seesAerial', 'comm.doesAerial')
          } else if (loud.dial === 'tempo' && loud.v > 50) {
            layer(side, 'tempo', 0.92); layer(side, 'defence', 1.03)
            say('comm.seesPace', 'comm.doesPace')
          } else if (loud.dial === 'aggression' && loud.v > 50) {
            layer(side, 'card', 0.85); layer(side, 'breakdown', 1.03)
            say('comm.seesPhysical', 'comm.doesPhysical')
          } else {
            // a quiet, conservative habit: press it
            layer(side, 'tempo', 1.08); layer(side, 'defence', 0.98)
            say('comm.seesPassive', 'comm.doesPassive')
          }
        }
      }
    }
    if (side.shifted) continue
    if (ctx.tick >= 12 && diff <= -10) {
      side.shifted = true
      layer(side, 'attack', 1.06)
      layer(side, 'defence', 0.95)
      layer(side, 'tempo', 1.14)
      layer(side, 'card', 1.15)
      pushLine(state, ctx, min, 'SUB', side, 'comm.coachChases', { who, team: teamShort(state, side.teamId) })
    } else if (ctx.tick >= 16 && diff >= 10) {
      side.shifted = true
      layer(side, 'defence', 1.05)
      layer(side, 'attack', 0.94)
      layer(side, 'tempo', 0.88)
      pushLine(state, ctx, min, 'SUB', side, 'comm.coachManages', { who, team: teamShort(state, side.teamId) })
    }
  }
}

/** Play through to the next natural stop (HT, 60' or FT).
 *  Any pending touchline decision is auto-resolved (take the points). */
export function playSegment(state: GameState, ctx: LiveCtx) {
  ctx.awaiting = null
  for (;;) {
    if (ctx.decision) resolveDecision(state, ctx, 'posts')
    const r = stepTick(state, ctx)
    if (ctx.decision) resolveDecision(state, ctx, 'posts')
    if (r !== 'play') { ctx.awaiting = null; break }
  }
}

/** Back-compat helper: plays to the next natural stop (used by full sims). */
export function playHalf(state: GameState, ctx: LiveCtx) {
  playSegment(state, ctx)
  if (ctx.seg === 2) playSegment(state, ctx) // second "half" = segments 2+3
}

/** Pre-match dressing-room speech. One per match, chosen before kick-off. */
export function applyPreTalk(state: GameState, ctx: LiveCtx, kind: 'calm' | 'fire' | 'underdog' | 'expect'): string {
  if (ctx.preTalk) return t('touch.speechMade')
  ctx.preTalk = kind
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const favourites = mine.units.overall >= opp.units.overall
  const say = (opts: string[]) => opts[Math.floor(ctx.rng() * opts.length)]
  // How much of it actually lands. A squad that has not decided about you yet
  // takes in less than half of the same words from a manager who has delivered
  // for two seasons (user: "players take time to trust you fully"). The talk is
  // the same, the room is not - which is what makes trust worth building rather
  // than a number on a screen.
  //
  // Applied by scaling the DISTANCE from 1, so a 1.06 becomes 1.027 at cold
  // trust and stays 1.06 once the room is bought in. Risk multipliers above 1
  // (the fire talk's cards) scale the same way, so an unconvincing rant does
  // not get you the penalties without the aggression.
  // COMPOSED, not replaced (pillar 1): trust is whether you have delivered
  // HERE, standing is whether your name commands this room at all. A rookie
  // in a star dressing room loses most of the talk on both counts; two
  // seasons of results rebuild both. Multiplying the two distances keeps
  // each system's probes meaningful on its own.
  const tf = trustFactor(state) * standing(state).talk
  const scale = (m: number) => 1 + (m - 1) * tf
  switch (kind) {
    case 'calm':
      layer(mine, 'defence', scale(1.06))
      layer(mine, 'card', scale(0.78))
      return say([
        'Cool heads. You walk them through the first twenty minutes - no panic, no cheap penalties.',
        'Quiet voice, slow words. By the end the room is breathing at your pace. First twenty on our terms.',
        'You put the game plan on one whiteboard line and cap the pen. "Do the simple things forever." Nods all round.',
      ])
    case 'fire':
      layer(mine, 'attack', scale(1.07))
      layer(mine, 'breakdown', scale(1.05))
      layer(mine, 'card', scale(1.28))
      return say([
        'The door rattles on its hinges. They leave the shed snorting - expect fireworks, and watch the referee.',
        'You knock a water bottle across the room on the way out. The studs in the tunnel sound like a drumroll.',
        'Two sentences, both loud. The front row leave first and the door does not survive intact. Mind the penalty count.',
      ])
    case 'underdog':
      if (!favourites) {
        layer(mine, 'attack', scale(1.07))
        layer(mine, 'defence', scale(1.05))
        return say([
          `"Nobody gives us a prayer out there. Perfect." The room tightens - shackles off, nothing to lose.`,
          `You read their team sheet out loud, name by name, then bin it. "Now let's ruin their afternoon." Grins everywhere.`,
          `"They have already written their headlines. Make the editors start again." The room hums.`,
        ])
      }
      layer(mine, 'attack', scale(0.98))
      return say([
        'You talk them down as underdogs... but everyone in the room knows you should win this. A few puzzled looks.',
        'The siege mentality does not fit a side this good, and the room knows it. The captain frowns at his boots.',
      ])
    case 'expect':
      if (favourites) {
        layer(mine, 'attack', scale(1.04))
        layer(mine, 'defence', scale(1.03))
        return say([
          'Standards. You expect a professional performance and the senior men nod - this is what we do.',
          '"Win, and win properly." Nothing else needs saying. The leaders take it from there.',
          'You name the standard, not the opposition. The room likes that - this is about us, not them.',
        ])
      }
      if (ctx.rng() < 0.45) {
        layer(mine, 'attack', scale(1.06))
        return say([
          'A big call against stronger opposition - but they respond. Chests out.',
          'You demand it anyway, and the room decides to believe you. Dangerous men, believers.',
        ])
      }
      layer(mine, 'defence', scale(0.96))
      return say([
        'You demand a win few expect. One or two shoulders tighten - the pressure lands badly.',
        'The words hang wrong in the air. Young eyes find the floor - that was a speech for a different team.',
      ])
  }
}

/** Half-time team talk for the user's side. One per match. */
export function applyTeamTalk(state: GameState, ctx: LiveCtx, kind: 'fire' | 'calm' | 'praise' | 'demand'): string {
  if (ctx.talkUsed) return t('touch.talkGiven')
  ctx.talkUsed = true
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const winning = mine.score > opp.score
  // deterministic rotation (score + tick), never the shared rng - ES rule
  const say = (opts: string[]) => opts[(mine.score + opp.score + ctx.tick) % opts.length]
  switch (kind) {
    case 'fire':
      layer(mine, 'attack', 1.07); layer(mine, 'breakdown', 1.05); layer(mine, 'card', 1.3)
      return say([
        'The shouting rattles the door on its hinges. They leave snorting - expect fire, and watch the referee.',
        'A cup of tea goes flying. Forty minutes of everything, you tell them, or explain yourselves to the fans outside. They leave at a jog.',
        'You go through the pack man by man, voice up, collar loose. The room is silent, then very loud. Watch the penalty count.',
      ])
    case 'calm':
      layer(mine, 'defence', 1.06); layer(mine, 'card', 0.8)
      return say([
        'Calm, clear, matter-of-fact. The defensive shape gets one more walk-through before they head out.',
        'No theatre. Two fixes on the whiteboard, one reminder about discipline, handshakes on the way out. Grown-up rugby.',
        'You lower the temperature of the room by ten degrees. The message: trust the system, make the tackle in front of you.',
      ])
    case 'praise':
      if (winning) { layer(mine, 'attack', 1.04); layer(mine, 'defence', 1.03) }
      return winning
        ? say([
          'You are delighted and you tell them so. Confidence flows - keep doing exactly this.',
          'You name three things they did exactly right and promise the second half is theirs if they keep doing them. Chests visibly lift.',
        ])
        : say([
          'Delighted? At that scoreline? A few eyebrows rise - the room is not sure you watched the same half.',
          'You accentuate the positives. The scoreboard in the corridor disagrees loudly, and so do a couple of the older heads.',
        ])
    case 'demand': {
      const roll = ctx.rng()
      if (roll < 0.5) {
        layer(mine, 'attack', 1.08); layer(mine, 'defence', 1.04)
        return say([
          'Encouraging, positive, believing - and the senior players nod along. They look ready to empty the tank.',
          'More, you ask - not different, just more. The captain answers for the room: they have more.',
        ])
      }
      layer(mine, 'attack', 0.97)
      return say([
        'You gee them up, but a couple of heads stay down. The message floats past them.',
        'You ask for more and the room hears criticism. Two players study their bootlaces. Wrong crowd, wrong day.',
      ])
    }
  }
}

/** Substitution for the user's side (MAX_SUBS tactical subs), any time play is stopped. */
export function makeSubstitution(state: GameState, ctx: LiveCtx, outId: number, inId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return t('touch.matchOver')
  if (ctx.subsUsed >= MAX_SUBS) return t('touch.allSubsUsed', { n: MAX_SUBS })
  const slotOut = mine.lineup.indexOf(outId)
  const slotIn = mine.lineup.indexOf(inId)
  const pin = state.players[inId]
  const pout = state.players[outId]
  if (slotOut < 0 || slotOut > 14 || !pout) return t('touch.notInStartingXV')
  // Law 3: a side may not replace a sin-binned player during his ten minutes
  if (mine.binned.has(outId)) return t('touch.inTheBin')
  if (!pin || pin.injury || (mine.ratings.has(inId) && mine.onPitch.has(inId))) return t('touch.notAvailable')
  mine.lineup[slotOut] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = outId
  mine.onPitch.delete(outId)
  mine.onPitch.add(inId)
  if (!mine.ratings.has(inId)) mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  ctx.subsUsed += 1
  recomputeSideUnits(state, ctx, mine)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  // the brief he was given, and the bill if the shirt does not fit him (F4)
  const briefsBefore = mine.briefsUsed ?? 0
  const coverBefore = !!mine.coverBlown
  const brief = applyBrief(state, mine, inId)
  forcedSwitchCost(state, ctx, mine, outId, pin, min)
  // remembered until play resumes, so this exact change can be taken back
  ctx.lastSub = {
    outId, inId,
    briefed: (mine.briefsUsed ?? 0) > briefsBefore,
    blewCover: !coverBefore && !!mine.coverBlown,
  }
  pushLine(state, ctx, min, 'SUB', mine, 'comm.subFromBench',
    { on: pin.name, off: pout.name, brief_k: brief ?? 'common.nothing' }, pin.id)
  return t('touch.willComeOn', { on: pin.name, off: pout.name })
}

/** Override the man the assistant sent on to cover an injury.
 *
 *  The engine has to fill the hole itself the instant a man breaks down: the
 *  same code runs for the fourteen AI sides and for Instant Result, where
 *  nobody is watching. So for a serious injury the UI stops the clock, shows the
 *  match-day squad and lets this undo the assistant's pick.
 *
 *  It is free. The injury forced the change, so charging a tactical replacement
 *  for disagreeing about who covers would be a punishment for paying attention.
 *  Only legal while the replacement has not yet played a minute, which is why
 *  the UI only offers it at the moment of the injury. */
export function swapInjuryCover(state: GameState, ctx: LiveCtx, onId: number, inId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return t('touch.matchOver')
  const slotOn = mine.lineup.indexOf(onId)
  const slotIn = mine.lineup.indexOf(inId)
  const pon = state.players[onId]
  const pin = state.players[inId]
  if (slotOn < 0 || slotOn > 14 || !pon || !mine.onPitch.has(onId)) return t('touch.notOnPitch')
  if (!pin || pin.injury || mine.onPitch.has(inId) || mine.ratings.has(inId)) return t('touch.notAvailable')
  mine.lineup[slotOn] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = onId
  mine.onPitch.delete(onId)
  mine.onPitch.add(inId)
  // He never actually got on, so he goes back to being a bench option rather
  // than carrying a rating for a cameo that did not happen.
  mine.ratings.delete(onId)
  mine.energy.delete(onId)
  mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  recomputeSideUnits(state, ctx, mine)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  // A better cover pick can undo the shortage the assistant walked into, so the
  // bill charged a moment ago is refunded exactly and then re-tested (F4). Only
  // the cover charge is reversed: briefs and the bench reshape stand.
  if (mine.coverBlown) {
    mine.coverBlown = false
    // 1/0.96 here for months against a 0.937 charge: every refund left a
    // permanent 2.4% defensive hole the comment above swore did not exist.
    // The constants are the single source of truth now (audit 16D).
    layer(mine, 'attack', 1 / COVER_ATT)
    layer(mine, 'defence', 1 / COVER_DEF)
  }
  const brief = applyBrief(state, mine, inId)
  forcedSwitchCost(state, ctx, mine, onId, pin, min)
  pushLine(state, ctx, min, 'SUB', mine, 'comm.subChangeOfPlan',
    { on: pin.name, off: pon.name, brief_k: brief ?? 'common.nothing' }, pin.id)
  return t('touch.takesShirtInstead', { on: pin.name, off: pon.name })
}

/** Take back the last tactical substitution, at the same stoppage it was made
 *  (16B, user: "i made a substitution but selected the wrong player, i couldnt
 *  undo it and I lost the player"). The replacement never played a second, so
 *  he goes back to being a bench option - same treatment as swapping injury
 *  cover - and the change gives back everything it took: the replacement slot,
 *  the brief it spent, the cover charge it blew. Play resuming closes the
 *  window: a man who has played a tick cannot be un-played. */
export function undoSubstitution(state: GameState, ctx: LiveCtx): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const u = ctx.lastSub
  if (!u) return t('touch.nothingToUndo')
  if (ctx.seg === 3) return t('touch.matchOver')
  const { outId, inId } = u
  const slotIn = mine.lineup.indexOf(inId)
  const slotOut = mine.lineup.indexOf(outId)
  const pout = state.players[outId]
  const pin = state.players[inId]
  if (slotIn < 0 || slotIn > 14 || !pout || pout.injury) { ctx.lastSub = null; return t('touch.tooLateToUndo') }
  mine.lineup[slotIn] = outId
  if (slotOut >= 0) mine.lineup[slotOut] = inId
  mine.onPitch.delete(inId)
  mine.onPitch.add(outId)
  // he never actually got on, so he carries no rating for a cameo that did
  // not happen and burns no replacement
  mine.ratings.delete(inId)
  mine.energy.delete(inId)
  ctx.subsUsed -= 1
  if (u.briefed) {
    const club = state.clubs[mine.teamId]
    const seat = mine.seatOf.get(inId)
    const b = club && seat != null ? briefForSeat(club, seat) : 'orders'
    if (b === 'impact') { layer(mine, 'attack', 1 / 1.025); layer(mine, 'defence', 1 / 0.99) }
    else if (b === 'shore') { layer(mine, 'defence', 1 / 1.025); layer(mine, 'attack', 1 / 0.99); layer(mine, 'card', 1 / 0.96) }
    else if (b === 'manage') { layer(mine, 'kicking', 1 / 1.03); layer(mine, 'attack', 1 / 0.995); layer(mine, 'tempo', 1 / 0.97) }
    mine.briefsUsed = Math.max(0, (mine.briefsUsed ?? 1) - 1)
  }
  if (u.blewCover && mine.coverBlown) {
    mine.coverBlown = false
    layer(mine, 'attack', 1 / COVER_ATT)
    layer(mine, 'defence', 1 / COVER_DEF)
  }
  recomputeSideUnits(state, ctx, mine)
  ctx.lastSub = null
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  pushLine(state, ctx, min, 'SUB', mine, pin ? 'comm.subUndoneNamed' : 'comm.subUndone',
    { off: pout.name, on: pin?.name ?? '' }, pout.id)
  return t('touch.staysOn', { player: pout.name })
}

/** Swap two on-pitch men's shirts (16B, user: "i want to be able to swap
 *  players positions if they are in the 15. so swap the 12 and 13 over").
 *  A positional switch, not a replacement: costs nothing, burns nothing, and
 *  the units are rebuilt so the shape change genuinely reaches the pitch. */
export function swapShirts(state: GameState, ctx: LiveCtx, aId: number, bId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return t('touch.matchOver')
  const ai = mine.lineup.indexOf(aId)
  const bi = mine.lineup.indexOf(bId)
  const pa = state.players[aId]
  const pb = state.players[bId]
  if (ai < 0 || ai > 14 || bi < 0 || bi > 14 || !pa || !pb) return t('touch.bothInXV')
  if (!mine.onPitch.has(aId) || !mine.onPitch.has(bId)) return t('touch.bothOnPitch')
  mine.lineup[ai] = bId
  mine.lineup[bi] = aId
  // a switch after an undo would otherwise resurrect a stale record
  ctx.lastSub = null
  recomputeSideUnits(state, ctx, mine)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  pushLine(state, ctx, min, 'SUB', mine, 'comm.shirtSwap',
    { team: teamShort(state, mine.teamId), a: pa.name, b: pb.name }, pa.id)
  return t('touch.swapPositions', { a: pa.name, b: pb.name })
}

/** Rebuild a side's unit strengths from its current lineup, tactics and conditions. */
export function recomputeSideUnits(state: GameState, ctx: LiveCtx, side: SideCtx) {
  // same fixture, same day: the match-day wobble a recompute rebuilds is the
  // one kick-off dealt, because it is keyed on (seed, fixture, player)
  side.units = teamUnits(state, side.lineup, { fxId: ctx.fx.id, big: !!ctx.fx.stage || ctx.derby })
  applyModifiers(state, side, ctx.weather)
  if (ctx.derby) side.cardRisk *= 1.35
}

/** Apply the user's (possibly changed) tactic sliders mid-match. */
export function applyTacticsChange(state: GameState, ctx: LiveCtx) {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  recomputeSideUnits(state, ctx, mine)
}

/** Match statistics for the stats panel. */
export function matchStats(ctx: LiveCtx) {
  const tot = ctx.home.poss + ctx.away.poss || 1
  return {
    possession: [Math.round((ctx.home.poss / tot) * 100), Math.round((ctx.away.poss / tot) * 100)] as [number, number],
    tries: [ctx.home.tries, ctx.away.tries] as [number, number],
    pens: [ctx.home.pens, ctx.away.pens] as [number, number],
    cards: [ctx.home.yellowUntil.size + ctx.home.sent, ctx.away.yellowUntil.size + ctx.away.sent] as [number, number],
    energy: [Math.round(sideEnergy(ctx.home)), Math.round(sideEnergy(ctx.away))] as [number, number],
  }
}

function finalizeMatch(state: GameState, ctx: LiveCtx) {
  const { fx, home, away, rng, detail, derby, isUser } = ctx
  fx.played = true
  fx.homeScore = home.score
  fx.awayScore = away.score
  fx.homeTries = home.tries
  fx.awayTries = away.tries
  pushLine(state, ctx, 80, 'FT', null, 'comm.fullTime', {
    home: teamShort(state, fx.homeId), away: teamShort(state, fx.awayId),
    hs: home.score, ascore: away.score,
  })
  if (detail) fx.events = ctx.events

  // Test rugby keeps score beyond the scoreboard: the world rankings move
  if (!state.clubs[fx.homeId] && !state.clubs[fx.awayId]) updateNatRank(state, fx)

  // an ill-tempered afternoon starts a feud of its own
  const totalCards = home.yellowUntil.size + home.sent + away.yellowUntil.size + away.sent
  if (totalCards >= 5 && state.clubs[fx.homeId] && state.clubs[fx.awayId] && !isDerby(fx.homeId, fx.awayId)) {
    addGrudge(state, fx.homeId, fx.awayId, 'news.grudgeBoiledOver', { cards: totalCards }, 1)
  }

  // the testimonial's morning after: the gate goes to the club, the day
  // goes into club folklore
  if (fx.testimonial != null && fx.homeId === state.userClubId) {
    const hero = state.players[fx.testimonial]
    const club = state.clubs[fx.homeId]
    if (hero && club && fx.att) {
      const gate = fx.att * 30
      club.balance += gate
      for (const id of club.players) {
        const tm = state.players[id]
        if (tm) tm.morale = clamp(tm.morale + 0.4, 1, 10)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `🎗 ${hero.name}'s testimonial: ${fx.att.toLocaleString()} say thank you`,
        body: `${club.stadium} was full for ${hero.name}'s testimonial${hero.name && ctx.events.some(e => e.type === 'TRY' && e.playerId === hero.id) ? ' - and he scored, because of course he did' : ''}. The gate receipts (${fmtMoney(gate)}) go to the club at his insistence. One season left in the shirt: make it a good one.`,
        k: 'news.testimonialDay',
        v: {
          player: hero.name, att: fx.att ?? 0, stadium: club.stadium, gate: fmtMoney(gate),
          scored_k: ctx.events.some(e => e.type === 'TRY' && e.playerId === hero.id)
            ? 'news.testimonialScored' : 'common.nothing',
        },
        playerId: hero.id,
        fixtureId: fx.id,
      })
    }
  }

  // an old boy coming back to haunt the user's club makes the back page
  if ((fx.homeId === state.userClubId || fx.awayId === state.userClubId) && fx.compId !== 'fr') {
    const oppSide = fx.homeId === state.userClubId ? away : home
    const oppClub = state.clubs[oppSide.teamId]
    const ev = ctx.events.find(e => e.type === 'TRY' && e.teamId === oppSide.teamId &&
      e.playerId != null && oppSide.exIds.has(e.playerId))
    const haunter = ev?.playerId != null ? state.players[ev.playerId] : null
    if (haunter && oppClub) {
      const weWon = (fx.homeId === state.userClubId ? home.score > away.score : away.score > home.score)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
        subject: `Old boy ${haunter.name} crosses against his former club`,
        body: weWon
          ? `${haunter.name}, once of this parish, went over for ${oppClub.short} - no celebration, just a nod to the away end. Your side had the last word on the scoreboard, which is all that matters.`
          : `Of course it was him. ${haunter.name} - ${oldBoyApps(haunter, state.userClubId)} appearances in your colours before he left - crossed against his old club and the ground knew it was coming. The oldest story in sport, and it found you today.`,
        k: weWon ? 'news.oldBoyWeWon' : 'news.oldBoyWeLost',
        v: { player: haunter.name, opp: oppClub.short, apps: oldBoyApps(haunter, state.userClubId) },
        playerId: haunter.id,
        fixtureId: fx.id,
      })
    }
  }

  let motmId: number | null = null
  let motmR = -1
  const debutants: { p: Player; r: number; kind: 'signing' | 'academy' }[] = []
  // see teamRatingTerm below for what the eighty minutes are worth
  for (const side of [home, away]) {
    const other = side === home ? away : home
    const won = side.score > other.score
    const isNation = !state.clubs[side.teamId]
    // what the eighty minutes were worth to everyone who played them
    const team = teamRatingTerm(side, other)
    // ---- AND WHAT THE SET PIECE WAS WORTH TO THE EIGHT WHO CONTESTED IT ----
    //
    // The other half of the forwards' missing credit. A pack that owned the
    // scrum and the lineout for eighty minutes changed the game and the mark
    // never said so.
    //
    // ZERO-SUM BETWEEN THE TWO PACKS, which is what stops it being farmed. The
    // handbook worry about this fix was that the scrum and lineout figures
    // carry the tactical dials, so a manager could slide his way to better
    // ratings. He cannot: this is measured as the DIFFERENCE between the two
    // packs, so whatever one side gains the other loses, and a dial that lifts
    // both sides of the contest moves nobody's mark. The league-wide mean is
    // untouched by construction rather than by calibration.
    const myPack = side.units.scrum + side.units.lineout
    const theirPack = other.units.scrum + other.units.lineout
    const packEdge = myPack + theirPack > 0
      ? clamp((myPack - theirPack) / (myPack + theirPack) * 3.2, -0.42, 0.42)
      : 0
    for (const [pid, r0] of side.ratings) {
      const p = state.players[pid]
      if (!p) continue
      // TWO QUANTITIES, NOT TWO OPINIONS OF ONE. `r` is the MARK - a verdict on
      // the afternoon, which is why the scoreboard belongs in it. `own` is the
      // same afternoon with the team's result taken back out, and it is what
      // feeds FORM, because form models this player's own sharpness and a
      // hammering does not make a prop individually sharper.
      //
      // This split was not a design instinct, it was a measurement.
      // scripts/difficultyprobe.ts went red the moment the team term reached
      // form: picking your best side was worth 21.0 league points a season
      // before, and 10.3 after. Form drives the auto-picked XV, so pouring a
      // team-wide number into it made every man in a winning side look sharp
      // and halved the value of the manager's biggest lever. The mark on the
      // screen can carry the result; the signal the squad is selected on
      // cannot.
      const spread = gauss(rng) * 0.8
      // the set-piece verdict lands on the eight who contested it, and on the
      // replacements who came into that contest, but never on a back
      const pack = FW_POS.has(p.pos) ? packEdge : 0
      const r = clamp(r0 + team + pack + spread, 1, 10)
      // NOT IN `own`, for the same reason the team term is not: `own` feeds
      // FORM, form drives the auto-picked XV, and the set-piece verdict is a
      // collective one. The first cut of this did put it in form and the effect
      // was immediate - selection shifted, results shifted with it, and the
      // forwards-versus-backs comparison this change exists to fix became
      // unmeasurable because the two runs were no longer playing the same
      // season. The mark on the screen can carry a collective verdict; the
      // signal the squad is picked on cannot.
      const own = clamp(r0 + spread, 1, 10)
      // THE SCREEN SHOWS THE NUMBER THE GAME REMEMBERS - one computation, read
      // by both, rather than the screen doing its own (the class of bug behind
      // the coach market and the bench tank as well). See SideCtx.finalR.
      ;(side.finalR ??= new Map()).set(pid, r)
      const friendly = ctx.fx.compId === 'fr'
      if (isNation) {
        // a Test match: another cap, and the milestones are forever
        p.caps = (p.caps ?? 0) + 1
        if (p.clubId === state.userClubId && (p.caps === 1 || p.caps === 50 || p.caps === 100)) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: p.caps === 1 ? `🌍 First cap: ${p.name}`
              : `🌍 ${p.name}: ${p.caps} Test caps`,
            body: p.caps === 1
              ? `${p.name} won his first Test cap for ${nationNameIn('en', side.teamId)} this week. The shirt gets framed; the club that made him gets the reflected glow.`
              : `${p.name} brought up his ${p.caps}th cap for ${nationNameIn('en', side.teamId)} this week - a special jersey, a guard of honour, and a proud week around the club.`,
            k: p.caps === 1 ? 'news.firstCap' : 'news.capMilestone',
            v: { player: p.name, ...nationVars(side.teamId), n: p.caps, n_o: p.caps },
            playerId: p.id,
          })
        }
      }
      if (!isNation && friendly) {
        // friendlies bank rhythm, not records: no apps, minutes or ratings -
        // but the legs and the sharpness are real
        p.lastWk = state.week
        const left = side.energy.get(pid)
        p.cond = left != null
          ? clamp(Math.min(p.cond, left + 8) - 6, 12, 100)
          : clamp(p.cond - (14 + Math.floor(rng() * 10)), 20, 100)
        p.sharp = clamp(p.sharp + 12, 0, 100)
      } else if (!isNation) {
        if (p.debutPending) { debutants.push({ p, r, kind: p.debutPending }); p.debutPending = null }
        p.stats.apps += 1
        const started = side.lineup.slice(0, 15).includes(pid)
        if (started) p.stats.starts += 1
        p.stats.mins += started ? 75 : 25
        p.stats.ratingSum += r
        // and the same rating against the award window, which is cleared every
        // time a Player of the Month is named (see SeasonStats.mSum)
        p.stats.mSum = (p.stats.mSum ?? 0) + r
        p.stats.mApps = (p.stats.mApps ?? 0) + 1
        p.lastR = r
        p.lastWk = state.week
        p.form = clamp(p.form * 0.65 + own * 0.35, 1, 10)
        const swing = (p.pers === 'Temperamental' ? 2 : 1) * (derby ? 1.6 : 1)
        p.morale = clamp(p.morale + (won ? 0.4 : -0.5) * swing, 1, 10)
        // post-match condition reflects how much petrol was actually burned
        const left = side.energy.get(pid)
        p.cond = left != null
          ? clamp(Math.min(p.cond, left + 8) - 6, 12, 100)
          : clamp(p.cond - (14 + Math.floor(rng() * 10)), 20, 100)
        p.sharp = clamp(p.sharp + 12, 0, 100)
        // suspensions news + totting-up for the user's squad
        if (p.clubId === state.userClubId) {
          if (p.bans > 0 && side.yellowUntil.has(pid) === false && p.stats.rc > 0 && ctx.events.some(e => e.type === 'RC' && e.playerId === pid)) {
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
              subject: `${p.name} suspended ${p.bans} matches`,
              body: `The disciplinary panel has banned ${p.name} for ${p.bans} matches following his red card. He will be unavailable until the ban is served.`,
              k: 'news.suspended', v: { player: p.name, n: p.bans },
              playerId: p.id,
            })
          }
          if (p.stats.yc > 0 && p.stats.yc % 4 === 0 && ctx.events.some(e => e.type === 'YC' && e.playerId === pid)) {
            p.bans += 1
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
              subject: `${p.name} banned - totting up`,
              body: `${p.stats.yc} yellow cards this season have earned ${p.name} a one-match suspension from the citing commissioner.`,
              k: 'news.tottingUp', v: { player: p.name, n: p.stats.yc },
              playerId: p.id,
            })
          }
        }
      }
      if (r > motmR) { motmR = r; motmId = pid }
    }
  }
  if (motmId != null && isUser) {
    const p = state.players[motmId]
    if (p) p.stats.motm += 1
    fx.motm = motmId
  }
  ctx.motmId = motmId

  // a debut worth the back page: a new face who scored, took MOTM or
  // simply played out of his skin gets his moment in print
  for (const { p, r, kind } of debutants) {
    if (p.clubId !== state.userClubId) continue
    const scored = ctx.events.some(e => e.type === 'TRY' && e.playerId === p.id)
    const isMotm = p.id === motmId
    if (!scored && !isMotm && r < 7.8) continue
    const homegrown = kind === 'academy'
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: homegrown ? `🌟 A debut to tell his grandkids about: ${p.name}` : `🌟 Dream debut for ${p.name}`,
      body: [
        homegrown
          ? `${p.name} (${p.age}, ${p.pos}) made his first-team debut today - the academy's own, first competitive rugby of his life.`
          : `First competitive appearance in the shirt for ${p.name} (${p.pos}), and he made it count.`,
        scored ? `He scored, because new signings who cost the coaching staff sleep always do.` : '',
        isMotm ? `The sponsors gave him the match award before he had learned everyone's names.` : '',
        `Rated ${r.toFixed(1)} by the press box. The supporters have a new song by Tuesday.`,
      ].filter(Boolean).join(' '),
      k: homegrown ? 'news.debutAcademy' : 'news.debutSigning',
      v: {
        player: p.name, age: p.age, pos: p.pos, rating: r.toFixed(1),
        scored_k: scored ? 'news.debutScored' : 'common.nothing',
        motm_k: isMotm ? 'news.debutMotm' : 'common.nothing',
      },
      playerId: p.id,
      fixtureId: fx.id,
    })
  }

  // the morning paper: a proper match report for every game you took charge of
  if (detail && isUser) {
    const usHome = ctx.userSideId === fx.homeId
    const us = usHome ? home : away
    const them = usHome ? away : home
    const margin = us.score - them.score
    const oppName = teamShort(state, them.teamId)
    const scorers = (side: SideCtx) => {
      const byName = new Map<string, number[]>()
      for (const e of ctx.events) {
        if (e.type !== 'TRY' || e.teamId !== side.teamId || !e.playerName) continue
        const mins = byName.get(e.playerName) ?? []
        mins.push(e.min)
        byName.set(e.playerName, mins)
      }
      return [...byName.entries()].map(([n, mins]) => `${n} (${mins.map(m => `${m}'`).join(', ')})`).join(', ')
    }
    const motm = motmId != null ? state.players[motmId] : null
    // the one line the gaffer reads after every match: rotate the phrasing
    // so twenty seasons of Monday papers do not all start the same way.
    //
    // The variants are keys rather than sentences, and say() draws exactly as
    // it did when they were sentences - one draw, same index, same variant -
    // so a world generated before this change and one generated after it are
    // the same world. Every opener is handed both team names whether its own
    // wording uses them or not, because which one a translation reaches for is
    // the translation's business.
    const say = (opts: string[]) => opts[Math.floor(rng() * opts.length)]
    const openerK = margin >= 20 ? say(['news.mrRout1', 'news.mrRout2', 'news.mrRout3'])
      : margin > 7 ? say(['news.mrComfort1', 'news.mrComfort2', 'news.mrComfort3'])
      : margin > 0 ? say(['news.mrNarrow1', 'news.mrNarrow2', 'news.mrNarrow3'])
      : margin === 0 ? say(['news.mrDraw1', 'news.mrDraw2', 'news.mrDraw3'])
      : margin >= -7 ? say(['news.mrNearMiss1', 'news.mrNearMiss2', 'news.mrNearMiss3'])
      : say(['news.mrBeaten1', 'news.mrBeaten2', 'news.mrBeaten3'])

    // The report is a column, so it is filed as a _ll list of fragment keys.
    // Where a slot can hold either a name or a word - the ground with no name,
    // the fixture with no competition - the WORD gets its own key rather than
    // being passed in as a variable, because a variable holding "the ground"
    // is English hiding inside a French sentence, which is the entire bug this
    // mechanism exists to remove. A club's name and a stadium's name are not
    // translated and travel as variables, which is what variables are for.
    const usName = teamShort(state, us.teamId)
    const ourTries = scorers(us), theirTries = scorers(them)
    const lines: { k: string; [x: string]: string | number }[] = [
      { k: openerK, us: usName, opp: oppName },
      ourTries ? { k: 'news.mrTries', tries: ourTries } : { k: 'news.mrNoTries', us: usName },
    ]
    if (theirTries) lines.push({ k: 'news.mrOppTries', opp: oppName, tries: theirTries })
    if (motm) lines.push({ k: 'news.mrMotm', motm: motm.name, rating: motmR.toFixed(1) })
    if (fx.att) {
      const stadium = state.clubs[fx.homeId]?.stadium
      const compName = state.comps[fx.compId]?.name
      const comp_k = compName ? 'news.mrCompNamed' : fx.compId === 'fr' ? 'news.mrFriendly' : ''
      const weather_k = fx.weather && fx.weather !== 'Dry' ? `matchday.wx${fx.weather}` : ''
      lines.push({
        k: comp_k && weather_k ? 'news.mrGateCompWx'
          : comp_k ? 'news.mrGateComp'
          : weather_k ? 'news.mrGateWx'
          : 'news.mrGate',
        att: fx.att,
        venue_k: stadium ? 'news.mrVenueNamed' : 'news.mrTheGround',
        venue: stadium ?? '',
        comp_k, comp: compName ?? '',
        weather_k,
      })
    }
    // The headline is the scoreline, so it goes through the key as well. A body
    // key implies a subject key - newsSubject() puts Subj on the end of it -
    // and leaving the subject as a template would have quietly replaced the
    // score with whatever that key happened to say.
    const v = {
      lines_ll: JSON.stringify(lines),
      home: teamShort(state, fx.homeId), away: teamShort(state, fx.awayId),
      hs: home.score, ascore: away.score,
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: true,
      subject: tIn('en', 'news.matchReportSubj', v),
      body: tIn('en', 'news.matchReport', v),
      k: 'news.matchReport', v,
      playerId: motm?.id,
    })

    // the season's best try: judged for drama the moment the whistle goes.
    // Pure bookkeeping over the finished event list - zero draws on the rng
    if (fx.compId !== 'fr' && us.teamId === state.userClubId) {
      for (const e of ctx.events) {
        if (e.type !== 'TRY' || e.teamId !== us.teamId || e.playerId == null) continue
        const scorer = state.players[e.playerId]
        if (!scorer) continue
        const drama =
          (e.min >= 78 ? 3 : e.min >= 70 ? 2 : e.min >= 60 ? 1 : 0) +
          (ctx.derby ? 2 : 0) +
          (margin > 0 && margin <= 5 ? 2 : Math.abs(margin) <= 12 ? 1 : 0) +
          (scorer.pos === 'WG' || scorer.pos === 'FB' ? 1 : 0) +
          (fx.stage === 'F' ? 3 : fx.stage ? 1 : 0)
        const best = state.tryOfSeason
        if (!best || best.season !== state.season || drama > best.drama) {
          state.tryOfSeason = {
            playerId: e.playerId, name: e.playerName ?? scorer.name, min: e.min,
            opp: oppName, text: e.text, drama, season: state.season,
          }
        }
      }
    }
  }
}

/** Simulate a full match in one go (AI fixtures, tests, quick sims). */
export function simMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean): SimResult {
  const ctx = beginMatch(state, fx, rng, detail)
  playHalf(state, ctx)
  playHalf(state, ctx)
  return { events: ctx.events, motmId: ctx.motmId }
}
