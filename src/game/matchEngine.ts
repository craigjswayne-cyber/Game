import { brittleF, traitDayF } from './formtraits'
import type { Club, Fixture, GameState, MatchEvent, Player, Pos, Tactic, Weather } from './model'
import { genderOf, type Gender, subjectVar } from './gender'
import { prepLeaked } from './talkingpoints'
import { ROLE_FX, rolesForSlot } from './roles'
import { zoneAt, zonePlan } from './tactics'
import { BENCH_SLOTS, CHEM_SLOTS, XV_SLOTS, addGrudge, careerRows, chemKey, demandCeiling, facLevel, fmtMoney, formGuide, grudgeBetween, inRedZone, oldBoyApps, trustFactor, unbeatenRun } from './model'
import { standing } from './authority'
import { bondCohesion } from './bonds'
import { analystShift, archetypeOf, loudestDial, repetitionFatigue, respectLayers } from './oppcoach'
import { resolveContest, type Contest } from './contest'
import { updateNatRank } from './natrank'
import { bigMatchTemper, consistency, effAt } from './attributes'
import { HT_TONES, PRE_CARRY, PRE_TONES, hotShare, logPreTalk, roomVerdict, silenceReads, silenceWeight, talkFactor, talkMorale, talkReads, talkSetting, type HtTone, type PreTone, type TalkRead, type TalkSetting } from './teamtalk'
import { nationName, nationNameIn, nationVars } from './nations'
import { derbyName, isDerby } from './rivalries'
import { EXPLOITED_BY, analystEdge, settleAnalyst } from './analyst'
import { t, tIn } from './i18n'
import { venueEffect } from './venue'
import { clamp, gauss, hashString, mulberry32, wpick, type Rng } from './rng'
import { KNOCK_ENERGY } from './knock'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, ROUTINE_BY_ID, playbookOf, routineEffect } from './playbook'
import { MOVE_BY_ID, MOVE_MAKER, RED_ZONE, anyCall, calledIds, callForTick, callsOf, launchOf, mixHash, moveEdge, moveFit, moveHash, moveMatchup, moveTempoF, sayKey, type Launch } from './moves'
import { adaptMap, tallyCalls } from './armsrace'
import { rematchOf, withRematch, type Rematch } from './rematch'
import {


  SPLIT_BY_ID, actualSplit, briefForSeat, isForward, seatsFor, splitFor,
  type BenchSplit,
} from './bench'
import { rememberDebut } from './memory'
import { LEVER_DIALS, buildEvidence, type CausalEvidence } from './evidence'
import { ATK_KICKS, atkSay, defSay, moveAffinity, styleDrain, styleFitsRel, styleTerr, styleTick, stylesOf, TURN_BASE, TURN_M, type SideStyle } from './styles'
import { ART_HOME, clubSurface, goalPenaltyOf, hotDay, injuryF, matchConditions, styleWx, surfaceOf, wetness, type Surface } from './conditions'
import { HABITS, HABITS_OFF, clutchKick, habitFx } from './habits'

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
    const fit = 0.82 + 0.18 * (p.cond / 100)
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
export const SPEC_HOOK_SCRUM = 0.92
export const SPEC_HOOK_LINEOUT = 0.8
export const SPEC_NINE_ATT = 0.94
export const SPEC_NINE_KICK = 0.94
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
 *  edit a number here, re-run simtest: the columns have to stay balanced.
 *
 *  As it stands (1.8.1, counted): breakdown averages exactly 1.000 and cards
 *  0.995, but flow averages 1.009, a small lift to scoring for everybody, and
 *  scrum 1.011. The bands were tuned with the panel as it is, so the drift is
 *  written down here rather than corrected on its own, which would move the
 *  world's scoring without a rebalance behind it. */
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

/**
 * ---- THE HOME CROWD (owner, 25 Sep 2026: "home-crowd referees") ----
 *
 * Some afternoons the fifty-fifty calls go the home side's way: a full,
 * loud ground, a derby, a knockout. This puts that in, as a tilt on who
 * concedes the penalties - fewer against the home side, as many more against
 * the visitors - of up to 7%.
 *
 * IT IS THE GROUND'S, NOT THE REFEREE'S. The panel above carries real
 * officials' names, and a trait that says a named referee favours home sides
 * is a claim about a real person's integrity. So the lean is read off the
 * occasion - the size of the ground, a derby, a knockout - and applies
 * whoever has the whistle; the briefing says it is the crowd.
 *
 * THE CROWD THAT IS THERE, NOT THE SEATS. The first cut read the stadium's
 * capacity, and pointsprobe caught it at once: a 60,000-seat ground a third
 * full leaned as hard as a sell-out, so a club with a vast empty bowl got
 * the referee's ear it had done nothing to earn. The match reads the counted
 * gate (fx.att, set in beginMatch after the draw for it); before kick-off,
 * for the briefing, it reads the seats the club can actually sell.
 *
 * Nothing at a neutral venue, in a friendly, or in front of a small crowd on
 * an ordinary Saturday. No draw.
 */
export function homeCrowdLean(state: GameState, fx: Fixture): number {
  if (fx.venue || fx.compId === 'fr') return 0
  const club = state.clubs[fx.homeId]
  const crowd = fx.att ?? (club ? Math.min(club.capacity, demandCeiling(club)) : 0)
  // a gate that is not a number (a damaged save) leans nobody's way (hostile171)
  if (!Number.isFinite(crowd)) return 0
  const size = clamp((crowd - 12000) / 18000, 0, 1)
  const occasion = (isDerby(fx.homeId, fx.awayId) ? 0.5 : 0) + (fx.stage ? 0.35 : 0)
  return 0.07 * Math.min(1, size + occasion)
}

/** Law 3: a 23 must be able to replace all three front-row positions.
 *
 *  Six suitably trained front-rowers, in practice two who can play each of
 *  loosehead, hooker and tighthead. Come up short and the referee orders
 *  uncontested scrums, which takes the set piece out of the game entirely: no
 *  shove, no scrum penalties, nothing for a dominant front row to win. That
 *  hurts whoever HAD the better scrum, which is why it is a genuine selection
 *  constraint and, in the real game, a genuine controversy - a side with a
 *  poor scrum has an incentive to be short. Comment kept rather than a
 *  sanction built: a front-row shortage already punishes itself when a
 *  tighthead limps off and the bench has no natural cover.
 *
 *  PLAYERS, NOT POSITIONS (1.8.3, Law 3.5). This used to count positions
 *  covered, a man counting once for every one he could play, so a prop who
 *  packs down on both sides was worth two and five men passed for six. The
 *  law counts men: six front-rowers in a 23, five in a squad of 19 to 22,
 *  four in 17 or 18 and three below that, each a different player, and the
 *  two-of-each test still stands on top so every position has its cover. The
 *  squad is the named men who are fit to play. No draw. */
