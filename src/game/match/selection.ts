// Selection, the unit ratings and rosters: who plays, and what the side is
// worth on paper. Split out of matchEngine.ts, which re-exports it. A leaf of
// the engine, so the analyst, the opposition coach and the arms race can read
// teamUnits and lineupFor without an import cycle through matchEngine.ts.
import { traitDayF } from '../formtraits'
import type { Club, GameState, Player, Pos } from '../model'
import { XV_SLOTS, chemKey } from '../model'
import { bigMatchTemper, consistency, effAt } from '../attributes'
import { nationName } from '../nations'
import { clamp, mulberry32 } from '../rng'
import { seatsFor, splitFor, type BenchSplit } from '../bench'
import { frontRowCover } from './referee'

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

// ------------------------------------------------------------------
// Selection
// ------------------------------------------------------------------

export function availablePlayers(state: GameState, ids: number[], forNation = false): Player[] {
  return ids
    .map(id => state.players[id])
    .filter(p => p && !p.injury && !p.maternity && !p.onLoan && p.bans === 0 && (forNation || !p.natSquad))
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
  const allPool = pool
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
  coverFrontRow(state, lineup, allPool, score)
  return lineup
}

/**
 * ---- A PROP FROM THE ACADEMY BEFORE UNCONTESTED SCRUMS (release QA after 1.8.16) ----
 *
 * Measured over three seasons of every club's sheet: 1.9% of the 23s this
 * picks could not cover the front row under Law 3, and in 45% of those the
 * club had the cover fit and unnamed. Saracens in week 7 had one fit senior
 * loosehead, put a third tighthead on the bench, and left two academy
 * looseheads at home: uncontested scrums from the first minute, for a side
 * with one of the best packs in the league. The academy is only raided when
 * the seniors cannot fill 23 shirts, and nothing asked whether those 23 could
 * scrummage.
 *
 * So when a sheet is short, the best fit man who can play the missing
 * position, academy included, takes a bench seat from a man that cover does
 * not need: a front-rower of a position with spare cover first, else the
 * weakest of the rest. The XV is never touched. A squad with nobody to call
 * on stays short, and the referee orders uncontested scrums as before.
 */