export function frontRowCover(state: GameState, lineup: (number | null)[]): { LP: number; HK: number; TP: number; players: number; need: number; legal: boolean } {
  const need = ['LP', 'HK', 'TP'] as const
  const out = { LP: 0, HK: 0, TP: 0, players: 0, need: 6, legal: false }
  const seen = new Set<number>()
  for (const id of lineup.slice(0, 23)) {
    if (id == null || seen.has(id)) continue
    const p = state.players[id]
    if (!p || p.injury) continue
    seen.add(id)
    let fr = false
    for (const n of need) if (p.pos === n || p.alt.includes(n)) { out[n] += 1; fr = true }
    if (fr) out.players += 1
  }
  const squad = seen.size
  out.need = squad >= 23 ? 6 : squad >= 19 ? 5 : squad >= 17 ? 4 : 3
  out.legal = out.LP >= 2 && out.HK >= 2 && out.TP >= 2 && out.players >= out.need
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
/**
 * ---- THE SHAPE OF A SEASON'S INJURIES (design review, v1.6.7) ----
 *
 * Measured before this round: about eleven time-loss injuries per club per
 * season, mean six weeks. The professional game runs several times that many
 * and most of them are short - a week or two of soft tissue, not a month.
 * Eleven long ones meant a squad never really churned, and the selection
 * problem an injury is supposed to set the manager almost never arrived.
 *
 * So the rate roughly doubles (the roll below) and the ranges come down at the
 * short end, which leaves the total weeks lost about where it was while making
 * the week-to-week medical room look like a rugby club's. The two that define
 * a career - the knee and the achilles - are untouched.
 */
const INJURIES = [
  ['injury.ribs', 1, 2], ['injury.deadLeg', 1, 1], ['injury.ankle', 1, 3],
  ['injury.hamstring', 2, 4], ['injury.concussion', 2, 3], ['injury.shoulder', 2, 6],
  ['injury.kneeLigament', 6, 16], ['injury.brokenHand', 3, 6], ['injury.calf', 1, 3],
  ['injury.groin', 2, 4], ['injury.bicep', 7, 12], ['injury.achilles', 16, 30],
] as const

/**
 * ---- WHAT GOES WRONG IS NOT THE SAME IN BOTH GAMES ----
 *
 * Owner, 6 Sep 2026: female players carry a "statistically higher weighting for
 * non-contact ACL/knee injuries and distinct concussion tracking", male players
 * for upper-body and shoulder damage. That is the sports-medicine literature's
 * clearest and least disputed finding about the two games, and a manager who
 * follows women's rugby knows it: the knee is the injury that defines a career.
 *
 * THE MEN'S ROW IS ALL ONES AND MUST STAY THAT WAY. A uniform weight makes the
 * weighted pick below return exactly the index `Math.floor(rng() * 12)` did, so
 * a men's career injures exactly the men it always would have, in the same
 * order, off the same rng stream. That is not a nicety - the match rng is
 * shared, so shifting one draw would move every scoreline after it in every
 * save in progress. The spec's men's row is satisfied RELATIVELY: men are
 * comparatively higher on shoulder because women are so much higher on knee.
 *
 * The women's row is the whole change. The knee is three times its flat share,
 * concussion close to double, and the injuries the literature puts on the men's
 * side - shoulder, bicep - are damped.
 */
const INJURY_WEIGHT: Record<Gender, readonly number[]> = {
  //     ribs dead ankl hams conc shou KNEE hand calf groi bice achi
  m: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  w: [1, 1, 1.2, 1.2, 1.8, 0.6, 3, 0.8, 1, 0.9, 0.5, 1],
}

/**
 * A longer road back from a head injury in the women's game.
 *
 * The owner asked for "distinct concussion tracking/recovery protocols" rather
 * than only a different chance of getting one. This is the modest version of
 * that: the same complaint, a wider return-to-play band. Two to five weeks
 * instead of two to three, so a bad one costs most of a block of fixtures.
 */
const CONCUSSION_W: readonly [number, number] = [2, 5]

/**
 * ---- THE TRAINING GROUND BREAKS PLAYERS TOO (design review, v1.6.7) ----
 *
 * Every injury in this game used to come out of a match, and a quarter to a
 * third of rugby's do not: they come from a Tuesday session, off a hamstring
 * that goes in a running drill or a shoulder in contact. A squad that only
 * ever got hurt on a Saturday was a squad the manager could rest into safety.
 *
 * Its own list rather than the match one, because the mix is different: soft
 * tissue dominates, the contact injuries are rarer, and the two that end
 * seasons are rarer still - though the achilles is on it on purpose, because
 * in the real game it goes in training as often as in a match.
 *
 * Weighted, and the weights are what make it a training list: a hamstring is
 * five times a knee here. The women's row from INJURY_WEIGHT still applies on
 * top, so a women's save keeps its knee and concussion loading.
 */
const TRAINING_INJURIES: readonly (readonly [string, number, number, number])[] = [
  //  complaint              lo  hi  weight
  ['injury.hamstring', 2, 4, 5],
  ['injury.calf', 1, 3, 4],
  ['injury.groin', 2, 4, 3],
  ['injury.ankle', 1, 3, 3],
  ['injury.deadLeg', 1, 1, 3],
  ['injury.shoulder', 2, 6, 2],
  ['injury.concussion', 2, 3, 1],
  ['injury.kneeLigament', 6, 16, 1],
  ['injury.achilles', 16, 30, 0.4],
] as const

/**
 * Pick a training-ground complaint and how long it costs. Two rng draws: the
 * weighted pick, then the length inside its band. The women's weighting and
 * the longer women's return-to-play after a head knock both carry over from
 * the match table, which is where that research is written down.
 */
export function pickTrainingInjury(rng: Rng, g: Gender): readonly [string, number] {
  const byKey = new Map<string, number>(INJURIES.map((r, i) => [r[0] as string, INJURY_WEIGHT[g][i]]))
  let total = 0
  for (const [dk, , , w] of TRAINING_INJURIES) total += w * (byKey.get(dk) ?? 1)
  let r = rng() * total
  let hit = TRAINING_INJURIES[TRAINING_INJURIES.length - 1]
  for (const row of TRAINING_INJURIES) {
    r -= row[3] * (byKey.get(row[0]) ?? 1)
    if (r < 0) { hit = row; break }
  }
  let [dk, lo, hi] = hit
  if (g === 'w' && dk === 'injury.concussion') { lo = CONCUSSION_W[0]; hi = CONCUSSION_W[1] }
  return [dk, lo + Math.floor(rng() * (hi - lo + 1))] as const
}

/** One rng draw, exactly as the flat pick took, so a uniform row is unchanged. */
function pickInjury(rng: Rng, g: Gender): readonly [string, number, number] {
  const w = INJURY_WEIGHT[g]
  let total = 0
  for (const x of w) total += x
  let r = rng() * total
  for (let i = 0; i < INJURIES.length; i++) {
    r -= w[i]
    if (r < 0) {
      const [dk, lo, hi] = INJURIES[i]
      if (g === 'w' && dk === 'injury.concussion') return [dk, CONCUSSION_W[0], CONCUSSION_W[1]]
      return [dk, lo, hi]
    }
  }
  return INJURIES[INJURIES.length - 1]
}

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

/** Every part of the penalty price that reads the whistle: the aggression
 *  price above and the ruck contest's (the dial block's `1 + rk * 0.11 *
 *  refPenF`). The kick-off swaps for the referee and the crowd went through
 *  aggPenRisk alone, so the ruck term kept the referee-blind factor of 1
 *  until the side's first recompute, and a manager's penalty rate shifted a
 *  little the first time he made any change (1.8.1). rk is read back off
 *  ruckContest, which the same block sets to `1 + rk * 0.1`. */
function refPenPrice(side: SideCtx, rp: number): number {
  const rk = ((side.ruckContest ?? 1) - 1) / 0.1
  return aggPenRisk(side.aggF, rp) * (1 + rk * 0.11 * rp)
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
  /** the minute each replacement came on (starters are absent: they have
   *  been on since the kick-off). Only the in-match player sheet reads it, to
   *  share a side's tackles by the minutes each man has been out there. */
  onAt?: Map<number, number>
  /** KICKS AT GOAL (1.8.0): conversions, penalties and drop goals taken and
   *  put over. Counted, never drawn, so they cannot move the stream; they are
   *  what lets a side that dominated and lost see that it missed five kicks. */
  kicksAt?: number
  kicksMade?: number
  /** KICKS FROM HAND (1.8.0, kicksFromHand): clearances, box kicks and kicks
   *  for territory this side put boot to, and how many of them were charged
   *  down. Absent on a match begun by an older build. */
  handKicks?: number
  chargedDown?: number
  /** TACKLES MADE AND MISSED, by player (1.8.0, countTackles). */
  tackles?: Map<number, number>
  missed?: Map<number, number>
  yellowUntil: Map<number, number>
  /** players currently sitting out a yellow - off the pitch, back in ten.
   *  Before this existed a sin-binned man stayed in onPitch and could score
   *  a try from inside the bin (audit 16D). */
  binned: Set<number>
  sent: number // players lost to RC
  /** players the side had to take off under Law 3.20 - a front-row card with
   *  nobody trained to cover costs a second player, so the uncontested scrum
   *  the card bought is never a free lunch. Charged like a sending-off in
   *  numF, but not a card in anybody's record. */
  short: number
  cardRisk: number
  /** per-tick chance of conceding a kickable penalty. Was a flat 0.115 for
   *  every side in the world, which made Physicality a free lunch: the dial
   *  bought breakdown and its only cost was the (6x smaller) card roll. Now
   *  aggression and the referee's tackle tolerance set the rate (audit 16D). */
  penRisk: number
  /** the referee's contribution to penRisk, locked in at kick-off so a unit
   *  recompute can rebuild the dial part without losing the whistle */
  refPenF?: number
  /** the breakdown dials (1.7.3): how much this side's commitment protects
   *  its own ball, and how hard its contest attacks the opponent's. 1 is none */
  ruckSecure?: number
  ruckContest?: number
  /** f(aggression), -1..1, stashed at build time. penRisk is now computed in two
   *  places - once before the referee is known and again once he is - and both
   *  need the dial. Storing the resolved figure is what stops the two copies of
   *  the formula drifting apart, which is the bug the refPenF comment above was
   *  itself written about. */
  aggF: number
  poss: number // accumulated momentum, for possession stats
  /**
   * ---- PRESSURE, 0 TO 100 (owner, v1.7.0) ----
   *
   * Competitor read: two bars beside the pitch saying who is on top right
   * now. It is the one thing a commentary ticker cannot do - a ticker tells
   * you what happened, and this tells you how the afternoon FEELS - and it
   * needs no animation, no art and no ball-by-ball simulation.
   *
   * Independent per side rather than a share of one bar, which is what makes
   * it honest: in a scrappy ten minutes where neither side can get out of
   * its own half, BOTH bars are low, and a single seesaw would have to claim
   * somebody was on top.
   *
   * It is DERIVED, never rolled: it reads the tick that just happened, so it
   * spends no rng and cannot move a result. A try is a spike, a penalty won
   * is a nudge, and it decays toward whatever the side's attacking threat
   * says it ought to be sitting at, so a spell of pressure builds and then
   * bleeds away when nothing comes of it.
   */
  pressure: number
  /** THE TRIES THIS SIDE'S RUGBY WAS WORTH (1.8.1): the sum of its try
   *  chance over the ticks, before the dice. Read by scripts/movesprobe.ts,
   *  which needs a measure of what a call did that the one roll a tick does
   *  not drown; nothing in the game reads it. */
  xTry?: number
  pens: number // penalty goals kicked
  /** penalties conceded - repeated infringements bring the bin into play */
  consPens: number
  /** per-player petrol tank, 0-100 - drains with minutes played */
  energy: Map<number, number>
  /** TEAM TALKS (teamtalk.ts): each man's match-day multiplier from how he
   *  took the talk, read by teamUnits on every rebuild; the reaction itself,
   *  carried into his morale at full time; and how far the pre-match talk
   *  moved him, which is still in him at the break. Absent on every side
   *  nobody spoke to. */
  talkF?: Map<number, number>
  talkR?: Map<number, number>
  talkShift?: Map<number, number>
  /** drain multiplier from tempo tactics */
  /** how far the style dial is from the squad's natural shape, as a unit cost (1.8.14) */
  styleMisfit?: number
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
  /** THE LAST INJURY STOPPAGE, as the engine resolved it (owner, round 6):
   *  who went down, who the assistant sent on (null when nobody could go on)
   *  and where the stoppage's own lines end in ctx.events. The injury sheet
   *  reads the cover from here rather than guessing it from the next line of
   *  commentary, and the free override is judged against `upTo`, so a line
   *  written at the same stoppage (playing out of position, uncontested
   *  scrums) is not mistaken for the cover having played. Never read by the
   *  simulation, never a draw. */
  lastInj?: { hurtId: number; coverId: number | null; upTo: number }
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

  // ---- THE AFTERNOON ITSELF (1.8.16, see THE AFTERNOON'S INCIDENTS) ----------
  /** how each unit is going today: the lineout that will not fire, the scrum
   *  that is on top. Set once at kick-off, layered so a sub keeps it. */
  day?: Partial<Record<DayUnit, number>>
  /** the number each man wore at kick-off, by player id (1.8.16) */
  shirtNo?: Record<number, number>
  /** how well the side is executing its plan today: scales what its called
   *  moves and its zone plans are worth, never their sign */
  exec?: number
  /** scrum free kicks against this side, for the full-arm escalation */
  scrumFK?: number
  /** free kicks this side has won, and offences it has been named for */
  freeKicks?: number
  /** tries each man has scored in this match (the hat-trick and records) */
  matchTries?: Map<number, number>
  /** the minute of this side's first try, for the fastest-try record */
  firstTryMin?: number
  /** and who scored it */
  firstTryBy?: number
  /** the referee has had a word with this side's captain */
  warned?: number
  /** penalty tries awarded to this side */
  penTries?: number
  /** 50:22s this side has found */
  fifty22?: number

  // ---- who was out there, and for how long ----------------------------------
  /** the XV on the pitch when the first tick ran. The lineup array is
   *  rewritten by every substitution, so reading it at full time handed the
   *  start to whoever finished the match in the shirt. */
  starters?: Set<number>
  /** the minute each man now on the pitch began his current stint */
  since?: Map<number, number>
  /** minutes each man has banked from stints that have ended */
  played?: Map<number, number>
  /** the personnel the units were last built from (see fieldChanged) */
  unitsKey?: number | string
  /** THE STYLES THIS SIDE PLAYS (1.8.2, styles.ts) and how well the men on
   *  the pitch suit them, set with the units (applyModifiers), so a change of
   *  personnel or of style re-reads it. Absent for a side with no club (a
   *  Test side), which the style arithmetic reads as neutral. */
  sty?: SideStyle
  /** the style fits, kept against the shirts and styles they were scored on */
  styFit?: { k: string; atkFit: number; defFit: number }
  /** turnovers this side's defence won through its style, and how many of
   *  its own ticks it lost the ball in (styleprobe reads both) */
  styTurnWon?: number
  /** the ball this side lost in its own ticks that came to nothing (the
   *  half-time read counts it) */
  styTurnLost?: number
  /** its backs' sure hands (habits.ts): a multiplier on the chance a tick
   *  that comes to nothing is turned over, 1 for an average side */
  handsF?: number
  /** this tick's handling error against the world's (styleTick turnP over
   *  TURN_BASE): the forward pass in a try's build-up reads it (scoreTry) */
  fwdF?: number
  /** the tries this side has gone over for, stood or not, which keys the
   *  forward-pass hash; and how many the TMO ruled out or let stand for one */
  tryCalls?: number
  fwdRuledOut?: number
  fwdStood?: number
  /** a man taken off under Law 3 while a front-rower sits a yellow, back on
   *  when the binned man returns (checkFrontRow) */
  lawOut?: { id: number; binned: number } | null
  /** Law 3 with the cover on the bench (frontRowCardCover): a front-rower
   *  sits a yellow, a trained replacement wears his shirt (`shirt`) and
   *  `off` makes way for him. When the binned man's ten minutes end he takes
   *  his shirt back, the replacement goes to the bench and `off` returns.
   *  `swap` false once another man's return has settled the shirt: only
   *  `off` is owed his place back. */
  frCover?: { binned: number; on: number; off: number; shirt: number; swap: boolean }[]
  /** the men sent off who sit in a replacement's seat, because the
   *  replacement took the front-row shirt (frontRowCardCover): never cover */
  sentOff?: Set<number>
  /** the men already named in the commentary as out of a specialist shirt */
  specSaid?: Set<number>
  /** the three set-piece units summed over the ticks played, and how many.
   *  The coach's verdict reads the match's average from these: now that a
   *  side's units follow its replacements, the full-time figure is the pack
   *  that finished the game, not the one that contested most of it. */
  setAcc?: { scrum: number; lineout: number; breakdown: number; n: number }
  /** WHAT THE MATCH WAS MADE OF (1.8.3, evidence.ts): counts kept as the
   *  ticks run, from numbers each tick has already worked out, so the full
   *  time and half time reads can say why without guessing. Never drawn,
   *  never read by the simulation; absent on a match begun by an older build. */
  ev?: EvCount
}

/** The causes a point can be put down to (EvCount.pts), in this order of
 *  precedence for a try: a called move that made it, a turnover won in that
 *  tick or the one before, a line break (a tick whose try chance cleared
 *  BREAK_P), and phase play for the rest of open play. Then the other side's
 *  penalties (the kick, the corner, the tap and a try under advantage), and
 *  the boot (drop goals, and the try off a charge-down). A conversion goes
 *  with its try. */
export const EV_CAUSES = ['move', 'turn', 'break', 'phase', 'pen', 'kick'] as const
export type EvCause = typeof EV_CAUSES[number]

/** A LINE BREAK, as the engine sees one: a tick whose try chance, after
 *  everything (units, ground, plan, contest, move, style, the clock), is at
 *  least this. About five in a match for a side (evidenceprobe), more in a
 *  mismatch; the counter only names the ticks, it decides nothing. */
export const BREAK_P = 0.2

/** the zone a side is in, by its own distance up the pitch (tactics.zoneAt):
 *  0 its own 22, 1 the middle, 2 the opposition 22 */
export const zoneIdx = (up: number): 0 | 1 | 2 => up < 22 ? 0 : up > 78 ? 2 : 1

export interface EvCount {
  /** per move called: [calls, metres it won or lost (the line's own move),
   *  tries it made, calls the tape blunted, metres the blunting cost] */
  calls: Record<string, number[]>
  /** points by cause, in EV_CAUSES order; they sum to the side's score */
  pts: number[]
  /** line breaks, and ticks where this side won its carry (contest) */
  breaks: number
  carries: number
  /** the style matchup summed over this side's ticks (styles.ts m), and the
   *  tries the style added over the world's (the try chance it multiplied) */
  sty: number
  styX: number
  /** ticks this side played in each zone (its plan's zone), own 22 first */
  zone: number[]
  /** turnovers won and lost, by the zone (from this side's view) they
   *  happened in; and the tick of the last one won (for the try that follows) */
  turnWon: number[]
  turnLost: number[]
  lastTurn: number
  /** the try chance the tape took off this side's calls (armsrace.ts) */
  bluntX: number
}

/** the counters, made on first use, so an old match reads as empty */
export function evOf(side: SideCtx): EvCount {
  return (side.ev ??= {
    calls: {}, pts: [0, 0, 0, 0, 0, 0], breaks: 0, carries: 0, sty: 0, styX: 0,
    zone: [0, 0, 0], turnWon: [0, 0, 0], turnLost: [0, 0, 0], lastTurn: -9, bluntX: 0,
  })
}

/** Points on the board, put down to what made them: the cause the scoring
 *  path set on ctx.evWhy, else phase play (a penalty kick and a drop goal
 *  name their own). */
function evPts(ctx: LiveCtx, side: SideCtx, n: number, cause?: EvCause) {
  const c = cause ?? ctx.evWhy ?? 'phase'
  evOf(side).pts[EV_CAUSES.indexOf(c)] += n
}

/** One tick's worth of evidence for the side with the ball, read off what
 *  simTick has just worked out for it: where it was, whether the tick was a
 *  line break, who won the carry, what the style matchup and the called move
 *  were worth, and what the tape took off the call. */
function evTick(side: SideCtx, opp: SideCtx, pTry: number, up: number,
  mv: MoveInPlay | null, st: { m: number; tryF: number }, contest: Contest | null | undefined) {
  const ev = evOf(side)
  ev.zone[zoneIdx(up)] += 1
  if (pTry >= BREAK_P) ev.breaks += 1
  if (contest && contest.dominance > 0.5) ev.carries += 1
  if (side.sty && opp.sty) {
    ev.sty += st.m
    if (st.tryF > 0) ev.styX += pTry * (1 - 1 / st.tryF)
  }
  if (!mv) return
  // the ground the call moves the line by when the tick comes to nothing
  const metres = (g: number) => g >= 0 ? g * 20 : g * 40 * mv.risk
  const c = (ev.calls[mv.id] ??= [0, 0, 0, 0, 0])
  c[0] += 1
  c[1] += metres(mv.gain)
  if (mv.gain0 != null && mv.gain0 !== mv.gain) {
    c[3] += 1
    c[4] += metres(mv.gain0) - metres(mv.gain)
    ev.bluntX += pTry * ((1 + mv.gain0) / Math.max(0.05, 1 + mv.gain) - 1)
  }
}

/** WHAT THE SKY DOES TO THE UNITS (conditions.ts), one place for kick-off and
 *  every rebuild: wet weather is forward weather, a damp day a third of it,
 *  wind takes a little off the kicking game; and the men who relish a heavy
 *  pitch (habits.ts) find a little more when it is wet. */
function weatherUnits(state: GameState, side: SideCtx, weather: Weather | null) {
  if (!weather) return
  if (weather === 'Rain' || weather === 'Snow') {
    side.units.attack *= weather === 'Snow' ? 0.86 : 0.90
    side.units.breakdown *= 1.04
  } else if (weather === 'Damp') {
    side.units.attack *= 0.965
    side.units.breakdown *= 1.013
  }
  if (weather === 'Wind') side.units.kicking *= 0.92
  const wet = wetness(weather)
  if (wet > 0) {
    const shirts = fieldLineup(side).slice(0, 15).map(id => (id != null && side.onPitch.has(id) ? state.players[id] ?? null : null))
    side.units.attack *= habitFx(state.seed, shirts, wet).mudAtk
  }
}

/** Tactic + weather + coaching modifiers, applied to freshly computed units. */
function applyModifiers(state: GameState, side: SideCtx, weather: Weather | null) {
  const club = state.clubs[side.teamId]
  // FROM A CLEAN BASE EVERY TIME. This runs at kick-off and again on every
  // recompute, and the figures below are only ASSIGNED on some paths: a Test
  // side has no club, so its tempo, card and penalty risk were never reset and
  // each recompute multiplied the layered mods into them again, and the
  // coaching block ADDS its goal-kicking bonus. A side that changed personnel
  // five times kicked with five coaching bonuses. Resetting here, to exactly
  // the values mkSide starts from, is what makes a recompute idempotent: the
  // kick-off numbers are unchanged and the tenth rebuild lands where the
  // first did. The penalty price reads refPenF, which carries the referee and
  // the crowd, so nothing beginMatch folded in is lost.
  side.goalBonus = 0
  side.tempoF = 1
  side.drainF = 1
  side.cardRisk = 0.012
  side.aggF = 0
  side.penRisk = aggPenRisk(0, side.refPenF ?? 1)
  // who is actually out there: a sent-off captain does not lead, a man in the
  // bin does not call the lineouts and a hot head in the stand cannot be sent
  // off again. At kick-off this is the XV, so nothing changes there.
  const present = (id: number | null | undefined): id is number => id != null && side.onPitch.has(id)
  // and the shirts as the units read them, an HIA stand-in in his (fieldLineup)
  const shirts = fieldLineup(side).slice(0, 15)
  /**
   * ---- THE TRAINING PITCH (owner, v1.8.1) ----
   *
   * "Good pitch equals good prep - bad pitch means in game effect on
   * breakdowns and skills."
   *
   * This facility was called the Playing Surface and did exactly one thing:
   * shaved a few per cent off the user's injury roll at home, while the
   * screen advertised "3.5% fewer breakdowns at home" that no line of code
   * delivered. A placebo control with a label on it.
   *
   * It is the TRAINING pitch now, which is the honest version: a squad that
   * does its ruck work on a bog arrives on Saturday rusty at the breakdown
   * and heavy-handed, and one with a true surface arrives sharp. So it reads
   * off the side's OWN club - the pitch you train on travels with you - and
   * it cuts both ways around level three, because a bad pitch is a real cost
   * and not merely an absent bonus.
   *
   * Every club in the world has one, so this is read per side rather than
   * through facLevel, which only ever answers for the manager's club.
   */
  if (club) {
    const lvl = club.facilities?.pitch ?? 0
    side.units.breakdown *= 0.955 + lvl * 0.018
    side.units.attack *= 0.97 + lvl * 0.012
  }
  // a happy dressing room plays for each other; a sour one hesitates
  if (club) {
    const xv = shirts.map(id => id != null ? state.players[id] : null).filter(Boolean)
    if (xv.length) {
      const avgMor = xv.reduce((s, p) => s + p!.morale, 0) / xv.length
      const mF = 1 + (avgMor - 6.5) * 0.009 // roughly ±3% at the extremes
      side.units.attack *= mF
      side.units.defence *= mF
      // close friends side by side, or two men not speaking (bonds.ts): ±0.6% at most
      const bF = bondCohesion(state, club.id, shirts)
      side.units.attack *= bF
      side.units.defence *= bF
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
    // TEMPO IS A TRADE BOTH WAYS (1.8.14). Slow used to buy defence (+3% at
    // the bottom of the dial) as well as 22% less running, for 5% of attack:
    // held all season it took the seventh-best squad in the Premier Division
    // to an average finish of 3.9th, from 5.8th. Slowing the game down now
    // costs more going forward, buys nothing at the back, and saves half as
    // much legs; playing fast still costs a little shape in defence.
    // A PLAN THE SQUAD CANNOT PLAY (1.8.14, owner's balance brief: "bad tactics
    // with great players should be punished"). Measured before it: the
    // strongest squad in France finished exactly as high playing the opposite
    // of its strengths as playing to them. A squad has a natural shape - read
    // off its own units, backs against pack, where the world's squads run from
    // about -0.04 (a pack side) to +0.22 (a back three side), mean 0.05, sd 0.064 - and a
    // style dial more than 15 away from it costs up to 6% of attack (at 45
    // away) and half that of the breakdown. Read before the dials move the units, so the dial cannot
    // chase its own tail. Every club, the same rule.
    const fwdU = (side.units.scrum + side.units.breakdown + side.units.lineout) / 3
    const lean = (side.units.attack - fwdU) / Math.max(1e-6, (side.units.attack + fwdU) / 2)
    const natural = 50 + clamp((lean - 0.05) / 0.064, -2, 2) * 20
    const styleV = Number.isFinite(tac.style) ? clamp(tac.style, 0, 100) : 50
    const misfit = clamp((Math.abs(styleV - natural) - 15) / 30, 0, 1) * 0.06
    side.styleMisfit = misfit
    const tf = f(tac.tempo)
    side.units.attack *= (1 - misfit) * (1 + f(tac.style) * 0.06 + tf * (tf < 0 ? 0.08 : 0.05) - f(tac.kicking) * 0.035)
    side.units.breakdown *= 1 - misfit * 0.5
    side.units.scrum *= 1 - f(tac.style) * 0.05
    side.units.breakdown *= 1 + f(tac.aggression) * 0.06 - f(tac.style) * 0.03 - f(tac.kicking) * 0.02
    side.units.kicking *= 1 + f(tac.kicking) * 0.1
    side.units.defence *= 1 - Math.max(0, tf) * 0.03
    side.tempoF = 1 + tf * 0.12
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
    // THE BREAKDOWN (1.7.3, owner: "breakdown commitments", attack and defence
    // separately). Both are trades, both exactly nothing at 50.
    //   COMMIT - how many you send into your own ruck. Many: the ball is safe
    //   (your breakdown counts for more when you have it) but those men are
    //   not in the attacking line. Few: the reverse, and quick ball goes wide.
    //   CONTEST - how hard you go after theirs. Counter-rucking and jackalling
    //   make your breakdown bite on their ball, but the men on the floor are
    //   not in the defensive line, and a fussy referee (refPenF above 1) sees
    //   more of it: penalties up, and a little more card risk.
    const rc = f(tac.ruckCommit ?? 50)
    side.units.attack *= 1 - rc * 0.035
    side.ruckSecure = 1 + rc * 0.1
    const rk = f(tac.ruckContest ?? 50)
    side.units.defence *= 1 - rk * 0.03
    side.ruckContest = 1 + rk * 0.1
    // 0.11 from 1.8.0 (was 0.1): an own-half penalty now goes to touch rather
    // than at the posts, so each one conceded costs a little less and the full
    // contest had drifted to +3.2 a match against balanced (kickbreakprobe;
    // 0.12 fixed that but left draws one game under bandcheck's floor).
    side.penRisk *= 1 + rk * 0.11 * (side.refPenF ?? 1)
    side.cardRisk += rk * 0.0015

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
      // execute does not hand you its upside either. Tempo was applied in
      // full until 1.8.1, so an undrilled maul still saved the legs a drilled
      // one does; now the saving (tempo under 1) needs the competence and a
      // cost (over 1) is paid whether the shape comes off or not.
      if (r.attack) side.units.attack *= 1 + (r.attack - 1) * Math.max(0, e.q)
      if (r.tempo) side.tempoF *= r.tempo < 1 ? 1 + (r.tempo - 1) * Math.max(0, e.q) : r.tempo
    }
    // the attacking moves' legs (moves.ts), on the routine's rule; exactly 1
    // for a club with no calls
    side.tempoF *= moveTempoF(state, club)

    // THE STYLES (1.8.2, styles.ts): what this side plays with and without
    // the ball, how well the men in the shirts suit it, and the legs it
    // costs. Read here so a substitution or a change of style re-reads it.
    const sty = stylesOf(state, club)
    if (sty) {
      const at = (shirt: number, a: keyof Player['a']) => {
        const pid = shirts[shirt - 1]
        const p = pid != null ? state.players[pid] : undefined
        return p ? p.a[a] : null
      }
      // a man's attributes do not move during a match, so the fit only
      // changes with the shirts or the styles: kept until one of them does
      // (perfprobe, 1.8.16: every rebuild scored the XV twice over)
      const k = `${sty.atk}|${sty.def}|${shirts.join(',')}`
      if (side.styFit?.k !== k) {
        const [atkFit, defFit] = styleFitsRel([sty.atk, sty.def], at)
        side.styFit = { k, atkFit, defFit }
      }
      side.sty = { ...sty, atkFit: side.styFit.atkFit, defFit: side.styFit.defFit }
      side.tempoF *= styleDrain(sty)
    }

    // The kicking game (F3). A designated kicker is a decision; the automatic
    // pick of whoever has the best attribute is not.
    // Read against the SHIRTS, not against who is on the pitch this minute: a
    // first-choice kicker sitting out ten in the bin is still the first-choice
    // kicker, and goalKicker() finds a stand-in while he sits and hands the tee
    // back when he returns. Keyed on onPitch, a rebuild during his ten minutes
    // quietly demoted him for the rest of the match. At kick-off the two sets
    // are the same, so the pick there is unchanged.
    const named = (tac.kickers ?? []).find(id => id != null && side.lineup.slice(0, 15).includes(id) && !state.players[id]?.injury)
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
      if (!r || shirts[i] == null) continue
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
  for (const id of shirts) {
    const p = present(id) ? state.players[id] : null
    if (p?.trait === 'Hot Head') side.cardRisk += 0.002
  }
  // a proper captain in the XV steadies the ship and keeps discipline;
  // when he's missing, the vice-captain leads at half the effect
  const xvIds = shirts.filter(present)
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
    const onField = new Set(shirts.filter(present))
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
  // When this was written a sleepwalking manager's fixtures were simmed with
  // isUser false for BOTH sides - so gating on the flag handed the manager's
  // own club a free coaching department on exactly the weeks he could not be
  // bothered to turn up. (simMatch now marks his club as the user's side, as
  // every other path does, but a Test week or any future caller that names
  // another side must still not hand his club this baseline.) Measured before this line was fixed: a giant's
  // sleepwalk board bottomed at 31.3 instead of 16.3 and sackings fell from 2
  // in 6 to 1 in 6, which is the change making absenteeism SAFER. The user's
  // club is the user's club whoever is pressing the buttons.
  //
  // Deterministic: reputation only, no draw from the shared stream.
  //
  // And a club the manager has been sacked by is not his any more: userClubId
  // still names it while he is out of work, and it played with neither his
  // staff nor anybody else's, a few per cent weaker than every other side.
  if (side.teamId !== state.userClubId || state.unemployed) {
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

  // THE ROOM CARRIES OUT WHAT IT BELIEVES IN (1.8.14, authority.ts EXEC_BITE).
  // Keyed on the club like the coaching baseline above: the manager's club
  // plays with the room he has, whoever is pressing the buttons.
  if (side.teamId === state.userClubId && !state.unemployed) {
    const ex = standing(state).execution
    side.units.attack *= ex
    side.units.defence *= ex
    side.units.breakdown *= ex
  }

  // your backroom staff sharpen the matchday units (club only - Test
  // weeks mean borrowed players, not your own coaching department)
  if (side.isUser && side.teamId === state.userClubId && state.staff) {
    const s = state.staff
    // (1.8.14: a level is 1.3%, from 1.6%, so a fully badged department is
    // worth what the best AI club's flat coaching is - 3.9% against 4.0% -
    // rather than more. A full house measured +5 to +11 points of win rate
    // over an empty one, more than any decision the manager made)
    side.units.attack *= 1 + (s.attack ?? 0) * 0.013
    side.units.defence *= 1 + (s.defence ?? 0) * 0.013
    side.units.scrum *= 1 + (s.scrumCoach ?? 0) * 0.013
    side.units.lineout *= 1 + (s.scrumCoach ?? 0) * 0.013
    side.units.kicking *= 1 + (s.kicking ?? 0) * 0.016
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
      // 0.07 from 1.8.0: the same collapse again, in two steps. E5-E9 took
      // the edge from +78.7 points a season to +27.3, and kicks from hand,
      // charge-downs and the two-layer contest took it to -14.0 and then
      // -0.3 (following sound reads was worth nothing against a fitness
      // week). At 0.07: +44.4, ahead in 14 of 24 paired seasons.
      // 0.09 from 1.8.14: the fatigue rebalance (a fresher starting tank,
      // condition costing less per point) made a fitness week relatively
      // stronger again, and the edge read -4.5 a season over 48 seasons.
      // Measured on the same 48: 0.09 reads +31.3 (ahead in 30), 0.11 +44.9.
      //
      // This is OUR half of the edge. Their half, the soft spot itself giving
      // a little more (x0.955), is layered once at kick-off in beginMatch; the
      // two together are the one correct read. Until 1.8.1 kick-off also put
      // x1.03 on our OWN unit of the same name, so a read of their defence
      // lifted our defence as well as our attack: one read paid twice, once
      // on a unit it had nothing to do with.
      const homework = 0.09 * prepF
      side.units[EXPLOITED_BY[read.unit]] *= 1 + homework
    }
  }
  weatherUnits(state, side, weather)
  // THE MEN'S HABITS (habits.ts): secret, centred on the world, read off the
  // men actually out there, so a sub or a card re-reads them
  {
    const hx = HABITS.on ? habitFx(state.seed, shirts.map(id => (present(id) ? state.players[id] ?? null : null)), 0) : HABITS_OFF
    side.units.lineout *= hx.lineout
    side.penRisk *= hx.pen
    side.units.defence *= hx.defence
    side.handsF = hx.hands
  }
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
      // carrying a knock (knock.ts): he starts short of his usual tank
      const knockF = state.players[id]?.knock ? KNOCK_ENERGY : 1
      // HALF OF LAST WEEK IS IN THE LEGS, NOT ALL OF IT (1.8.14). The tank
      // started at his condition, so 80% condition was 80% of a tank on top of
      // the 4% the craft term takes: one tired week cost a side 18 points of
      // win rate. A night's sleep and a team run give some of it back.
      const c0 = state.players[id]?.cond ?? 85
      energy.set(id, Math.max(50, 100 - (100 - c0) * 0.45) * knockF)
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
    score: 0, tries: 0, ratings, onPitch, yellowUntil: new Map(), binned: new Set(), sent: 0, short: 0,
    cardRisk: 0.012, penRisk: 0.115, aggF: 0,
    poss: 0, pens: 0, consPens: 0, pressure: 12,
    energy, tempoF: 1, drainF: 1, goalBonus: 0,
    exIds: new Set(),
    isUser: teamId === userTeamId,
    mods: freshMods(),
    // the split the bench ACTUALLY is, not the one that was chosen: five of the
    // eight seats take whoever you put in them, so the men in the shirts decide.
    // Read off this match's 23, not the stored sheet (see actualSplit, 1.8.1)
    split: actualSplit(state, state.clubs[teamId], lineup),
    benchIds, seatOf,
  }
  applyModifiers(state, side, null)
  // REPETITION FATIGUE (pillar 2): a high-intensity habit held for weeks is
  // paid for in petrol. Set once here - the substitution rebuild re-runs
  // applyModifiers, not mkSide, so this can never compound. 1.0 exactly in a
  // fresh world, which is what keeps the fingerprint on the old stream.
  // the CLUB is the club, whoever pressed the button. isUser was false for both
  // sides when the assistant settled a fixture, so delegating a week skipped
  // the penalty entirely - the same isUser-versus-teamId trap the coaching
  // department comment above was written about. Keyed on the club it holds
  // whoever the caller names as the user's side.
  if (side.teamId === state.userClubId) side.repF = repetitionFatigue(state)
  // the XV start their stints at the kick-off, and the units just built are
  // the units of this personnel, so the first tick has nothing to rebuild
  side.since = new Map([...onPitch].map(id => [id, 0]))
  side.played = new Map()
  side.unitsKey = personnelKey(side)
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
/** the lines that claim range, and the plain line each becomes for a kicker without it */
const PEN_LONG: Record<string, string> = { 'comm.pen4': 'comm.pen1', 'comm.pen6': 'comm.pen2', 'comm.pen9': 'comm.pen3' }
/** the same idea for a line that claims WEATHER. pen11 has the kicker wiping
 *  mud off the ball and rain off his face, and nothing stopped it firing under
 *  a clear sky - the try bank has had TRY_LINES_WET since the beginning and the
 *  penalty bank never got the equivalent. Same shape as PEN_LONG: a swap after
 *  the draw, so no extra call on the stream and every seeded match keeps its
 *  fingerprint. */
const PEN_WET: Record<string, string> = { 'comm.pen11': 'comm.pen5' }
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
/** try lines that put the ball under the posts, and conversion lines that
 *  put the kicker on the touchline: the two never follow each other. Since
 *  1.8.12 neither line names the posts (owner: the clip showed the try nowhere
 *  near them), but the swap stays so the line sequence, and the fingerprint
 *  built from it, are unchanged */
const UNDER_POSTS = new Set(['comm.try5', 'comm.try21'])
const TOUCHLINE_CON = new Set(['comm.con3', 'comm.con8'])
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
/** the light moments (1.7.4, owner: "need more humour in the game"): a dog on
 *  the pitch, a lost boot, a seagull that will not move. Rare, about one in
 *  thirty atmosphere lines, so a match has one now and then and never a set. */
const FLAVOR_FUN = ['comm.fun1', 'comm.fun2', 'comm.fun3', 'comm.fun4', 'comm.fun5', 'comm.fun6']
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

/**
 * ---- THE MATCH, CALLED AS IT IS PLAYED (1.8.0) ----
 *
 * The owner asked for more commentary, about 100 to 150 lines a match. A watched match
 * used to be about 48 lines, most of them scores and the odd atmosphere line,
 * so four minutes of rugby could pass in one sentence. These banks describe
 * the rugby the engine is already playing: where the ball is (ctx.field), who
 * has been winning it (the tick's scoring roll), the kicks from hand it now
 * counts, the restarts after a score, the set piece the match sheet derives.
 *
 * WORDS ONLY. Every pick in here is ctx.crng, the commentary's own dice, and
 * every line is stamped at the minute the clock has already reached (see
 * colour() below), so a watched match and the same fixture played silently
 * stay the same match (scripts/detailprobe.ts). Nothing here reads a line
 * back or changes a number.
 *
 * Grouped by where the ball is, so a line never puts a side in the wrong 22.
 */
/** a side running it out of its own 22 */
const PBP_DEEP = ['comm.pbpDeep1', 'comm.pbpDeep2', 'comm.pbpDeep3', 'comm.pbpDeep4', 'comm.pbpDeep5', 'comm.pbpDeep6']
/** phase play between the 22s */
const PBP_MID = [
  'comm.pbpMid1', 'comm.pbpMid2', 'comm.pbpMid3', 'comm.pbpMid4', 'comm.pbpMid5', 'comm.pbpMid6',
  'comm.pbpMid7', 'comm.pbpMid8', 'comm.pbpMid9', 'comm.pbpMid10', 'comm.pbpMid11', 'comm.pbpMid12',
]
/** close to their line */
const PBP_RED = [
  'comm.pbpRed1', 'comm.pbpRed2', 'comm.pbpRed3', 'comm.pbpRed4', 'comm.pbpRed5',
  'comm.pbpRed6', 'comm.pbpRed7', 'comm.pbpRed8', 'comm.pbpRed9', 'comm.pbpRed10',
]
/** the breakdown, anywhere */
const PBP_RUCK = [
  'comm.pbpRuck1', 'comm.pbpRuck2', 'comm.pbpRuck3', 'comm.pbpRuck4', 'comm.pbpRuck5',
  'comm.pbpRuck6', 'comm.pbpRuck7', 'comm.pbpRuck8', 'comm.pbpRuck9', 'comm.pbpRuck10',
]
/** a count of phases: {n} is the phase count, a word choice like the rest */
const PBP_PHASES = ['comm.pbpPhases1', 'comm.pbpPhases2', 'comm.pbpPhases3', 'comm.pbpPhases4', 'comm.pbpPhases5', 'comm.pbpPhases6']
/** the side without the ball, as a unit */
const DEF_SET = [
  'comm.defSet1', 'comm.defSet2', 'comm.defSet3', 'comm.defSet4', 'comm.defSet5',
  'comm.defSet6', 'comm.defSet7', 'comm.defSet8', 'comm.defSet9', 'comm.defSet10',
]
/** a named tackler: always a man the tackle count already has making hits */
const DEF_HIT = ['comm.defHit1', 'comm.defHit2', 'comm.defHit3', 'comm.defHit4', 'comm.defHit5', 'comm.defHit6', 'comm.defHit7', 'comm.defHit8']
/** the set piece the match sheet derives (matchStats): words, no count moves */
const SP_LINEOUT = [
  'comm.lineout1', 'comm.lineout2', 'comm.lineout3', 'comm.lineout4', 'comm.lineout5',
  'comm.lineout6', 'comm.lineout7', 'comm.lineout8', 'comm.lineout9', 'comm.lineout10',
]
const SP_SCRUM = [
  'comm.scrum1', 'comm.scrum2', 'comm.scrum3', 'comm.scrum4', 'comm.scrum5',
  'comm.scrum6', 'comm.scrum7', 'comm.scrum8', 'comm.scrum9', 'comm.scrum10',
]
/** the kick-off after a score, taken by the side that conceded it */
const RESTART = [
  'comm.restart1', 'comm.restart2', 'comm.restart3', 'comm.restart4', 'comm.restart5',
  'comm.restart6', 'comm.restart7', 'comm.restart8', 'comm.restart9', 'comm.restart10',
]
/** where the game is being played, now and then */
const TERR_CAMPED = ['comm.terrCamped1', 'comm.terrCamped2', 'comm.terrCamped3', 'comm.terrCamped4', 'comm.terrCamped5']
const TERR_MIDDLE = ['comm.terrMiddle1', 'comm.terrMiddle2', 'comm.terrMiddle3', 'comm.terrMiddle4', 'comm.terrMiddle5']
/** the last ten minutes, read off the scoreboard as it stands */
const LATE_CHASE = ['comm.lateChase1', 'comm.lateChase2', 'comm.lateChase3', 'comm.lateChase4']
const LATE_HOLD = ['comm.lateHold1', 'comm.lateHold2', 'comm.lateHold3', 'comm.lateHold4']
const LATE_LEVEL = ['comm.lateLevel1', 'comm.lateLevel2', 'comm.lateLevel3']
/** a greasy ball, when it is raining */
const PBP_WET = ['comm.pbpWet1', 'comm.pbpWet2', 'comm.pbpWet3', 'comm.pbpWet4', 'comm.pbpWet5']

/** KICKS FROM HAND (1.8.0), each one a kick the engine counted (kicksFromHand) */
const KICK_EXIT = ['comm.kickExit1', 'comm.kickExit2', 'comm.kickExit3', 'comm.kickExit4', 'comm.kickExit5', 'comm.kickExit6', 'comm.kickExit7']
const KICK_BOX = ['comm.kickBox1', 'comm.kickBox2', 'comm.kickBox3', 'comm.kickBox4', 'comm.kickBox5', 'comm.kickBox6', 'comm.kickBox7']
const KICK_TOUCH = ['comm.kickTouch1', 'comm.kickTouch2', 'comm.kickTouch3', 'comm.kickTouch4', 'comm.kickTouch5', 'comm.kickTouch6']
const KICK_LONG = ['comm.kickLong1', 'comm.kickLong2', 'comm.kickLong3', 'comm.kickLong4', 'comm.kickLong5', 'comm.kickLong6']
const KICK_UP = ['comm.kickUp1', 'comm.kickUp2', 'comm.kickUp3', 'comm.kickUp4', 'comm.kickUp5', 'comm.kickUp6']
const KICK_PIN = ['comm.kickPin1', 'comm.kickPin2', 'comm.kickPin3', 'comm.kickPin4', 'comm.kickPin5', 'comm.kickPin6']
/** the other side's answer to a kick, named for the man who fields it */
const KICK_FIELD = ['comm.kickField1', 'comm.kickField2', 'comm.kickField3', 'comm.kickField4', 'comm.kickField5', 'comm.kickField6', 'comm.kickField7']

/** CHARGE-DOWNS (1.8.0): the block, the try that can come of it, and the
 *  four other ways the ball can land */
const CHARGE_DOWN = ['comm.chargeDown1', 'comm.chargeDown2', 'comm.chargeDown3', 'comm.chargeDown4', 'comm.chargeDown5']
const CHARGE_TRY_LINES = ['comm.tryCharge1', 'comm.tryCharge2', 'comm.tryCharge3', 'comm.tryCharge4']
const CHARGE_LINEOUT = ['comm.chargeLineout1', 'comm.chargeLineout2', 'comm.chargeLineout3']
const CHARGE_SCRUM = ['comm.chargeScrum1', 'comm.chargeScrum2', 'comm.chargeScrum3']
const CHARGE_REGATHER = ['comm.chargeRegather1', 'comm.chargeRegather2', 'comm.chargeRegather3']
const CHARGE_SAFE = ['comm.chargeSafe1', 'comm.chargeSafe2', 'comm.chargeSafe3']

/** DROP GOALS THAT MISS (1.8.0): the attempt was always rolled and counted as
 *  a kick at goal, and a miss said nothing at all */
const DROP_MISS = ['comm.dropMiss1', 'comm.dropMiss2', 'comm.dropMiss3', 'comm.dropMiss4', 'comm.dropMiss5', 'comm.dropMiss6']

/** Live match context. The match is simulated tick by tick (4 minutes per
 *  tick, 20 ticks) so tactics changes and substitutions genuinely change
 *  what happens next, at any point in the game. */
export interface LiveCtx {
  fx: Fixture
  /** the salt of the styles' turnover hash (styleSalt), set on first use */
  stySalt?: number
  /** how far the manager's opponent is set for each of his calls (1.8.2,
   *  armsrace.ts), taken at kick-off; absent in a match he is not in */
  callAdapt?: Record<string, number>
  /** what the manager's opponent remembers of the last meeting (1.8.4,
   *  rematch.ts), taken at kick-off with the tape; absent otherwise */
  rematch?: Rematch
  home: SideCtx
  away: SideCtx
  rng: Rng
  /** THE COMMENTARY'S OWN DICE (1.8.0). Anything drawn only because somebody
   *  is watching (which atmosphere line, whether a missed kick gets a line)
   *  draws from here, never from rng. The match is ONE engine whether it is
   *  watched or not, as Football Manager's is: the detail level decides what
   *  is written down, never what happens. Drawing commentary from rng made
   *  every watched match a different match from the same fixture played
   *  silently (scripts/detailprobe.ts: 0 of 120 alike before this). */
  crng: Rng
  /** EVERY KICK AT GOAL, in the order of the commentary (1.8.0): [the index
   *  of the line it belongs to, 0 home / 1 away, 1 made / 0 missed]. The
   *  engine runs a tick ahead of the ticker, so the live stats count only
   *  the kicks whose line has been shown; reading the side's totals put a
   *  kick on the screen before the ticker had taken it. */
  kickLog?: [number, 0 | 1, 0 | 1][]
  /** the seed of the kicks-from-hand dice (kicksFromHand), drawn once from
   *  rng at kick-off so every match has its own */
  kickSeed?: number
  /** the partnerships this match has already been counted into (state.chem,
   *  at kick-off). A rebuild of the units reads them one game short, so it
   *  sees the familiarity the kick-off units were built from and does not
   *  hand a side a chemistry step for having made a substitution. */
  chemToday?: Set<string>
  detail: boolean
  weather: Weather
  /** the pitch it is played on (conditions.ts): absent on a match begun by
   *  an older build, read as hybrid */
  surface?: Surface
  derby: boolean
  goalPenalty: number
  hfa: number
  events: MatchEvent[]
  lastMin: number
  isUser: boolean
  /** the team the user is coaching in this match (club or national side) */
  userSideId: string | null
  /** THE ASSISTANT HAS THE BENCH (1.8.0): set by the instant result, where the
   *  manager has handed the match over. The user's side then makes its
   *  replacements the way every AI side does (aiAutoSubs), instead of none -
   *  measured before this: 0.8 replacements a match, all of them injuries,
   *  against the opposition's 6.5, so tired starters played the full eighty
   *  and the bench split and the replacement briefs did nothing. */
  assistantSubs?: boolean
  /** next tick to simulate, 0..20 */
  tick: number
  /** 0 = pre-KO, 1 = HT reached, 2 = 60' break reached, 3 = full-time */
  seg: 0 | 1 | 2 | 3
  /** set at HT / 60' until the user resumes play */
  awaiting: 'HT' | 'BRK' | null
  /** A whistle the clock has reached but which has NOT been blown, because a
   *  kickable penalty awarded before it is still in the manager's hands
   *  (owner, twice: "half time whistle went, but i was still able to kick a
   *  goal"). Nothing is narrated, the interval does not open and the match is
   *  not finalised until the call is answered - see stepTick and
   *  resolveDecision. */
  heldWhistle?: 'HT' | 'FT' | null
  /**
   * ---- WHERE THE GAME IS BEING PLAYED, 0 TO 100 (owner, v1.8.0) ----
   *
   * 0 is the home try line, 100 is the away one, 50 is halfway. Until now
   * this engine had no field position at all: a scoring chance came purely
   * from the ratio of the two sides' unit strengths, and `terr` tilted that
   * ratio by the kicking game without ever saying WHERE anybody was.
   *
   * That was a defensible abstraction and it cost two things. A manager's
   * boot bought him an invisible edge rather than a visible position, and
   * there was nothing for a zonal tactic to refer to - "in your own 22" has
   * no meaning in an engine with no 22.
   *
   * So the boot now moves a line, and the line decides whose afternoon it is.
   */
  field: number
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
  /** how each man took the pre-match and the half-time talk (teamtalk.ts),
   *  for the screens: absent until a talk is given */
  preReads?: TalkRead[]
  htReads?: TalkRead[]
  htTone?: string
  /** a touchline call waiting on the user (kickable penalty etc) */
  decision: { kind: 'penalty'; min: number; fld?: number } | null
  /** Index of the whistle line for the period that has just ended, while a
   *  touchline call awarded BEFORE it is still unanswered. The kick belongs
   *  in front of that line, not behind it - see resolveDecision. Null
   *  whenever the clock is running. */
  whistleAt?: number | null
  /** the referee has ordered uncontested scrums: at kick-off for a lineup
   *  that cannot cover the front row, or mid-match when the last trained
   *  loosehead, hooker or tighthead goes off. Read before ordering them twice. */
  uncontested?: boolean
  /** the levelling factors a sin-bin ordered, kept so the scrum can be
   *  contested again when the binned front-rower returns. Absent for a
   *  shortage that cannot mend itself (kick-off, injury, red card). */
  uncontestedUndo?: { home: number; away: number } | null
  /** momentum, -1 (away camped in our half) .. +1 (home dominant) */
  momo: number
  /** live bad blood between the clubs (reason string) - derby-lite heat */
  grudge?: string | null
  /** per-tick home possession share, for the last-10-minutes graphic */
  momoHist?: number[]
  /** THE CALLED MOVE THAT MADE THIS TRY (1.8.1, moves.ts), set by simTick
   *  just before scoreTry and cleared straight after: scoreTry names the move
   *  in the try line instead of the pool's line, after the pool's draw has
   *  been taken, so the dice are the same either way. */
  moveTry?: { id: string; launch: Launch; maker: number | null } | null
  /** WHAT THE POINTS ABOUT TO GO ON THE BOARD ARE PUT DOWN TO (1.8.3,
   *  EvCount.pts): set just before a scoring call and cleared after it, as
   *  moveTry is. Read only by the counters. */
  evWhy?: EvCause | null
  /** the margin (home minus away) at the end of each tick, for the lead
   *  changes the evidence keeps (evidence.ts) */
  marginHist?: number[]
  /** THE HALF-TIME READ, KEPT (1.8.4, evidence.ts halfFollow): the evidence
   *  as it stood at the break, and the manager's four touchline dials there
   *  and as the second half kicked off, so full time can say whether what
   *  was hurting eased and whether he moved the dial that answers it. Read
   *  at the whistle, never drawn; a resumed match replays to the same. */
  htEv?: CausalEvidence
  htDials?: number[]
  shDials?: number[]
  /** the same four dials as the ball was first kicked (1.8.5), so full time
   *  can tell a plan carried into the match and changed at the break from
   *  one dropped before it (matchfindings planCarried) */
  koDials?: number[]
  /** a hot afternoon (1.8.16): legs go sooner and the referee calls water
   *  breaks at the quarters. Set at kick-off from the conditions, no draw. */
  hot?: boolean
}

/** The manager's four touchline dials, in LEVER_DIALS order: his club's
 *  match only (a Test side has no club board). */
function userDials(state: GameState, ctx: LiveCtx): number[] | undefined {
  if (!ctx.userSideId || ctx.userSideId !== state.userClubId) return undefined
  const tac = state.clubs[ctx.userSideId]?.tactic
  return tac ? LEVER_DIALS.map(k => tac[k]) : undefined
}

/**
 * THE KICK YOU SEE IS THE KICK YOU ASKED FOR (1.7.3). When the commentary's
 * pick lands on one of this side's own kicks, it is shown as the side's style
 * of kick: a touch-finder for territory, a high ball won for the contest, a
 * grubber or a cross-kick for attack. It re-labels the draw already made and
 * never makes one, so no match changes by a single point.
 */
const OWN_KICKS = new Set(['comm.flav7', 'comm.flav10', 'comm.flav17'])
function styledKick(key: string, style: Tactic['kickStyle']): string {
  if (!style || style === 'balanced' || !OWN_KICKS.has(key)) return key
  if (style === 'territory') return 'comm.flav7'
  if (style === 'contest') return 'comm.flav20'
  return key === 'comm.flav17' ? key : 'comm.flav10'
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
  'comm.uncontestedNow': 'SCRUM',   // the last trained front-rower goes off
  'comm.uncontestedShort': 'SCRUM', // Law 3.20: a second man leaves with him
  'comm.uncontestedNoRep': 'SCRUM', // Law 3: the injured front-rower cannot be replaced
  'comm.uncontestedBin': 'SCRUM',   // Law 3: a second man sits the ten minutes out with him
  'comm.contestedAgain': 'SCRUM',   // the binned front-rower returns
  'comm.frontRowReturns': 'SCRUM',  // Law 3.35: a replaced front-rower comes back
  'comm.frontRowBinCover': 'SCRUM', // Law 3: the bench front-rower on for a binned one
  'comm.frontRowRedCover': 'SCRUM', // Law 3: the bench front-rower on for a sent-off one
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
  'comm.dropMiss1': 'MISS',         // and the drop goal that misses
  'comm.dropMiss2': 'MISS',
  'comm.dropMiss3': 'MISS',
  'comm.dropMiss4': 'MISS',
  'comm.dropMiss5': 'MISS',
  'comm.dropMiss6': 'MISS',         // off the upright (1.8.16)
  'comm.penPost1': 'MISS',
  'comm.penPost2': 'MISS',
  'comm.conPost': 'MISS',
  'comm.fk_lineoutNumbers': 'LINEOUT',
  'comm.notStraight1': 'LINEOUT',
  'comm.notStraight2': 'LINEOUT',
  'comm.notStraightCold': 'LINEOUT',
  'comm.fk_scrumEarly': 'SCRUM',
  'comm.fk_scrumFeed': 'SCRUM',
  'comm.fifty22_1': 'LINEOUT',
  'comm.fifty22_2': 'LINEOUT',
  'comm.fifty22_3': 'LINEOUT',
  'comm.tmoFoul_high': 'TMO',
  'comm.tmoFoul_secondary': 'TMO',
  'comm.tmoFoul_neckRoll': 'TMO',
  'comm.tmoFoul_cleanout': 'TMO',
  'comm.tmoFoul_ballOnGround': 'TMO',
  'comm.reverse_screen': 'TMO',
  'comm.tmoReview5': 'TMO',
  'comm.tmoReview6': 'TMO',
  'comm.tmoReview7': 'TMO',
  'comm.tmoNoTry5': 'NOTRY',
  'comm.tmoNoTry6': 'NOTRY',
  'comm.tmoNoTry7': 'NOTRY',
  'comm.lineout3': 'LINEOUT',       // the jumper lifted, the throw taken
  'comm.lineout7': 'LINEOUT',
  'comm.scrum2': 'SCRUM',           // the scrum that goes forward
  'comm.scrum6': 'SCRUM',
  'comm.tmoReview1': 'TMO',         // the referee goes upstairs (scoreTry)
  'comm.tmoReview2': 'TMO',
  'comm.tmoReview3': 'TMO',
  'comm.tmoReview4': 'TMO',
  'comm.tmoNoTry1': 'NOTRY',        // and the TMO says no
  'comm.tmoNoTry2': 'NOTRY',
  'comm.tmoNoTry3': 'NOTRY',
  'comm.tmoNoTry4': 'NOTRY',
  'comm.tmoReviewFwd1': 'TMO',      // a forward pass in the build-up (scoreTry)
  'comm.tmoReviewFwd2': 'TMO',
  'comm.tmoNoTryFwd1': 'NOTRY',
  'comm.tmoNoTryFwd2': 'NOTRY',
  'comm.tmoFwdScrum1': 'SCRUM',     // and the scrum the defenders get for it
  'comm.tmoFwdScrum2': 'SCRUM',
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
/**
 * TEN MINUTES FROM THE CARD YOU SAW. pushEvent never lets the clock run
 * backwards, so a card shown on a tick whose earlier lines were stamped a
 * minute on (a conversion is `min + 1`) reads a minute later than the tick it
 * happened on - and the ten minutes were counted from the tick. The man came
 * back after ten real minutes and nine on the screen, and scored at 71' off a
 * card shown at 62' (auditprobe, seed 999, surfaced when the TMO moved the
 * stream). Counted from the minute the card is shown, the bin is ten minutes
 * on the ticker, which is the only clock anyone watching has. No draw.
 */
function binUntil(ctx: LiveCtx, min: number): number {
  // the clock runs watched or not (clockTo), so the bin reads it either way
  return Math.max(min, ctx.lastMin) + 10
}

function pushLine(
  state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null,
  k: string, v?: Record<string, string | number>, playerId?: number,
) {
  // silent, the line is not written, but its minute still moves the clock,
  // so a silent match keeps the same time as a watched one
  if (!ctx.detail) { clockTo(ctx, min, type); return }
  pushEvent(state, ctx, min, type, side, tIn('en', k, v), playerId, k, v, DEPICTS[k])
}

function pushEvent(
  state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null,
  text: string, playerId?: number, k?: string, v?: Record<string, string | number>,
  fx?: MatchEvent['fx'],
) {
  min = clockTo(ctx, min, type)
  // only the writing down is for the watcher
  if (!ctx.detail) return
  ctx.events.push({
    min, type, teamId: side?.teamId ?? '', fld: Math.round(ctx.field ?? 50),
    playerId, playerName: playerId != null ? state.players[playerId]?.name : undefined,
    text, k, v, fx, homeScore: ctx.home.score, awayScore: ctx.away.score,
  })
}

/** THE CLOCK RUNS WATCHED OR NOT (1.8.0): a line's minute moves the match
 *  clock in a silent match too, so a sin bin and the match sheet read the
 *  same minute either way. Returns the minute the line is stamped with. */
function clockTo(ctx: LiveCtx, min: number, type: MatchEvent['type']): number {
  if (type !== 'HT' && type !== 'FT') {
    // NOTHING HAPPENS AFTER THE WHISTLE (owner: "ive noticed a few times a
    // penalty kick comes after the half-time whistle has blown... this should
    // never happen should be everything within the time").
    //
    // Measured before the fix: 52 first-half lines in 360 matches were stamped
    // 41', and the clock ran backwards 53 times. Two causes, one shape. A tick
    // is four minutes and draws its minute as `tick * 4 + rng(0..3) + 1`, so
    // the last tick of a half can land exactly on the whistle - and the lines
    // that FOLLOW a score (the conversion, the celebration, the maul held up)
    // are deliberately stamped `min + 1` so they read a beat later than the
    // try. On the last tick of a half that beat is past the whistle: 41' in a
    // half that ends at 40, 81' in a match that ends at 80.
    //
    // The half's own end is the ceiling. Clamping here rather than at each of
    // the forty call sites is the point - a new line cannot reintroduce it.
    const whistle = ctx.seg === 0 ? 40 : 80
    min = Math.min(Math.max(min, ctx.lastMin), whistle)
    ctx.lastMin = min
  }
  return min
}

export function beginMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean, userTeamId: string | null = state.userClubId): LiveCtx {
  const derby = isDerby(fx.homeId, fx.awayId)
  // a big day: a knockout tie or a derby - the matches with an atmosphere
  // that gets inside players' heads (25D-2)
  const big = !!fx.stage || derby
  const home = mkSide(state, fx.homeId, userTeamId, fx.id, big)
  const away = mkSide(state, fx.awayId, userTeamId, fx.id, big)
  // THE CONDITIONS (conditions.ts) are the fixture's, by a hash of where and
  // when it is played. The draw the old weather roll took is still taken, and
  // thrown away, so every dice after it in the match is where it always was.
  // A fixture that already carries its day keeps it (a probe that asks for a
  // wet day sets one; the game itself never sets it before kick-off).
  rng()
  const weather = fx.weather ?? matchConditions(state, fx)
  const surface: Surface = surfaceOf(state, fx)
  fx.weather = weather
  fx.derby = derby
  let goalPenalty = 0
  const ref = refFor(fx.id)
  for (const side of [home, away]) {
    weatherUnits(state, side, weather)
    if (derby) side.cardRisk *= 1.35
    // ---- SOMEBODY TOLD THEM HOW YOU PLAY ----
    // A rival coach briefed a journalist about your side this week
    // (talkingpoints.ts), so the team you meet has read it. The edge is small
    // and it is real: they defend your shape a little better and your attack
    // has to work harder for the same ball. It only ever costs the USER, which
    // is the point - it is a story about your week, not a coin flip.
    if (prepLeaked(state) && side.teamId === state.userClubId) {
      layer(side, 'attack', 0.95)
      layer(side, 'breakdown', 0.97)
    }
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
    side.penRisk *= refPenPrice(side, side.refPenF) / refPenPrice(side, 1)
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
    // A CUP TIE IS ITS OWN KIND OF DAY (1.8.14): one game, no table to fall
    // back on, so in a cup knockout the squeeze is wider (up to 4.5%) than
    // in a league play-off or a derby
    const cupKO = !!fx.stage && state.comps[fx.compId]?.type === 'cup'
    const squeeze = Math.min(cupKO ? 0.045 : 0.03, gapR * (cupKO ? 0.5 : 0.35))
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
  // THE ARMS RACE (1.8.2, armsrace.ts): how far this opponent is set for each
  // of the manager's calls, off the tape as it stood BEFORE this match, and
  // then this match's reps and first-phase strikes on the tape
  //
  // THE REMATCH (1.8.4, rematch.ts): and what this coach remembers of the
  // last meeting, read off the same tape, a little more on the call that
  // beat him or a little more in the unit that did
  let callAdapt: Record<string, number> | undefined
  let rematch: Rematch | null = null
  if (fx.homeId === state.userClubId || fx.awayId === state.userClubId) {
    const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
    rematch = rematchOf(state, oppId)
    callAdapt = withRematch(adaptMap(state, oppId), rematch)
    tallyCalls(state, fx)
  }
  // The analysts were watching. Calling the same move every week is how it stops
  // working, so the tally is kept here, once per match, for both clubs. The
  // manager's own is kept by tallyCalls above (1.8.3: it fades in-season and
  // a strike wears by its share of the ball, armsrace.ts THE WEAR).
  for (const id of [fx.homeId, fx.awayId]) {
    const c = state.clubs[id]
    if (!c || id === state.userClubId) continue
    const pb = playbookOf(c)
    for (const call of [c.tactic.lineoutCall ?? DEFAULT_LINEOUT, c.tactic.scrumCall ?? DEFAULT_SCRUM]) {
      pb.used[call] = (pb.used[call] ?? 0) + 1
    }
    // and the attacking moves, on the same tape (moves.ts)
    for (const call of calledIds(callsOf(state, c))) pb.used[call] = (pb.used[call] ?? 0) + 1
  }
  // the analyst's read: if the manager prepared for the weakness he named and
  // the read was sound, the soft spot gives a little more on the day. This is
  // THEIR half of the edge; ours is the homework in applyModifiers, on the
  // unit that goes after it (EXPLOITED_BY). If he called it wrong, the week
  // was spent on a problem the opposition do not have.
  if (userTeamId === state.userClubId && (fx.homeId === state.userClubId || fx.awayId === state.userClubId)) {
    const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
    const edge = analystEdge(state, oppId)
    if (edge) {
      if (edge.right) {
        const theirs = fx.homeId === state.userClubId ? away : home
        layer(theirs, edge.unit, 0.955)
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

  // KICKING STYLE (1.7.3, owner: "kick strategy", four styles). What kind of
  // kick, read against the day and the opponent at kick-off, scaled by how
  // much the side kicks at all (the kicking dial: a side that barely kicks
  // barely cares what kind). Every style trades something; 'balanced', or no
  // style at all, multiplies by exactly 1 and the fingerprint holds.
  //   TERRITORY  touch-finders: more ground from every kick; pays when your
  //              lineout is the better one (the ball comes back to you in
  //              their half), costs a little when it is theirs
  //   CONTEST    up-and-unders to win it back: the chase is a breakdown
  //              battle, and in the wet a spilled high ball is the best
  //              attacking platform in the game; in the dry it is a gift of
  //              possession more often than not
  //   ATTACK     grubbers and cross-kicks: behind a rushing line they are the
  //              way through, against a patient one less so, and a wet ball
  //              does not bounce where you want it; territory is given up
  for (const [mine, theirs] of [[home, away], [away, home]] as const) {
    const myT = state.clubs[mine.teamId]?.tactic
    const oppT = state.clubs[theirs.teamId]?.tactic
    const ks = myT?.kickStyle
    if (!myT || !ks || ks === 'balanced') continue
    const kick = Number.isFinite(myT.kicking) ? Math.max(0, Math.min(100, myT.kicking)) : 50
    const k = 0.4 + 0.6 * kick / 100
    const wet = weather === 'Rain' || weather === 'Snow'
    const oppLine = Number.isFinite(oppT?.defLine as number) ? ((oppT!.defLine as number) - 50) / 50 : 0
    if (ks === 'territory') {
      layer(mine, 'kicking', 1 + 0.06 * k)
      const setEdge = mine.units.lineout >= theirs.units.lineout
      layer(mine, 'attack', setEdge ? 1 + 0.025 * k : 1 - 0.015 * k)
    } else if (ks === 'contest') {
      layer(mine, 'breakdown', 1 + 0.03 * k)
      layer(mine, 'attack', 1 + (wet ? 0.05 : -0.01) * k)
      layer(mine, 'kicking', 1 - 0.02 * k)
    } else if (ks === 'attack') {
      layer(mine, 'attack', 1 + (0.02 + 0.03 * Math.max(0, oppLine)) * k - (wet ? 0.045 * k : 0))
      layer(mine, 'kicking', 1 - 0.05 * k)
    }
  }

  goalPenalty = goalPenaltyOf(weather)

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
  // THE HOME CROWD, now that it has been counted (homeCrowdLean). Folded into
  // refPenF, which every later recompute reads, and swapped into penRisk as a
  // ratio for the same reason the referee's own price is (see above).
  const crowdLean = homeCrowdLean(state, fx)
  if (crowdLean > 0) {
    for (const side of [home, away]) {
      const rp = side.refPenF ?? 1
      const f = side === home ? 1 - crowdLean : 1 + crowdLean
      side.penRisk *= refPenPrice(side, rp * f) / refPenPrice(side, rp)
      side.refPenF = rp * f
    }
  }

  // every match started together deepens a partnership (counted at kick-off,
  // after this match's units were computed from the old familiarity)
  state.chem ??= {}
  const chemToday = new Set<string>()
  for (const side of [home, away]) {
    for (const [i, j] of CHEM_SLOTS) {
      const a = side.lineup[i], b = side.lineup[j]
      if (a != null && b != null) {
        const k = chemKey(a, b)
        state.chem[k] = (state.chem[k] ?? 0) + 1
        chemToday.add(k)
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
  // THE PLASTIC PITCH (1.8.2 depth, conditions.ts). A side that plays every
  // home match on an artificial surface knows its pace and its bounce, and a
  // visitor raised on grass does not: a small edge to the home side there,
  // about what the clubs that play on one have measured for themselves.
  // Nothing on grass or hybrid, nothing between two artificial grounds.
  else if (surface === 'artificial' && state.clubs[fx.awayId] && clubSurface(state.clubs[fx.awayId]) !== 'artificial') hfa *= ART_HOME

  const ctx: LiveCtx = {
    fx, home, away, rng, detail, weather, surface, derby, goalPenalty,
    crng: mulberry32(((Math.imul(fx.id | 0, 2654435761) ^ Math.imul(state.season | 0, 40503) ^ 0x5eed) >>> 0) || 1),
    hfa,
    events: [], lastMin: 0,
    isUser: fx.homeId === userTeamId || fx.awayId === userTeamId,
    userSideId: fx.homeId === userTeamId ? fx.homeId : fx.awayId === userTeamId ? fx.awayId : null,
    tick: 0, seg: 0, awaiting: null, field: 50, motmId: null, talkUsed: false, subsUsed: 0,
    preTalk: null, decision: null, momo: 0, grudge: grudge?.reason ?? null,
    callAdapt,
    ...(rematch ? { rematch } : {}),
  }
  ctx.kickSeed = Math.floor(rng() * 4294967296) >>> 0
  ctx.chemToday = chemToday
  // THE DAY (1.8.16): how each side's units are going, and a warm-up
  // withdrawal now and then, both off the incident dice (no draw on rng);
  // and whether it is a hot afternoon, off the fixture
  dealTheDay(ctx, uncontested)
  lateWithdrawal(state, ctx, home)
  lateWithdrawal(state, ctx, away)
  ctx.hot = hotDay(state, fx, weather)
  ctx.koDials = userDials(state, ctx)

  // THE ANALYST'S HOMEWORK (pillar 2): an analyst-archetype dugout facing the
  // user starts with its plan pulled toward the counter to the user's habit.
  // Layered like the referee - a substitution cannot wash it off - and drawn
  // from no rng: an empty tendency window means nothing happens, which is
  // every calibrated harness and every fresh world.
  for (const side of [home, away]) {
    if (side.isUser || !ctx.isUser) continue
    // A BIG NAME IS RESPECTED (E9, oppcoach.setUpForUser): a coach who has
    // set up to spoil the manager's game also works harder at it, a little
    // more effort in defence and at the breakdown, for this match only
    const rl = respectLayers(state, side.teamId)
    if (rl) for (const [u, m] of Object.entries(rl)) layer(side, u as keyof SideMods, m)
    // THE REMATCH (1.8.4): the unit that lost him the last meeting, a little
    // lifted; a remembered call is in callAdapt above. Said at kick-off, as
    // the report and the desk said it before
    const rm = ctx.rematch
    if (rm) {
      if (rm.unit && rm.layer !== 1) layer(side, rm.unit, rm.layer)
      pushLine(state, ctx, 0, 'SUB', side, 'comm.oppRematch', { team: teamShort(state, side.teamId) })
    }
    const shift = analystShift(state, side.teamId)
    if (!shift) continue
    for (const [u, m] of Object.entries(shift.layers)) layer(side, u as keyof SideMods, m)
    pushLine(state, ctx, 0, 'SUB', side, state.clubs[side.teamId]?.coach ? 'comm.oppCoachNamed' : 'comm.oppCoach', {
      ...subjectVar(state.clubs[side.teamId]?.coachGender), coach: state.clubs[side.teamId]?.coach ?? '',
      team: teamShort(state, side.teamId),
      pattern_k: `comm.pattern${shift.pattern[0].toUpperCase()}${shift.pattern.slice(1)}`,
    })
  }
  // THE STYLES ON THE KICK-OFF LINE (1.8.2): hA/hD the home side's attack
  // and defence, aA/aD the away side's, so anything that has only the events
  // (the highlight clip, styles.matchStyles) knows how both sides played
  const koSty: Record<string, string> = {}
  if (home.sty) { koSty.hA = home.sty.atk; koSty.hD = home.sty.def }
  if (away.sty) { koSty.aA = away.sty.atk; koSty.aD = away.sty.def }
  if (fx.venue) {
    pushLine(state, ctx, 0, 'KO', home, fx.att ? 'comm.koFinalDayGate' : 'comm.koFinalDay',
      { venue: fx.venue.name, city: fx.venue.city, att: fx.att ?? 0, ...koSty })
  } else if (derby) {
    pushLine(state, ctx, 0, 'KO', home, fx.att ? 'comm.koDerbyGate' : 'comm.koDerby',
      { derby: derbyName(fx.homeId, fx.awayId) ?? '', att: fx.att ?? 0, ...koSty })
  } else if (grudge) {
    pushLine(state, ctx, 0, 'KO', home, 'comm.koGrudge', { reason_k: grudge.rk ?? 'common.nothing', ...(grudge.rv ?? {}), ...koSty })
  } else {
    pushLine(state, ctx, 0, 'KO', home, 'comm.koPlain', {
      wx_k: weather === 'Rain' ? 'comm.koRain' : weather === 'Wind' ? 'comm.koWind' : weather === 'Snow' ? 'comm.koSnow' : weather === 'Damp' ? 'comm.koDamp' : 'common.nothing',
      ...koSty,
    })
  }
  // THE HAKA (item 54): New Zealand lay down the challenge, and the side
  // facing it answers. Only ever for the national side; words only.
  if (detail && (fx.homeId === 'NZL' || fx.awayId === 'NZL')) {
    const nz = fx.homeId === 'NZL' ? home : away
    const them = nz === home ? away : home
    pushLine(state, ctx, 0, 'SUB', nz, `comm.haka${1 + (fx.id % 3)}`, { team: teamShort(state, nz.teamId), opp: teamShort(state, them.teamId) })
  }
  if (detail && ctx.hot) pushLine(state, ctx, 0, 'SUB', null, 'comm.hotDay')
  noteSpecialists(state, ctx, home)
  noteSpecialists(state, ctx, away)
  if (uncontested) {
    ctx.uncontested = true
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
        const cApps = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0) + 1
        if ([50, 100, 150, 200, 250].includes(cApps)) {
          pushLine(state, ctx, 1, 'SUB', side, 'comm.milestoneApps', { player: p.name, n: cApps }, p.id)
        }
      }
    }
  }
  // ONE CANONICAL BUILD AT KICK-OFF (1.8.16): the day, the respect, the
  // rematch and the analyst each layer onto the units one multiplication at a
  // time, and the rebuild multiplies the same mods in another order, so the two
  // differed in the fifteenth decimal place (teamtalkprobe: a silent room must
  // leave the units exactly as they were). Rebuilt once from the mods here, so
  // every later rebuild starts from the number it would have made. No draws.
  for (const side of [home, away]) recomputeSideUnits(state, ctx, side)
  // THE NUMBER ON THE BACK IS THE ONE HE WALKED OUT IN (owner, 1.8.16: "if
  // they are number 23 on the bench they should be 23 on the pitch"). Taken
  // once the sheet is final (after any warm-up withdrawal), 1-15 the XV and
  // 16-23 the bench, and it does not change when he takes another man's place.
  for (const side of [home, away]) {
    side.shirtNo = {}
    side.lineup.forEach((id, i) => { if (id != null && i < 23) side.shirtNo![id] = i + 1 })
  }
  return ctx
}

/** The number a man wears in this match: the one he had at kick-off, or, on a
 *  match saved before 1.8.16, the shirt he is filling now. */
export function shirtNumber(side: SideCtx, id: number): number | undefined {
  const n = side.shirtNo?.[id]
  if (n != null) return n
  const i = side.lineup.indexOf(id)
  return i >= 0 ? i + 1 : undefined
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
 * dialweight cannot currently resolve effects that small (docs/archive/audit-handoff).
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
// reaches form, so the autopilotprobe lesson stands untouched.
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
  // snow and a hot afternoon both take more out of a man (heat, 1.8.16)
  const wF = ctx.weather === 'Snow' ? 1.1 : ctx.hot ? 1.08 : 1
  for (const id of side.onPitch) {
    const p = state.players[id]
    if (!p) continue
    const base = (2.0 + (20 - p.a.sta) * 0.14) * (inRedZone(p) ? 1.12 : 1)
    const posF = FW_POS.has(p.pos) ? 1.1 : 1
    const e = side.energy.get(id) ?? 80
    side.energy.set(id, Math.max(0, e - base * side.tempoF * side.drainF * (side.repF ?? 1) * posF * wF))
  }
}

/**
 * No kick at goal is a certainty: base skill, then form (a kicker in a purple
 * patch is a different animal), confidence (morale) and the day's conditions
 * all move the needle. Floor drops to 38% on a bad day.
 *
 * ---- THE CEILING USED TO EAT THE ATTRIBUTE (design review, v1.6.7) ----
 *
 * The curve was `base + goa/34` for a penalty against a hard clamp at 93%, and
 * the world's kickers run from 2 to 18. So everyone from 16 upwards kicked at
 * exactly 93%, the attribute stopped separating men precisely where a manager
 * cares most about it, and the measured world converted 83% of its tries -
 * well above the professional game, which lives nearer three in four.
 *
 * The slope is now less than half what it was, so the top of the range has
 * somewhere to go: a goa of 12 kicks a penalty at 75%, 14 at 79%, 16 at 83%
 * and 18 at 86%, where all four used to be 93% alike. The 90% ceiling is
 * reached only by a great kicker in form, backed by a kicking coach and
 * kicking off a level-five enclosure - the investment still buys the last few
 * points, it is simply no longer free with the attribute alone.
 *
 * Measured after: 72% of the world's tries converted, against 83% before and
 * about 73% in the professional club game.
 */
function kickChance(state: GameState, kicker: Player | null, base: number, div: number, goalPenalty: number, side: SideCtx): number {
  if (!kicker) return 0.5 - goalPenalty + side.goalBonus
  const skill = base + kicker.a.goa / div
  const formF = (kicker.form - 6) * 0.012      // ±5% across the form range
  const confF = (kicker.morale - 6.5) * 0.008  // nerves show from the tee
  const traitB = kicker.trait === 'Siege Gun' ? 0.03 : 0
  const floor = kicker.trait === 'Metronome' ? 0.45 : 0.38
  return clamp(skill + formF + confF - goalPenalty + side.goalBonus + traitB, floor, 0.90)
}

/** Count a kick at goal on the side, and log it against the commentary. */
function noteKick(ctx: LiveCtx, side: SideCtx, made: boolean) {
  side.kicksAt = (side.kicksAt ?? 0) + 1
  if (made) side.kicksMade = (side.kicksMade ?? 0) + 1
  if (ctx.detail) (ctx.kickLog ??= []).push([ctx.events.length, side === ctx.home ? 0 : 1, made ? 1 : 0])
}

/** how often the shot clock beats a kicker (1.8.16) */
const SHOT_CLOCK_P = 0.006
/** Take the three points: roll the kick at goal. */
function takePenaltyShot(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  const { rng, detail, goalPenalty } = ctx
  const kicker = goalKicker(state, side)
  const other = side === ctx.home ? ctx.away : ctx.home
  // THE SHOT CLOCK (1.8.16, item 30): sixty seconds from the mark, and the
  // kick is lost when it runs out - a scrum to the other side where the
  // penalty was. Rare, on its own dice; the kick's draw is still taken.
  if (incRng(ctx, min, side, 0x5C10C)() < SHOT_CLOCK_P) {
    rng()
    pushLine(state, ctx, min, 'SUB', side, `comm.shotClock${1 + (min % 2)}`,
      { player: kicker?.name ?? teamShort(state, side.teamId), team: teamShort(state, side.teamId), opp: teamShort(state, other.teamId) }, kicker?.id)
    return
  }
  // the kicker's nerve with the match on the line (habits.ts): a threshold, never a draw
  const pPen = clamp(kickChance(state, kicker, 0.53, 54, ctx.goalPenalty ?? 0, side) + clutchKick(state.seed, kicker, min, side.score - other.score), 0.3, 0.92)
  const penOver = rng() < pPen
  noteKick(ctx, side, penOver)
  if (penOver) {
    side.score += 3
    side.pens += 1
    evPts(ctx, side, 3, 'pen')
    if (kicker) {
      kicker.stats.pens += 1; kicker.stats.points += 3
      side.ratings.set(kicker.id, (side.ratings.get(kicker.id) ?? 6) + 0.15)
    }
    // The banks hold keys now, and the draw is unchanged: one call to rng(),
    // the same index, the same line. Where a bank's line names the kicker and
    // there is no kicker to name, "The kicker" is a WORD and gets a key of its
    // own rather than being passed in as a variable.
    // A LINE THAT NAMES THE DISTANCE NEEDS THE BOOT FOR IT. "From halfway"
    // about a kicker with no range read as a wrong stat (release audit,
    // 1.5.0); such a line falls back to a plain one for him, with no extra
    // draw on the stream, so the fingerprint of every other match is intact.
    let line = PEN_LINES[Math.floor(rng() * PEN_LINES.length)]
    if ((!kicker || kicker.a.goa < 12) && PEN_LONG[line]) line = PEN_LONG[line]
    if (ctx.weather !== 'Rain' && ctx.weather !== 'Snow' && PEN_WET[line]) line = PEN_WET[line]
    pushLine(state, ctx, min, 'PEN', side, line,
      { player: kicker?.name ?? tIn('en', 'comm.theKicker') }, kicker?.id)
    // restart, as after any score - AFTER the line, so the line is stamped
    // with where the kick was taken (MatchEvent.fld), not the halfway restart
    ctx.field = ctx.field * 0.6 + 50 * 0.4
    describeRestart(state, ctx, side)
  } else if (detail && ctx.crng() < 0.7) {
    // now and then it is the upright that says no (item 57), words only
    const post = !!kicker && ctx.crng() < 0.14
    pushLine(state, ctx, min, 'SUB', side, post ? `comm.penPost${1 + Math.floor(ctx.crng() * 2)}` : kicker ? 'comm.penWideNamed' : 'comm.penWide',
      { player: kicker?.name ?? '' }, kicker?.id)
  }
}

/**
 * A line of colour: written only when somebody is watching, and stamped at
 * the minute the clock has ALREADY reached. pushLine moves the clock in a
 * silent match as well (clockTo), so a line that exists only when watched must
 * never move it, or the sin bin (binUntil reads lastMin) would be timed
 * differently in the two. Stamped at lastMin it cannot.
 */
function colour(
  state: GameState, ctx: LiveCtx, side: SideCtx | null, key: string,
  v?: Record<string, string | number>, playerId?: number,
) {
  if (!ctx.detail) return
  pushLine(state, ctx, ctx.lastMin, 'SUB', side, key, v, playerId)
}

/** one of a bank, on the commentary's dice */
function said<T>(ctx: LiveCtx, xs: readonly T[]): T {
  return xs[Math.floor(ctx.crng() * xs.length)]
}

/** the men a side has on the pitch */
function onField(state: GameState, side: SideCtx): Player[] {
  return [...side.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p)
}

/** whoever wears shirt slot `i` (0-based) and is on the pitch, else null */
function inShirt(state: GameState, side: SideCtx, i: number): Player | null {
  const id = side.lineup[i]
  return id != null && side.onPitch.has(id) ? state.players[id] ?? null : null
}

/** a man for a line, by shirt: the first of `slots` on the pitch, weighted by
 *  `w`, on the commentary's dice; anybody on the pitch if none of them is */
function sayWho(state: GameState, ctx: LiveCtx, side: SideCtx, slots: number[], w?: number[]): Player | null {
  const men = slots.map(s => inShirt(state, side, s))
  const ok = men.map((p, i) => (p ? (w?.[i] ?? 1) : 0))
  const tot = ok.reduce((a, b) => a + b, 0)
  if (tot > 0) {
    let r = ctx.crng() * tot
    for (let i = 0; i < men.length; i++) { r -= ok[i]; if (r < 0 && men[i]) return men[i] }
  }
  const all = onField(state, side)
  return all.length ? all[Math.floor(ctx.crng() * all.length)] : null
}

/** how far up the pitch a side is, 0 its own line, 100 theirs */
const upOf = (ctx: LiveCtx, side: SideCtx) => side === ctx.home ? ctx.field : 100 - ctx.field
/** move the line `m` metres towards a side's own posts */
function backTowards(ctx: LiveCtx, side: SideCtx, m: number) {
  ctx.field = clamp(side === ctx.home ? ctx.field - m : ctx.field + m, 4, 96)
}

/**
 * THE RUGBY BETWEEN THE SCORES, called for a watched match (1.8.0). Read
 * before the tick's scoring roll, so a try that follows is preceded by the
 * carries that made it - the highlight clip plays those lines as its build-up
 * (HighlightClip.buildClip), and at most the last three of them.
 */
function describePlay(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, contest?: Contest | null) {
  if (!ctx.detail) return
  // A BUSY AFTERNOON NEEDS LESS FILLER (1.8.16). The incidents have their own
  // lines, so a match full of them ran to 190 against the owner's 100-150:
  // past about two lines a minute, the carries and the phase counts go quiet
  // by half and the cards, the tries and the TMO keep the room.
  if (ctx.events.length > 2.0 * Math.max(8, ctx.lastMin) && ctx.crng() < 0.5) return
  const up = upOf(ctx, side)
  const team = teamShort(state, side.teamId), oppT = teamShort(state, opp.teamId)
  // the set piece now and then: the sheet derives about thirteen scrums and
  // twenty-five lineouts a match, and these name a few of them
  const sp = ctx.crng()
  if (sp < 0.13) {
    const p = sayWho(state, ctx, side, [3, 4, 5, 6, 7], [3, 3, 1, 2, 1])
    if (p) colour(state, ctx, side, said(ctx, SP_LINEOUT), { team, opp: oppT, player: p.name }, p.id)
  } else if (sp < 0.21) {
    colour(state, ctx, side, said(ctx, SP_SCRUM), { team, opp: oppT })
  }
  // the carry, where the ball is: forwards close in, backs in space
  // (0.45 to 0.38 in 1.8.16: the incidents' own lines took the room, and the
  // owner's 100-150 lines a match is a ceiling as well as a floor)
  if (ctx.crng() < 0.38) {
    const bank = up < 22 ? PBP_DEEP : up > 78 ? PBP_RED : PBP_MID
    // the man the contest put into contact, when there was one
    const real = contest && side.onPitch.has(contest.carrier) ? state.players[contest.carrier] : null
    const p = real ?? (up > 78
      ? sayWho(state, ctx, side, [0, 1, 2, 3, 4, 5, 6, 7, 11], [1, 2, 1, 2, 2, 2, 2, 3, 1])
      : up < 22
        ? sayWho(state, ctx, side, [8, 9, 14, 10, 13, 11], [2, 3, 3, 1, 1, 1])
        : sayWho(state, ctx, side, [3, 5, 6, 7, 9, 10, 11, 12, 13, 14], [1, 1, 1, 2, 2, 1, 2, 2, 1, 1]))
    if (p) colour(state, ctx, side, said(ctx, bank), { team, opp: oppT, player: p.name }, p.id)
  }
  // the breakdown, or the count of phases
  const bd = ctx.crng()
  if (bd < 0.15) {
    const p = sayWho(state, ctx, side, [0, 1, 2, 3, 4, 5, 6, 7, 8], [1, 1, 1, 1, 1, 2, 2, 1, 2])
    if (p) colour(state, ctx, side, said(ctx, PBP_RUCK), { team, opp: oppT, player: p.name }, p.id)
  } else if (bd < 0.21) {
    colour(state, ctx, side, said(ctx, PBP_PHASES), { team, opp: oppT, n: 3 + Math.floor(ctx.crng() * 9) })
  }
  if ((ctx.weather === 'Rain' || ctx.weather === 'Snow') && ctx.crng() < 0.07) {
    const p = sayWho(state, ctx, side, [8, 9, 11, 12, 13, 14])
    if (p) colour(state, ctx, side, said(ctx, PBP_WET), { team, opp: oppT, player: p.name }, p.id)
  }
}

// ---- THE CALLED MOVES, IN THE MATCH (1.8.1, moves.ts) ----------------------

interface MoveInPlay {
  id: string
  launch: Launch
  /** the share it moves this tick's try chance by, signed */
  gain: number
  risk: number
  /** the man it is run through, if he is on the pitch */
  maker: Player | null
  /** what the gain would have been had the opponent not been set for it
   *  (armsrace.ts); present only on a call the tape blunted */
  gain0?: number
}

/** The move this side runs in this tick, or null: what the tick was launched
 *  from (a hash, no draw), the call for it, and what it is worth with these
 *  men against this defence. */
function moveInPlay(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, tick: number): MoveInPlay | null {
  const club = state.clubs[side.teamId]
  if (!club) return null
  const calls = callsOf(state, club)
  if (!anyCall(calls)) return null
  const home = side === ctx.home
  // in the opposition 22 the red-zone play has the ball when it can run
  const call = callForTick(calls, launchOf(ctx.fx.id, tick, home), mixHash(ctx.fx.id, tick, home), upOf(ctx, side) >= RED_ZONE)
  const m = call ? MOVE_BY_ID[call.id] : undefined
  if (!m || !call) return null
  // a move that belongs to the side's style is run better (styles.ts)
  const fit = clamp(moveFit(m, (s, a) => inShirt(state, side, s - 1)?.a[a] ?? null)
    + moveAffinity(side.sty?.atk, m.id, m.group === 'shape'), -1, 1)
  const match = moveMatchup(m, state.clubs[opp.teamId]?.tactic)
  // the manager's opponent set for his most-run calls (armsrace.ts)
  const adapt = club.id === state.userClubId ? (ctx.callAdapt?.[m.id] ?? 0) : 0
  const e = moveEdge(state, club, m.id, fit, match, adapt)
  // the same reckoning without the tape, for the evidence: a read, no draw
  const gain0 = adapt > 0 ? moveEdge(state, club, m.id, fit, match, 0).gain : undefined
  // and how the plan is clicking today (THE DAY, 1.8.16): the same call is
  // worth more on one Saturday than the next, in whichever direction it goes
  const ex = side.exec ?? 1
  return { id: m.id, launch: call.launch, gain: e.gain * ex, risk: m.risk, maker: inShirt(state, side, (MOVE_MAKER[m.id] ?? 10) - 1), gain0: gain0 != null ? gain0 * ex : undefined }
}

/** how far the penalty slot's play moves a quick tap's chance, per unit of
 *  its edge: the edge is a share of the try chance, and a tap is one go at
 *  the line, so it is added as it stands. At 1.6 the right play drilled
 *  took a strong side's tap five metres out to the 55% ceiling, a cheat
 *  code; at 1 the right play is worth about ten points of the chance, the
 *  wrong one costs about three, and an undrilled one about twelve
 *  (tapplayprobe). */
const TAP_PLAY_W = 1.0

/** The penalty slot's play, as a kickable penalty tapped runs it: what it is
 *  worth with the men in the shirts against this defence, and who runs it.
 *  Null for a side with no play in the slot. No draw. */
function penPlay(state: GameState, side: SideCtx, opp: SideCtx): MoveInPlay | null {
  const club = state.clubs[side.teamId]
  const id = club ? callsOf(state, club).pen : undefined
  const m = id ? MOVE_BY_ID[id] : undefined
  if (!club || !m) return null
  const fit = clamp(moveFit(m, (s, a) => inShirt(state, side, s - 1)?.a[a] ?? null)
    + moveAffinity(side.sty?.atk, m.id, false), -1, 1)
  const e = moveEdge(state, club, m.id, fit, moveMatchup(m, state.clubs[opp.teamId]?.tactic))
  return { id: m.id, launch: 'tap', gain: e.gain * (side.exec ?? 1), risk: m.risk, maker: inShirt(state, side, (MOVE_MAKER[m.id] ?? 9) - 1) }
}

/** Whether the try this tick scored is the move's, for its line and its
 *  clip: a strike move that came off usually is (it launched the tick), a
 *  shape now and then. Deterministic, so it never draws. */
function moveTryOf(state: GameState, ctx: LiveCtx, side: SideCtx, mv: MoveInPlay | null, tick: number): LiveCtx['moveTry'] {
  if (!mv || mv.gain <= 0) return null
  const h = moveHash(ctx.fx.id, tick, side === ctx.home ? 1 : 2)
  if (h >= (mv.launch === 'open' ? 0.3 : 0.6)) return null
  return { id: mv.id, launch: mv.launch, maker: mv.maker?.id ?? null }
}

const MOVE_CALL_LO = ['comm.moveCallLo1', 'comm.moveCallLo2', 'comm.moveCallLo3']
const MOVE_CALL_SC = ['comm.moveCallSc1', 'comm.moveCallSc2', 'comm.moveCallSc3']
const MOVE_CALL_TAP = ['comm.moveCallTap1', 'comm.moveCallTap2']
const MOVE_SHAPE = ['comm.moveShape1', 'comm.moveShape2', 'comm.moveShape3']
const MOVE_MISFIRE = ['comm.moveMisfire1', 'comm.moveMisfire2', 'comm.moveMisfire3', 'comm.moveMisfire4']
const MOVE_GAIN = ['comm.moveGain1', 'comm.moveGain2', 'comm.moveGain3']
const SHAPE_MISFIRE = ['comm.shapeMisfire1', 'comm.shapeMisfire2']

/** The call, as it is made: watched only, on the commentary's dice. */
function describeMoveCall(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, mv: MoveInPlay) {
  if (!ctx.detail) return
  const strike = mv.launch !== 'open'
  if (ctx.crng() >= (strike ? 0.4 : 0.1)) return
  const bank = mv.launch === 'lineout' ? MOVE_CALL_LO : mv.launch === 'scrum' ? MOVE_CALL_SC : mv.launch === 'tap' ? MOVE_CALL_TAP : MOVE_SHAPE
  colour(state, ctx, side, said(ctx, bank),
    { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), move_k: sayKey(mv.id) })
}

/** A move that did not end in a score: the misfire named, and now and then
 *  the one that won the gain line. Watched only. */
function describeMoveOutcome(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, mv: MoveInPlay) {
  if (!ctx.detail) return
  const v = { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), move_k: sayKey(mv.id) }
  if (mv.gain < 0 && ctx.crng() < 0.5) {
    if (mv.launch === 'open') colour(state, ctx, side, said(ctx, SHAPE_MISFIRE), v)
    else if (mv.maker) colour(state, ctx, side, said(ctx, MOVE_MISFIRE), { ...v, player: mv.maker.name }, mv.maker.id)
  } else if (mv.gain > 0.02 && mv.launch !== 'open' && mv.maker && ctx.crng() < 0.3) {
    colour(state, ctx, side, said(ctx, MOVE_GAIN), { ...v, player: mv.maker.name }, mv.maker.id)
  }
}

// ---- THE STYLES, IN WORDS (1.8.2, styles.ts) -----------------------------

/**
 * A line when a style TELLS: the attack's style finding the defence it
 * beats ("the width is stretching the drift"), or the defence's style
 * shutting down the attack it is built for ("the blitz catches them behind
 * the gain line"). Watched only and on the commentary's dice, so a silent
 * match is the same match. Every line carries both styles' ids (sa, sd) for
 * the highlight clip.
 */
function describeStyle(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, st: { m: number }) {
  if (!ctx.detail || !side.sty || !opp.sty || st.m === 0) return
  if (ctx.crng() >= 0.05 * Math.abs(st.m)) return
  const v = {
    team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId),
    atk_k: atkSay(side.sty.atk), def_k: defSay(opp.sty.def), sa: side.sty.atk, sd: opp.sty.def,
  }
  const n = 1 + Math.floor(ctx.crng() * 2)
  if (st.m > 0) colour(state, ctx, side, `styles.cAtk_${side.sty.atk}${n}`, v)
  else colour(state, ctx, opp, `styles.cDef_${opp.sty.def}${n}`, { ...v, team: v.opp, opp: v.team })
}

/** the per-match salt of the style's turnover hash: the world, the season,
 *  the fixture and who is playing it, cached on the match */
function styleSalt(state: GameState, ctx: LiveCtx): number {
  return (ctx.stySalt ??= hashString(`${state.seed}|${state.season}|${ctx.fx.id}|${ctx.fx.homeId}|${ctx.fx.awayId}`))
}

/** A turnover the style made, named for the defence that made it: watched only. */
function describeTurnover(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, _st: { m: number }) {
  if (!ctx.detail || !side.sty || !opp.sty || ctx.crng() >= 0.35) return
  const p = sayWho(state, ctx, opp, [3, 4, 5, 6, 7, 11, 12], [2, 2, 3, 3, 2, 1, 1])
  if (!p) return
  colour(state, ctx, opp, `styles.cTurn_${opp.sty.def}`, {
    team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId), player: p.name,
    atk_k: atkSay(side.sty.atk), def_k: defSay(opp.sty.def), sa: side.sty.atk, sd: opp.sty.def,
  }, p.id)
}

/** The try line for a try the called move made: who ran it, who scored, and
 *  from where. The key says the launch, so the clip can draw the set piece. */
function moveTryLine(state: GameState, mt: NonNullable<LiveCtx['moveTry']>, scorer: Player, min: number): { k: string; v: Record<string, string | number> } {
  const maker = mt.maker != null ? state.players[mt.maker] : undefined
  const bank = MOVE_TRY[mt.launch]
  const move_k = sayKey(mt.id)
  if (!maker || maker.id === scorer.id) return { k: bank.self, v: { player: scorer.name, move_k } }
  return { k: bank.lines[(min + scorer.id) % bank.lines.length], v: { player: scorer.name, maker: maker.name, move_k } }
}
const MOVE_TRY: Record<Launch, { self: string; lines: string[] }> = {
  lineout: { self: 'comm.moveTryLoSelf', lines: ['comm.moveTryLo1', 'comm.moveTryLo2', 'comm.moveTryLo3'] },
  scrum: { self: 'comm.moveTryScSelf', lines: ['comm.moveTrySc1', 'comm.moveTrySc2', 'comm.moveTrySc3'] },
  tap: { self: 'comm.moveTryTapSelf', lines: ['comm.moveTryTap1', 'comm.moveTryTap2', 'comm.moveTryTap3'] },
  open: { self: 'comm.shapeTrySelf', lines: ['comm.shapeTry1', 'comm.shapeTry2', 'comm.shapeTry3'] },
}

/** The side without the ball, when the tick came to nothing for the side
 *  that had it: a line about the defence. A man named for a hit is one the
 *  tackle count already has making hits (TACKLE_LINES rule). */
function describeDefence(state: GameState, ctx: LiveCtx, def: SideCtx, att: SideCtx, contest?: Contest | null) {
  if (!ctx.detail || ctx.crng() >= 0.21) return
  const team = teamShort(state, def.teamId), oppT = teamShort(state, att.teamId)
  const hitters = onField(state, def).filter(q => (def.tackles?.get(q.id) ?? 0) > 0)
  if (hitters.length && ctx.crng() < 0.45) {
    // the man who won this tick's collision, if the tackle count has him
    const won = contest && contest.dominance < 0.5 ? hitters.find(q => q.id === contest.tackler) : undefined
    const p = won ?? hitters[Math.floor(ctx.crng() * hitters.length)]
    colour(state, ctx, def, said(ctx, DEF_HIT), { team, opp: oppT, player: p.name }, p.id)
  } else {
    colour(state, ctx, def, said(ctx, DEF_SET), { team, opp: oppT })
  }
}

/** The kick-off after a score, by the side that conceded it. Not when a
 *  whistle is standing on the call that produced the score: that line goes
 *  in front of half time or full time, and nothing restarts after it. */
function describeRestart(state: GameState, ctx: LiveCtx, scored: SideCtx) {
  if (!ctx.detail || ctx.heldWhistle || ctx.crng() >= 0.85) return
  const kickers = scored === ctx.home ? ctx.away : ctx.home
  const p = sayWho(state, ctx, kickers, [9, 11, 14], [6, 1, 1])
  if (!p) return
  colour(state, ctx, kickers, said(ctx, RESTART),
    { team: teamShort(state, kickers.teamId), opp: teamShort(state, scored.teamId), player: p.name }, p.id)
}

/** Where the game is, and in the last ten minutes what the scoreboard asks
 *  of each side: at most one line a tick, read off the score as it stands. */
function describeState(state: GameState, ctx: LiveCtx, tick: number) {
  if (!ctx.detail) return
  const { home, away } = ctx
  const margin = home.score - away.score
  if (tick >= 17 && Math.abs(margin) <= 14 && ctx.crng() < 0.4) {
    if (margin === 0) {
      colour(state, ctx, null, said(ctx, LATE_LEVEL), { home: teamShort(state, home.teamId), away: teamShort(state, away.teamId) })
    } else {
      const lead = margin > 0 ? home : away, trail = lead === home ? away : home
      const chase = ctx.crng() < 0.5
      const s = chase ? trail : lead, o = chase ? lead : trail
      colour(state, ctx, s, said(ctx, chase ? LATE_CHASE : LATE_HOLD), { team: teamShort(state, s.teamId), opp: teamShort(state, o.teamId) })
    }
    return
  }
  if (ctx.crng() < 0.14) {
    if (ctx.field < 25 || ctx.field > 75) {
      const on = ctx.field > 75 ? home : away, off = on === home ? away : home
      colour(state, ctx, on, said(ctx, TERR_CAMPED), { team: teamShort(state, on.teamId), opp: teamShort(state, off.teamId) })
    } else {
      colour(state, ctx, null, said(ctx, TERR_MIDDLE), { home: teamShort(state, home.teamId), away: teamShort(state, away.teamId) })
    }
  }
}

/**
 * ---- KICKS FROM HAND, AND THE ONES THAT ARE CHARGED DOWN (owner, 1.8.0) ----
 *
 * The owner's numbers: one kick from hand in forty is charged down, and one
 * in eighty ends in a try for the side that charged it.
 *
 * The engine had no kicks from hand at all: the kicking game was the line's
 * drift (ctx.field) and a handful of words. So the kicks are counted here, on
 * the match's own dice because a charge-down changes the match: a side kicks
 * a little more in its own half (the exit, the clearance, the box kick) than
 * in theirs, more with the kicking dial up and a territory game, and less with
 * the ball in hand. About seventeen a side a match, on the neutral dials.
 *
 * ONLY A LITTLE MORE DEEP, on purpose. With a steep gradient (half as many
 * kicks between the 22s as inside your own) territory paid twice: the side
 * with the field position also got the other side's charge-downs, and the
 * long exit from your own 22 went past optionsprobe's meta line.
 *
 * Each kick is a single draw against CHARGE_RATE. A charge-down is half a try
 * for the side that blocked it (a proper try, converted as any other, and not
 * sent to the TMO: nobody reviews a man falling on a loose ball in-goal), and
 * otherwise the ball lands where it lands - touch, a scrum, the chargers or
 * the kicker's own side - one draw between the four, and each moves the line
 * towards the kicking side's posts by what that outcome is worth.
 *
 * TWO SETS OF DICE, BOTH THE MATCH'S. How many kicks a side puts in and
 * whether each is charged come off a stream of their own, seeded once from
 * rng at kick-off and then by the tick and the side, because the count depends on the
 * tactics and the field: drawn from rng, a change of kicking dial shifted every
 * draw after it, and optionsprobe's common random numbers - the same match
 * with only the option changed - fell apart (a zone plan read +5.3 points one
 * run and +2.0 the next). What a charge-down DOES (who blocked it, whether it
 * is a try, where the ball goes, the try and the conversion) is rng, like
 * everything else that changes a match. Nothing here is the commentary's: the
 * same whether the match is watched or not, and only the words (which line,
 * which kicker is named) are crng.
 */
const HAND_KICKS_BY_PLAN: Record<string, number> = { long: 1.25, box: 1.1, play: 0.6, terr: 1.15, hand: 0.8 }
export const CHARGE_RATE = 1 / 40
export const CHARGE_TRY = 0.5
function kicksFromHand(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number) {
  const rng = mulberry32((((ctx.kickSeed ?? ctx.fx.id) ^ Math.imul(tick + 1, 104729) ^ (side === ctx.home ? 0x4b1c : 0x2e7d)) >>> 0) || 1)
  const up = upOf(ctx, side)
  const tac = state.clubs[side.teamId]?.tactic
  let rate = up < 22 ? 1.0 : up < 50 ? 0.9 : up < 78 ? 0.8 : 0.7
  rate *= 0.75 + (tac?.kicking ?? 50) / 200
  rate *= tac?.kickStyle === 'territory' ? 1.15 : tac?.kickStyle === 'attack' ? 0.9 : 1
  // and the style (1.8.2): the box kick and chase kicks the most
  if (side.sty) rate *= ATK_KICKS[side.sty.atk]
  // and the plan for where the ball is: a side kicking its exits long, or
  // playing for territory, puts in more of the kicks that can be charged, and
  // a side running it out of its own 22 fewer. Without this the kicking plans
  // won the ground AND dodged the risk that comes with it (optionsprobe: the
  // long exit read +4.0 points a match against a meta line of 4).
  rate *= HAND_KICKS_BY_PLAN[zonePlan(zoneAt(up), tac?.zones?.[zoneAt(up)]).id] ?? 1
  const n = Math.floor(rate) + (rng() < rate % 1 ? 1 : 0)
  for (let i = 0; i < n; i++) {
    side.handKicks = (side.handKicks ?? 0) + 1
    if (rng() < CHARGE_RATE) { chargeDown(state, ctx, side, opp, min); return }
    // OUT ON THE FULL, AND THE 50:22 (1.8.16, items 51, 59). On the same
    // kick dice. A kick that goes out without bouncing comes back to where it
    // was struck, a lineout to them; a kick from your own half that bounces
    // out inside their 22 is your throw there. A better boot finds more of
    // those, a touch-finding style looks for them, and now and then the
    // referee rules the ball was taken back into the kicker's half first and
    // it is an ordinary lineout to them.
    const k = rng()
    if (k < OUT_FULL_P * (2 - (side.day?.kicking ?? 1))) {
      backTowards(ctx, side, 7)
      const p = sayWho(state, ctx, side, [9, 14, 11], [5, 3, 1])
      colour(state, ctx, side, said(ctx, OUT_FULL), { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), player: p?.name ?? teamShort(state, side.teamId) }, p?.id)
      continue
    }
    if (up < 50 && k < OUT_FULL_P + fiftyTwentyTwoP(side, tac)) {
      const p = sayWho(state, ctx, side, [9, 14, 8], [5, 3, 1])
      const v = { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), player: p?.name ?? teamShort(state, side.teamId) }
      if (rng() < VOID_5022) {
        colour(state, ctx, side, 'comm.void5022', v, p?.id)
        continue
      }
      ctx.field = side === ctx.home ? 82 : 18
      side.pressure = clamp(side.pressure + 15, 0, 100)
      side.fifty22 = (side.fifty22 ?? 0) + 1
      colour(state, ctx, side, said(ctx, FIFTY22), v, p?.id)
      return
    }
    describeKick(state, ctx, side, opp, up, tac?.kickStyle)
  }
}

/** a kick that goes out on the full, a 50:22 found, and the share of those
 *  the referee voids because the ball was taken back into the half (1.8.16) */
const OUT_FULL_P = 0.012
const VOID_5022 = 0.15
const OUT_FULL = ['comm.outFull1', 'comm.outFull2', 'comm.outFull3']
const FIFTY22 = ['comm.fifty22_1', 'comm.fifty22_2', 'comm.fifty22_3']
function fiftyTwentyTwoP(side: SideCtx, tac: Tactic | undefined): number {
  const boot = clamp(side.units.kicking / 16, 0.6, 1.5)
  return 0.017 * boot * (tac?.kickStyle === 'territory' ? 1.4 : tac?.kickStyle === 'attack' ? 0.8 : 1)
}

/** a kick from hand, in words: where it was kicked from decides what kind */
function describeKick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, up: number, style?: Tactic['kickStyle']) {
  if (!ctx.detail || ctx.crng() >= 0.42) return
  const c = ctx.crng()
  const bank = up < 22 ? (c < 0.5 ? KICK_EXIT : KICK_BOX)
    : up < 50 ? (style === 'territory' ? (c < 0.6 ? KICK_TOUCH : KICK_LONG) : style === 'contest' ? (c < 0.6 ? KICK_BOX : KICK_UP)
      : c < 0.3 ? KICK_BOX : c < 0.65 ? KICK_TOUCH : KICK_LONG)
    : up < 78 ? (style === 'attack' ? (c < 0.6 ? KICK_PIN : KICK_UP) : c < 0.5 ? KICK_UP : c < 0.75 ? KICK_LONG : KICK_TOUCH)
    : KICK_PIN
  const p = bank === KICK_BOX ? sayWho(state, ctx, side, [8]) : sayWho(state, ctx, side, [9, 14, 11], [6, 3, 1])
  if (!p) return
  const team = teamShort(state, side.teamId), oppT = teamShort(state, opp.teamId)
  colour(state, ctx, side, said(ctx, bank), { team, opp: oppT, player: p.name }, p.id)
  // a ball in touch, and the quick throw taken before the lineout forms (item 29)
  if (bank === KICK_TOUCH && ctx.crng() < 0.12) {
    const q = sayWho(state, ctx, opp, [14, 10, 13, 8], [3, 2, 2, 1])
    if (q) colour(state, ctx, opp, `comm.quickThrow${1 + Math.floor(ctx.crng() * 2)}`, { team: oppT, opp: team, player: q.name }, q.id)
  }
  // the other side's answer to a kick they have to field
  if ((bank === KICK_LONG || bank === KICK_UP || bank === KICK_BOX) && ctx.crng() < 0.35) {
    const q = sayWho(state, ctx, opp, [14, 10, 13, 8], [4, 2, 2, 1])
    if (q) colour(state, ctx, opp, said(ctx, KICK_FIELD), { team: oppT, opp: team, player: q.name }, q.id)
  }
}