function coverFrontRow(state: GameState, lineup: (number | null)[], pool: Player[], score: (p: Player, pos: Pos) => number) {
  const FR = ['LP', 'HK', 'TP'] as const
  const can = (p: Player, pos: Pos) => p.pos === pos || p.alt.includes(pos)
  for (let guard = 0; guard < 3; guard++) {
    const cov = frontRowCover(state, lineup)
    if (cov.legal) return
    // a position with fewer than two, else (every position covered twice but
    // by too few men, a two-sided prop counting for both) any front-row man
    const short = FR.find(pos => cov[pos] < 2)
    const named = new Set(lineup.filter((x): x is number => x != null))
    let cand: Player | null = null
    let candS = -1
    for (const p of pool) {
      if (named.has(p.id)) continue
      const pos = short ?? FR.find(f => can(p, f))
      if (!pos || !can(p, pos)) continue
      const s = score(p, pos)
      if (s > candS) { cand = p; candS = s }
    }
    if (!cand) return
    // the seat to give up: never a man the cover itself rests on
    let seat = -1, seatS = Infinity, seatSpare = false
    for (let i = 15; i < 23; i++) {
      const id = lineup[i]
      const p = id != null ? state.players[id] : null
      if (!p) { seat = i; break }
      const fr = FR.filter(pos => can(p, pos))
      if (fr.some(pos => cov[pos] <= 2)) continue
      const spare = fr.length > 0
      const s = score(p, p.pos)
      if ((spare && !seatSpare) || (spare === seatSpare && s < seatS)) { seat = i; seatS = s; seatSpare = spare }
    }
    if (seat < 0) return
    lineup[seat] = cand.id
  }
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
    return !!p && !p.injury && !p.maternity && !p.onLoan && p.bans === 0 && !p.natSquad && p.clubId === club.id
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
/** the blended units' world mean against the single-attribute ones they
 *  replaced (scripts/_units measured over 321 sides, three seeds), so the
 *  engine's calibration stands */
const UNIT_NORM = { breakdown: 0.98818, attack: 1.02380, defence: 1.05597 }

export function teamUnits(state: GameState, lineup: (number | null)[], day?: { fxId: number; big: boolean; chemToday?: Set<string>; talk?: Map<number, number> }): Units {
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
      f = (1 + consistency(state.seed, p.id) * (u - 0.5) * 2
        + (day.big ? bigMatchTemper(state.seed, p.id) * 0.015 : 0))
        // the hidden form tendencies (formtraits.ts): a slow starter back from
        // a lay-off, a confidence player after two marks the same way
        * traitDayF(state.seed, p)
        // how he took the manager's talk (teamtalk.ts): 1 for anybody who
        // heard none, which is every man on every AI side
        * (day.talk?.get(p.id) ?? 1)
      dayCache.set(p.id, f)
    }
    return f
  }
  const at = (i: number, k: keyof Player['a']) => {
    const p = P(i)
    if (!p) return 5
    // CONDITION COSTS LESS OF A MAN'S CRAFT (1.8.14). At 0.75 + 0.25 a squad at
    // 80% condition lost 21 points of win rate on this term and the energy
    // tank together - more than tactics, morale and staff combined, which made
    // the cheapest way to win "spend less of yourself" (low tempo) rather than
    // anything a manager would recognise as rugby. Tiredness still bites, in
    // the tank and the last quarter, where it belongs.
    // AND A LITTLE MORE AGAIN (1.8.17, FIT_W): at 0.82 + 0.18 a side picked on
    // fitness every week was worth 3 points a season over one left as it was,
    // under autopilotprobe's bar of 5; the owner chose to restore some of the
    // cost. 0.22 is about half way back. The tempo trade that closed the
    // low-tempo exploit in 1.8.14 is untouched.
    const fit = (1 - FIT_W) + FIT_W * (p.cond / 100)
    const frm = 0.9 + 0.02 * p.form
    // match sharpness: a player eased back after a layoff is a touch off the pace
    const shp = 0.945 + 0.055 * ((p.sharp ?? 70) / 100)
    return p.a[k] * fit * frm * shp * df(p)
  }
  const fw = [0, 1, 2, 3, 4, 5, 6, 7]
  const bk = [8, 9, 10, 11, 12, 13, 14]
  let scrum = avg([at(0, 'scr'), at(1, 'scr'), at(2, 'scr'), at(3, 'str'), at(4, 'str'), at(0, 'str'), at(2, 'str')])
  let lineout = avg([at(1, 'lin'), at(3, 'lin'), at(4, 'lin'), at(5, 'lin'), at(7, 'lin')])
  // ---- NO ONE ATTRIBUTE IS A WHOLE UNIT (1.8.0, scripts/ladderprobe.ts) ----
  // Measured exactly (ladderprobe: what +2 across a 23 does to the attacking
  // and defending strength every tick is decided by): tackling raised it 9.0%,
  // 2.5 times the third attribute (handling 3.6%), because the defence unit
  // WAS tackling; rucking was the whole breakdown and came second at 7.4%.
  // Decisions, agility and work rate read 0.0%: counted in the rating, read
  // by nothing in a match. After: tackling 5.7%, rucking 5.1%, positioning
  // 3.0%, and all three of those now count.
  // So a defence is tackling, the reads (positioning) and getting back into
  // the line (work rate); a breakdown is rucking and the strength to win the
  // clear-out; an attack reads its half-backs' decisions and its backs'
  // agility as well as their hands and legs. Each unit is then scaled by the
  // world's measured mean (UNIT_NORM) so the game plays at the same level and
  // only what each attribute is worth moves.
  let breakdown = avg(fw.map(i => at(i, 'ruc') * 0.7 + at(i, 'str') * 0.3)) * UNIT_NORM.breakdown
  let attack = avg([
    ...bk.map(i => at(i, 'han')),
    at(9, 'vis') * 1.5, at(8, 'pas') * 1.3, at(11, 'pac'), at(12, 'pac'),
    at(10, 'pac'), at(13, 'pac'), at(14, 'pos'),
    at(8, 'dec'), at(9, 'dec') * 1.2, at(11, 'agi'), at(13, 'agi'), at(14, 'agi'),
  ]) * UNIT_NORM.attack
  const dman = (i: number) => at(i, 'tac') * 0.6 + at(i, 'pos') * 0.2 + at(i, 'wor') * 0.2
  let defence = avg([...fw.map(dman), ...bk.map(dman), at(14, 'pos') * 1.2]) * UNIT_NORM.defence
  let kicking = avg([at(9, 'kic') * 1.6, at(8, 'kic'), at(14, 'kic')])
  // partnership chemistry: combinations that have played together click
  if (state.chem) {
    const games = (i: number, j: number) => {
      const a = lineup[i], b = lineup[j]
      if (a == null || b == null) return 0
      const k = chemKey(a, b)
      return (state.chem![k] ?? 0) - (day?.chemToday?.has(k) ? 1 : 0)
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
  // THE SPECIALIST SHIRTS (1.8.2 depth). A prop, a hooker and a scrum-half
  // are trades, not positions: a man who has never packed down cannot hold
  // up a scrum, a hooker who has never thrown in cannot hit a jumper, and a
  // nine who has never passed off the base slows every ruck. So the platform
  // pays heavily for a non-specialist in those shirts, on top of what his own
  // attributes already cost it (specialistGaps says which).
  const gaps = specialistGaps(xv)
  for (const g of gaps) {
    if (g === 0 || g === 2) scrum *= SPEC_PROP
    else if (g === 1) { scrum *= SPEC_HOOK_SCRUM; lineout *= SPEC_HOOK_LINEOUT }
    else if (g === 8) { attack *= SPEC_NINE_ATT; kicking *= SPEC_NINE_KICK }
  }
  // best goal kicker on the pitch
  let kickerId: number | null = null
  let goal = 5
  for (const p of xv) {
    if (p && p.a.goa > goal) { goal = p.a.goa; kickerId = p.id }
  }
  const overall = scrum * 0.16 + lineout * 0.12 + breakdown * 0.18 + attack * 0.24 + defence * 0.22 + kicking * 0.08
  return { scrum, lineout, breakdown, attack, defence, kicking, goal, overall, kickerId }
}

/**
 * A side's strength on paper, as a dressing room would judge it: the XV's
 * units with no match-day fog, plus the coaching every professional club
 * brings (the baseline in applyModifiers) or, for the manager's own club, his
 * attack and defence coaches. What the team talks read "favourites" and
 * "underdogs" off (teamtalk.ts); the MatchDay preview asks the same question
 * with the same call, so the room the manager reads is the one the engine
 * hears. Nothing drawn.
 */
export function paperOverall(state: GameState, teamId: string, lineup: (number | null)[]): number {
  const u = teamUnits(state, lineup).overall
  if (teamId !== state.userClubId || state.unemployed) {
    if (!state.clubs[teamId]) return u
    const tilt = clamp(((state.clubs[teamId]?.rep ?? 60) - 40) / 50, 0, 1)
    return u * (1 + (0.026 + 0.014 * tilt) * 0.93)
  }
  const st = state.staff
  return st ? u * (1 + ((st.attack ?? 0) + (st.defence ?? 0)) * 0.016 * 0.46) : u
}

/** the platform's price for a non-specialist in each specialist shirt */
export const SPEC_PROP = 0.84
const SPEC_HOOK_SCRUM = 0.92
const SPEC_HOOK_LINEOUT = 0.8
const SPEC_NINE_ATT = 0.94
const SPEC_NINE_KICK = 0.94
/** The specialist shirts a man is filling without the trade: 0 and 2 (the
 *  props: any trained prop will do on either side), 1 (hooker) and 8 (scrum-
 *  half). An empty shirt is not counted here; it is already a weak man. */
export function specialistGaps(xv: (Player | null | undefined)[]): number[] {
  const out: number[] = []
  const can = (p: Player, ps: Pos[]) => ps.includes(p.pos) || p.alt.some(a => ps.includes(a))
  const need: [number, Pos[]][] = [[0, ['LP', 'TP']], [1, ['HK']], [2, ['LP', 'TP']], [8, ['SH']]]
  for (const [i, ps] of need) {
    const p = xv[i]
    if (p && !can(p, ps)) out.push(i)
  }
  return out
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

/** How much of a man's craft his condition governs (`fit` in the unit build),
 *  and how much of last week's lost condition he starts a match without (the
 *  energy tank). 1.8.14 took them to 0.18 and 0.45; 1.8.17 half way back.
 *  autopilotprobe, 54 worlds: picking the side worth 6.9 points a season
 *  (3.1 before); bandcheck inside every band. */
const FIT_W = 0.22
export const TANK_K = 0.75
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
  // The same man in two shirts is one man. A hand-edited or damaged sheet with
  // a player at 4 and at 21 went through every check below (each shirt was
  // filled, each wearer fit) and onto the pitch, where frontRowCover counted
  // him twice (scripts/qa/banned.ts, 1.6.5). The second shirt is emptied here
  // and the tidy-up below fills it like any other gap.
  // Only when there IS a duplicate: a clean manager-picked sheet comes back
  // by reference, untouched (scripts/absentprobe.ts relies on that).
  if (club) {
    const seen = new Set<number>()
    let dup = false
    for (const id of club.tactic.lineup) { if (id != null) { if (seen.has(id)) dup = true; seen.add(id) } }
    if (dup) {
      seen.clear()
      club.tactic.lineup = club.tactic.lineup.map(id => {
        if (id == null || seen.has(id)) return null
        seen.add(id)
        return id
      })
    }
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
    // THE BENCH TOO (1.9.4). Only the fifteen were checked, so a replacement
    // who had since been called up, injured or banned stayed on the sheet and
    // could be sent on (engine10k caught a man on Test duty coming on for the
    // last five minutes). A bench shirt may be empty; a named one must be fit.
    const fit = (id: number) => {
      const p = state.players[id]
      return !!p && !p.injury && !p.maternity && !p.onLoan && p.bans === 0 && !p.natSquad && p.clubId === teamId
    }
    const valid = lu.slice(0, 15).every(id => id != null && fit(id)) &&
      lu.slice(15).every(id => id == null || fit(id))
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
      // autopilotprobe caught it making autopilot BETTER: a weekly form-and-
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