/** The kick is charged down. Who got a hand (a body, a shin) to it is the
 *  match's dice, since he may be the man who scores; the rest is words. */
function chargeDown(state: GameState, ctx: LiveCtx, kick: SideCtx, charge: SideCtx, min: number) {
  const { rng } = ctx
  kick.chargedDown = (kick.chargedDown ?? 0) + 1
  const men = onField(state, charge)
  if (!men.length) return
  // the men who charge are the ones nearest the kicker: the back row, the
  // locks and the midfield more than the wings
  const W: Partial<Record<Pos, number>> = { FL: 3, N8: 2.2, LK: 2, HK: 1.4, LP: 1, TP: 1, SH: 1.2, FH: 1.5, CE: 1.6, WG: 0.7, FB: 0.6 }
  const charger = wpick(rng, men, men.map(p => W[p.pos] ?? 1))
  const kicker = sayWho(state, ctx, kick, [8, 9, 14], [3, 5, 2])
  const team = teamShort(state, charge.teamId), oppT = teamShort(state, kick.teamId)
  colour(state, ctx, charge, said(ctx, CHARGE_DOWN), { team, opp: oppT, player: charger.name, kicker: kicker?.name ?? oppT }, charger.id)
  charge.ratings.set(charger.id, (charge.ratings.get(charger.id) ?? 6) + 0.2)
  const o = rng()
  if (o < CHARGE_TRY) {
    // loose behind them, and the chargers get there first. The line is left
    // where the kick was taken: moving it onto the kicking side's own line
    // first made every charge-down try restart the game deep in their 22,
    // which quietly paid the own-22 exit plans twice (optionsprobe)
    charge.pressure = clamp(charge.pressure + 42, 0, 100)
    kick.pressure = clamp(kick.pressure * 0.55, 0, 100)
    ctx.evWhy = 'kick'
    scoreTry(state, ctx, charge, min, said(ctx, CHARGE_TRY_LINES), charger, { player: charger.name }, false)
    ctx.evWhy = null
    return
  }
  // otherwise one of four, evenly: touch, a scrum, the chargers regather, or
  // the kicking side does. Every one of them costs the kicker ground.
  const k = Math.min(3, Math.floor((o - CHARGE_TRY) / ((1 - CHARGE_TRY) / 4)))
  if (k === 0) {
    backTowards(ctx, kick, 5)
    colour(state, ctx, kick, said(ctx, CHARGE_LINEOUT), { team: oppT, opp: team })
  } else if (k === 1) {
    backTowards(ctx, kick, 6)
    colour(state, ctx, charge, said(ctx, CHARGE_SCRUM), { team, opp: oppT })
  } else if (k === 2) {
    backTowards(ctx, kick, 10)
    charge.pressure = clamp(charge.pressure + 20, 0, 100)
    charge.poss += 0.3
    colour(state, ctx, charge, said(ctx, CHARGE_REGATHER), { team, opp: oppT, player: charger.name }, charger.id)
  } else {
    backTowards(ctx, kick, 3)
    colour(state, ctx, kick, said(ctx, CHARGE_SAFE), { team: oppT, opp: team })
  }
}

/**
 * ---- THE DROP GOAL, MADE OR MISSED (owner, 1.8.0) ----
 *
 * The attempt was always rolled and always counted as a kick at goal, and a
 * miss said nothing, so the stats panel could show a kick taken that the
 * commentary never mentioned. Every attempt now has its line.
 *
 * And it is a kick from where the ball is: only in their half (it was rolled
 * from anywhere, halfway line included), better the closer in, and read off
 * the fly-half's kicking from hand - or the goal-kicker's if the 10 is off.
 * LATE IN A CLOSE GAME IT IS THE PLAY: from tick 17 (the 69th minute) a side level or
 * within a score goes for it about four times as often, a side a score up
 * twice as often. The base rate is set so the world kicks as many drop goals
 * as it did before any of this: 0.18 over a match, 0.53 points, measured on
 * the same 1,440 watched fixtures before and after - and now about 0.12
 * missed ones a match with them, which used to be silent.
 */
const DROP_BASE = 0.0135
function dropChance(ctx: LiveCtx, side: SideCtx, opp: SideCtx, up: number, tick: number): number {
  if (up < 55) return 0
  const diff = side.score - opp.score
  const late = tick >= 17 ? (diff >= -3 && diff <= 0 ? 4 : diff > 0 && diff <= 4 ? 2 : 1) : 1
  return DROP_BASE * late * (up > 70 ? 1.25 : 1)
}

function dropGoalAttempt(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, up: number) {
  const { rng } = ctx
  const fh = inShirt(state, side, 9)
    ?? goalKicker(state, side)
  if (!fh) return
  const pOver = clamp(0.12 + fh.a.kic / 40 + (up - 68) * 0.006, 0.12, 0.75)
  const dgOver = rng() < pOver
  noteKick(ctx, side, dgOver)
  if (dgOver) {
    side.score += 3
    evPts(ctx, side, 3, 'kick')
    fh.stats.drops += 1; fh.stats.points += 3
    // the line before the restart, so it is stamped where it was struck
    pushLine(state, ctx, min, 'DG', side, 'comm.dropGoal', { player: fh.name }, fh.id)
    ctx.field = ctx.field * 0.6 + 50 * 0.4
    describeRestart(state, ctx, side)
  } else {
    // a missed drop goal is a 22 drop-out for the other side, which is where
    // the ball already is: nothing moves but the words
    pushLine(state, ctx, min, 'SUB', side, said(ctx, DROP_MISS), { player: fh.name }, fh.id)
  }
}

/** How often a try goes to the TMO, and how often a review chalks it off.
 *  Together about one try in twenty is disallowed (the four-seed balance in
 *  fingerprint.ts records what that did to the scoring). */
export const TMO_REVIEW = 0.16
export const TMO_OVERTURN = 0.33
/** A handled try with a forward pass in its build-up, for a side that handles
 *  as the world does (x side.fwdF), and the share of those the TMO rules out
 *  (owner: 90%; the other 10% stand as tight calls). See scoreTry. An
 *  object so scripts/fwdpassprobe.ts can switch it off and show that nothing
 *  else in a match moves; nothing in the game writes to it. */
export const FWD_PASS = { rate: 0.02, ruledOut: 0.9 }
/** how far back up the field the scrum is, where the pass was thrown */
const FWD_SCRUM_BACK = 8

/** Score a try (+ conversion attempt) for a side - shared by open play and set-piece strikes. */
/** `line`/`lineV` let a set-piece strike supply its own wording - a maul that
 *  rumbles over reads better than the generic bank - and it is a KEY, not a
 *  sentence, for the same reason everything else here is. */
function scoreTry(
  state: GameState, ctx: LiveCtx, side: SideCtx, min: number,
  line?: string, forceScorer?: Player | null, lineV?: Record<string, string | number>,
  /** false for a try nobody would send upstairs (a charge-down fallen on) */
  review = true,
) {
  const { rng, goalPenalty } = ctx
  let scorer = forceScorer ?? tryScorer(state, side, rng)
  // a maul that goes over is grounded by the man at the back of it, the
  // hooker who runs it (1.8.2, the maul switch): the draw above is taken
  // either way, so only the name on the try moves
  const mvTry = !forceScorer && ctx.moveTry ? MOVE_BY_ID[ctx.moveTry.id] : undefined
  if (mvTry?.red && mvTry.from.includes('lineout') && ctx.moveTry?.maker != null) {
    const mk = state.players[ctx.moveTry.maker]
    if (mk && side.onPitch.has(mk.id)) scorer = mk
  }
  // ---- THE TMO (owner, 25 Sep 2026: "we need to be able to overturn a try
  // if the tmo finds it ... there is randomness to whether its a try or not").
  //
  // A MECHANICAL CHANGE, on the rng stream on purpose: two draws per try, the
  // second only when the first sends it upstairs, so fingerprint.ts is
  // rebaselined in the same commit. Every match takes it, AI and Instant
  // Result included, or the user's fixtures would score differently from the
  // rest of the league.
  //
  // What the review is ABOUT (grounding, knock-on, the last pass, the
  // touchline) is picked from the minute and the scorer, not drawn: which
  // question the referee asks is wording, and wording never moves the stream.
  // The question and the verdict agree - a try chalked off for a knock-on was
  // being checked for a knock-on.
  //
  // ---- THE FORWARD PASS IN THE BUILD-UP (owner, 30 Sep 2026: "There should
  // still be forward passes in the game, but IF a try happens then the TMO
  // should get involved with 90% ruled off. The other 10% should be left in
  // for debate and tight calls.") ----
  //
  // A handled try (not a maul, a pack drive, a red-zone play or a
  // charge-down fallen on) carries a forward pass in its build-up at
  // FWD_PASS.rate, scaled by the attacking side's handling error this tick:
  // the same turnover chance the styles, the wet ball and sure hands already
  // set (styleTick turnP over TURN_BASE, side.fwdF). The TMO always looks at
  // one, and FWD_PASS.ruledOut of them are chalked off; the rest stand as the
  // tight calls the replays will argue over.
  //
  // NO DRAW ON THE SHARED STREAM. Both decisions are a hash of the world, the
  // fixture, the side, the minute and how many tries this side has gone over
  // for (moveHash off styleSalt, as the style turnovers are). The ordinary
  // review's first draw is still taken for every reviewable try, and its
  // second is taken whenever it would have been, so a forward-pass try that
  // stands spends exactly the draws it always did (the one exception: a try
  // the ordinary review would have chalked off for something else now
  // stands). A try ruled out moves what follows (no conversion is kicked),
  // which is the point.
  const tryIdx = side.tryCalls = (side.tryCalls ?? 0) + 1
  const handled = review && !!scorer && !forceScorer && !mvTry?.red && line == null
  const fwdPass = handled
    && moveHash(styleSalt(state, ctx), min, side === ctx.home ? 1 : 2, tryIdx, 0x46574450) < FWD_PASS.rate * (side.fwdF ?? 1)
  const upstairs = review && rng() < TMO_REVIEW
  let fwdStands = false
  if (fwdPass) {
    if (upstairs) rng() // the ordinary review's verdict draw, taken and set aside
    const q = 1 + ((min + (scorer?.id ?? 0)) % 2)
    const team = { team: teamShort(state, side.teamId) }
    const oppSide = side === ctx.home ? ctx.away : ctx.home
    pushLine(state, ctx, min, 'SUB', side, `comm.tmoReviewFwd${q}`, team, scorer?.id)
    if (moveHash(styleSalt(state, ctx), min, side === ctx.home ? 1 : 2, tryIdx, 0x52554c45) < FWD_PASS.ruledOut) {
      // No points, no conversion, no credit. The scrum goes to the defending
      // side where the pass was thrown, a few metres back up the field, and
      // the attack's momentum goes with it.
      side.fwdRuledOut = (side.fwdRuledOut ?? 0) + 1
      pushLine(state, ctx, min, 'SUB', side, `comm.tmoNoTryFwd${q}`, team, scorer?.id)
      backTowards(ctx, side, FWD_SCRUM_BACK)
      side.pressure = clamp(side.pressure * 0.6, 0, 100)
      pushLine(state, ctx, min, 'SUB', oppSide, `comm.tmoFwdScrum${q}`, { team: teamShort(state, oppSide.teamId) })
      return
    }
    side.fwdStood = (side.fwdStood ?? 0) + 1
    fwdStands = true
  } else if (upstairs) {
    // what is being checked (1.8.16, items 40, 24, 58): grounding, knock-on,
    // the last pass and the touchline as before, and now offside at the kick
    // in the build-up, a blocker running interference, and the TMO going back
    // through the phases to an offside at the lineout. Picked, never drawn.
    const q = 1 + ((min + (scorer?.id ?? 0)) % 7)
    // the lines name the side, not the man: no pronoun to get wrong, and a
    // pack drive has no single scorer to name
    const team = { team: teamShort(state, side.teamId) }
    pushLine(state, ctx, min, 'SUB', side, `comm.tmoReview${q}`, team, scorer?.id)
    if (rng() < TMO_OVERTURN) {
      // No points, no conversion, no credit. The ball stays where it was, down
      // at the defending side's line: a scrum five metres out or a drop-out,
      // and the attack still has the field it had earned.
      pushLine(state, ctx, min, 'SUB', side, `comm.tmoNoTry${q}`, team, scorer?.id)
      // an offence by the attack is a penalty to the defence, kicked clear
      if (q >= 5) backTowards(ctx, side, 12)
      return
    }
  }
  // THE RESTART (v1.8.0). The position that won the try is given back: the
  // conceding side kicks off from halfway. A HARD set to 50 was tried and
  // measured first, and with eleven scores across twenty ticks it meant more
  // than half of all rugby was played from exactly halfway - the restart is
  // contested, somebody kicks long, and this leaves that in.
  ctx.field = ctx.field * 0.6 + 50 * 0.4
  side.score += 5
  side.tries += 1
  evPts(ctx, side, 5)
  // the hat-trick and the fastest try (records, 1.8.16)
  if (side.firstTryMin == null) { side.firstTryMin = min; side.firstTryBy = scorer?.id }
  if (scorer) (side.matchTries ??= new Map()).set(scorer.id, (side.matchTries.get(scorer.id) ?? 0) + 1)
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
  let tryKey = line ?? 'comm.tryPackDrive'
  if (line) pushLine(state, ctx, min, 'TRY', side, line, lineV, scorer?.id)
  else if (scorer) {
    tryKey = tryPool[Math.floor(rng() * tryPool.length)]
    // the called move that made it names itself (moves.ts); the pool's draw
    // above is taken either way, so naming it moves nothing
    const mt = ctx.moveTry ? moveTryLine(state, ctx.moveTry, scorer, min) : null
    if (mt) tryKey = mt.k
    // a try that came through a forward pass came through hands: a maul line
    // drawn for it is swapped after the draw, so the stream is untouched
    else if (fwdStands && DEPICTS[tryKey] === 'MAUL') tryKey = 'comm.try2'
    pushLine(state, ctx, min, 'TRY', side, tryKey, mt ? mt.v : { player: scorer.name }, scorer.id)
    // three in an afternoon (1.8.16)
    if (side.matchTries?.get(scorer.id) === 3) colour(state, ctx, side, 'comm.hatTrick', { player: scorer.name, team: teamShort(state, side.teamId) }, scorer.id)
    // and the debate that follows a tight call
    if (fwdStands) pushLine(state, ctx, min, 'SUB', side, `comm.tmoFwdStands${1 + ((min + scorer.id) % 2)}`, { team: teamShort(state, side.teamId) }, scorer.id)
  }
  else pushLine(state, ctx, min, 'TRY', side, 'comm.tryPackDrive')
  const cTries = scorer ? careerRows(scorer).reduce((s, c) => s + c.tries, 0) + scorer.stats.tries + (scorer.hist?.tries ?? 0) : 0
  if (scorer && ctx.detail && [25, 50, 75, 100].includes(cTries)) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryCareerMilestone', { n: cTries, player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && [10, 15, 20, 25].includes(scorer.stats.tries)) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.trySeasonCount', { n: scorer.stats.tries, player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && scorer.id === ctx.fx.testimonial) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryAtTestimonial', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && side.exIds.has(scorer.id) && (min + scorer.id) % 4 < 3) {
    // deterministic gates on all detail-only flavour: commentary must never
    // consume the shared rng stream (the EK/ER lesson, applied everywhere)
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryNoCelebration', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && scorer.retiring && (scorer.ca >= 72 || (scorer.caps ?? 0) >= 25) && (min + scorer.id) % 5 < 3) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryRetiringOvation', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && (scorer.rust ?? 0) >= 2 && (min + scorer.id) % 10 < 7) {
    // gate is deterministic (minute + id), not an rng draw: commentary must
    // never move the sim stream - see the EK lesson
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryComeback', { player: scorer.name }, scorer.id)
  }
  // THE MARK DOES NOT DEPEND ON WHO WAS WATCHING (1.8.1). The testimonial
  // try and the old boy's try against his former club were worth a little
  // more only inside the watched-only commentary above, so the same match
  // gave different ratings, and so a different Player of the Match and form,
  // when it was simmed. The words stay with the watcher; the marks do not,
  // and they no longer wait on a milestone line not having been said first.
  if (scorer && scorer.id === ctx.fx.testimonial) {
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.3)
  } else if (scorer && side.exIds.has(scorer.id) && (min + scorer.id) % 4 < 3) {
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.2)
  }
  const kicker = goalKicker(state, side)
  const pCon = clamp(kickChance(state, kicker, 0.495, 54, goalPenalty, side)
    + clutchKick(state.seed, kicker, min, side.score - (side === ctx.home ? ctx.away : ctx.home).score), 0.3, 0.92)
  const conOver = rng() < pCon
  noteKick(ctx, side, conOver)
  if (conOver) {
    side.score += 2
    evPts(ctx, side, 2)
    if (kicker) { kicker.stats.cons += 1; kicker.stats.points += 2 }
    // A TRY UNDER THE POSTS IS NOT CONVERTED FROM THE TOUCHLINE (1.6.3). The
    // conversion line was drawn without looking at the try line, and thirteen
    // times in 224 matches "dives under the posts" was followed by "converts
    // from the touchline" (scripts/qa/whistle.ts). Same shape as PEN_WET: a
    // swap after the draw, so the stream and the fingerprint are untouched.
    let conKey = CON_LINES[Math.floor(rng() * CON_LINES.length)]
    if (UNDER_POSTS.has(tryKey) && TOUCHLINE_CON.has(conKey)) conKey = 'comm.con4'
    pushLine(state, ctx, min + 1, 'CON', side, conKey,
      { player: kicker?.name ?? tIn('en', 'comm.theKicker') }, kicker?.id)
  } else {
    pushLine(state, ctx, min + 1, 'SUB', side, ctx.detail && kicker && ctx.crng() < 0.12 ? 'comm.conPost' : 'comm.conWide',
      { player: kicker?.name ?? '' }, kicker?.id)
  }
  describeRestart(state, ctx, side)
}

/**
 * Resolve the user's touchline call on a kickable penalty.
 *
 * THE WHISTLE WAITS FOR THE KICK (owner: "ive noticed a few times a penalty
 * kick comes after the half-time whistle has blown... this should never
 * happen should be everything within the time").
 *
 * A penalty awarded in the last four minutes of a half stops the clock, and
 * the answer - a tap from the manager, a standing instruction, or the 'posts'
 * default a skip or an instant result takes - arrives after stepTick has
 * already pushed HALF TIME. Reproduced before the fix: index 42 "PENALTY to
 * Northampton - kickable range", index 44 "Full-time", index 45 the kick.
 *
 * The kick was awarded before time, so it belongs in front of that line. When
 * a whistle is standing on an unanswered call, everything this function
 * narrates is spliced in ahead of it - which fixes the live ticker, the skip
 * and the instant result in one place, and without taking the last decision
 * of a half away from the manager.
 */
export function resolveDecision(state: GameState, ctx: LiveCtx, choice: 'posts' | 'corner' | 'tap'): string {
  const d = ctx.decision
  if (!d) return ''
  ctx.decision = null
  const whistleAt = ctx.whistleAt
  const before = ctx.events.length
  // whatever the answer puts on the board is the penalty's (EvCount.pts)
  ctx.evWhy = 'pen'
  const msg = decide(state, ctx, d, choice)
  ctx.evWhy = null
  if (whistleAt != null && whistleAt <= before) {
    const moved = ctx.events.splice(before)
    // AND THEY TAKE THE WHISTLE'S CLOCK WITH THEM.
    //
    // Moving the lines was only half of it. They were narrated live, so they
    // carry the minute of the tick that resolved them - and the whistle line
    // they are being placed IN FRONT OF was stamped when the half ended, which
    // is earlier. A kick awarded at 40' and taken in injury time produced a
    // ticker reading 41' TRY, 42' CON, 40' Half-time: the timeline ran
    // backwards, and the half-time card claimed to have happened two minutes
    // before the score it was reporting.
    //
    // Everything spliced here happened BEFORE the whistle by definition - that
    // is the whole reason it is being moved - so it cannot be stamped later
    // than the whistle. Clamp, do not renumber: a kick genuinely taken at 41'
    // in a half that ran to 42' keeps its 41'.
    //
    // scripts/stresstest.ts had caught this all along and could not say so: its
    // timeline invariant exempts HT, FT and BRK, so the whistle line itself was
    // waved through, and only the half-time NUMBERS line beside it - typed SUB,
    // because there is no interval type and HT would blow the whistle twice in
    // ui/audio.ts - was ever checked. It went red the moment a change elsewhere
    // shifted the rng stream enough to make first halves run long.
    const whistleMin = ctx.events[whistleAt]?.min ?? d.min
    for (const e of moved) e.min = Math.min(e.min, whistleMin)
    ctx.events.splice(whistleAt, 0, ...moved)
    // AND THE WHISTLE LINE SAYS THE SCORE THE KICK LEFT (1.6.3). It was stamped
    // when the half ended, before the answer, so its snapshot - which is what
    // the scoreboard shows while the ticker rests on it - read three or seven
    // short in every late-penalty half (scripts/qa/whistle.ts: 26 of 26).
    const whistle = ctx.events[whistleAt + moved.length]
    if (whistle && (whistle.type === 'HT' || whistle.type === 'FT')) {
      whistle.homeScore = ctx.home.score
      whistle.awayScore = ctx.away.score
      if (whistle.k && whistle.v) {
        whistle.v = { ...whistle.v, hs: ctx.home.score, ascore: ctx.away.score }
        whistle.text = tIn('en', whistle.k, whistle.v)
      }
    }
  }
  // A KICK ANSWERED AFTER THE FINAL WHISTLE CHANGES THE RESULT.
  //
  // finalizeMatch runs inside the last tick, before the manager has answered,
  // and writes the fixture's score and the full-time line from the scoreboard
  // as it stood. The splice above put the kick in the right place on the
  // ticker; it did nothing about the record. Found by scripts/releaseaudit.ts,
  // which rigged a kickable penalty into the 80th minute 114 times: the ticker
  // read 72-13 and the fixture 69-13 in 105 of them - three points that were
  // on the screen and not in the table.
  //
  // The half-time case never had the problem: a kick taken at 41' lands on a
  // scoreboard that finalizeMatch reads forty minutes later. Only the final
  // whistle needs the record re-read, so only the final whistle does it.
  if (ctx.seg === 3) syncResult(ctx)
  // AND NOW THE WHISTLE GOES. The clock reached it while this call was open,
  // so it was held; the kick has been narrated above and belongs in front of
  // it, which is exactly the order the ticker now has without any splicing.
  if (ctx.heldWhistle === 'HT') blowHalfTime(state, ctx)
  else if (ctx.heldWhistle === 'FT') blowFullTime(state, ctx)
  return msg
}

/** The fixture and the full-time line say what the scoreboard says. Called
 *  when a kick is taken after finalizeMatch has already written both.
 *  Ratings were settled on the pre-kick margin and are left alone: three
 *  points of margin move teamRatingTerm by a fraction of a point across a
 *  side, and re-marking twenty-three men for one kick is more churn than the
 *  correction is worth. The result is what the table reads, so the result is
 *  what is fixed. */
function syncResult(ctx: LiveCtx) {
  const { fx, home, away } = ctx
  fx.homeScore = home.score
  fx.awayScore = away.score
  fx.homeTries = home.tries
  fx.awayTries = away.tries
  const ft = ctx.events.find(e => e.type === 'FT' && e.k === 'comm.fullTime')
  if (ft?.v) {
    ft.v = { ...ft.v, hs: home.score, ascore: away.score }
    ft.text = tIn('en', 'comm.fullTime', ft.v)
    // the snapshot the scoreboard reads at the last line, not only the words
    ft.homeScore = home.score
    ft.awayScore = away.score
  }
}

function decide(
  state: GameState, ctx: LiveCtx, d: { kind: 'penalty'; min: number; fld?: number },
  choice: 'posts' | 'corner' | 'tap',
): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  // the kick belongs to the half the penalty was awarded in, and cannot run
  // past that half's whistle however late the answer arrives
  const min = Math.min(d.min <= 40 ? 40 : 79, d.min + 1)
  // AND IT BELONGS TO THE SPOT IT WAS AWARDED ON (1.8.0). The rest of the tick
  // plays on while the call waits, so an opposition kick to touch could move
  // the ball back into your half before the answer came, and a shot "at the
  // posts" went up from your own 43 (kickrangeprobe, 1 in 533). Absent on a
  // decision saved before 1.8.0, which keeps the old behaviour.
  if (d.fld != null) ctx.field = d.fld
  if (choice === 'posts') {
    takePenaltyShot(state, ctx, mine, min)
    return t('touch.pointsOnBoard')
  }
  if (choice === 'corner') return kickToCorner(state, ctx, mine, opp, min)
  return tapAndGo(state, ctx, mine, opp, min)
}

/**
 * ---- POSTS, CORNER OR TAP: THE AI'S CALL (1.8.16) ----
 *
 * The broadcasts are full of it: "go to the corner and back the maul", three
 * points turned down because three are not enough. The AI kicked every
 * kickable penalty at goal. Now it reads what a captain reads: the clock and
 * the scoreboard first (late and more than a kick behind, it needs a try), then
 * how close the line is and whether its maul has the beating of their pack.
 * Each club has its own appetite for it, off a hash of its id, so some sides
 * go to the corner far more than others. No draw: the call is read, and the
 * dice that follow are the ones the manager's own call would have taken.
 */
function aiPenaltyCall(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number): 'posts' | 'corner' | 'tap' {
  const toLine = side === ctx.home ? 100 - ctx.field : ctx.field
  const behind = opp.score - side.score
  const drive = side.units.lineout * 0.6 + side.units.scrum * 0.4
  const stop = opp.units.defence * 0.5 + opp.units.breakdown * 0.5
  const maul = drive - stop
  const pace = side.units.attack - opp.units.defence
  let h = 0
  for (const ch of side.teamId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const appetite = (h % 1000) / 1000   // 0 = always the posts, 1 = loves the corner
  // the last ten minutes, more than a kick behind: three points will not do
  if (min >= 70 && behind > 3) return toLine <= 8 && pace > 1 ? 'tap' : 'corner'
  // ahead late, or level and the kick puts them in front: take the points
  if (min >= 60 && behind <= 0) return 'posts'
  // five metres out with backs who have the beating of them
  if (toLine <= 5 && pace > 3.5 - appetite) return 'tap'
  // close in with a pack that is on top: back the maul. Rarer than the
  // posts by a distance, as it is in the Premiership: the tries it makes were
  // measured against the bands (bandcheck), not added on top of them
  if (toLine <= 12 && maul > 3.8 - appetite * 2.4 && behind > -10) return 'corner'
  return 'posts'
}

/** The corner and the maul, for whichever side has the penalty (the manager's
 *  call through decide, the AI's through aiPenaltyCall). */
function kickToCorner(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, min: number): string {
  const rng = ctx.rng
  {
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
    // the line says they gave away another penalty, so the count has it
    concedePenalty(state, ctx, opp, min + 1, null)
    return t('touch.pinnedNoPoints')
  }
}

/** The quick tap, for whichever side has the penalty. */
function tapAndGo(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, min: number): string {
  const rng = ctx.rng
  // TAP AND GO READS THE PLACE AND THE MATCHUP (1.8.0, optionsprobe). It
  // scored 17% of the time from anywhere against anyone, 1.01 points a call
  // from twenty metres against 2.47 for the posts, so "always tap" gave away
  // seven points a match. Close in with an attack that has the beating of
  // their defence it is now a real rival to the posts; from forty metres out
  // it is still a punt, which is rugby.
  //
  // AND IT IS RUN AS THE PLAYBOOK'S PENALTY PLAY (round 6). The play in the
  // penalty slot moves the chance by what it is worth with these men against
  // this defence (moveEdge, the same reckoning as any called move: drilled,
  // fitted, matched, and a misfire when undrilled), and a try it makes is
  // named for it. No play is the tap as it always was. Read off the side,
  // never a draw: the one roll below is the one there always was.
  mine.poss += 1.4
  const toLine = mine === ctx.home ? 100 - ctx.field : ctx.field
  const pen = penPlay(state, mine, opp)
  const pTap = clamp(0.42 - toLine * 0.006 + (mine.units.attack - opp.units.defence) * 0.03 + (pen ? pen.gain * TAP_PLAY_W : 0), 0.10, 0.55)
  if (rng() < pTap) {
    ctx.moveTry = pen ? { id: pen.id, launch: 'tap', maker: pen.maker?.id ?? null } : null
    scoreTry(state, ctx, mine, min, undefined)
    ctx.moveTry = null
    return t('touch.quickTapWorks')
  }
  pushLine(state, ctx, min, 'SUB', mine, 'comm.quickTapPhases', { team: teamShort(state, mine.teamId) })
  return t('touch.tempoLifted')
}

/** A penalty conceded: the count climbs, and when it reaches the referee's
 *  patience (and again at twice it) somebody takes ten in the bin for the
 *  team. One place for it, because the failed maul says "another penalty"
 *  too and used to leave the count, and so the warning and the bin, where
 *  they were (1.8.1). */
function concedePenalty(state: GameState, ctx: LiveCtx, opp: SideCtx, min: number, name?: null) {
  opp.consPens += 1
  const binAt = refFor(ctx.fx.id).patience
  // WHAT IT WAS FOR, AND THE WORD WITH THE CAPTAIN (1.8.16): words only, on
  // crng. `null` from a caller whose own line already says what it was.
  if (name !== null) describeOffence(state, ctx, opp, opp === ctx.home ? ctx.away : ctx.home)
  describeWarning(state, ctx, opp, binAt)
  if ((opp.consPens === binAt || opp.consPens === binAt * 2) && opp.onPitch.size > 13) {
    // never the man already back from the bin (see giveYellow)
    const ps = [...opp.onPitch].map(id => state.players[id]).filter(x => x && !opp.yellowUntil.has(x.id))
    if (ps.length) {
      const p = wpick(ctx.rng, ps, ps.map(x => x.a.agg))
      opp.yellowUntil.set(p.id, binUntil(ctx, min))
      opp.onPitch.delete(p.id)
      opp.binned.add(p.id)
      p.stats.yc += 1
      opp.ratings.set(p.id, (opp.ratings.get(p.id) ?? 6) - 0.7)
      pushLine(state, ctx, min, 'YC', opp, 'comm.ycRepeated',
        { n: opp.consPens, team: teamShort(state, opp.teamId), player: p.name }, p.id)
      checkFrontRow(state, ctx, opp, min, p, 'yellow')
      fieldChanged(state, ctx, opp, min)
    }
  }
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

const FRONT_ROW = ['LP', 'HK', 'TP'] as const
export function isFrontRower(p: Player | undefined | null): boolean {
  return !!p && FRONT_ROW.some(n => p.pos === n || p.alt.includes(n))
}

/**
 * ONLY THE FRONT ROW IS HARD TO REPLACE (owner, round 6: "he is a back rower
 * so I should be able to replace him with anyone ... Only front row players
 * should be harder to replace ... if a back has to play front row for example
 * then it would be uncontested scrums").
 *
 * Every other shirt takes any fit man on the bench, and a man out of position
 * pays the existing cover charge (forcedSwitchCost). Shirts 1, 2 and 3 want a
 * trained front-rower while one is available: an unused fit man on the bench,
 * or `alsoId` (the assistant's injury cover, who goes back to the bench if he
 * is swapped). When none is, anybody may take the shirt and Law 3 orders
 * uncontested scrums (checkFrontRow). True means "a non-front-rower may not
 * take this shirt now". Read-only, no draw.
 */
export function needsFrontRower(state: GameState, side: SideCtx, outId: number, alsoId?: number): boolean {
  const slot = side.lineup.indexOf(outId)
  if (slot < 0 || slot > 2) return false
  if (alsoId != null && isFrontRower(state.players[alsoId])) return true
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.ratings.has(id) || side.binned.has(id)) continue
    const p = state.players[id]
    if (p && !p.injury && p.bans === 0 && isFrontRower(p)) return true
  }
  return false
}

/** A non-front-rower has gone into a front-row shirt because nobody trained
 *  was left: if the side can no longer cover all three positions, the
 *  referee orders uncontested scrums. The change was the law's own answer to
 *  the shortage, so nobody else leaves the field for it. */
function frontRowGap(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, lost: Player | undefined) {
  if (!lost || ctx.uncontested || liveFrontRowCover(state, side)) return
  const pretend: Player = isFrontRower(lost) ? lost : { ...lost, pos: 'LP' as Pos, alt: [] }
  checkFrontRow(state, ctx, side, min, pretend, 'hia')
}

/** Law 3 mid-match: can the side still put a trained loosehead, hooker and
 *  tighthead on the pitch? Counts the players on it plus the bench that has
 *  not been used; a man in the bin does not count until he is back. The
 *  kick-off test (frontRowCover) wants two of each across the 23 because a
 *  match has replacements to make; once it is running, one of each is enough
 *  to keep the scrum contested. */
export function liveFrontRowCover(state: GameState, side: SideCtx): boolean {
  const pool: Player[] = []
  for (const id of side.onPitch) { const p = state.players[id]; if (p && !p.injury) pool.push(p) }
  // A REPLACED FRONT-ROWER STILL COUNTS (Law 3.35): a prop who came off at
  // the hour may return for a prop who is injured, binned or sent off, which
  // is why uncontested scrums are rare in the professional game. Only the
  // injured, the binned and the man on the pitch are out of the reckoning.
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.binned.has(id) || side.sentOff?.has(id)) continue
    const p = state.players[id]
    if (p && !p.injury) pool.push(p)
  }
  const cover = { LP: 0, HK: 0, TP: 0 }
  let capable = 0
  for (const p of pool) {
    if (!isFrontRower(p)) continue
    capable += 1
    for (const n of FRONT_ROW) if (p.pos === n || p.alt.includes(n)) cover[n] += 1
  }
  return capable >= 3 && cover.LP >= 1 && cover.HK >= 1 && cover.TP >= 1
}

/** The best replaced, uninjured front-rower on the bench, for Law 3.35. */
function returningFrontRower(state: GameState, side: SideCtx): Player | null {
  let best: Player | null = null
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.binned.has(id) || side.sentOff?.has(id) || !side.ratings.has(id)) continue
    const p = state.players[id]
    if (!p || p.injury || !isFrontRower(p)) continue
    if (!best || p.ca > best.ca) best = p
  }
  return best
}

/** Can the men on the pitch pack down a trained front row: a hooker and two
 *  props, three different men? A prop is a prop on either side here, as he
 *  is for the shirts (specialistGaps). Read-only, no draw. */
function pitchFrontRow(state: GameState, ids: Iterable<number>): boolean {
  const fr: Player[] = []
  for (const id of ids) { const p = state.players[id]; if (p && !p.injury && isFrontRower(p)) fr.push(p) }
  if (fr.length < 3) return false
  const hook = (p: Player) => p.pos === 'HK' || p.alt.includes('HK')
  const prop = (p: Player) => p.pos === 'LP' || p.pos === 'TP' || p.alt.includes('LP') || p.alt.includes('TP')
  for (const h of fr) {
    if (!hook(h)) continue
    if (fr.filter(p => p !== h && prop(p)).length >= 2) return true
  }
  return false
}

/**
 * LAW 3 WITH THE COVER ON THE BENCH (1.8.3, Laws 3.19 and 3.20).
 *
 * A front-rower is carded and a trained replacement is sitting on the bench.
 * This used to stop at "the cover exists": liveFrontRowCover counted the bench
 * man, so the scrum stayed contested, and nobody came on. The AI bench skipped
 * the empty shirt (aiAutoSubs replaces only a man who is out there) and the
 * manager could not fill it either (makeSubstitution refuses a binned man), so
 * the side scrummaged for ten minutes, or for the rest of the match, with a
 * card in the front row and a hooker on the bench.
 *
 * The law's answer: the side nominates another player to leave the field and
 * the front-row replacement comes on, so the scrum stays a contest and the
 * side is still a man down for the card. For a yellow it is undone when the
 * ten minutes end (simTick, the bin block): the carded man takes his shirt
 * back, the replacement goes back to the bench and the nominated man returns.
 * For a red it is for the match (RED-CARD-01: the sending-off is permanent).
 *
 * The replacement is the unused bench man who best fits the shirt (effAt), and
 * failing one a front-rower already replaced (Law 3.35), on the legs he left
 * with. The man who makes way is chosen as checkFrontRow chooses its man off:
 * the least valuable non-front-rower still out there by his mark so far. It is
 * the same for the manager's side and the AI's: forced, like an injury change,
 * so it spends none of the manager's replacements. No draw. Returns false when
 * nobody on the bench restores a whole front row, and Law 3 then orders
 * uncontested scrums as before.
 */
function frontRowCardCover(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, lost: Player, cause: 'red' | 'yellow'): boolean {
  const shirt = side.lineup.indexOf(lost.id)
  if (shirt < 0 || shirt > 14) return false
  const pos = XV_SLOTS[shirt].pos
  const fresh: Player[] = []
  const used: Player[] = []
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.binned.has(id) || side.sentOff?.has(id)) continue
    const p = state.players[id]
    if (!p || p.injury || p.bans > 0 || !isFrontRower(p)) continue
    if (!pitchFrontRow(state, [...side.onPitch, p.id])) continue
    ;(side.ratings.has(id) ? used : fresh).push(p)
  }
  let rep: Player | null = null
  for (const p of fresh) if (!rep || effAt(p, pos) > effAt(rep, pos)) rep = p
  const back = !rep
  if (!rep) for (const p of used) if (!rep || p.ca > rep.ca) rep = p
  if (!rep) return false
  const rest = [...side.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p && !isFrontRower(p))
  if (!rest.length) return false
  let nom = rest[0]
  for (const p of rest) if ((side.ratings.get(p.id) ?? 6) < (side.ratings.get(nom.id) ?? 6)) nom = p
  // the replacement wears the carded man's shirt, and the carded man takes
  // the replacement's seat; the man who makes way keeps his shirt, off the
  // pitch, the way a Law 3.20 removal does
  const seat = side.lineup.indexOf(rep.id)
  side.lineup[shirt] = rep.id
  if (seat >= 0) side.lineup[seat] = lost.id
  side.onPitch.delete(nom.id)
  side.onPitch.add(rep.id)
  cameOn(side, rep.id, min)
  if (!back) {
    side.ratings.set(rep.id, 6)
    side.energy.set(rep.id, benchTank(rep))
  } else {
    side.energy.set(rep.id, Math.min(benchTank(rep), side.energy.get(rep.id) ?? benchTank(rep)))
  }
  if (cause === 'yellow') (side.frCover ??= []).push({ binned: lost.id, on: rep.id, off: nom.id, shirt, swap: true })
  else (side.sentOff ??= new Set()).add(lost.id)
  fieldChanged(state, ctx, side, min)
  pushLine(state, ctx, min, 'SUB', side, cause === 'yellow' ? 'comm.frontRowBinCover' : 'comm.frontRowRedCover',
    { team: teamShort(state, side.teamId), on: rep.name, player: nom.name, lost: lost.name }, rep.id)
  return true
}

/** The bin block's half of frontRowCardCover: the carded front-rower's ten
 *  minutes are up. He takes his shirt back from whoever wears it now (the
 *  replacement, or whoever replaced him), that man goes to the bench, and the
 *  man who made way comes back on. Returns true when it handled the man. */
function frontRowCoverEnds(state: GameState, ctx: LiveCtx, s: SideCtx, id: number, min: number): boolean {
  const list = s.frCover
  const i = list ? list.findIndex(r => r.binned === id) : -1
  if (!list || i < 0) return false
  const r = list[i]
  list.splice(i, 1)
  const p = state.players[id]
  const nom = state.players[r.off]
  // THE COVER IS IN THE BIN HIMSELF: the replacement hooker took a card of
  // his own while he wore the shirt (frontrowcardprobe, after 1.8.16 gave the
  // TMO and the professional foul cards of their own). The man who made way
  // for him is owed his place back when the COVER's ten minutes end, not now,
  // or the side would have one more on the pitch than its cards allow.
  const cover = s.lineup[r.shirt]
  const coverSitting = r.swap && cover != null && cover !== id && s.binned.has(cover)
  if (r.swap && p && !p.injury) {
    const cur = s.lineup[r.shirt]
    const seat = s.lineup.indexOf(id)
    if (cur != null && cur !== id) {
      s.lineup[r.shirt] = id
      if (seat >= 0) s.lineup[seat] = cur
      s.onPitch.delete(cur)
      // the shirt's wearer is off for a head assessment: the man standing in
      // for HIM leaves now, and the assessed man, whatever the doctors say,
      // has no shirt to come back to (journeyprobe: sixteen on the pitch when
      // a binned front-rower returned during his cover's HIA)
      if (s.hia && s.hia.pid === cur) s.onPitch.delete(s.hia.subId)
    }
    s.onPitch.add(id)
    // a later card on the same shirt is settled by this return: its man
    // off is still owed his place, but the shirt is spoken for
    for (const o of list) if (o.shirt === r.shirt) o.swap = false
    pushLine(state, ctx, min, 'SUB', s, 'comm.frontRowBinBack',
      { team: teamShort(state, s.teamId), lost: p.name, on: cur != null ? state.players[cur]?.name ?? '' : '', player: nom?.name ?? '' }, id)
  }
  if (coverSitting) list.push({ binned: cover!, on: cover!, off: r.off, shirt: r.shirt, swap: false })
  else if (nom && !nom.injury && s.lineup.slice(0, 15).includes(nom.id) && !s.binned.has(nom.id)) s.onPitch.add(nom.id)
  return true
}

/**
 * A front-rower has just gone off. If nobody trained is left to take his
 * place the referee orders uncontested scrums from here: both packs are
 * levelled the way kick-off levels them, so the side with the better scrum
 * pays for the other's shortage.
 *
 * THE LAW AS IMPLEMENTED (World Rugby Law 3, uncontested scrums, and the
 * law application guidelines on it, 2017 and 2020). When uncontested scrums
 * are ordered because of a sending-off, a temporary suspension or an injury,
 * the player whose departure caused them cannot be replaced, so the team that
 * caused them plays a man fewer than it otherwise would:
 *
 *   injury   the injured front-rower is not replaced: whoever came on for
 *            him goes back off (or, with nobody on, the side's least-used man
 *            in the loose), and the side plays with fourteen
 *   red      the side is already a man down for the card, and loses a second
 *            man as well, so it plays with thirteen for the rest of the match
 *   yellow   a second man leaves with him for the ten minutes (thirteen), and
 *            both return together when the bin ends (simTick, the bin block),
 *            which is also when the scrum is contested again if the cover is back
 *   hia      a temporary replacement for a head injury assessment that becomes
 *            permanent is treated as the guidelines treat a blood replacement
 *            that becomes permanent: the side does not lose a player
 *
 * The man taken off is the least valuable non-front-rower still out there,
 * the one a coach would choose. The guidelines' exception for an injury
 * caused by foul play is not modelled: nothing in the engine injures a man by
 * foul play, so no injury qualifies for it.
 */
export function checkFrontRow(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, lost: Player, cause: 'red' | 'yellow' | 'injury' | 'hia', replaced = true) {
  if (ctx.uncontested || !isFrontRower(lost)) return
  // a card with the cover on the bench: the cover comes on and another man
  // makes way (frontRowCardCover); a front row still whole on the pitch
  // needs nothing; and only when neither holds is it uncontested
  if (cause === 'red' || cause === 'yellow') {
    if (pitchFrontRow(state, side.onPitch)) return
    if (frontRowCardCover(state, ctx, side, min, lost, cause)) return
  } else if (liveFrontRowCover(state, side)) return
  const { home, away } = ctx
  const level = (home.units.scrum + away.units.scrum) / 2
  const homeF = level / Math.max(1, home.units.scrum)
  const awayF = level / Math.max(1, away.units.scrum)
  layer(home, 'scrum', homeF)
  layer(away, 'scrum', awayF)
  ctx.uncontested = true
  ctx.uncontestedUndo = cause === 'yellow' ? { home: homeF, away: awayF } : null
  pushLine(state, ctx, min, 'SUB', side, 'comm.uncontestedNow', { team: teamShort(state, side.teamId), player: lost.name }, lost.id)
  // an injured man nobody came on for has already left the side a man short
  if (cause === 'hia' || (cause === 'injury' && !replaced)) return
  // the man off: the least valuable non-front-rower still out there
  const rest = [...side.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p && !isFrontRower(p))
  if (!rest.length) return
  let nom = rest[0]
  for (const p of rest) if ((side.ratings.get(p.id) ?? 6) < (side.ratings.get(nom.id) ?? 6)) nom = p
  side.onPitch.delete(nom.id)
  side.short += 1
  if (cause === 'yellow') side.lawOut = { id: nom.id, binned: lost.id }
  fieldChanged(state, ctx, side, min)
  pushLine(state, ctx, min, 'SUB', side, cause === 'injury' ? 'comm.uncontestedNoRep' : cause === 'yellow' ? 'comm.uncontestedBin' : 'comm.uncontestedShort',
    { team: teamShort(state, side.teamId), player: nom.name, lost: lost.name }, nom.id)
}

/**
 * THE ASSISTANT'S BENCH IS AS GOOD AS THE ASSISTANT (1.8.1, autopilotprobe).
 *
 * When the manager hands the touchline over (an instant result, or a week he
 * simply lets the game settle), his assistant makes the changes. A week
 * settled without him used to make none at all, and since 1.8.1 simMatch
 * hands it to the assistant as the instant result always did - who then made
 * them exactly as an AI head coach does, the full four on the hour and every
 * rolling change for a spent man, whoever was on the staff. Measured on
 * autopilotprobe's 54 worlds, that line was worth 14 points a season to a
 * Northampton that never opened a screen (34.1 without it, 48.6 with it) and
 * seven titles in 54: pressing Continue had become a strategy.
 *
 * So the bench, like the team sheet (assistantJudgement), is as good as the
 * man he hired to run it. Up to level one he makes two changes on the hour
 * and nothing else; level two makes three and reads a tank running dry the
 * way a head coach does; level three is a head coach. A manager who makes his
 * own changes has the whole bench whatever his staff. Measured on the same 54
 * worlds (Northampton has a level-two assistant): 44.2 points a season, 3
 * titles, against the engaged manager's 52.3 and 12. Deterministic: no draw.
 */
export function assistantBench(state: GameState): { bulk: number; rolling: boolean } {
  const lvl = Math.min(3, Math.max(0, state.staff?.assistant ?? 0))
  return { bulk: [2, 2, 3, 4][lvl], rolling: lvl >= 2 }
}

function aiAutoSubs(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  // the user manages their own bench (except forced injury subs elsewhere),
  // unless they handed the match to the assistant
  if (side.isUser && !ctx.assistantSubs) return
  if (ctx.tick < 11) return
  const bulk = ctx.tick === 15 // the classic bench emptying, 61-64'
  // his assistant runs it at the assistant's level (assistantBench)
  const asst = side.isUser ? assistantBench(state) : null
  if (asst && !bulk && !asst.rolling) return
  let made = 0
  for (let slot = 0; slot < 15 && made < (bulk ? (asst?.bulk ?? 4) : 1); slot++) {
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
      // A CHANGE FOR TIRED LEGS IS LIKE FOR LIKE. This took the best of
      // whatever was left, and once the bench prop had gone on for an injury
      // that could be a centre at tighthead. It cost nothing while an AI
      // side's units ignored its replacements; now that they read the men on
      // the pitch, a centre in the front row scrummages like one. A tired
      // specialist is kept on rather than swapped for a man who does not play
      // there (his own position, a listed alternative or the neighbouring
      // shirt, which is what effAt's 0.8 marks). Injuries still take whoever
      // is left: that change is forced.
      if (s < p.ca * 0.8) continue
      if (s > bestS) { bestS = s; best = p }
    }
    // nobody on the bench plays there: this shirt keeps its man, and the next
    // tired shirt may still have a like-for-like change waiting
    if (!best) continue
    side.onPitch.delete(outId)
    side.onPitch.add(best.id)
    cameOn(side, best.id, min)
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
  // once for the lot, not once a man: nothing in the loop reads the units,
  // and the hour's bulk change used to rebuild them four times over
  if (made) fieldChanged(state, ctx, side, min)
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
/**
 * REBASED for territory (v1.8.0), from 0.108.
 *
 * pTry is TRY_BASE times a ratio raised to 2.6, and field position multiplies
 * that ratio - up for the side with the position, down for the side without.
 * Those two are exact reciprocals, so the RATIO's mean is untouched, but the
 * 2.6 is convex: g^2.6 and g^-2.6 average to more than one, and the league
 * measured 56.2 points a game against 50.6 before the line existed. Rebased
 * a second time, 0.096 to 0.088, when the line was widened so that a tenth of
 * all rugby is played inside each 22 - a wider line means a bigger convex
 * term, and the league had drifted back up to 55.0.
 *
 * Same lesson, and the same fix, as the last-quarter fatigue term above - the
 * mechanism stays at full strength and the constant underneath it comes down
 * so the season's totals stay on the band.
 *
 * And a third time the other way, 0.0832 to 0.0895, when the TMO started
 * chalking tries off (scoreTry): about one in eighteen is disallowed, so a few
 * more are scored in the first place and the season lands where it was
 * (fingerprint.ts has the before-and-after).
 *
 * And 0.0895 to 0.0945 in 1.7.3, when ageing began turning an older side's
 * pace into tackling and handling (ageing.ts): every veteran back is a little
 * slower and every veteran tackler a little surer, so fewer tries were
 * scored until the constant moved (bandcheck pooled, tries a game: 6.40
 * before ageing, 6.38 after it with this constant; points 50.2 -> 50.3).
 *
 * And 0.0930 to 0.0843 in 1.8.0, for the charge-downs (kicksFromHand): about
 * 0.4 tries a match now come off a blocked kick, whoever is the better side,
 * so the tries the scoring roll hands out come down to leave the season's
 * total where it was. See scripts/fingerprint.ts for the before and after.
 *
 * And 0.0843 to 0.0815 later in 1.8.0, with the two-layer contest (E12),
 * whose extra variance had thinned home advantage below its band.
 */
const TRY_BASE = 0.0815
/** late in a match: how much an empty tank costs the side defending, and the side attacking */
const TIRED_DEF = 0.8, TIRED_ATT = 0.3
/** the strength a side keeps on an empty tank from the 56th minute (0.78 before it).
 *  0.6, then 0.55 once AI replacements brought their own quality instead of
 *  the starters' (creditprobe): a sub became a real trade for the AI too, the
 *  side that never changed was punished less, and the manager's whole bench
 *  fell to +0.43 points (subvalueprobe). At 0.55 it reads +0.91, four fresh
 *  men +1.09, and bandcheck holds every band (49.1 pts, 52.7% home). */
const LATE_FLOOR = 0.55
/** how hard the penalty count leans toward the defending side's half (1.7.4) */
const PEN_LEAN = 1.7
/** how hard a zone plan moves the line (1.8.0, see simTick): at 1 the kicking
 *  and own-half penalty changes had shrunk the gap between plans (advprobe:
 *  long vs play 0.5, drive vs spread 0.2); at 2 the gaps are 1.3 and 0.6 */
const ZONE_PULL = 2
/** how hard a style's kicking game moves the line (1.8.2, styles.ts): the
 *  push is a constant a tick, and the line's decay multiplies a constant by
 *  about 28, so this is small on purpose (see ZonePlan.terr) */
const STYLE_PULL = 1

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

/**
 * ---- THE AFTERNOON'S INCIDENTS (1.8.16) ----------------------------------
 *
 * The owner sat through a season of real broadcasts (TNT Sports' Prem, the
 * play-offs, the Quilter Nations Series) and wrote down everything that
 * happened in them that this engine could not: the penalty try and the yellow
 * that goes with it, the intercept run in from halfway, the TMO calling back
 * a high shot after play had gone on, held up over the line and the goal-line
 * drop-out, free kicks, the 50:22, the kick that goes out on the full, the
 * referee's word with the captain, the scuffle, the warm-up withdrawal. His
 * brief: "its important each game feels different and authentic. We need
 * randomness amongst all the tactics."
 *
 * THE INCIDENT DICE. Every one of these changes a match, so none of them is
 * the commentary's (crng). But none of them draws on the shared stream either:
 * each decision comes off a small stream of its own, seeded from the match's
 * kickSeed (taken once from rng at kick-off) and the tick, the side and what
 * is being decided. So a side that is never in position for an intercept
 * still has every other dice of the afternoon where it was, which keeps the
 * common random numbers optionsprobe and dialweight depend on. What an
 * incident then DOES (who scores, the conversion, the card's front-row law)
 * is run on the same incident stream (withRng), for the same reason.
 *
 * Wording stays on crng, as everywhere else in this file.
 */
export type DayUnit = 'scrum' | 'lineout' | 'breakdown' | 'kicking' | 'attack' | 'defence'
const DAY_UNITS: DayUnit[] = ['scrum', 'lineout', 'breakdown', 'kicking', 'attack', 'defence']
/** how much each unit can be up or down on the day, one standard deviation.
 *  The set piece swings most (a lineout that will not fire is the most
 *  common story of a bad afternoon); attack and defence least, because they
 *  reach the try chance through a power of 2.6. */
const DAY_SD: Record<DayUnit, number> = { scrum: 0.05, lineout: 0.06, breakdown: 0.045, kicking: 0.05, attack: 0.022, defence: 0.022 }
/** how far the plan clicks or stalls on the day: scales what called moves
 *  and zone plans are worth, never their direction */
const EXEC_SD = 0.15

/** a stream for one decision: the match, the tick, the side and the question */
function incRng(ctx: LiveCtx, tick: number, side: SideCtx | null, salt: number): Rng {
  const s = ((ctx.kickSeed ?? (ctx.fx.id | 0)) ^ Math.imul(tick + 11, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)
    ^ (side == null ? 0x2f1 : side === ctx.home ? 0x1d0f5 : 0x7a31b)) >>> 0
  return mulberry32(s || 1)
}

/** run `fn` with ctx.rng set to `r`, so whatever it draws comes off `r` */
function withRng<T>(ctx: LiveCtx, r: Rng, fn: () => T): T {
  const was = ctx.rng
  ctx.rng = r
  try { return fn() } finally { ctx.rng = was }
}

/** a standard normal off a stream (Box-Muller) */
function normalOf(r: Rng): number {
  const u = Math.max(1e-9, r())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

/**
 * THE DAY (1.8.16, owner: "each game feels different"). Every side turns up
 * with a lineout that fires or does not, a scrum that is on top or under it,
 * a boot that finds touch or slices it. Drawn once at kick-off, mean-neutral
 * (a lognormal with its drift taken out), layered so a substitution keeps it,
 * and the same whether anybody is watching. The plan itself clicks or stalls
 * too (exec), which is the "randomness amongst all the tactics": the same
 * tactics are worth more on one Saturday than the next.
 */
function dealTheDay(ctx: LiveCtx, uncontested = false) {
  for (const side of [ctx.home, ctx.away]) {
    const r = incRng(ctx, -2, side, 0xDA7)
    const day: Partial<Record<DayUnit, number>> = {}
    for (const u of DAY_UNITS) {
      const sd = DAY_SD[u]
      const m = Math.exp(sd * normalOf(r) - (sd * sd) / 2)
      day[u] = clamp(m, 1 - 3 * sd, 1 + 3 * sd)
      // an uncontested scrum has no good day or bad one (the draw is still
      // taken, so the units after it are dealt the same)
      if (u === 'scrum' && uncontested) { day[u] = 1; continue }
      layer(side, u, day[u]!)
    }
    side.day = day
    side.exec = clamp(Math.exp(EXEC_SD * normalOf(r) - (EXEC_SD * EXEC_SD) / 2), 0.4, 1.8)
  }
}

/** The day, in words, once it has had time to show: the unit furthest from
 *  normal for each side, at about twenty minutes, and the plan by the hour. */
function describeDay(state: GameState, ctx: LiveCtx, tick: number) {
  if (!ctx.detail || (tick !== 5 && tick !== 14)) return
  for (const side of [ctx.home, ctx.away]) {
    const team = teamShort(state, side.teamId)
    if (tick === 5 && side.day) {
      let best: DayUnit | null = null, far = 0
      for (const u of DAY_UNITS) {
        if (u === 'attack' || u === 'defence') continue
        const d = Math.abs((side.day[u] ?? 1) - 1) / DAY_SD[u]
        if (d > far) { far = d; best = u }
      }
      if (best && far >= 1.3) {
        const up = (side.day[best] ?? 1) > 1
        colour(state, ctx, side, `comm.day_${best}${up ? 'Up' : 'Down'}`, { team })
      }
    }
    if (tick === 14 && side.exec != null) {
      if (side.exec >= 1.35) colour(state, ctx, side, 'comm.day_planClicks', { team })
      else if (side.exec <= 0.7) colour(state, ctx, side, 'comm.day_planStalls', { team })
    }
  }
}

/** the man leading this side on the pitch: the captain, the vice, or the
 *  most natural leader out there */
function captainOf(state: GameState, side: SideCtx): Player | null {
  const club = state.clubs[side.teamId]
  for (const id of [club?.captain, club?.vice]) {
    if (id != null && side.onPitch.has(id)) return state.players[id] ?? null
  }
  const ps = onField(state, side)
  return ps.length ? ps.reduce((a, b) => (b.a.lea > a.a.lea ? b : a)) : null
}

/** ten minutes in the bin, for a named reason. Never below thirteen. */
function giveYellow(state: GameState, ctx: LiveCtx, side: SideCtx, p: Player, min: number, key: string, v?: Record<string, string | number>): boolean {
  if (!side.onPitch.has(p.id)) return false
  // A SECOND YELLOW IS A RED (Law 9 and World Rugby Regulation 17): a man
  // already back from the bin is sent off for the rest of it. The panel often
  // calls the sending-off sanction enough, sometimes adds a week; which one is
  // read off the man and the minute, so no draw is taken from either stream.
  if (side.yellowUntil.has(p.id)) {
    side.sent += 1
    side.onPitch.delete(p.id)
    p.stats.rc += 1
    p.bans += (p.id + min) % 2
    side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
    pushLine(state, ctx, min, 'RC', side, 'comm.secondYellow', { player: p.name, team: teamShort(state, side.teamId) }, p.id)
    checkFrontRow(state, ctx, side, min, p, 'red')
    fieldChanged(state, ctx, side, min)
    return true
  }
  if (side.onPitch.size <= 13) return false
  side.yellowUntil.set(p.id, binUntil(ctx, min))
  side.onPitch.delete(p.id)
  side.binned.add(p.id)
  p.stats.yc += 1
  side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
  pushLine(state, ctx, min, 'YC', side, key, { player: p.name, team: teamShort(state, side.teamId), ...(v ?? {}) }, p.id)
  checkFrontRow(state, ctx, side, min, p, 'yellow')
  fieldChanged(state, ctx, side, min)
  return true
}

/** a red card: for the match (RED-CARD-01), with the ban that follows */
function giveRed(state: GameState, ctx: LiveCtx, side: SideCtx, p: Player, min: number, key: string, v?: Record<string, string | number>): boolean {
  if (!side.onPitch.has(p.id)) return false
  side.sent += 1
  side.onPitch.delete(p.id)
  p.stats.rc += 1
  p.bans += 2 + Math.floor(ctx.rng() * 2)
  side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
  pushLine(state, ctx, min, 'RC', side, key, { player: p.name, team: teamShort(state, side.teamId), ...(v ?? {}) }, p.id)
  checkFrontRow(state, ctx, side, min, p, 'red')
  fieldChanged(state, ctx, side, min)
  return true
}

/** the share of the old card roll that still fires, now that the
 *  professional foul, the TMO and the scuffle give cards of their own */
const CARD_SHARE = 0.75
/** the strength each missing man (bin, red, unreplaced) takes from a side */
const MAN_DOWN = 0.1
/** what the card from the discipline roll was for: words only */
const YC_REASONS = ['comm.yellowCard', 'comm.ycHigh', 'comm.ycKnockOn', 'comm.ycOffsideRepeat', 'comm.ycShoulder', 'comm.ycTrip']
/** GARBAGE TIME FOR THE INCIDENTS TOO: a side more than four converted tries
 *  up takes its foot off, so the intercept and the penalty try damp the way
 *  the scoring roll does (blowprobe: without it the far tail of mismatches
 *  reached 40 in 20,000 past 90 points) */
function leadDamp(scoring: SideCtx, other: SideCtx): number {
  const lead = scoring.score - other.score
  return lead > 28 ? Math.max(0.2, Math.pow(28 / lead, 1.4)) : 1
}
/** a man by position, weighted, off the given stream */
function manFor(r: Rng, ps: Player[], w: Partial<Record<Pos, number>>, agg = 0): Player | null {
  if (!ps.length) return null
  return wpick(r, ps, ps.map(p => (w[p.pos] ?? 0.3) * (1 + agg * (p.a.agg - 10) / 10)))
}

/**
 * ---- WHAT THE PENALTY WAS FOR (item 18, and 24, 25, 40, 44, 45, 46) ----
 *
 * Every broadcast names the offence and this engine never did: "PENALTY to
 * Leicester" and nothing about why. Named now, and named from what the side
 * giving it away is doing: a rush defence is penalised for offside, a side
 * contesting every ruck for hands in it, a pack going backwards at the scrum
 * for collapsing. A fussy breakdown referee blows more of the ruck offences.
 * Words only, on crng: the penalty happened either way.
 */
type Offence =
  | 'offsideLine' | 'offsideRuck' | 'sideEntry' | 'handsRuck' | 'offFeet' | 'notRelease' | 'notRoll'
  | 'highTackle' | 'scrumCollapse' | 'scrumAngle' | 'scrumBind' | 'scrumKnee' | 'scrumEarly'
  | 'maulCollapse' | 'lineoutBarge' | 'lineoutThrough' | 'lifterAcross' | 'offsideKick' | 'boxKick10'
  | 'pullBack' | 'beyondRuck' | 'noBall'
const OFFENCE_MEN: Record<Offence, Partial<Record<Pos, number>>> = {
  offsideLine: { CE: 3, WG: 2, FH: 1, FL: 1.5, FB: 0.6 }, offsideRuck: { FL: 2, N8: 1.5, LK: 1.5, CE: 1 },
  sideEntry: { FL: 2, LK: 2, HK: 1.5, N8: 1.5, LP: 1, TP: 1 }, handsRuck: { FL: 3, N8: 2, HK: 1.5, CE: 1 },
  offFeet: { FL: 3, HK: 2, N8: 1.5, LK: 1.2, CE: 0.8 }, notRelease: { CE: 2, FL: 2, LK: 1.5, WG: 1, FB: 1 },
  notRoll: { LK: 2, FL: 2, LP: 1.5, TP: 1.5, HK: 1, CE: 1 }, highTackle: { LK: 2, FL: 2, CE: 2, LP: 1, TP: 1, HK: 1 },
  scrumCollapse: { LP: 3, TP: 3, HK: 1 }, scrumAngle: { LP: 2, TP: 3 }, scrumBind: { LP: 3, TP: 2, HK: 1 },
  scrumKnee: { LP: 3, TP: 3 }, scrumEarly: { LP: 2, TP: 2, HK: 2 },
  maulCollapse: { LK: 3, FL: 2, HK: 1, N8: 1 }, lineoutBarge: { LK: 3, FL: 2, N8: 1 },
  lineoutThrough: { LK: 2, FL: 2, N8: 2 }, lifterAcross: { LP: 3, TP: 3, FL: 1 },
  offsideKick: { CE: 2, WG: 2, FL: 1.5, FH: 1 }, boxKick10: { FL: 2, N8: 1.5, WG: 1.5, CE: 1 },
  pullBack: { FL: 2, LK: 1.5, N8: 1.5, HK: 1 }, beyondRuck: { FL: 2, LK: 2, HK: 1.5, N8: 1.5 },
  noBall: { CE: 2, FL: 2, WG: 1.5, LK: 1 },
}
const SCRUM_OFFENCES = new Set<Offence>(['scrumCollapse', 'scrumAngle', 'scrumBind', 'scrumKnee', 'scrumEarly'])

function pickOffence(state: GameState, ctx: LiveCtx, off: SideCtx, att: SideCtx): Offence {
  const tac = state.clubs[off.teamId]?.tactic
  const rush = clamp(((tac?.defLine ?? 50) - 50) / 50, -1, 1)
  const contest = clamp(((tac?.ruckContest ?? 50) - 50) / 50, -1, 1)
  const fussy = clamp(2 - refFor(ctx.fx.id).breakdown, 0.7, 1.3)
  const scrumDown = clamp(att.units.scrum / Math.max(1, off.units.scrum), 0.7, 1.5)
  const attUp = upOf(ctx, att)
  const W: [Offence, number][] = [
    ['offsideLine', 1.1 + 1.4 * Math.max(0, rush)], ['offsideRuck', 0.7], ['sideEntry', 0.7 * fussy],
    ['handsRuck', (1 + 0.9 * Math.max(0, contest)) * fussy], ['offFeet', (0.9 + 0.5 * Math.max(0, contest)) * fussy],
    ['notRelease', 0.9 * fussy], ['notRoll', attUp > 78 ? 1.3 : 0.6], ['highTackle', 0.45 * (1 + (off.aggF ?? 0))],
    ['scrumCollapse', 0.7 * scrumDown * scrumDown], ['scrumAngle', 0.25 * scrumDown], ['scrumBind', 0.25 * scrumDown],
    ['scrumKnee', 0.18 * scrumDown], ['maulCollapse', attUp > 68 ? 0.8 : 0.1], ['lineoutBarge', 0.18],
    ['lineoutThrough', 0.14], ['lifterAcross', 0.1], ['offsideKick', 0.3], ['boxKick10', attUp < 40 ? 0.35 : 0.1],
    ['pullBack', 0.12], ['beyondRuck', 0.28], ['noBall', 0.22],
  ]
  const tot = W.reduce((s, [, w]) => s + w, 0)
  let x = ctx.crng() * tot
  for (const [o, w] of W) { x -= w; if (x < 0) return o }
  return 'offsideLine'
}

/** the offence named, on the commentary's dice, before the kick decision */
function describeOffence(state: GameState, ctx: LiveCtx, off: SideCtx, att: SideCtx) {
  if (!ctx.detail) return
  const o = pickOffence(state, ctx, off, att)
  const ps = onField(state, off)
  const w = OFFENCE_MEN[o]
  let p: Player | null = null
  if (ps.length) {
    let x = ctx.crng() * ps.reduce((s, q) => s + (w[q.pos] ?? 0.2), 0)
    for (const q of ps) { x -= w[q.pos] ?? 0.2; if (x < 0) { p = q; break } }
  }
  const v = { team: teamShort(state, off.teamId), opp: teamShort(state, att.teamId), player: p?.name ?? teamShort(state, off.teamId) }
  colour(state, ctx, off, `comm.off_${o}${1 + Math.floor(ctx.crng() * 2)}`, v, p?.id)
  // a second scrum offence after a free kick is the full arm (item 49)
  if (SCRUM_OFFENCES.has(o) && (off.scrumFK ?? 0) > 0) colour(state, ctx, off, 'comm.offFullArm', v)
}

/** the referee and the captain: the warning before the bin, the final one
 *  before the second, and now and then a skipper asking for a word */
function describeWarning(state: GameState, ctx: LiveCtx, off: SideCtx, binAt: number) {
  if (!ctx.detail) return
  const cap = captainOf(state, off)
  const v = { team: teamShort(state, off.teamId), player: cap?.name ?? teamShort(state, off.teamId), n: off.consPens }
  if (binAt >= 3 && off.consPens === binAt - 1) {
    off.warned = (off.warned ?? 0) + 1
    colour(state, ctx, off, `comm.refWarn${1 + Math.floor(ctx.crng() * 3)}`, v, cap?.id)
  } else if (off.consPens === binAt * 2 - 1) {
    colour(state, ctx, off, 'comm.refWarnFinal', v, cap?.id)
  } else if (off.consPens >= 3 && ctx.crng() < 0.12) {
    colour(state, ctx, off, `comm.capTalk${1 + Math.floor(ctx.crng() * 3)}`, v, cap?.id)
  }
}

/**
 * THE REFEREE CHANGES HIS MIND (item 53). Late word from the touch judge, a
 * replay on the big screen, or a block the attack ran that he had not seen:
 * the penalty goes the other way. About one in fifty.
 */
const REVERSE_P = 0.02
function reversedPenalty(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number): boolean {
  const r = incRng(ctx, tick, side, 0x8E7E)
  if (r() >= REVERSE_P) return false
  const u = r()
  const kind = u < 0.4 ? 'obstruction' : u < 0.7 ? 'screen' : 'touchJudge'
  withRng(ctx, r, () => {
    pushLine(state, ctx, min, 'SUB', side, `comm.reverse_${kind}`, { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId) })
    concedePenalty(state, ctx, side, min, null)
  })
  side.pressure = clamp(side.pressure * 0.6, 0, 100)
  opp.pressure = clamp(opp.pressure + 12, 0, 100)
  backTowards(ctx, side, 12)
  return true
}

/**
 * ---- CYNICAL, AND THE PENALTY TRY (items 21, 26, 41) ----
 *
 * Close to the line, a defence about to be scored against will sometimes
 * kill it: a hand slapping a pass down, a body lying on the ball, a maul
 * pulled down. Inside the 22 that is a yellow card for the professional
 * foul; within a few metres, with a try coming, the referee goes under the
 * posts for seven points and the man still goes to the bin. How likely
 * scales with how likely the try was (pTry), so the side carving the
 * defence open is the side that gets them.
 */
const CYN_NEAR = 0.1, CYN_FAR = 0.018
function cynicalIncident(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number, up: number, pTry: number): 'pt' | 'yc' | null {
  if (up < 70) return null
  const r = incRng(ctx, tick, side, 0xC71C)
  const near = up >= 88
  const p = (near ? clamp(CYN_NEAR * pTry / 0.1, 0.05, 0.25) : CYN_FAR) * leadDamp(side, opp)
  if (r() >= p) return null
  const u = r()
  const kind = u < 0.4 ? 'knockDown' : u < 0.75 ? 'ruck' : 'maul'
  const W: Partial<Record<Pos, number>> = kind === 'knockDown' ? { WG: 3, CE: 3, FB: 2, FH: 1, SH: 1, FL: 1 }
    : kind === 'ruck' ? { FL: 3, N8: 2, LK: 2, HK: 1.5 } : { LK: 3, FL: 2, HK: 1.5, LP: 1, TP: 1 }
  const p0 = manFor(r, onField(state, opp), W, 0.5)
  if (!p0) return null
  const pt = near && r() < (up >= 93 ? 0.45 : 0.2)
  const v = { team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId), player: p0.name }
  return withRng(ctx, r, () => {
    pushLine(state, ctx, min, 'SUB', opp, `comm.cyn_${kind}`, v, p0.id)
    if (pt) {
      penaltyTry(state, ctx, side, min)
      giveYellow(state, ctx, opp, p0, min + 1, 'comm.ycPenTry')
      return 'pt' as const
    }
    giveYellow(state, ctx, opp, p0, min, 'comm.ycProfFoul')
    return 'yc' as const
  })
}

/** seven points under the posts, no conversion, nobody credited (Law 8) */
function penaltyTry(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  side.pressure = clamp(side.pressure + 42, 0, 100)
  const opp = side === ctx.home ? ctx.away : ctx.home
  opp.pressure = clamp(opp.pressure * 0.55, 0, 100)
  ctx.field = ctx.field * 0.6 + 50 * 0.4
  side.score += 7
  side.tries += 1
  side.penTries = (side.penTries ?? 0) + 1
  evPts(ctx, side, 7, 'pen')
  pushLine(state, ctx, min, 'TRY', side, `comm.penTry${1 + ((min + side.score) % 3)}`, { team: teamShort(state, side.teamId) })
  describeRestart(state, ctx, side)
}

/**
 * ---- THE INTERCEPT (items 22, 50) ----
 *
 * A pass floated wide into a rush defence, and the man who read it is gone.
 * Off a tick that came to nothing for the side with the ball, likelier
 * against a rush (defLine) and a loose handling side (fwdF), and on a wet
 * ball. From deep it is a long way: a slower man is run down, and the ball
 * is then deep in the attacking side's half anyway. Nobody sends an
 * intercept upstairs.
 */
const INTERCEPT_P = 0.0085
const INTERCEPT_TRY = ['comm.tryIntercept1', 'comm.tryIntercept2', 'comm.tryIntercept3', 'comm.tryIntercept4']
function interceptTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number, up: number): boolean {
  const r = incRng(ctx, tick, side, 0x1A7C)
  const rush = (state.clubs[opp.teamId]?.tactic.defLine ?? 50) / 100
  const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow' ? 1.2 : 1
  const p = INTERCEPT_P * (0.7 + 0.6 * rush) * (up > 45 ? 1.2 : 0.5) * clamp(side.fwdF ?? 1, 0.6, 1.6) * wet * leadDamp(opp, side)
  if (r() >= p) return false
  const man = manFor(r, onField(state, opp), { WG: 3, CE: 3, FB: 1.5, FH: 1, SH: 0.8, FL: 0.4 })
  if (!man) return false
  // the run is as long as the attack had come: `up` metres back to their line
  const pAway = clamp(1.05 - up * 0.006 + (man.a.pac - 12) * 0.025, 0.35, 0.97)
  opp.ratings.set(man.id, (opp.ratings.get(man.id) ?? 6) + 0.25)
  // it is a turnover, and the evidence counts it as one, where it happened
  // (the try it may become is put down to turnovers, so the count must have it)
  const z = zoneIdx(up)
  evOf(side).turnLost[z] += 1
  const eo = evOf(opp)
  eo.turnWon[2 - z] += 1
  eo.lastTurn = tick
  opp.styTurnWon = (opp.styTurnWon ?? 0) + 1
  side.styTurnLost = (side.styTurnLost ?? 0) + 1
  if (r() < pAway) {
    side.pressure = clamp(side.pressure * 0.55, 0, 100)
    ctx.evWhy = 'turn'
    withRng(ctx, r, () => scoreTry(state, ctx, opp, min, said(ctx, INTERCEPT_TRY), man, { player: man.name }, false))
    ctx.evWhy = null
  } else {
    backTowards(ctx, side, Math.min(60, up * 0.7))
    opp.pressure = clamp(opp.pressure + 25, 0, 100)
    pushLine(state, ctx, min, 'SUB', opp, `comm.interceptCaught${1 + (min % 2)}`, { player: man.name, team: teamShort(state, opp.teamId) }, man.id)
  }
  return true
}

/**
 * ---- HELD UP, AND THE GOAL-LINE DROP-OUT (items 19, 27) ----
 *
 * Over the line and the ball never touches the grass: a body underneath it,
 * an arm in the way. Since the 2022 law it restarts with a drop-out from the
 * defending side's own goal line, so being held up is a real defensive win:
 * the attack had the ball five metres out and now receives it near halfway.
 */
const HELD_UP_P = 0.24
function heldUpTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number, up: number): boolean {
  if (up < 86) return false
  const r = incRng(ctx, tick, side, 0x4E1D)
  if (r() >= HELD_UP_P) return false
  const carrier = manFor(r, onField(state, side), { N8: 2, FL: 2, LK: 1.5, HK: 2, LP: 1, TP: 1, CE: 1.2, WG: 1 })
  const stopper = manFor(r, onField(state, opp), { FL: 2, N8: 2, LK: 1.5, CE: 1.2, SH: 1, WG: 1, FB: 1 })
  if (stopper) opp.ratings.set(stopper.id, (opp.ratings.get(stopper.id) ?? 6) + 0.15)
  pushLine(state, ctx, min, 'SUB', opp, `comm.heldUp${1 + (min % 3)}`, {
    team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId),
    player: stopper?.name ?? teamShort(state, opp.teamId), carrier: carrier?.name ?? teamShort(state, side.teamId),
  }, stopper?.id)
  pushLine(state, ctx, min, 'SUB', opp, `comm.gldo${1 + (min % 2)}`, { team: teamShort(state, opp.teamId) })
  backTowards(ctx, side, 45)
  side.pressure = clamp(side.pressure * 0.6, 0, 100)
  opp.pressure = clamp(opp.pressure + 15, 0, 100)
  return true
}

/**
 * ---- FREE KICKS, AND THE THROW THAT IS NOT STRAIGHT (items 28, 33, 34, 46) ----
 *
 * The short arm: early engagement at the scrum, numbers at the lineout,
 * a crooked feed, time-wasting at the set piece, and a mark called inside
 * the 22. Nobody kicks at goal from one, so it is a little ground and the
 * ball, and a scrum offence given as a free kick makes the next one a full
 * penalty (describeOffence). A throw that is not straight hands the other
 * side the scrum; a hooker who throws badly, or one who has just come off the
 * bench cold, throws more of them.
 */
const FK_P = 0.08, NOT_STRAIGHT_P = 0.011
function setPieceTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number) {
  const r = incRng(ctx, tick, side, 0xF4EE)
  const u = r()
  const up = upOf(ctx, side)
  const team = teamShort(state, side.teamId), oppT = teamShort(state, opp.teamId)
  if (u < FK_P) {
    const k = r()
    const kind = up < 22 && k < 0.35 ? 'mark' : k < 0.5 ? 'scrumEarly' : k < 0.68 ? 'lineoutNumbers'
      : k < 0.82 ? 'scrumFeed' : k < 0.92 ? 'delay' : 'lineoutGap'
    if (kind === 'scrumEarly' || kind === 'scrumFeed') opp.scrumFK = (opp.scrumFK ?? 0) + 1
    side.freeKicks = (side.freeKicks ?? 0) + 1
    const who = kind === 'mark' ? manFor(r, onField(state, side), { FB: 4, WG: 2, FH: 1 }) : null
    backTowards(ctx, opp, kind === 'mark' ? 18 : 5)
    side.pressure = clamp(side.pressure + 6, 0, 100)
    side.poss += 0.3
    pushLine(state, ctx, min, 'SUB', side, `comm.fk_${kind}`, { team, opp: oppT, player: who?.name ?? team }, who?.id)
    return
  }
  // the throw: the side throwing is `opp`, and `side` gets the scrum
  const hk = inShirt(state, opp, 1)
  const cold = hk && (opp.onAt?.get(hk.id) ?? 0) > 0 && min - (opp.onAt?.get(hk.id) ?? 0) < 12
  const pNS = NOT_STRAIGHT_P * clamp(1 + (12 - (hk?.a.lin ?? 12)) / 10, 0.6, 1.8) * (cold ? 1.4 : 1) * (2 - (opp.day?.lineout ?? 1))
  if (u < FK_P + pNS) {
    side.poss += 0.2
    opp.pressure = clamp(opp.pressure * 0.85, 0, 100)
    pushLine(state, ctx, min, 'SUB', opp, cold ? 'comm.notStraightCold' : `comm.notStraight${1 + (min % 2)}`,
      { team: oppT, opp: team, player: hk?.name ?? oppT }, hk?.id)
  }
}

/**
 * ---- THE TMO CALLS IT BACK (items 23, 43) ----
 *
 * Play has gone on, and the screen shows a high shot, a neck roll, a
 * dangerous clean-out, or a man playing the ball on the floor out of a
 * tackle. The referee goes upstairs for foul play, and the outcome is the
 * modern process: red for the worst, yellow for most, and a penalty only
 * when there is mitigation (a carrier dipping, a late change of direction, a
 * man falling into the tackle, low danger). The penalty is kicked to touch.
 */
const TMO_FOUL_P = 0.0062
function tmoFoulTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number) {
  const r = incRng(ctx, tick, side, 0x7F01)
  const agg = onField(state, opp).reduce((s, p) => s + p.a.agg, 0) / Math.max(1, opp.onPitch.size)
  const p = TMO_FOUL_P * clamp(agg / 11, 0.6, 1.6) * (ctx.derby ? 1.3 : 1) * refFor(ctx.fx.id).cards
  if (r() >= p) return
  const k = r()
  const kind = k < 0.35 ? 'high' : k < 0.55 ? 'secondary' : k < 0.68 ? 'neckRoll' : k < 0.82 ? 'cleanout' : 'ballOnGround'
  const W: Partial<Record<Pos, number>> = kind === 'ballOnGround' ? { HK: 2, FL: 3, N8: 2, LK: 1 }
    : kind === 'cleanout' ? { LK: 3, LP: 2, TP: 2, HK: 1.5, FL: 1.5 } : { LK: 2, FL: 2, CE: 2, LP: 1, TP: 1, HK: 1, N8: 1 }
  const man = manFor(r, onField(state, opp), W, 0.8)
  if (!man) return
  const v = { team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId), player: man.name }
  withRng(ctx, r, () => {
    pushLine(state, ctx, min, 'SUB', opp, `comm.tmoFoul_${kind}`, v, man.id)
    const verdict = r()
    if (kind !== 'ballOnGround' && verdict < 0.05) {
      giveRed(state, ctx, opp, man, min, 'comm.rcTmo')
    } else if (verdict < 0.6) {
      giveYellow(state, ctx, opp, man, min, kind === 'ballOnGround' ? 'comm.ycBallOnGround' : 'comm.ycTmo')
    } else {
      const m = r()
      pushLine(state, ctx, min, 'SUB', opp, `comm.tmoMit_${m < 0.3 ? 'dip' : m < 0.55 ? 'fall' : m < 0.8 ? 'late' : 'low'}`, v, man.id)
    }
    concedePenalty(state, ctx, opp, min, null)
  })
  backTowards(ctx, opp, 12)
  side.pressure = clamp(side.pressure + 12, 0, 100)
}

/**
 * ---- HANDBAGS (item 42) ----
 *
 * A shove after the whistle becomes six men and a referee. Mostly nothing
 * comes of it; sometimes the man who started it is penalised, and now and
 * then he is in the bin. More of them in a derby or a grudge match, in a
 * tight finish, and between sides with short fuses. Once a tick, not per side.
 */
const SCUFFLE_P = 0.011
function scuffleTick(state: GameState, ctx: LiveCtx, tick: number, min: number) {
  const r = incRng(ctx, tick, null, 0x5C0F)
  const margin = Math.abs(ctx.home.score - ctx.away.score)
  const heat = (ctx.derby ? 2.2 : ctx.grudge ? 1.6 : 1) * (tick >= 15 && margin <= 10 ? 1.4 : 1)
  if (r() >= SCUFFLE_P * heat) return
  const aggOf = (s: SideCtx) => onField(state, s).reduce((t, p) => t + p.a.agg, 0) / Math.max(1, s.onPitch.size)
  const ha = aggOf(ctx.home), aa = aggOf(ctx.away)
  const inst = r() < ha / Math.max(1, ha + aa) ? ctx.home : ctx.away
  const other = inst === ctx.home ? ctx.away : ctx.home
  const man = manFor(r, onField(state, inst), { LK: 2, FL: 2, HK: 2, LP: 1.5, TP: 1.5, N8: 1, CE: 1 }, 1.2)
  if (!man) return
  const v = { team: teamShort(state, inst.teamId), opp: teamShort(state, other.teamId), player: man.name }
  pushLine(state, ctx, min, 'SUB', inst, `comm.scuffle${1 + Math.floor(r() * 3)}`, v, man.id)
  const o = r()
  if (o < 0.55) {
    pushLine(state, ctx, min, 'SUB', null, 'comm.scuffleNothing', v)
  } else {
    withRng(ctx, r, () => {
      pushLine(state, ctx, min, 'SUB', inst, 'comm.scufflePen', v, man.id)
      concedePenalty(state, ctx, inst, min, null)
      if (o >= 0.88) giveYellow(state, ctx, inst, man, min, 'comm.ycScuffle')
    })
    backTowards(ctx, inst, 10)
    other.pressure = clamp(other.pressure + 10, 0, 100)
  }
}

/** THE WATER BREAK (item 31): a hot afternoon stops at the quarters */
function waterBreak(state: GameState, ctx: LiveCtx, tick: number) {
  if (!ctx.hot || (tick !== 5 && tick !== 15)) return
  colour(state, ctx, null, `comm.waterBreak${tick === 5 ? 1 : 2}`, { home: teamShort(state, ctx.home.teamId), away: teamShort(state, ctx.away.teamId) })
}

/**
 * ---- THE WARM-UP WITHDRAWAL (item 55) ----
 *
 * A hamstring tightens in the warm-up and the team sheet changes an hour
 * before kick-off: the replacement who was named on the bench starts, and the
 * side plays with a bench one short. Never a front-rower (the scrum law has
 * its own rules), about one side in fifty, and the man who pulls out misses a
 * week.
 */
const WITHDRAW_P = 0.02
function lateWithdrawal(state: GameState, ctx: LiveCtx, side: SideCtx) {
  const r = incRng(ctx, -1, side, 0x1A7E)
  if (r() >= WITHDRAW_P) return
  const slot = 3 + Math.floor(r() * 12)
  const outId = side.lineup[slot]
  const out = outId != null ? state.players[outId] : null
  if (!out || !side.onPitch.has(out.id)) return
  const pos = XV_SLOTS[slot].pos
  let bIdx = -1
  for (let i = 15; i < side.lineup.length; i++) {
    const id = side.lineup[i]
    const b = id != null ? state.players[id] : null
    if (!b || b.injury) continue
    if (b.pos === pos || b.alt.includes(pos)) { bIdx = i; break }
    if (bIdx < 0 && isForward(b.pos) === isForward(pos) && !isFrontRower(b)) bIdx = i
  }
  if (bIdx < 0) return
  const b = state.players[side.lineup[bIdx] as number]
  side.lineup[slot] = b.id
  side.lineup[bIdx] = null
  side.onPitch.delete(out.id)
  side.onPitch.add(b.id)
  side.benchIds.delete(b.id)
  side.ratings.delete(out.id)
  side.ratings.set(b.id, 6)
  side.energy.delete(out.id)
  side.energy.set(b.id, benchTank(b))
  side.since?.delete(out.id)
  side.since?.set(b.id, 0)
  out.injury = { desc: tIn('en', 'injury.warmup'), dk: 'injury.warmup', until: state.week + 1, weeks: 1 }
  out.injLog = [...(out.injLog ?? []), { s: state.season, w: state.week, dk: 'injury.warmup', weeks: 1 }].slice(-20)
  recomputeSideUnits(state, ctx, side)
  pushLine(state, ctx, 0, 'SUB', side, 'comm.lateWithdrawal', { team: teamShort(state, side.teamId), player: out.name, sub: b.name }, b.id)
}

function simTick(state: GameState, ctx: LiveCtx, tick: number) {
  const { rng, detail, derby, goalPenalty, home, away } = ctx
  const min = tick * 4 + Math.floor(rng() * 4) + 1
  // the clock reaches this tick whether or not anybody writes a line in it
  // (1.8.0): a silent match used to stop its clock at its last written line,
  // so its sheet counted fewer minutes of scrums than the same match watched
  ctx.lastMin = Math.max(ctx.lastMin, Math.min(min, ctx.seg === 0 ? 40 : 80))
  const poss0: [number, number] = [home.poss, away.poss]

  // the bin empties: ten minutes served and the man comes back on, unless he
  // was replaced while he sat (his shirt no longer names him) or broke down
  for (const s of [home, away]) {
    if (!s.binned.size) continue
    for (const id of [...s.binned]) {
      if ((s.yellowUntil.get(id) ?? 0) > min) continue
      s.binned.delete(id)
      // Law 3: back from the bin to a shirt a front-row replacement wore
      const covered = frontRowCoverEnds(state, ctx, s, id, min)
      const p = state.players[id]
      if (!covered && p && !p.injury && s.lineup.slice(0, 15).includes(id)) s.onPitch.add(id)
      // Law 3: the man who went off with a binned front-rower comes back with him
      if (s.lawOut && s.lawOut.binned === id) {
        const o = state.players[s.lawOut.id]
        if (o && !o.injury && s.lineup.slice(0, 15).includes(o.id)) { s.onPitch.add(o.id); s.short = Math.max(0, s.short - 1) }
        s.lawOut = null
      }
    }
    /**
     * HE SERVED HIS TEN AND DID NOT COME BACK.
     *
     * The two `else` cases above are silent: a man who broke down while he sat,
     * and a man whose shirt was given away while he sat to somebody who is not
     * on the pitch either. In both the side finishes a man light and NOTHING
     * was charging for it - binned no longer holds him, his yellowUntil has
     * expired so numF has stopped counting him, and short never heard of him.
     * Fourteen men, priced as fifteen, for the rest of the match.
     *
     * This is the same hole the uncovered-injury path had (the `side.short`
     * charge further down, and its comment), one door along, and it is found
     * the same way: journeyprobe reconciling heads on the pitch against the
     * men the card accounts for. It surfaced when TRY_BASE moved, which is all
     * a seeded probe can ever tell you - the bug was always there, and the
     * dice had simply not walked into it.
     *
     * Reconciled rather than special-cased, because `short` IS this number:
     * players the side had to do without, and not a card in anybody's record.
     */
    // `binned` IS the answer to "who is still sitting", and yellowUntil is not:
    // the loop above deletes a man from the set the moment his ten minutes are
    // up, so anyone left in it never came back. Reading the clock instead gets
    // the final whistle wrong in both directions.
    const accounted = 15 - s.sent - s.short - s.binned.size
    if (s.onPitch.size < accounted) s.short += accounted - s.onPitch.size
  }
  // the men back from the bin are timed from now, and the net for anything
  // else that changed since the last tick (see fieldChanged). The XV that
  // walks out for the first tick is the one that started, whatever the
  // manager did to the sheet before kick-off.
  for (const s of [home, away]) {
    s.starters ??= new Set(s.onPitch)
    fieldChanged(state, ctx, s, min)
    const acc = (s.setAcc ??= { scrum: 0, lineout: 0, breakdown: 0, n: 0 })
    acc.scrum += s.units.scrum; acc.lineout += s.units.lineout; acc.breakdown += s.units.breakdown; acc.n += 1
  }
  // a sin-binned front-rower is back and the cover with him: the scrum is a
  // contest again, the levelling his card ordered taken back off both packs
  if (ctx.uncontested && ctx.uncontestedUndo && liveFrontRowCover(state, home) && liveFrontRowCover(state, away)) {
    layer(home, 'scrum', 1 / ctx.uncontestedUndo.home)
    layer(away, 'scrum', 1 / ctx.uncontestedUndo.away)
    ctx.uncontested = false
    ctx.uncontestedUndo = null
    pushLine(state, ctx, min, 'SUB', null, 'comm.contestedAgain')
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
  // CLOSED IN 1.8.0 for the part that matters: the band is unchanged for the
  // first hour and steeper from the 56th minute (LATE_FLOOR, below), which
  // is where replacements come on. scripts/subvalueprobe.ts: four changes
  // +1.27 points over none, eight +1.32 (were about 0 and -0.4), and
  // awardprobe's Player of the Month floor holds.
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
  // THE LAST QUARTER IS THE BENCH'S (1.8.0, owner: "subs should be
  // important"). The side-wide band above stays as it was for the first
  // hour - widening it everywhere was tried and reverted, see the note - and
  // from the 56th minute, where every replacement actually comes on, an
  // empty tank costs more: LATE_FLOOR at zero instead of 0.78.
  const eF = (s: SideCtx) => tick >= 14
    ? LATE_FLOOR + (1 - LATE_FLOOR) * (sideEnergy(s) / 100)
    : 0.78 + 0.22 * (sideEnergy(s) / 100)

  /**
   * ---- THE LINE MOVES (v1.8.0) ----
   *
   * One draw a tick. The better kicking game walks the game up the pitch, and
   * everything leaks back toward halfway because restarts, turnovers and the
   * simple fact of eighty minutes all pull it there - without that pull a
   * side with a marginally better boot would end every match camped on the
   * opposition line, which is not a rugby match, it is a slow ratchet.
   *
   * The noise is deliberately larger than the edge. Territory in rugby swings
   * on a single clearance or a single counter, and a field position that
   * crept predictably would make the boot a certainty rather than a bet.
   */
  /**
   * THE GAME PLAN FOR WHERE WE ARE (v1.8.0). Each side is in its own zone -
   * home's own 22 IS away's opposition 22 - so both are read, and each side's
   * plan pushes the line away from its own posts. A side kicking its exits
   * long and a side running them both get what they asked for, in opposite
   * directions, and the net is the tug of war it should be.
   */
  const planOf = (s: SideCtx) => {
    const up = s === home ? ctx.field : 100 - ctx.field
    const z = zoneAt(up)
    return zonePlan(z, state.clubs[s.teamId]?.tactic.zones?.[z])
  }
  // what each side sets out to do, read from where it is standing NOW
  const kickEdge = Math.log(home.units.kicking / Math.max(1, away.units.kicking))
  // and the styles' kicking games (1.8.2): a box-kick-and-chase side walks
  // the line up the pitch, as far as the other side's defence lets it
  const windy = ctx.weather === 'Wind'
  const styPush = (styleTerr(home.sty, away.sty, windy) - styleTerr(away.sty, home.sty, windy)) * STYLE_PULL
  const push = kickEdge * 7 + (rng() - 0.5) * 86 + (planOf(home).terr - planOf(away).terr) * ZONE_PULL + styPush
  ctx.field = clamp(ctx.field * 0.965 + 50 * 0.035 + push, 4, 96)
  // AND READ AGAIN AFTER THE LINE HAS MOVED. The push above is what a side
  // does FROM where it was; the scoring roll below happens WHERE IT ENDED UP,
  // and the terr factor under it reads that same new position. Deriving the
  // plan once, before the move, meant an exit plan could be scoring tries
  // from the halfway line.
  const hp = planOf(home)
  const ap = planOf(away)
  // where the game is, in words (watched only, and no draw on rng)
  describeState(state, ctx, tick)
  // the day's form showing, a hot afternoon's water break, and a scuffle
  describeDay(state, ctx, tick)
  waterBreak(state, ctx, tick)
  scuffleTick(state, ctx, tick, min)

  for (const [side, opp, adv] of [[home, away, ctx.hfa], [away, home, 1]] as [SideCtx, SideCtx, number][]) {
    // THE SECOND LAYER (E12, contest.ts): this tick's phase is a contest
    // between men - a carrier into a tackler, a jackal at the ruck - drawn
    // from the main dice (four draws, always, watched or not) and centred
    // on the world's average collision, so it decides who wins the carries
    // the units have earned without moving the season's scoring
    const contest = resolveContest(side, opp, state.players, rng, side === home ? ctx.hfa : 1 / ctx.hfa)
    // the rugby this side plays in the tick, before what it comes to
    describePlay(state, ctx, side, opp, contest)
    // THE CALLED MOVE (1.8.1, moves.ts): what this tick was launched from,
    // and the move called for it. Null for a side with no call there, which
    // leaves every number below exactly as it was.
    const mv = moveInPlay(state, ctx, side, opp, tick)
    if (mv) describeMoveCall(state, ctx, side, opp, mv)
    const mvTry = mv ? 1 + mv.gain : 1
    const mvPen = mv ? 1 + mv.gain * 0.5 : 1
    // THE STYLES (1.8.2, styles.ts): this side's attack into their defence,
    // the line breaks it makes, the gain line it wins and the turnovers it
    // risks. Exactly neutral for a side without a club. No draw.
    const st = styleTick(side.sty, opp.sty, {
      attSet: side.units.scrum + side.units.lineout, defSet: opp.units.scrum + opp.units.lineout,
      attack: side.units.attack, defence: opp.units.defence,
    }, styleWx(ctx.weather, ctx.surface))
    // sure hands in the backs (habits.ts) hold on to more of it
    st.turnP *= side.handsF ?? 1
    side.fwdF = clamp(st.turnP / TURN_BASE, 0.5, 2)
    describeStyle(state, ctx, side, opp, st)
    const scores0 = side.score + opp.score
    // A MAN DOWN COSTS WHAT IT COSTS (1.8.16, coverage list item 35): at 7%
    // a man, a yellow card was worth 2.8 net points to the other side over
    // its ten minutes (incidentprobe), well short of the professional game's
    // figure of about five. MAN_DOWN is the share of the side's strength each
    // missing man takes.
    const numF = 1 - MAN_DOWN * ([...side.yellowUntil.values()].filter(u => u > min).length + side.sent + side.short)
    const oppNumF = 1 - MAN_DOWN * ([...opp.yellowUntil.values()].filter(u => u > min).length + opp.sent + opp.short)
    // the breakdown dials (1.7.3): your commitment protects your own ball, and
    // their contest attacks it - both exactly 1 when nobody has touched them
    const att = (side.units.attack * 0.55 + side.units.breakdown * 0.25 * (side.ruckSecure ?? 1) + side.units.scrum * 0.1 + side.units.lineout * 0.1) * eF(side)
    const def = (opp.units.defence * 0.7 + opp.units.breakdown * 0.3 * (opp.ruckContest ?? 1)) * eF(opp)
    /**
     * THE BOOT IS TERRITORY (audit 16D), AND TERRITORY IS NOW A PLACE (v1.8.0).
     *
     * This used to be the kicking ratio applied straight to the scoring
     * chance: a side with the better boot got a permanent invisible edge. It
     * is now the position that boot has WON - ctx.field above - and the
     * kicking ratio only moves the line.
     *
     * EXACTLY RECIPROCAL between the two sides, which is the property the
     * original was built around and the reason the world mean cannot move:
     * whatever this multiplies one side's chance by, it divides the other's
     * by the same. A line at halfway is 1.0 for both. At their 22 it is
     * about 1.29 for the side attacking and 0.78 for the side defending, and
     * camped on their line (the clamp at 96) 1.89 against 0.53, which through
     * the ratio's power of 2.6 is about five times the try chance before the
     * 0.42 cap: being pinned in your own 22 is not a small disadvantage, and
     * it was previously not a disadvantage at all.
     */
    const up = side === home ? ctx.field : 100 - ctx.field
    const terr = Math.pow(up / Math.max(1, 100 - up), 0.20)
    // what this side chose to do in the zone it is standing in
    const plan = side === home ? hp : ap
    /**
     * HOW WIDE THE PENALTY WINDOW IS, worked out ONCE (v1.8.0).
     *
     * The discipline a zone plan buys belongs to the side GIVING the penalty
     * away, which is the opposition here, so it reads their plan and not this
     * side's. And it is a `const` because the first cut scaled it inline in
     * the penalty branch and left the drop-goal branch below reading the raw
     * figure - which turned the gap between the two into drop-goal territory
     * and would have made a side playing for the corner kick five times as
     * many of them.
     */
    // WHERE PENALTIES ARE GIVEN AWAY (1.7.4). A side defending its own half
    // gives away more of them than one pressing in the other: that is where
    // the pressure is. Kicks at goal are now confined to the opposition half
    // (below), so the chance leans with territory - (up/50)^PEN_LEAN, 1 at
    // halfway - rather than sitting flat across the field.
    // THE SCRUM WINS PENALTIES (1.8.0, ladderprobe). A pack that goes
    // forward at the scrum is where a real side's penalties come from, and
    // here the scrum decided almost nothing: +4 scrummaging across a squad
    // was worth 0.06 points a match. So the side whose scrum is on top draws
    // more of them, bounded, and reciprocal between the two packs so the
    // world's count of penalties does not move.
    const scrumEdge = Math.pow(clamp(side.units.scrum / Math.max(1, opp.units.scrum), 0.8, 1.25), 0.8)
    const penWindow = opp.penRisk * (side === home ? ap : hp).penF * Math.pow(up / 50, PEN_LEAN) * scrumEdge * (contest?.penF ?? 1) * mvPen * st.penF
    let ratio = ((att * adv * numF * terr) / Math.max(1, def * oppNumF))
    if (derby) ratio = Math.pow(ratio, 0.72) // form book out the window
    else if (ctx.grudge) ratio = Math.pow(ratio, 0.85) // needle levels the contest
    side.poss += ratio
    let pTry = clamp(TRY_BASE * Math.pow(ratio, 2.6) * (1 + (plan.tryF - 1) * (side.exec ?? 1)) * (contest?.tryF ?? 1) * mvTry * st.tryF, 0.01, 0.42)
    // THE LAST QUARTER OPENS UP (audit 16D). Measured before this existed:
    // tries were dead flat across the 80 (11.6-14.0% per ten-minute bucket)
    // because both sides drain together and the mutual exhaustion cancels in
    // eF. Real rugby scores roughly a third of its tries after the hour -
    // tired defences miss first. So from tick 15 the shared fatigue itself
    // raises the try chance for BOTH sides; TRY_BASE is set below what the
    // old flat constant was so the season's totals stay on the band.
    if (tick >= 15) {
      /**
       * THE TIRED SIDE IS THE ONE DEFENDING (v1.8.0). This read the AVERAGE
       * of the two tanks, which quietly meant a side raised its own try
       * chance by exhausting itself - and the release audit's own words for
       * the mechanism are "tired defences miss first", not "tired attacks
       * score more". It survived because both sides drain together, so the
       * average and the opponent's figure are nearly the same number all
       * afternoon; it only parts company when the two diverge, which is
       * exactly the case 1.2d exists to test. Measured there: a side emptied
       * from the 68th minute outscored the same side rested, 36.1 to 35.0.
       *
       * In an ordinary match this changes almost nothing, for the same
       * reason it hid for so long.
       */
      const tired = 1 - sideEnergy(opp) / 100
      // AND A TIRED ATTACK GOES NOWHERE (1.8.0, owner: "if a team is tired
      // then they shouldn't score more they should be easier to score
      // against. Subs should be important"). Measured on the 1.2d scenario
      // over the last twelve minutes only, with the first 68 identical: an
      // emptied side already scored less (4.92 v 5.55) and conceded more
      // (3.86 v 3.13), but by too little to feel. The tired defence now
      // gives up to 80% more (was 50%) and a tired attack loses up to 30%,
      // so the bench is where a last quarter is won.
      const own = 1 - sideEnergy(side) / 100
      pTry = Math.min(0.42, pTry * (1 + Math.max(0, tired) * TIRED_DEF) * (1 - Math.max(0, own) * TIRED_ATT))
    }
    // GARBAGE TIME IS REAL (user, after a 106-3 win at a top club: "this would
    // be a tight game in real life - the scores feel well off at present").
    // Past five converted tries of lead nobody keeps the hammer down: the
    // fly-half kicks the corners, the bench gets its run, the skipper points
    // at the posts. The damp sits on the LEADING side's try chance only, so a
    // close game never feels it; the floor keeps a true mismatch a rout
    // rather than a cricket score. Same rng draws either way - the stream is
    // untouched, only the threshold the roll is compared against moves.
    // 1.8.0: the damp starts at 28 rather than 35 and bottoms lower. Territory
    // and the advantage law both add tries at the top of the range, and
    // blowprobe caught the result - two top clubs reached 63, past its stated
    // ceiling of 60 - while the median margin (15) and the 90th percentile
    // (31) had barely moved. A damp that only engages five converted tries in
    // is a damp that never sees the games it exists for.
    const lead = side.score - opp.score
    // 1.8.16: the damp steepens with the lead (power 1.4, floor 0.2). The
    // narrower execution factor made a strong side strong every week rather
    // than most weeks, and blowprobe's mismatch tail went from 34 to 49 in
    // 20,000 past 90. Below 28 up nothing changes; at 56 up the leading side
    // keeps 38% of its chance rather than 50%.
    if (lead > 28) pTry *= Math.max(0.2, Math.pow(28 / lead, 1.4))

    /**
     * PRESSURE (v1.7.0), read off this tick and never rolled for. It decays
     * toward the level this side's threat deserves - a team carving the
     * defence open sits high even between scores, a team pinned in its 22
     * sinks - and the things that actually happen below spike it on top. The
     * decay is what makes it read as MOMENTUM rather than as a stat: a spell
     * of pressure that comes to nothing bleeds away over the next few ticks,
     * the way it does when you are watching.
     */
    side.xTry = (side.xTry ?? 0) + pTry
    evTick(side, opp, pTry, up, mv, st, contest)
    const floor = clamp(pTry * 190, 4, 62)
    side.pressure = clamp(side.pressure * 0.72 + floor * 0.28, 0, 100)

    const r = rng()
    if (r < pTry) {
      side.pressure = clamp(side.pressure + 42, 0, 100)
      opp.pressure = clamp(opp.pressure * 0.55, 0, 100)
      ctx.moveTry = moveTryOf(state, ctx, side, mv, tick)
      // what the try is put down to (EV_CAUSES, in that order)
      ctx.evWhy = ctx.moveTry ? 'move' : evOf(side).lastTurn >= tick - 1 ? 'turn' : pTry >= BREAK_P ? 'break' : 'phase'
      const tries0 = side.tries
      scoreTry(state, ctx, side, min)
      if (ctx.moveTry && side.tries > tries0) {
        const c = evOf(side).calls[ctx.moveTry.id]
        if (c) c[2] += 1
      }
      ctx.moveTry = null
      ctx.evWhy = null
    } else if (r < pTry + penWindow) {
      // a penalty won is a side on the front foot, whatever it does with it
      side.pressure = clamp(side.pressure + 17, 0, 100)
      opp.pressure = clamp(opp.pressure * 0.86, 0, 100)
      // a kickable penalty: yours is a touchline decision, theirs is automatic.
      // THE REFEREE CAN CHANGE HIS MIND, AND A DEFENCE CAN KILL IT (1.8.16):
      // a reversed penalty is the other side's; a cynical one near the line
      // is a card, and within a few metres a penalty try. Either way the
      // advantage draw below is still taken, so the stream after it is where
      // it always was.
      const reversed = reversedPenalty(state, ctx, side, opp, min, tick)
      if (!reversed) concedePenalty(state, ctx, opp, min)
      const cyn = reversed ? null : cynicalIncident(state, ctx, side, opp, min, tick, up, pTry)
      /**
       * ---- ADVANTAGE (design review, v1.6.7) ----
       *
       * The arm goes out and the whistle stays down. Until now it did not:
       * a penalty was awarded and the game stopped dead, which is not how any
       * professional match is refereed and which quietly removed one of the
       * sport's most recognisable moments - the side that takes the space,
       * gets no reward, and hears "advantage over" with three points gone.
       *
       * Three outcomes, one draw:
       *
       *   a try under the advantage      the kick is irrelevant, they scored
       *   advantage over, nothing in it  ground was made, the penalty is gone
       *   back for the penalty           much the most common, and unchanged
       *
       * The try chance rides pTry, so a side already carving the defence open
       * is the side likeliest to make something of it, and the referee's own
       * `flow` governs how readily he waves it away: the same panel that makes
       * one afternoon a stop-start scrum-fest and another a loose one.
       *
       * The infringement still counts against the offending side whatever
       * happens next. Advantage does not pardon anything - the count climbs,
       * and if it has reached the referee's patience the card has already been
       * issued above, exactly as it would be at the next stoppage.
       */
      const advRoll = rng()
      // DELIBERATELY MODEST, because only KICKABLE penalties reach this code
      // (opp.penRisk is the kickable rate). Those are the ones a referee is
      // most careful to bring back, since three points are sitting there. At
      // a quarter of them the penalty mix collapsed from a fifth of the
      // world's points to a seventh; at an eighth it reads right, and the
      // moment is still on the ticker most weeks.
      const pAdvTry = Math.min(0.10, pTry * 0.42)
      const pAdvOver = 0.08 * refFor(ctx.fx.id).flow
      if (reversed || cyn === 'pt') {
        // nothing more to play for: the penalty went the other way, or the
        // seven points are already on the board
      } else if (advRoll < pAdvTry) {
        // they did not need the three: the arm was still out when they scored
        if (detail) pushLine(state, ctx, min, 'SUB', side, 'comm.advPlaying', { team: teamShort(state, side.teamId) })
        ctx.evWhy = 'pen'
        scoreTry(state, ctx, side, min)
        ctx.evWhy = null
      } else if (advRoll < pAdvTry + pAdvOver) {
        // ground made, nothing at the end of it, and the kick is gone with it
        if (detail) pushLine(state, ctx, min, 'SUB', side, 'comm.advOver', { team: teamShort(state, side.teamId) })
      } else if (up < 50) {
        // OUT OF RANGE: KICK FOR TOUCH (1.7.4, owner: "kicks at goal should be
        // limited to within the opposition teams halfway"). A penalty in your
        // own half is not a shot at goal, so nobody is asked and nobody lines
        // one up: the kicker finds touch and the lineout is further up the
        // field. How far is the boot's, with no draw on the stream.
        // the line first, so it is stamped where the penalty was given
        if (detail) pushLine(state, ctx, min, 'SUB', side, 'comm.penTouchOwnHalf', { team: teamShort(state, side.teamId) })
        const gain = 14 + Math.min(12, side.units.kicking * 0.8)
        ctx.field = side === home ? clamp(ctx.field + gain, 4, 96) : clamp(ctx.field - gain, 4, 96)
      } else {
        // NO SCORE AND NO GROUND: he brings it back. This is the common case,
        // and from here the code below is exactly what it always was.
        //
        // A standing instruction answers the call for you (F3). Being asked
        // every time is the right default on a big screen and a nuisance on a
        // phone during a nine-penalty afternoon, so the choice is the manager's.
        const standing = state.clubs[side.teamId]?.tactic.penaltyCall ?? 'ask'
        if (side.isUser && !ctx.decision) {
          ctx.decision = { kind: 'penalty', min, fld: ctx.field }
          if (standing === 'ask') {
            // WATCHED OR NOT, THE CALL WAITS FOR THE END OF THE TICK (1.8.1).
            // A silent match used to kick at once while a watched one held
            // the call and let the rest of the tick draw first, so the same
            // match took its dice in a different order depending on whether
            // anybody was looking. Held here either way; with nobody to ask,
            // playSegment answers 'posts' where a skip would. Silent, the line
            // is not written but still moves the clock (pushLine).
            pushLine(state, ctx, min, 'SUB', side, 'comm.penKickableAsk', { team: teamShort(state, side.teamId) })
          } else {
            // resolveDecision reads ctx.decision and works out the side itself,
            // so the instruction goes through exactly the path a tap would take.
            // THE STANDING CALL HOLDS ON AN INSTANT RESULT TOO (1.8.0): found
            // by scripts/optionsprobe.ts, where corner and tap had changed
            // nothing in a match nobody watched.
            resolveDecision(state, ctx, standing)
          }
        } else if (!side.isUser) {
          // THE AI MAKES THE CALL TOO (owner, 1.8.16: "they should also go to
          // the corner"). It used to kick every penalty at goal.
          const call = aiPenaltyCall(state, ctx, side, opp, min)
          if (call === 'posts') takePenaltyShot(state, ctx, side, min)
          else {
            const was = ctx.evWhy
            ctx.evWhy = 'pen'
            if (call === 'corner') kickToCorner(state, ctx, side, opp, min)
            else tapAndGo(state, ctx, side, opp, min)
            ctx.evWhy = was
          }
        } else {
          takePenaltyShot(state, ctx, side, min)
        }
      }
    } else if (r < pTry + penWindow + dropChance(ctx, side, opp, up, tick)) {
      dropGoalAttempt(state, ctx, side, min, up)
    }

    // A MOVE THAT CAME TO NOTHING STILL MOVED THE BALL (moves.ts): one that
    // came off won the gain line and the ground with it; one that misfired
    // was caught behind it, and a risky one gives away more. No draw.
    if (mv && r >= pTry + penWindow && side.score + opp.score === scores0) {
      const m = mv.gain >= 0 ? mv.gain * 20 : mv.gain * 40 * mv.risk
      backTowards(ctx, side, -m)
      describeMoveOutcome(state, ctx, side, opp, mv)
    }

    // THE STYLE, WHEN THE TICK CAME TO NOTHING (1.8.2): a direct side still
    // won a little of the gain line, and any side can be turned over - an
    // offload that goes to ground, a flat pass picked off, a carrier held up
    // in the choke tackle. On a hash, never a draw, as the moves' ground is
    // (above): of the world, the fixture and the two sides as well as the
    // tick, because a fixture's id alone repeats from world to world (every
    // new career's first fixture is the same number) and the same ticks
    // would be turned over in all of them.
    if (r >= pTry + penWindow && side.score + opp.score === scores0 && side.sty && opp.sty) {
      if (st.ground) backTowards(ctx, side, -st.ground)
      if (moveHash(styleSalt(state, ctx), tick, side === home ? 3 : 4, 0x57) < st.turnP) {
        // where it was lost, for the evidence, before the line moves
        const z = zoneIdx(upOf(ctx, side))
        evOf(side).turnLost[z] += 1
        const eo = evOf(opp)
        eo.turnWon[2 - z] += 1
        eo.lastTurn = tick
        backTowards(ctx, side, TURN_M)
        opp.styTurnWon = (opp.styTurnWon ?? 0) + 1
        side.styTurnLost = (side.styTurnLost ?? 0) + 1
        describeTurnover(state, ctx, side, opp, st)
      }
    }

    // THE AFTERNOON'S INCIDENTS (1.8.16), each on its own dice: when the
    // tick came to nothing, held up over the line close in or a pass picked
    // off further out; and whatever the tick was, the set piece's short arm,
    // the throw that is not straight, and the TMO calling back foul play
    if (r >= pTry + penWindow && side.score + opp.score === scores0) {
      if (!heldUpTick(state, ctx, side, opp, min, tick, up)) interceptTick(state, ctx, side, opp, min, tick, up)
    }
    setPieceTick(state, ctx, side, opp, min, tick)
    tmoFoulTick(state, ctx, side, opp, min, tick)

    // the kicks from hand this side puts in, and any that are charged down
    kicksFromHand(state, ctx, side, opp, min, tick)
    // and when nothing came of the tick, a word for the side that stopped it
    if (side.score + opp.score === scores0) describeDefence(state, ctx, opp, side, contest)

    // atmosphere lines for the live ticker
    if (detail && ctx.crng() < 0.3) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(Boolean)
      if (ps.length) {
        const p = ps[Math.floor(ctx.crng() * ps.length)]
        const e = side.energy.get(p.id) ?? 70
        if (e < 22 && ctx.crng() < 0.5) {
          pushLine(state, ctx, min, 'SUB', side, TIRED_LINES[Math.floor(ctx.crng() * TIRED_LINES.length)], { player: p.name }, p.id)
        } else {
          const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow'
          const pool = ctx.crng() < 0.035 ? FLAVOR_FUN
            : derby && ctx.crng() < 0.3 ? FLAVOR_DERBY
            : ctx.fx.compId === 'natl1' && ctx.crng() < 0.3 ? FLAVOR_GRASSROOTS
            : ctx.fx.compId === 'pnc' && ctx.crng() < 0.3 ? FLAVOR_PACIFIC
            : wet && ctx.crng() < 0.3 ? FLAVOR_WET
            : ctx.weather === 'Wind' && ctx.crng() < 0.25 ? FLAVOR_WIND
            : FLAVOR
          let key = styledKick(pool[Math.floor(ctx.crng() * pool.length)], state.clubs[side.teamId]?.tactic.kickStyle)
          // a line that names a man for a hit names one the tackle count
          // already has making hits: it describes the count, it does not add
          // to it (it used to add one, so a watched match's sheet had more
          // tackles than the same match played silently)
          let who = p
          if (TACKLE_LINES.has(key)) {
            const hitters = ps.filter(q => (side.tackles?.get(q.id) ?? 0) > 0)
            if (hitters.length) who = hitters[Math.floor(ctx.crng() * hitters.length)]
            else key = FLAVOR[0]
          }
          pushLine(state, ctx, min, 'SUB', side, key,
            { player: who.name, team: teamShort(state, side.teamId) }, who.id)
        }
      }
    }

    // discipline - tired sides give away more
    const tiredCards = sideEnergy(side) < 35 ? 1.25 : 1
    // CARD_SHARE (1.8.16): the professional foul, the TMO's foul-play call
    // and the scuffle now give their own cards for their own reasons, so the
    // card that comes from nowhere comes a little less often
    if (rng() < side.cardRisk * tiredCards * CARD_SHARE) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(Boolean)
      if (ps.length) {
        const p = wpick(rng, ps, ps.map(x => x.a.agg))
        // A RED CARD IS FOR THE MATCH (owner, 16 Sep 2026): the elite game is
        // trialling a twenty-minute replacement, and this engine keeps the
        // permanent sending-off by decision, not by omission (RED-CARD-01).
        if (rng() < 0.06) {
          side.sent += 1
          side.onPitch.delete(p.id)
          p.stats.rc += 1
          p.bans += 2 + Math.floor(rng() * 2)
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
          pushLine(state, ctx, min, 'RC', side, 'comm.redCard', { player: p.name }, p.id)
          checkFrontRow(state, ctx, side, min, p, 'red')
        } else if (side.onPitch.size > 13 && !side.yellowUntil.has(p.id)) {
          // NEVER BELOW THIRTEEN FOR A YELLOW (1.8.3): the repeated-penalty
          // bin has always stopped at thirteen on the pitch (concedePenalty)
          // and this one did not, so a side already two down could lose a
          // third. Same floor here; the draws above are taken either way, so
          // the stream does not move, only the card that is no longer shown.
          side.yellowUntil.set(p.id, binUntil(ctx, min))
          // he SITS the ten minutes: off the pitch pools, so a man in the bin
          // cannot score a try, take another card or pull an injury while he
          // sits (audit 16D). numF still charges the missing man's strength.
          side.onPitch.delete(p.id)
          side.binned.add(p.id)
          p.stats.yc += 1
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
          // and it says what it was for (item 26 among them), words only
          pushLine(state, ctx, min, 'YC', side, ctx.detail ? said(ctx, YC_REASONS) : 'comm.yellowCard', { player: p.name, team: teamShort(state, side.teamId) }, p.id)
          checkFrontRow(state, ctx, side, min, p, 'yellow')
        }
        fieldChanged(state, ctx, side, min)
      }
    }

    // injury - tired legs and rusty returners break down more.
    //
    // THE HOME SURFACE TERM IS GONE (v1.8.1). It read the pitch facility,
    // which is the TRAINING pitch now: a match is played at the ground, not
    // on the field the squad does its ruck work on, so a training pitch
    // cannot keep anybody on their feet on a Saturday. What it does keep
    // people on their feet through is TRAINING, and that is where the term
    // has moved to (season.ts, the Tuesday session).
    // CONTACT AND THE GROUND (conditions.ts injuryF): the carrying game and
    // the rush defence that meets it, on a hard pitch, take a bigger share of
    // the roll; centred on the world, so it shifts who is hurt more than how
    // many. The draw is the same draw; only what it is compared with moves.
    // (1.8.14: 0.043, from 0.036. Losing six first-choice men for nine weeks
    // moved the strongest club in France from 1.83rd to 2.0th: a big squad
    // shrugged off a crisis. A fifth more knocks makes depth a decision.
    // Same draw, a different threshold.)
    if (rng() < 0.043 * injuryF(side.sty, opp.sty, ctx.surface ?? 'hybrid')) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(p => p && !p.injury)
      if (ps.length) {
        const w = ps.map(p => {
          const rustF = (p.rust ?? 0) > 0 ? 3.4 : 1
          const tiredF = (side.energy.get(p.id) ?? 70) < 25 ? 1.8 : 1
          const loadF = inRedZone(p) ? 1.5 : 1 // 1,300+ season minutes
          // a brittle man tired or rushed back is likelier to be the one
          // (formtraits.ts): it chooses who, the roll above decides how often
          return rustF * tiredF * loadF * brittleF(state.seed, p, tiredF > 1)
        })
        const p = wpick(rng, ps, w)
        const [dk, lo, hi] = pickInjury(rng, genderOf(state))
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
          p.injLog = [...(p.injLog ?? []), { s: state.season, w: state.week, dk, weeks }].slice(-20)
          side.onPitch.delete(p.id)
          pushLine(state, ctx, min, 'INJ', side, 'comm.injuryDown', {
            player: p.name, injury_k: dk,
            rush_k: (p.rust ?? 0) > 0 ? 'comm.injuryRushedBack' : 'common.nothing',
          }, p.id)
          // with the bench spent, a replaced front-rower may come back for an
          // injured one (Law 3.35) - on the legs he left with, not fresh ones
          const back = pickBenchSub(state, side, p.id) == null && isFrontRower(p) ? returningFrontRower(state, side) : null
          const sub = back ?? pickBenchSub(state, side, p.id)
          if (sub) {
            side.onPitch.add(sub.id)
            cameOn(side, sub.id, min)
            if (!back) side.ratings.set(sub.id, 6)
            side.energy.set(sub.id, back ? Math.min(benchTank(sub), side.energy.get(sub.id) ?? benchTank(sub)) : benchTank(sub))
            const slot = side.lineup.indexOf(p.id)
            const bSlot = side.lineup.indexOf(sub.id)
            if (slot >= 0 && slot < 15) {
              side.lineup[slot] = sub.id
              if (bSlot >= 0) side.lineup[bSlot] = p.id
            }
            if (back) {
              pushLine(state, ctx, min, 'SUB', side, 'comm.frontRowReturns', { player: sub.name }, sub.id)
            } else {
              const brief = applyBrief(state, side, sub.id)
              pushLine(state, ctx, min, 'SUB', side, 'comm.subComesOn',
                { player: sub.name, brief_k: brief ?? 'common.nothing' }, sub.id)
            }
            // and if the bench had nobody who plays there, the side pays (F4)
            forcedSwitchCost(state, ctx, side, p.id, sub, min)
          } else {
            // NOBODY LEFT TO SEND ON. The bench is spent, so the side finishes
            // the match a man down - and until this line existed, that cost it
            // nothing at all. The commentary said fourteen; numF, which is the
            // only place the missing man is charged for, counted yellows, red
            // cards and Law 3.20 and knew nothing about an uncovered injury.
            // So a side could play twenty minutes with fourteen men and be
            // exactly as strong as one with fifteen.
            //
            // Found by scripts/journeyprobe.ts reconciling the men on the pitch
            // against the men the card accounted for, in a Bristol side that
            // lost a man at 72 minutes with an empty bench. Charged as `short`
            // because that is what short means: a player the side had to do
            // without, and not a card in anybody's record.
            side.short += 1
          }
          checkFrontRow(state, ctx, side, min, p, 'injury', !!sub)
          fieldChanged(state, ctx, side, min)
          side.lastInj = { hurtId: p.id, coverId: sub && !back ? sub.id : null, upTo: ctx.events.length }
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
          const rtp = 2 + (((pid + ctx.tick) % 2)) // return-to-play: two or three weeks
          // desc + dk, like every other injury written in this file: desc is
          // the stored-English fallback, dk is what a French screen renders.
          // This line used to store the bare English string, so a failed HIA
          // was the one complaint on the Medical screen that ignored the
          // reader's language (release audit, 25 Aug).
          p.injury = { desc: tIn('en', 'injury.hiaFail'), dk: 'injury.hiaFail', until: state.week + rtp, weeks: rtp }
          p.injLog = [...(p.injLog ?? []), { s: state.season, w: state.week, dk: 'injury.hiaFail', weeks: rtp }].slice(-20)
          const slot = side.lineup.indexOf(pid)
          const bSlot = side.lineup.indexOf(subId)
          if (slot >= 0 && slot < 15) { side.lineup[slot] = subId; if (bSlot >= 0) side.lineup[bSlot] = pid }
          pushLine(state, ctx, min, 'INJ', side, 'comm.hiaFailed', { player: p.name, sub: sub.name }, pid)
          checkFrontRow(state, ctx, side, min, p, 'hia')
        } else if (side.onPitch.has(subId)) {
          side.onPitch.delete(subId)
          side.onPitch.add(pid)
          pushLine(state, ctx, min, 'SUB', side, 'comm.hiaPassed', { player: p.name }, pid)
        } else if (side.binned.has(subId)) {
          // THE STAND-IN IS IN THE BIN. The side is a man down for the card
          // whoever the man is: the assessed man takes the rest of the ten
          // minutes' place (he comes on when the bin ends) and the stand-in
          // goes back to the bench. Swapping him straight on made sixteen
          // when the bin emptied (journeyprobe: 15 on and 1 binned at FT).
          side.binned.delete(subId)
          side.binned.add(pid)
          side.yellowUntil.set(pid, side.yellowUntil.get(subId) ?? min)
          pushLine(state, ctx, min, 'SUB', side, 'comm.hiaPassed', { player: p.name }, pid)
        }
        // otherwise the stand-in has already gone (sent off, or hurt and
        // replaced himself): the place he held is spoken for, so the assessed
        // man stays on the bench rather than make a sixteenth
      }
      side.hia = undefined
      fieldChanged(state, ctx, side, min)
    }
    if (!side.hia && rng() < 0.0085) {
      const ids = [...side.onPitch].filter(id => state.players[id] && !state.players[id].injury)
      const p = ids.length ? state.players[ids[Math.floor(rng() * ids.length)]] : null
      const sub = p ? pickBenchSub(state, side, p.id) : null
      if (p && sub) {
        side.onPitch.delete(p.id)
        side.onPitch.add(sub.id)
        cameOn(side, sub.id, min)
        side.ratings.set(sub.id, 6)
        side.energy.set(sub.id, benchTank(sub))
        side.hia = { pid: p.id, subId: sub.id, failed: rng() < 0.4, returnTick: ctx.tick + 3 }
        // the smart mouthguard flags more of them than the eye does now
        // (item 56): which of the two lines is said is words only
        pushLine(state, ctx, min, 'INJ', side, ctx.detail && ctx.crng() < 0.4 ? 'comm.hiaMouthguard' : 'comm.hiaLedAway', { player: p.name, sub: sub.name }, p.id)
        fieldChanged(state, ctx, side, min)
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
  countTackles(state, ctx, tick, dh, da)
  ctx.momo = clamp(ctx.momo * 0.62 + (dh - da) * 0.55, -1, 1)
  // rolling possession history: each entry is the home share of one tick,
  // so the live 'LAST 10 MINUTES' graphic can average the recent window
  ;(ctx.momoHist ??= []).push(dh + da > 0 ? dh / (dh + da) : 0.5)
  // and the scoreboard at the end of it, for the lead changes (evidence.ts)
  ;(ctx.marginHist ??= []).push(home.score - away.score)
}

/**
 * Simulate the next 4-minute tick. Returns what the clock hit:
 * 'play' (normal), 'HT' (40'), 'BRK' (60'), 'FT' (80', match finalised).
 * At HT/BRK the context waits (`awaiting`) until resumed.
 */
/**
 * Blow half time: the whistle line, the interval numbers, and the break.
 *
 * Split out of stepTick so it can fire LATER than the tick that reached 40'.
 * A penalty awarded in the closing minutes is still the manager's to answer,
 * and the answer cannot arrive before stepTick returns - so when a call is
 * outstanding the clock reaches the whistle and the whistle waits.
 */
function blowHalfTime(state: GameState, ctx: LiveCtx) {
  ctx.heldWhistle = null
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
  if (ctx.userSideId) {
    const ev = buildEvidence(state, ctx)
    if (ev) ctx.htEv = ev
    ctx.htDials = userDials(state, ctx)
  }
}

/** Blow full time. Same deal: seg only reaches 3 - which is what every caller
 *  reads as "the match is over" - once the last call of the match is in. */
function blowFullTime(state: GameState, ctx: LiveCtx) {
  ctx.heldWhistle = null
  ctx.seg = 3
  ctx.awaiting = null
  finalizeMatch(state, ctx)
}

export function stepTick(state: GameState, ctx: LiveCtx): 'play' | 'HT' | 'BRK' | 'FT' {
  if (ctx.tick >= 20) return 'FT'
  // play has resumed: the last substitution has now been played and cannot be
  // taken back (16B), and no whistle is waiting on anything
  ctx.lastSub = null
  ctx.whistleAt = null
  // the dials the second half kicks off with, against the half-time read
  if (ctx.tick === 10 && ctx.htEv && !ctx.shDials) ctx.shDials = userDials(state, ctx)
  simTick(state, ctx, ctx.tick)
  ctx.tick += 1
  aiTacticShift(state, ctx)
  if (ctx.tick === 10) {
    ctx.seg = 1
    // THE WHISTLE WAITS FOR THE KICK. A penalty awarded in the closing minutes
    // is still to be taken, so the half has not ended: nothing is narrated and
    // the interval does not open until resolveDecision blows it. seg moves to
    // 1 either way - that only means "second half next", and it is what keeps
    // the decision panel on screen instead of the interval.
    if (ctx.decision) ctx.heldWhistle = 'HT'
    else blowHalfTime(state, ctx)
    return 'HT'
  }
  if (ctx.tick === 15) {
    ctx.seg = 2
    ctx.awaiting = 'BRK'
    pushLine(state, ctx, 60, 'BRK', null, 'comm.hourMark')
    return 'BRK'
  }
  if (ctx.tick === 20) {
    // Same at the end. seg stays at 2 while a call is outstanding, because
    // every caller reads seg === 3 as "finished" - the store settles knockout
    // ties on it, the screen shows the full-time panel on it - and the match
    // is not finished while a kick that can change the result is unanswered.
    if (ctx.decision) ctx.heldWhistle = 'FT'
    else blowFullTime(state, ctx)
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

/** The setting a talk is read against: how the two XVs compare on paper (the
 *  preview's numbers, no match-day fog), where, how big, and at the break the
 *  scoreline. The MatchDay preview builds the same thing from the same calls,
 *  so the room the manager reads is the room the engine hears. */
function talkSettingFor(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, margin?: number): TalkSetting {
  return talkSetting(paperOverall(state, mine.teamId, mine.lineup), paperOverall(state, opp.teamId, opp.lineup),
    mine === ctx.home, !!ctx.fx.stage || ctx.derby, margin)
}

/** How much of the room is listening, 0..1: trust earned here times the
 *  standing a name brings (authority.ts). */
export function talkListen(state: GameState): number {
  return Math.max(0, Math.min(1, (trustFactor(state) - 0.45) / 0.55 * standing(state).talk))
}

/** Every line a tone can open with, chosen by a hash (never the match rng). */
const TALK_LINES = 2
function talkLine(state: GameState, ctx: LiveCtx, tone: string, half: 'pre' | 'ht', verdict: string): string {
  const n = (hashString(`${state.seed}:${ctx.fx.id}:${half}:${tone}`) % TALK_LINES) + 1
  return `${t(`tt.${half}_${tone}${n}`)} ${t(`tt.verdict_${verdict}`)}`
}

/** Fold a talk into the side: per-man multipliers, the cards a room pushed
 *  over the edge gives away, and the reaction kept for full time. `prior`
 *  is how much of an earlier talk's reaction is still in each man. */
function landTalk(state: GameState, ctx: LiveCtx, side: SideCtx, reads: TalkRead[], prior: number, fire: boolean) {
  const f = new Map<number, number>()
  const rr = new Map<number, number>()
  for (const x of reads) {
    const r = (side.talkR?.get(x.pid) ?? 0) * prior + x.r
    rr.set(x.pid, r)
    f.set(x.pid, talkFactor(r))
  }
  side.talkF = f
  side.talkR = rr
  // over the edge: complacent men and wound-up men give away cards
  const hot = hotShare(reads)
  layer(side, 'card', (fire ? 1.1 : 1) * (1 + hot * 1.1))
  recomputeSideUnits(state, ctx, side)
}

/** Pre-match dressing-room speech. One per match, chosen before kick-off.
 *  Every man in the 23 hears it and takes it his own way (teamtalk.ts). */
export function applyPreTalk(state: GameState, ctx: LiveCtx, kind: PreTone): string {
  if (ctx.preTalk) return t('touch.speechMade')
  ctx.preTalk = kind
  // an id from a build that offered a tone this one does not: heard as
  // nothing, which is what the old switch did with it
  if (!PRE_TONES.includes(kind)) return ''
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const s = talkSettingFor(state, ctx, mine, opp)
  const reads = talkReads(state, mine.lineup.slice(0, 23), s, kind, ctx.fx.id, talkListen(state))
  ctx.preReads = reads
  mine.talkShift = new Map(reads.map(x => [x.pid, x.after - x.before]))
  landTalk(state, ctx, mine, reads, 0, kind === 'fire')
  return talkLine(state, ctx, kind, 'pre', roomVerdict(reads))
}

/**
 * THE DRESSING ROOM, SPOKEN IN OR NOT (owner, round 6). Every way the manager
 * takes the field (kick-off, Instant Result, a resumed match) comes through
 * here, so the habit is counted once per match whichever door he used: a tone
 * is the talk above, and nothing is nothing - unless it has become a habit,
 * when the room takes the silence as a small knock of its own (teamtalk.ts,
 * SAYING NOTHING). The log is written after the room is read, so the moods the
 * preview showed are the moods the engine heard. No draws.
 */
export function openDressingRoom(state: GameState, ctx: LiveCtx, kind: PreTone | null | undefined): string | null {
  if (ctx.preTalk) return null
  if (kind) {
    const msg = applyPreTalk(state, ctx, kind)
    state.preTalkLog = logPreTalk(state.preTalkLog, true)
    return msg
  }
  // this silence counted with the ones before it, past the two a room forgives
  const k = silenceWeight(logPreTalk(state.preTalkLog, false))
  let msg: string | null = null
  if (k > 0) {
    const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
    const opp = mine === ctx.home ? ctx.away : ctx.home
    const reads = silenceReads(state, mine.lineup.slice(0, 23), talkSettingFor(state, ctx, mine, opp), ctx.fx.id, talkListen(state), k)
    ctx.preReads = reads
    mine.talkShift = new Map(reads.map(x => [x.pid, x.after - x.before]))
    landTalk(state, ctx, mine, reads, 0, false)
    // the assistant says it once, plainly; the reactions say the rest
    const n = (hashString(`${state.seed}:${ctx.fx.id}:pre:silent`) % TALK_LINES) + 1
    msg = t(`tt.pre_silent${n}`)
  }
  state.preTalkLog = logPreTalk(state.preTalkLog, false)
  return msg
}

/** Half-time team talk for the user's side. One per match. Read against the
 *  scoreline, and against whatever the pre-match talk left in each man; part
 *  of the pre-match reaction is still in the legs (PRE_CARRY). */
export function applyTeamTalk(state: GameState, ctx: LiveCtx, kind: HtTone): string {
  if (ctx.talkUsed) return t('touch.talkGiven')
  ctx.talkUsed = true
  if (!HT_TONES.includes(kind)) return ''
  ctx.htTone = kind
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const s = talkSettingFor(state, ctx, mine, opp, mine.score - opp.score)
  // the men still in it: anyone already replaced has nothing left to give
  const ids = mine.lineup.slice(0, 23).filter((id): id is number => id != null && (mine.onPitch.has(id) || !mine.ratings.has(id)))
  const reads = talkReads(state, ids, s, kind, ctx.fx.id, talkListen(state), mine.talkShift)
  ctx.htReads = reads
  landTalk(state, ctx, mine, reads, PRE_CARRY, kind === 'fire')
  return talkLine(state, ctx, kind, 'ht', roomVerdict(reads))
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
  // AND A MAN WHO IS NOT OUT THERE CANNOT BE REPLACED AT ALL.
  //
  // A sending-off and a Law 3.20 removal both leave a shirt in the starting XV
  // with nobody wearing it, and every check above passed for that shirt: the
  // number is in the lineup, the man exists, the bench is fit. So taking it off
  // deleted a player who was not on the pitch (a no-op) and added one who now
  // was, and a side that should have finished with fourteen men finished with
  // fifteen - carrying its full strength through the twenty minutes the red
  // card was supposed to cost it.
  //
  // Found by scripts/journeyprobe.ts counting the men on the pitch at full time
  // against the men the card accounted for.
  if (!mine.onPitch.has(outId)) return t('touch.notOnPitch')
  // A MAN WHO HAS BEEN REPLACED DOES NOT COME BACK ON (1.8.1). Anybody with
  // a mark has played; he was only refused here while still on the pitch, so
  // a starter taken off could return as a tactical change with a fresh bench
  // tank. The MatchDay screen never offered him, but the rule belongs in the
  // engine, where every caller meets it. The sin bin and the HIA bring men
  // back through their own paths, not this one.
  if (!pin || pin.injury || mine.ratings.has(inId)) return t('touch.notAvailable')
  // only a man on the bench, and only one who is allowed to play (1.6.3: the
  // call accepted any id, so a suspended man or a man not in the 23 could come
  // on if a caller named him, scripts/qa/banned.ts)
  // (a Test side's whole bench is on national duty by definition, so the
  // call-up check only applies when the side being coached is a club)
  if (slotIn < 15 || pin.bans > 0 || (pin.natSquad && !!state.clubs[mine.teamId])) return t('touch.notAvailable')
  // shirts 1 to 3 take a trained front-rower while there is one on the bench
  if (!isFrontRower(pin) && needsFrontRower(state, mine, outId)) return t('touch.frontRowOnly')
  mine.lineup[slotOut] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = outId
  mine.onPitch.delete(outId)
  mine.onPitch.add(inId)
  cameOn(mine, inId, Math.min(79, Math.max(1, ctx.lastMin)))
  if (!mine.ratings.has(inId)) mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  ctx.subsUsed += 1
  fieldChanged(state, ctx, mine, ctx.lastMin)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  // the brief he was given, and the bill if the shirt does not fit him (F4)
  const briefsBefore = mine.briefsUsed ?? 0
  const coverBefore = !!mine.coverBlown
  const brief = applyBrief(state, mine, inId)
  forcedSwitchCost(state, ctx, mine, outId, pin, min)
  // nobody trained was left for the front-row shirt: uncontested from here
  if (slotOut <= 2 && !isFrontRower(pin)) frontRowGap(state, ctx, mine, min, pout)
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
  /**
   * HE CANNOT BE ERASED ONCE HE HAS PLAYED (coverswap, 1.8.0).
   *
   * The rewrite at the bottom of this function corrects ONE line - the one
   * that said he came on - on the stated assumption that the override arrives
   * at the same stoppage, before a tick has run. Nothing enforced that
   * assumption. A cover who had been on for ten minutes and scored could be
   * taken back off, out of the lineup and out of onPitch, while his try stayed
   * in the match record under his name: a permanent, saved account of a man
   * scoring in a game he did not play in.
   *
   * The window closes the moment he does something. Anything after his own
   * substitution line that carries his id is him doing something.
   */
  const evs = ctx.events
  let subIdx = -1
  for (let i = evs.length - 1; i >= 0; i--) {
    if (evs[i].k === 'comm.subComesOn' && evs[i].playerId === onId) { subIdx = i; break }
  }
  // THE STOPPAGE'S OWN LINES ARE NOT HIM PLAYING (owner, round 6). A back-rower
  // went down with no back-rower on the bench, the assistant sent a back on, and
  // the engine wrote "playing out of position" under the substitution, at the
  // same stoppage, carrying the new man's id. That line read as "he has done
  // something", so every other name the manager tapped was refused as too late:
  // the one injury he most needed to answer was the one he could not. The
  // stoppage ends where the engine says it does (lastInj.upTo); only a line
  // after that is the cover playing.
  const inj = mine.lastInj && mine.lastInj.coverId === onId ? mine.lastInj : null
  if (subIdx >= 0) {
    for (let i = Math.max(subIdx + 1, inj ? inj.upTo : 0); i < evs.length; i++) {
      if (evs[i].playerId === onId) return t('touch.tooLateToUndo')
    }
  }
  // the front row wants a trained front-rower while there is one (needsFrontRower):
  // the assistant's own pick counts, because a swap sends him back to the bench
  if (!isFrontRower(pin) && needsFrontRower(state, mine, onId, onId)) return t('touch.frontRowOnly')
  // and the stoppage's "out of position" line named the man who is now going
  // back to the bench: it is the record, so it goes with him (the charge is
  // refunded and re-tested below, and a new line is written if it still applies)
  if (inj) {
    for (let i = inj.upTo - 1; i > subIdx && i >= 0; i--) {
      if (evs[i].k === 'comm.outOfCover' && evs[i].playerId === onId) { evs.splice(i, 1); inj.upTo -= 1 }
    }
  }
  mine.lineup[slotOn] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = onId
  mine.onPitch.delete(onId)
  mine.onPitch.add(inId)
  cameOn(mine, inId, mine.onAt?.get(onId) ?? Math.min(79, Math.max(1, ctx.lastMin)))
  // He never actually got on, so he goes back to being a bench option rather
  // than carrying a rating for a cameo that did not happen.
  mine.ratings.delete(onId)
  mine.energy.delete(onId)
  mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  // and the minutes he was on the pitch are the other man's, from the same
  // moment, because as far as the match is concerned it was always him
  const from = mine.since?.get(onId)
  if (from != null) { mine.since!.delete(onId); mine.since!.set(inId, from) }
  fieldChanged(state, ctx, mine, ctx.lastMin)
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
  // nobody trained was left for a front-row shirt: uncontested from here
  if (slotOn <= 2 && !isFrontRower(pin)) frontRowGap(state, ctx, mine, min, inj ? state.players[inj.hurtId] : pon)
  if (inj) inj.coverId = inId
  // THE MAN WHO NEVER GOT ON IS NOT IN THE COMMENTARY (owner, from a real
  // match: "I overrode the suggestion and chose someone else but the
  // commentary still mentioned the original player").
  //
  // The assistant's pick was written into the ticker the instant the injury
  // happened, and that line is not a display list - it is the match record,
  // saved with the fixture and read back on the report screen. Appending "change
  // of plan" under it left a running account of a substitution that did not
  // happen, in the record, for ever. The override is made at the same stoppage
  // and before a tick has run, so the honest thing is that the earlier line
  // names the man who actually came on. Searched from the end, because the
  // assistant may have made an earlier change in the same match.
  const line = [...ctx.events].reverse().find(e => e.k === 'comm.subComesOn' && e.playerId === onId)
  if (line) {
    line.playerId = pin.id
    line.v = { ...line.v, player: pin.name, brief_k: brief ?? 'common.nothing' }
    line.text = tIn('en', 'comm.subComesOn', line.v as Record<string, string | number>)
  } else {
    // no line to correct - a resumed save, or a change made before one was
    // written - so say it as it happens instead
    pushLine(state, ctx, min, 'SUB', mine, 'comm.subChangeOfPlan',
      { on: pin.name, off: pon.name, brief_k: brief ?? 'common.nothing' }, pin.id)
  }
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
  mine.onAt?.delete(inId)
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
  // he never played a second, so his stint closes empty (play has not
  // resumed, so the clock has not moved since he came on)
  fieldChanged(state, ctx, mine, ctx.lastMin)
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
  side.units = teamUnits(state, fieldLineup(side), { fxId: ctx.fx.id, big: !!ctx.fx.stage || ctx.derby, chemToday: ctx.chemToday, talk: side.talkF })
  applyModifiers(state, side, ctx.weather)
  if (ctx.derby) side.cardRisk *= 1.35
  side.unitsKey = personnelKey(side)
}

/**
 * The shirts the units are built from. The lineup, except that a man off for
 * a head injury assessment is played by his stand-in: the HIA keeps the
 * assessed man's name on the shirt so that he can come back to it, and the
 * units used to go on reading his attributes for the ten minutes somebody
 * else was wearing it.
 *
 * A man in the bin or sent off keeps his place here on purpose. numF charges
 * the missing man, and building the units without him as well (teamUnits
 * reads an empty shirt as a 5 in everything) would charge him twice.
 */
function fieldLineup(side: SideCtx): (number | null)[] {
  const h = side.hia
  if (!h || !side.onPitch.has(h.subId)) return side.lineup
  const i = side.lineup.indexOf(h.pid)
  if (i < 0 || i > 14) return side.lineup
  const out = side.lineup.slice()
  out[i] = h.subId
  return out
}

/** Everything a rebuild of the units reads that a match can change: the
 *  shirts (with an HIA stand-in in his) and who is on the pitch. */
function personnelKey(side: SideCtx): number {
  // A number, not a string (1.8.0): this runs at the top of every tick for
  // both sides of every match in the world, and joining and sorting two lists
  // there cost a week about a third of its time (perfprobe, 99-126 ms to
  // 141-158 ms). The shirts are hashed in order, the men on the pitch by an
  // order-free mix, and a rebuild is all a collision could ever cost.
  const lu = fieldLineup(side)
  let h = 17
  for (let i = 0; i < 15; i++) h = (Math.imul(h, 31) + (lu[i] ?? -1)) | 0
  let set = side.onPitch.size
  for (const id of side.onPitch) set = (set + Math.imul(id ^ (id >>> 7), 0x9e3779b1)) | 0
  return (h ^ Math.imul(set, 0x85ebca6b)) | 0
}

/**
 * ---- SOMEBODY CAME ON OR WENT OFF ----
 *
 * The one place a change of personnel is settled, for every side in the
 * world. Until this existed the units were rebuilt only by the manager's own
 * hand (a substitution, an undo, a shirt swap, a slider), so an AI side
 * played its whole afternoon on the fifteen it kicked off with: a
 * replacement's attributes never reached its scrum or its defence, an injury
 * cover never counted, and a sent-off captain went on leading. The manager's
 * own side had the same hole for everything he did not do himself - an
 * injury, an HIA, a card.
 *
 * Two jobs, both cheap and neither drawing on the match rng:
 *
 *  - the minutes. Each man's stint is opened when he appears in onPitch and
 *    closed when he leaves it, at the minute given. A man in the bin is not on
 *    the pitch and banks nothing for his ten minutes: the figure feeds the
 *    season's workload (the 1,300-minute red zone), and a man sitting on the
 *    bench by the touchline is resting, not playing.
 *
 *  - the units, rebuilt only when the personnel they are built from has
 *    actually changed (personnelKey), so calling this when nothing moved is
 *    free and a rebuild is never repeated. applyModifiers starts from a clean
 *    base, so a rebuild is idempotent: the tenth lands where the first did.
 *
 * Called straight after each change with the minute of it, and once at the
 * top of every tick as a net for anything that moved without saying so; a
 * stint the net catches is timed to that tick's minute instead.
 */
function fieldChanged(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  const at = clamp(min, 0, 80)
  const since = (side.since ??= new Map())
  const played = (side.played ??= new Map())
  for (const [id, from] of since) {
    if (side.onPitch.has(id)) continue
    played.set(id, (played.get(id) ?? 0) + Math.max(0, at - from))
    since.delete(id)
  }
  for (const id of side.onPitch) if (!since.has(id)) since.set(id, at)
  if (side.unitsKey !== personnelKey(side)) { recomputeSideUnits(state, ctx, side); noteSpecialists(state, ctx, side) }
}

/** A man in a specialist shirt without the trade (specialistGaps) gets one
 *  line, the first time he is out there in it. Colour only: never drawn,
 *  never moves the clock. */
const SPEC_LINE: Record<number, string> = { 0: 'comm.specProp', 1: 'comm.specHook', 2: 'comm.specProp', 8: 'comm.specNine' }
function noteSpecialists(state: GameState, ctx: LiveCtx, side: SideCtx) {
  if (!ctx.detail) return
  const xv = fieldLineup(side).slice(0, 15).map(id => (id != null && side.onPitch.has(id) ? state.players[id] : null))
  for (const i of specialistGaps(xv)) {
    const p = xv[i]!
    const said = (side.specSaid ??= new Set())
    if (said.has(p.id)) continue
    said.add(p.id)
    colour(state, ctx, side, SPEC_LINE[i], { player: p.name, team: teamShort(state, side.teamId) }, p.id)
  }
}

/** A man's minutes in this match so far: the stints he has finished and the
 *  one he is in, counted to `now`. */
export function minutesPlayed(side: SideCtx, id: number, now: number): number {
  const from = side.since?.get(id)
  return (side.played?.get(id) ?? 0) + (from != null ? Math.max(0, now - from) : 0)
}

/**
 * ---- WHO TAKES THE KICK ----
 *
 * units.kickerId is the side's first choice: the named kicker, or the best
 * boot in the XV. It is a name on a sheet, and it used to be the only thing
 * read, so a kicker who had been sent off, sin-binned or replaced went on
 * taking the side's kicks from the stand and being credited with the points.
 *
 * Now the kick goes to the first choice if he is on the pitch; failing him,
 * to the next of the manager's named kickers who is out there; failing them,
 * to the best goal kicker on the field. Nothing is stored, so a first choice
 * back from the bin takes the tee again at the next kick. A tie for the best
 * boot goes to the man who has been out there longest. At kick-off the first
 * choice is always on, so the pick there is exactly the one it always was.
 */
export function goalKicker(state: GameState, side: SideCtx): Player | null {
  const first = side.units.kickerId
  if (first != null && side.onPitch.has(first)) return state.players[first] ?? null
  for (const id of state.clubs[side.teamId]?.tactic.kickers ?? []) {
    if (id != null && side.onPitch.has(id) && !state.players[id]?.injury) return state.players[id] ?? null
  }
  let best: Player | null = null
  let goal = 5
  for (const id of side.onPitch) {
    const p = state.players[id]
    if (p && !p.injury && p.a.goa > goal) { goal = p.a.goa; best = p }
  }
  return best
}

/** Apply the user's (possibly changed) tactic sliders mid-match. */
export function applyTacticsChange(state: GameState, ctx: LiveCtx) {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  recomputeSideUnits(state, ctx, mine)
}

/**
 * Match statistics for the stats panel (scrums, lineouts and tackles joined
 * it for v1.1.9; the live strip that briefly drew them under the pitch was
 * removed the next morning at the owner's ask - the panel is the home).
 *
 * Possession, tries, penalties, cards and energy are MEASURED: the engine has
 * been keeping every one of them all along.
 *
 * (Tackles were derived too, until 1.8.0 counted them: countTackles.)
 *
 * The set pieces are DERIVED, and the difference is worth being
 * straight about. The engine does not simulate an individual scrum, so these
 * are computed from things it does simulate - how much ball each side has
 * actually had, and the two packs' real scrum, lineout and defence numbers.
 * A heavier pack wins more of its own feed and steals more of yours; a side
 * camped in its own half makes far more tackles. Every figure moves for a
 * reason a manager can point at, which is the bar a stats sheet has to clear.
 * What it is not is a ball-by-ball count, and saying so here because a number
 * on a stats sheet looks like a measurement and the next reader deserves to
 * know which kind it is. scripts/statsprobe.ts holds it to all of that.
 *
 * NO RNG. A pure function of state that already exists, so it can be called
 * on every render of a live match without the stream ever noticing.
 */
/** How a side's tackling is shared across the XV by shirt: flankers make the
 *  most, then the locks, hooker, No. 8 and centres; the back three the fewest.
 *  From the tackle counts of top-flight games. */
const SLOT_TACKLES = [7, 10, 7, 11, 11, 13, 14, 11, 7, 8, 4, 10, 10, 4, 3]

/**
 * ---- EVERY TACKLE, COUNTED AND NAMED (1.8.0) ----
 *
 * Owner, 27 Sep 2026: "track the tackles accurately? How do we do that?" The
 * engine plays a match in twenty four-minute ticks and never simulated a
 * single tackle: the stats panel's figure was worked out afterwards from
 * possession, and the first per-player column shared that figure out by
 * shirt. Now each tick the engine plays the tackles: a side makes about 4
 * attempts a minute for every minute the other side has the ball (the ball
 * each side actually won this tick, dh and da), a better defence gets through
 * more, and every attempt goes to a man on the pitch - weighted by his shirt,
 * his tackling and how much he has left in his legs. His tackling decides
 * whether he makes it or misses it. A man in the bin, off injured or not yet
 * on makes none, because he is not in onPitch.
 *
 * ITS OWN DICE. The draws come from a stream seeded by the fixture and the
 * tick, never from the match's rng, so counting tackles cannot move a single
 * score, card or injury, and a resumed match counts them exactly as before.
 */
function countTackles(state: GameState, ctx: LiveCtx, tick: number, dh: number, da: number) {
  const total = dh + da
  if (total <= 0) return
  const rng = mulberry32((((ctx.fx.id | 0) * 7919) ^ (tick * 104729) ^ ((state.season | 0) * 31)) >>> 0)
  for (const [def, attPoss] of [[ctx.home, da], [ctx.away, dh]] as [SideCtx, number][]) {
    const men = [...def.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p)
    if (!men.length) continue
    // 4 minutes a tick, 4 attempts a minute without the ball: about 160 a
    // match at even possession, 140 of them made, a top-flight side's count
    const expected = 4 * 4 * (attPoss / total) * (0.9 + def.units.defence / 900)
    const n = Math.floor(expected) + (rng() < expected % 1 ? 1 : 0)
    const weights = men.map(p => {
      const slot = def.lineup.indexOf(p.id)
      const shirt = slot >= 0 && slot < 15 ? SLOT_TACKLES[slot] : 8
      return shirt * (0.7 + 0.6 * p.a.tac / 20) * (0.6 + 0.4 * (def.energy.get(p.id) ?? 80) / 100)
    })
    const made = (def.tackles ??= new Map()), miss = (def.missed ??= new Map())
    for (let i = 0; i < n; i++) {
      const p = wpick(rng, men, weights)
      const hold = clamp(0.8 + (p.a.tac - 12) * 0.012, 0.62, 0.96)
      if (rng() < hold) made.set(p.id, (made.get(p.id) ?? 0) + 1)
      else miss.set(p.id, (miss.get(p.id) ?? 0) + 1)
    }
  }
}

/** A commentary line that names a man for a hit is a tackle he made. */
const TACKLE_LINES = new Set(['comm.flavPac5', 'comm.flav8', 'comm.flav12', 'comm.flav15'])

function cameOn(side: SideCtx, id: number, min: number) {
  (side.onAt ??= new Map()).set(id, min)
}

/**
 * VISITS TO THE 22, and the points a side came away with (1.8.1). One count
 * for the live stats and the Visits panel, read off the lines shown so far.
 * A visit starts on the first line of the side's own inside the opposition 22
 * after a line that was not; the other side's line, or its own further out,
 * ends it.
 *
 * A TRY IS ALWAYS A VISIT. scoreTry moves the ball back towards halfway for
 * the restart before the try line is written, so a try finished from a long
 * break was stamped outside the 22 and the store screenshot showed a try, 0
 * visits and 0.0 points per visit. The line is scored over, so a try line
 * counts as inside whatever its stamp says, and the conversion that follows
 * belongs to the same visit. The scoreboard is read as a high-water mark, so a
 * whistle line stamped with an older score cannot count the same points twice.
 */
export function visitsTo22(events: readonly MatchEvent[], homeId: string, home: boolean): { visits: number; pts: number } {
  let visits = 0, pts = 0, inside = false, best = 0
  for (const e of events) {
    const was = inside
    const ours = !!e.teamId && (e.teamId === homeId) === home
    // the conversion is stamped at the restart, so it neither opens nor
    // closes a visit: it is the second half of the try before it
    const con = ours && e.type === 'CON'
    if (e.fld != null && e.teamId && !con) {
      const up = home ? e.fld : 100 - e.fld
      const now = ours && (up >= 78 || e.type === 'TRY')
      if (now && !inside) visits++
      inside = now
    }
    const score = home ? e.homeScore : e.awayScore
    if (score != null && score > best) {
      if (inside || was || con) pts += score - best
      best = score
    }
  }
  return { visits, pts }
}

export function matchStats(ctx: LiveCtx) {
  const tot = ctx.home.poss + ctx.away.poss || 1
  const share = (s: SideCtx) => s.poss / tot
  // minutes of rugby actually played, not the clock's ambition
  const mins = Math.max(0, Math.min(80, ctx.lastMin || 0))
  // a pack's edge over the other, squashed into a sensible band: a dominant
  // scrum wins nearly all its own ball, a beaten one coughs up a quarter of
  // it, and nobody ever wins the lot
  const rate = (mine: number, theirs: number) => 0.86 + 0.11 * Math.tanh((mine - theirs) / 14)
  // about thirteen scrums and twenty-five lineouts across eighty minutes,
  // tilted a little towards whoever has been playing more
  const feeds = (s: SideCtx, perMin: number) =>
    Math.round(mins * perMin * (0.5 + (share(s) - 0.5) * 0.4))
  const setPiece = (s: SideCtx, perMin: number, mine: number, theirs: number): [number, number] => {
    const f = feeds(s, perMin)
    const won = Math.round(f * rate(mine, theirs))
    return [won, Math.max(0, f - won)]
  }
  const [hsw, hsl] = setPiece(ctx.home, 0.16, ctx.home.units.scrum, ctx.away.units.scrum)
  const [asw, asl] = setPiece(ctx.away, 0.16, ctx.away.units.scrum, ctx.home.units.scrum)
  const [hlw, hll] = setPiece(ctx.home, 0.30, ctx.home.units.lineout, ctx.away.units.lineout)
  const [alw, all_] = setPiece(ctx.away, 0.30, ctx.away.units.lineout, ctx.home.units.lineout)
  // COUNTED, since 1.8.0 (countTackles): the sum of every man's tackles. A
  // match begun by an older build has no counts, and falls back to the
  // figure this used to work out from possession and the defence.
  const tackles = (s: SideCtx) => s.tackles
    ? [...s.tackles.values()].reduce((a, b) => a + b, 0)
    : Math.round(mins * (1 - share(s)) * 3.6 * (0.9 + s.units.defence / 900))
  return {
    possession: [Math.round((ctx.home.poss / tot) * 100), Math.round((ctx.away.poss / tot) * 100)] as [number, number],
    tries: [ctx.home.tries, ctx.away.tries] as [number, number],
    pens: [ctx.home.pens, ctx.away.pens] as [number, number],
    cards: [ctx.home.yellowUntil.size + ctx.home.sent, ctx.away.yellowUntil.size + ctx.away.sent] as [number, number],
    energy: [Math.round(sideEnergy(ctx.home)), Math.round(sideEnergy(ctx.away))] as [number, number],
    scrumsWon: [hsw, asw] as [number, number],
    scrumsLost: [hsl, asl] as [number, number],
    lineoutsWon: [hlw, alw] as [number, number],
    lineoutsLost: [hll, all_] as [number, number],
    tackles: [tackles(ctx.home), tackles(ctx.away)] as [number, number],
    /** [made, taken] for each side: conversions, penalties and drop goals */
    goalKicks: [[ctx.home.kicksMade ?? 0, ctx.home.kicksAt ?? 0], [ctx.away.kicksMade ?? 0, ctx.away.kicksAt ?? 0]] as [[number, number], [number, number]],
    /** kicks from hand put in, and how many of each side's were charged down */
    handKicks: [ctx.home.handKicks ?? 0, ctx.away.handKicks ?? 0] as [number, number],
    chargedDown: [ctx.home.chargedDown ?? 0, ctx.away.chargedDown ?? 0] as [number, number],
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
        subject: `${hero.name}'s testimonial: ${fx.att.toLocaleString()} say thank you`,
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
          : `Of course it was him. ${haunter.name} - ${oldBoyApps(haunter, state.userClubId)} appearances in your colours before he left - crossed against his old club and the ground knew it was coming.`,
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
      // scripts/autopilotprobe.ts went red the moment the team term reached
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
        // (not while he is out of work: userClubId still names the club that
        // sacked him, and its players' caps are not his news - exileprobe)
        if (!state.unemployed && p.clubId === state.userClubId && (p.caps === 1 || p.caps === 50 || p.caps === 100)) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: p.caps === 1 ? `First cap: ${p.name}`
              : `${p.name}: ${p.caps} Test caps`,
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
        // but the legs and the sharpness are real. REAL, NOT RUINED: this used
        // to run the league-match drain, so a manager who watched his opening
        // friendly without making a sub had fifteen men on ~22%, one +22 week
        // of recovery put them on exactly 44%, and the second matchday of a
        // brand-new career was a wall of flagged names (owner, 29 Aug, with
        // the screenshot). No coach lets a pre-season run-out empty the tank -
        // minutes are managed even when the sim plays all eighty - so a
        // friendly's legs bottom out at 48%: one ordinary +22 recovery week
        // puts the same XV at 70, clear of the 62% rotation flag, so the wall
        // cannot recur - while a manager who never rests anybody still rolls
        // into the league opener a long way short of the rotated sides. (A
        // first cut floored at 64 and autopilotprobe caught what that really
        // was: most of the sleepwalk penalty gone - board-misery gaps
        // collapsed, a sacking-parity flip, and a title stolen on autopilot.
        // 48 keeps the owner's fix and the game's teeth.) The rng draw on the
        // no-energy path is kept exactly as it was: this branch may not
        // change the stream (fingerprint).
        p.lastWk = state.week
        const left = side.energy.get(pid)
        p.cond = left != null
          ? clamp(Math.max(Math.min(p.cond, left + 8) - 6, 48), 12, 100)
          : clamp(Math.max(p.cond - (14 + Math.floor(rng() * 10)), 48), 20, 100)
        p.sharp = clamp(p.sharp + 12, 0, 100)
      } else if (!isNation) {
        if (p.debutPending) { debutants.push({ p, r, kind: p.debutPending }); p.debutPending = null }
        p.stats.apps += 1
        // WHO STARTED AND HOW LONG HE PLAYED, as it happened. This read the
        // lineup at full time and credited a flat 75 or 25, and the lineup is
        // rewritten by every substitution: the replacement who finished in
        // the shirt was given the start and 75 minutes, and the man who
        // played the first hour got 25 and no start. The minutes feed the
        // 1,300-minute red zone, so the wrong men were being rested. Now the
        // start is the XV of the first tick and the minutes are the stints
        // fieldChanged timed, the bin excluded, closed at the final whistle.
        // A man who got on at all has played at least a minute of it.
        const started = (side.starters ?? new Set(side.lineup.slice(0, 15))).has(pid)
        if (started) p.stats.starts += 1
        p.stats.mins += Math.max(1, Math.round(minutesPlayed(side, pid, 80)))
        p.stats.ratingSum += r
        // and the same rating against the award window, which is cleared every
        // time a Player of the Month is named (see SeasonStats.mSum)
        p.stats.mSum = (p.stats.mSum ?? 0) + r
        p.stats.mApps = (p.stats.mApps ?? 0) + 1
        p.lastR = r
        p.ratings = [...(p.ratings ?? []), Math.round(r * 10) / 10].slice(-10)
        p.lastWk = state.week
        p.form = clamp(p.form * 0.65 + own * 0.35, 1, 10)
        const swing = (p.pers === 'Temperamental' ? 2 : 1) * (derby ? 1.6 : 1)
        p.morale = clamp(p.morale + (won ? 0.4 : -0.5) * swing, 1, 10)
        // and what he took from the manager's talks, a little either way
        const tr = side.talkR?.get(pid)
        if (tr) p.morale = clamp(p.morale + talkMorale(tr, won), 1, 10)
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
    if (kind === 'academy') rememberDebut(state, p) // memory.ts: you gave him his debut
    const scored = ctx.events.some(e => e.type === 'TRY' && e.playerId === p.id)
    const isMotm = p.id === motmId
    if (!scored && !isMotm && r < 7.8) continue
    const homegrown = kind === 'academy'
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: homegrown ? `A debut to tell his grandkids about: ${p.name}` : `Dream debut for ${p.name}`,
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

  // PLAYOFF RECORDS (1.8.16, item 47): a hat-trick in a knockout tie, and
  // the fastest knockout try anybody has scored, are news wherever they come
  koRecords(state, ctx)

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
            ...(e.k ? { tj: JSON.stringify({ ...(e.v ?? {}), k: e.k }) } : {}),
          }
        }
      }
    }
  }
}

/** Simulate a full match in one go (AI fixtures, tests, quick sims). */
/**
 * ---- THE WALKOVER (1.6.4) ----
 *
 * A club that cannot put ten fit players on the field forfeits: the match is
 * awarded 28-0 with four tries, the losing side gets nothing. The engine used
 * to play on with three men and lose 0-82 (scripts/qa/edge.ts), which no
 * competition on earth would let happen. Ten is the owner's line. Test sides
 * never forfeit - a nation always finds fifteen - and if both clubs are short
 * the fixture is scratched as a 0-0 draw with no bonus points.
 */
export const FORFEIT_MIN = 10
export const FORFEIT_SCORE = 28
export const FORFEIT_TRIES = 4

export function forfeitSide(state: GameState, fx: Fixture): 'home' | 'away' | 'both' | null {
  const short = (teamId: string) => {
    const club = state.clubs[teamId]
    if (!club) return false
    // academy men count: a club short of seniors drafts them, as the team
    // sheet already does
    return availablePlayers(state, club.players).length < FORFEIT_MIN
  }
  const h = short(fx.homeId), a = short(fx.awayId)
  return h && a ? 'both' : h ? 'home' : a ? 'away' : null
}

export function settleForfeit(state: GameState, fx: Fixture, side: 'home' | 'away' | 'both'): SimResult {
  const winner = side === 'home' ? fx.awayId : side === 'away' ? fx.homeId : null
  const loser = side === 'home' ? fx.homeId : side === 'away' ? fx.awayId : null
  fx.played = true
  fx.homeScore = winner === fx.homeId ? FORFEIT_SCORE : 0
  fx.awayScore = winner === fx.awayId ? FORFEIT_SCORE : 0
  fx.homeTries = winner === fx.homeId ? FORFEIT_TRIES : 0
  fx.awayTries = winner === fx.awayId ? FORFEIT_TRIES : 0
  const v = {
    loser: loser ? teamShort(state, loser) : teamShort(state, fx.homeId),
    winner: winner ? teamShort(state, winner) : teamShort(state, fx.awayId),
  }
  const events: MatchEvent[] = [{
    min: 0, type: 'FT', teamId: winner ?? fx.homeId, text: tIn('en', 'comm.forfeit', v), k: 'comm.forfeit', v,
    homeScore: fx.homeScore, awayScore: fx.awayScore,
  } as unknown as MatchEvent]
  const mine = fx.homeId === state.userClubId || fx.awayId === state.userClubId
  if (mine) {
    fx.events = events
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: tIn('en', 'news.forfeitSubj', v), body: tIn('en', 'news.forfeit', v),
      k: 'news.forfeit', v,
    })
  }
  return { events, motmId: null }
}

const KO_STAGE = new Set(['QF', 'SF', 'F', 'BAR'])
function koRecords(state: GameState, ctx: LiveCtx) {
  const fx = ctx.fx
  if (!fx.stage || !KO_STAGE.has(fx.stage)) return
  const stage_k = `news.koStage_${fx.stage}`
  const comp = state.comps[fx.compId]?.name ?? ''
  for (const side of [ctx.home, ctx.away]) {
    for (const [pid, n] of side.matchTries ?? []) {
      const p = state.players[pid]
      if (!p || n < 3) continue
      const v = { player: p.name, team: teamShort(state, side.teamId), n, comp, stage_k }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.koHatTrickSubj', v), body: tIn('en', 'news.koHatTrick', v),
        k: 'news.koHatTrick', v, playerId: p.id, fixtureId: fx.id,
      })
    }
  }
  const first = [ctx.home, ctx.away].filter(s => s.firstTryMin != null && s.firstTryBy != null)
    .sort((a, b) => (a.firstTryMin ?? 99) - (b.firstTryMin ?? 99))[0]
  if (!first || first.firstTryMin == null || first.firstTryBy == null) return
  const rec = state.koFastest
  if (rec && rec.min <= first.firstTryMin) return
  const p = state.players[first.firstTryBy]
  if (!p) return
  state.koFastest = { min: first.firstTryMin, name: p.name, team: teamShort(state, first.teamId), season: state.season }
  // the first one set is not news: a record needs something to beat
  if (!rec) return
  const v = { player: p.name, team: teamShort(state, first.teamId), min: first.firstTryMin, old: rec.name, oldMin: rec.min, comp, stage_k }
  // "after 1 minutes": a minute is the one count the old record can never be
  // (the record it beats is longer), so only {min} needs a singular line
  const k = first.firstTryMin === 1 ? 'news.koFastest1' : 'news.koFastest'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', k + 'Subj', v), body: tIn('en', k, v),
    k, v, playerId: p.id, fixtureId: fx.id,
  })
}

export function simMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean): SimResult {
  const forfeit = forfeitSide(state, fx)
  if (forfeit) return settleForfeit(state, fx, forfeit)
  const ctx = beginMatch(state, fx, rng, detail)
  // NOBODY IS ON THE TOUCHLINE (1.8.1). beginMatch marks the manager's club
  // as the user's side, and aiAutoSubs leaves a user's bench to the user, so
  // a week settled here (not played, not handed to the assistant, the way a
  // soak or a sleepwalking manager's weeks are) used no bench at all except
  // for injuries and HIAs. The assistant has the match, exactly as he does
  // on an instant result.
  if (ctx.isUser) ctx.assistantSubs = true
  playHalf(state, ctx)
  playHalf(state, ctx)
  return { events: ctx.events, motmId: ctx.motmId }
}
