import type { Fixture, GameState, MatchEvent, Player, Pos, Weather } from './model'
import { BENCH_SLOTS, CHEM_SLOTS, XV_SLOTS, addGrudge, chemKey, demandCeiling, facLevel, fmtMoney, grudgeBetween, inRedZone, oldBoyApps } from './model'
import { updateNatRank } from './natrank'
import { effAt } from './attributes'
import { nationByCode } from './nations'
import { derbyName, isDerby } from './rivalries'
import { analystEdge, settleAnalyst } from './analyst'
import { clamp, gauss, wpick, type Rng } from './rng'

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

/** Pick the best legal 23 from a pool. Returns array of 23 player ids (or null). */
export function autoSelect(state: GameState, pool: Player[]): (number | null)[] {
  // academy players are a second squad - only raided when the seniors run dry
  const seniors = pool.filter(p => !p.acad)
  if (seniors.length >= 23) pool = seniors
  const used = new Set<number>()
  const lineup: (number | null)[] = new Array(23).fill(null)
  const score = (p: Player, pos: Pos) =>
    effAt(p, pos) * (0.7 + 0.3 * (p.cond / 100)) * (0.85 + 0.03 * p.form)

  // phase one: players in their own positions, best pairings first. A pure
  // slot-order greedy burned stars out of position (an 86 hooker at loosehead
  // for a 0.8 gain, costing 11 points at hooker) because it never weighed
  // what using a man here costs at his real slot
  {
    const pairs: { slot: number; p: Player; s: number }[] = []
    for (let i = 0; i < 15; i++) {
      const pos = XV_SLOTS[i].pos
      for (const p of pool) {
        if (p.pos === pos || p.alt.includes(pos)) pairs.push({ slot: i, p, s: score(p, pos) })
      }
    }
    pairs.sort((a, b) => b.s - a.s)
    for (const { slot, p } of pairs) {
      if (lineup[slot] != null || used.has(p.id)) continue
      lineup[slot] = p.id
      used.add(p.id)
    }
  }
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
      const slots = BENCH_SLOTS[b].pos
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
    const slots = BENCH_SLOTS[b].pos
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

export interface Units {
  scrum: number; lineout: number; breakdown: number
  attack: number; defence: number; kicking: number
  goal: number; overall: number
  kickerId: number | null
}

const avg = (ns: number[]) => ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 8

export function teamUnits(state: GameState, lineup: (number | null)[]): Units {
  const xv = lineup.slice(0, 15).map(id => (id != null ? state.players[id] : null))
  const P = (i: number) => xv[i]
  const at = (i: number, k: keyof Player['a']) => {
    const p = P(i)
    if (!p) return 5
    const fit = 0.75 + 0.25 * (p.cond / 100)
    const frm = 0.9 + 0.02 * p.form
    // match sharpness: a player eased back after a layoff is a touch off the pace
    const shp = 0.945 + 0.055 * ((p.sharp ?? 70) / 100)
    return p.a[k] * fit * frm * shp
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
  return state.clubs[teamId]?.name ?? nationByCode(teamId)?.name ?? teamId
}

export function teamShort(state: GameState, teamId: string): string {
  return state.clubs[teamId]?.short ?? nationByCode(teamId)?.name ?? teamId
}

export function lineupFor(state: GameState, teamId: string): (number | null)[] {
  const club = state.clubs[teamId]
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
    if (valid) return lu
  }
  const pool = availablePlayers(state, rosterOf(state, teamId), isNation)
  return autoSelect(state, pool)
}

// ------------------------------------------------------------------
// Simulation
// ------------------------------------------------------------------

const REF_NAMES = [
  'L. Pearce', 'K. Dickson', 'M. Carley', 'C. Ridley', 'A. Gardner', 'N. Amashukeli',
  'A. Piardi', 'P. Williams', "B. O'Keeffe", 'N. Berry', 'H. Davidson', 'A. Brace', 'P. Brousset',
]
export type RefStyle = 'strict' | 'fair' | 'lenient'
/** The man (or woman) in the middle - fixed per fixture, big influence. */
export function refFor(fxId: number): { name: string; style: RefStyle } {
  const h = (fxId * 2654435761) >>> 0
  return {
    name: REF_NAMES[h % REF_NAMES.length],
    style: h % 4 === 0 ? 'strict' : h % 4 === 3 ? 'lenient' : 'fair',
  }
}

const INJURIES = [
  ['bruised ribs', 1, 2], ['dead leg', 1, 1], ['sprained ankle', 2, 4],
  ['hamstring strain', 2, 5], ['concussion', 2, 3], ['shoulder injury', 3, 8],
  ['knee ligament damage', 6, 16], ['broken hand', 4, 6], ['calf strain', 2, 4],
  ['groin strain', 2, 5], ['torn bicep', 8, 14], ['ruptured achilles', 16, 30],
] as const

export interface SideCtx {
  teamId: string
  lineup: (number | null)[]
  units: Units
  score: number
  tries: number
  ratings: Map<number, number>
  onPitch: Set<number>
  yellowUntil: Map<number, number>
  sent: number // players lost to RC
  cardRisk: number
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
  /** an active Head Injury Assessment: who went off, who covers, verdict due */
  hia?: { pid: number; subId: number; failed: boolean; returnTick: number }
  /** goal-kicking bonus from the kicking coach */
  goalBonus: number
  /** players in this side facing a former club today - the old boys */
  exIds: Set<number>
  isUser: boolean
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
    const t = club.tactic
    const f = (v: number) => (v - 50) / 50 // -1..1
    side.units.attack *= 1 + f(t.style) * 0.06 + f(t.tempo) * 0.05
    side.units.scrum *= 1 - f(t.style) * 0.05
    side.units.breakdown *= 1 + f(t.aggression) * 0.06 - f(t.style) * 0.03
    side.units.kicking *= 1 + f(t.kicking) * 0.1
    side.units.defence *= 1 - f(t.tempo) * 0.03
    side.tempoF = 1 + f(t.tempo) * 0.22
    side.cardRisk = 0.012 + f(t.aggression) * 0.006
  }
  // positional roles: how each shirt is told to play (small, capped edges)
  if (club?.tactic.roles) {
    for (let i = 0; i < 15; i++) {
      const r = club.tactic.roles[i]
      if (!r || side.lineup[i] == null) continue
      switch (r) {
        case 'scrummager': side.units.scrum *= 1.02; side.units.attack *= 0.997; break
        case 'mobile': side.units.attack *= 1.008; side.units.scrum *= 0.988; break
        case 'lineout_general': side.units.lineout *= 1.025; break
        case 'enforcer_lock': side.units.breakdown *= 1.012; side.cardRisk *= 1.04; break
        case 'jackal_role': side.units.breakdown *= 1.015; break
        case 'carrier': side.units.attack *= 1.008; break
        case 'stopper': side.units.defence *= 1.01; break
        case 'box_kicker': side.units.kicking *= 1.02; break
        case 'sniper': side.units.attack *= 1.01; side.units.kicking *= 0.99; break
        case 'kicking_general': side.units.kicking *= 1.03; side.units.attack *= 0.995; break
        case 'playmaker': side.units.attack *= 1.012; side.units.defence *= 0.995; break
        case 'crash': side.units.breakdown *= 1.01; break
        case 'distributor': side.units.attack *= 1.008; break
        case 'finisher': side.units.attack *= 1.006; break
        case 'aerial': side.units.defence *= 1.008; side.units.kicking *= 1.01; break
      }
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
  }
  if (weather === 'Rain' || weather === 'Snow') {
    side.units.attack *= weather === 'Snow' ? 0.86 : 0.90
    side.units.breakdown *= 1.04 // wet weather is forward weather
  }
  if (weather === 'Wind') side.units.kicking *= 0.92
}

function mkSide(state: GameState, teamId: string, userTeamId: string | null): SideCtx {
  const lineup = lineupFor(state, teamId)
  const ratings = new Map<number, number>()
  const onPitch = new Set<number>()
  const energy = new Map<number, number>()
  lineup.slice(0, 15).forEach(id => {
    if (id != null) {
      ratings.set(id, 6 + gaussNoise())
      onPitch.add(id)
      energy.set(id, Math.max(50, state.players[id]?.cond ?? 85))
    }
  })
  const units = teamUnits(state, lineup)
  const side: SideCtx = {
    teamId, lineup, units,
    score: 0, tries: 0, ratings, onPitch, yellowUntil: new Map(), sent: 0,
    cardRisk: 0.012,
    poss: 0, pens: 0, consPens: 0,
    energy, tempoF: 1, drainF: 1, goalBonus: 0,
    exIds: new Set(),
    isUser: teamId === userTeamId,
  }
  applyModifiers(state, side, null)
  return side
}

let _n = 0
function gaussNoise() { _n = (_n + 1) % 7; return (_n - 3) * 0.05 }

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
  (n: string) => `TRY! ${n} crashes over from close range!`,
  (n: string) => `TRY! ${n} finishes superbly in the corner!`,
  (n: string) => `TRY! ${n} slices through the defence!`,
  (n: string) => `TRY! ${n} powers over off the back of the maul!`,
  (n: string) => `TRY! ${n} steps inside and dives under the posts!`,
  (n: string) => `TRY! Sweeping move, and ${n} applies the finish!`,
  (n: string) => `TRY! Quick tap by ${n} catches the defence napping!`,
  (n: string) => `TRY! ${n} gathers a clever grubber and touches down!`,
  (n: string) => `TRY! ${n} arcs outside his man and won't be caught!`,
  (n: string) => `TRY! ${n} picks from the base and burrows over!`,
  (n: string) => `TRY! A monstrous fend from ${n} and he strolls in!`,
  (n: string) => `TRY! ${n} takes the offload one-handed and finishes!`,
  (n: string) => `TRY! Fifty-metre intercept - ${n} all the way!`,
  (n: string) => `TRY! ${n} chips, regathers, scores. Outrageous.`,
  (n: string) => `TRY! Pick-and-go, pick-and-go, and ${n} forces it down!`,
  (n: string) => `TRY! ${n} hits a scything line off the shoulder - untouched!`,
  (n: string) => `TRY! The wraparound sends ${n} through the front door!`,
  (n: string) => `TRY! ${n} bumps off three tacklers on his way to the line!`,
  (n: string) => `TRY! ${n} shows and goes - nobody within five metres of him!`,
  (n: string) => `TRY! Eight phases of patience, and ${n} finds the shortest of short sides!`,
  (n: string) => `TRY! ${n} straightens, sits the last man down and strolls under the sticks!`,
  (n: string) => `TRY! The blindside wing comes off his line and it is ${n} who finishes it!`,
  (n: string) => `TRY! ${n} takes it flat and hits the line like a train - no stopping that!`,
  (n: string) => `TRY! Turnover ball, three passes, and ${n} is away - breathless rugby!`,
  (n: string) => `TRY! ${n} reaches through the tackle and plants it one-handed - the TMO checks and it is GOOD!`,
  (n: string) => `TRY! A no-look pass sends ${n} in at the flag - cheek and class in one movement!`,
]
const TRY_LINES_WET = [
  (n: string) => `TRY! ${n} follows a slithering kick through and wins the race!`,
  (n: string) => `TRY! The greasy ball squirts loose and ${n} pounces!`,
  (n: string) => `TRY! ${n} aquaplanes over in the corner - the crowd doesn't care!`,
  (n: string) => `TRY! ${n} surfs a puddle over the line - filthy conditions, beautiful result!`,
  (n: string) => `TRY! The maul splashes over and ${n} emerges from the swamp with the ball!`,
]
const TRY_LINES_DERBY = [
  (n: string) => `TRY! ${n} scores - and cups an ear to the away end! Bedlam!`,
  (n: string) => `TRY! ${n} settles a hundred pub arguments with that one!`,
  (n: string) => `TRY! ${n} through a wall of bodies - this derby has everything!`,
  (n: string) => `TRY! ${n} scores in front of the travelling fans and just stands there, arms wide!`,
  (n: string) => `TRY! The town will be unbearable for a week - ${n} has scored in the derby!`,
]
const PEN_LINES = [
  (n: string) => `${n} slots the penalty.`,
  (n: string) => `${n} makes no mistake from the tee.`,
  (n: string) => `${n} strikes it true - three more points.`,
  (n: string) => `${n} bisects the uprights from distance.`,
  (n: string) => `${n} takes his time... and drills it.`,
  (n: string) => `No radar needed - ${n} splits them from 45 metres.`,
  (n: string) => `${n} scrapes it over off the left post. They all count.`,
  (n: string) => `Ice in the veins: ${n} silences the whistlers.`,
  (n: string) => `${n} thumps it over from halfway - the big boot pays the bills.`,
  (n: string) => `A horrible angle, and ${n} makes it look like a warm-up.`,
  (n: string) => `${n} wipes the mud off the ball, wipes the rain off his face, and nails it.`,
]
const CON_LINES = [
  (n: string) => `${n} adds the extras.`,
  (n: string) => `${n} curls the conversion over.`,
  (n: string) => `${n} converts from the touchline!`,
  (n: string) => `${n} strokes the conversion straight through the middle.`,
  (n: string) => `Routine for ${n} - the lead grows.`,
  (n: string) => `${n} bends it home against the breeze.`,
  (n: string) => `${n} barely looks at it. Over. Next job.`,
  (n: string) => `From the chalk of the touchline, ${n} draws it inside the far post - kicking coaches will replay that one.`,
]
const FLAVOR_GRASSROOTS = [
  (n: string, t: string) => `${n} wins a scrappy one at the back of a collapsing maul - proper National 1 rugby, this.`,
  (n: string, t: string) => `A dog has briefly joined the ${t} defensive line. Play carries on regardless.`,
  (n: string, t: string) => `${n} slips in the mud where the winter pitch never quite recovers. The crowd, all four hundred of them, enjoy that.`,
  (n: string, t: string) => `Huge cheer from the clubhouse balcony as ${n} flattens his man. Someone rings the bell.`,
  (n: string, t: string) => `${t} work it through nine phases - patient stuff for this level, and the tea hut has gone quiet.`,
  (n: string, t: string) => `${n}, a schoolteacher on Monday mornings, sends the fly-half the wrong way. Class dismissed.`,
  (n: string, t: string) => `The touch judge is a club volunteer and takes a moment to find his flag. ${t} tap and go.`,
  (n: string, t: string) => `${n} charges down the clearance! The ball ricochets off the beer tent guy-rope and stays in.`,
]

const FLAVOR_PACIFIC = [
  (n: string, t: string) => `${n} throws the wildest offload you'll see all year - and it sticks! ${t} pour forward.`,
  (n: string, t: string) => `The drums in the stands haven't stopped since kick-off. ${n} feeds off it with a rampaging carry.`,
  (n: string, t: string) => `Footwork from ${n} that ought to be illegal - three defenders grasp at air.`,
  (n: string, t: string) => `${t} run it from their own line, because of course they do. The crowd loves every metre.`,
  (n: string, t: string) => `A hit from ${n} you can hear over the sea breeze. The flags in the crowd shake with approval.`,
  (n: string, t: string) => `One-handed take above his head from ${n} - Pacific rugby, no notes.`,
]

const FLAVOR = [
  (n: string, t: string) => `Big carry from ${n} takes ${t} into the 22.`,
  (n: string, t: string) => `${n} makes a searing half-break for ${t}.`,
  (n: string, t: string) => `Turnover! ${n} wins the breakdown battle for ${t}.`,
  (n: string, t: string) => `Monster scrum from the ${t} pack - penalty advantage.`,
  (n: string, t: string) => `${n} claims the high ball under pressure.`,
  (n: string, t: string) => `Rolling maul from ${t} eats up twenty metres.`,
  (n: string, t: string) => `${n} clears the lines with a booming touch-finder.`,
  (n: string, t: string) => `Thunderous hit by ${n} - the crowd roars.`,
  (n: string, t: string) => `${n} steals the lineout - ${t} ball against the throw!`,
  (n: string, t: string) => `Grubber in behind from ${n}; the ${t} chase is ferocious.`,
  (n: string, t: string) => `${n} slips the tackle and ${t} are suddenly on the front foot.`,
  (n: string, t: string) => `Choke tackle! ${n} holds him up and it's a ${t} scrum.`,
  (n: string, t: string) => `${n} puts in a 50:22! What a strike - ${t} lineout deep in the corner.`,
  (n: string, t: string) => `Offload of the season from ${n} - ${t} swarm forward.`,
  (n: string, t: string) => `The ${t} defence blitzes and ${n} smashes the carrier behind the gain line.`,
  (n: string, t: string) => `${n} is everywhere - third jackal attempt in ten minutes for ${t}.`,
  (n: string, t: string) => `Cross-field kick... ${n} climbs highest but it goes to ground. Scrappy stuff.`,
  (n: string, t: string) => `${n} takes a quick lineout - the ref waves play on and ${t} counter.`,
  (n: string, t: string) => `Show-and-go from ${n} splits the seam - ${t} are in behind!`,
  (n: string, t: string) => `${n} wins the aerial duel and ${t} have a platform at last.`,
  (n: string, t: string) => `The ${t} scrum inches forward... and forward... the ref's arm comes out.`,
  (n: string, t: string) => `${n} throws a cut-out pass that misses three men - vision, that.`,
  (n: string, t: string) => `A try-saver from ${n}! Ankle-tapped a metre from the corner flag.`,
  (n: string, t: string) => `${n} carries three defenders five metres. The ${t} crowd stands to applaud a carry.`,
  (n: string, t: string) => `Miscommunication in midfield and ${n} pounces on the loose ball for ${t}.`,
  (n: string, t: string) => `${n} shapes to drop a goal... dummies... and ${t} keep it alive!`,
]
const FLAVOR_WET = [
  (n: string, t: string) => `The rain hammers down as ${n} trudges to another ${t} scrum.`,
  (n: string, t: string) => `Knock-on! The soap-bar ball squirts out of ${n}'s grasp.`,
  (n: string, t: string) => `Box kick from ${n} disappears into the murk - ${t} chase hard.`,
  (n: string, t: string) => `Mud everywhere. ${n}'s number is barely readable now.`,
  (n: string, t: string) => `${n} calls for the high ball, loses it in the floodlights and the rain. ${t} scramble.`,
  (n: string, t: string) => `The ${t} forwards would rather be nowhere else - ${n} leads another wallow at the ruck.`,
]
const FLAVOR_WIND = [
  (n: string, t: string) => `${n}'s clearance hangs in the gale and barely makes ten metres.`,
  (n: string, t: string) => `The wind grabs the restart - ${n} does well to gather for ${t}.`,
  (n: string, t: string) => `${n} aims for the corner and the gale carries it dead. Kicking into a hurricane out there.`,
  (n: string, t: string) => `A ${t} pass sails on the wind and ${n} has to climb for it two metres off course.`,
]
const FLAVOR_DERBY = [
  (n: string, t: string) => `Handbags after the whistle! ${n} in the middle of it - the ref calls the captains.`,
  (n: string, t: string) => `The noise is deafening every time ${n} touches it for ${t}.`,
  (n: string, t: string) => `Derby rugby: ${n} launched into the tackle a heartbeat late. The crowd howls.`,
  (n: string, t: string) => `A ${t} clearance goes straight into the away end, who keep the ball. The ref sighs.`,
  (n: string, t: string) => `${n} and his opposite number exchange words at the lineout. Neither is discussing the weather.`,
]
const TIRED_LINES = [
  (n: string) => `${n} has his hands on his knees - the tank is emptying.`,
  (n: string) => `${n} is blowing hard out there.`,
  (n: string) => `${n} takes an age to get up from that ruck. The bench is warming up.`,
  (n: string) => `Cramp for ${n} - he waves away the physio, but the legs have gone.`,
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

function pushEvent(state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null, text: string, playerId?: number) {
  if (!ctx.detail) return
  if (type !== 'HT' && type !== 'FT') {
    min = Math.max(min, ctx.lastMin)
    ctx.lastMin = Math.min(80, min)
  }
  ctx.events.push({
    min, type, teamId: side?.teamId ?? '',
    playerId, playerName: playerId != null ? state.players[playerId]?.name : undefined,
    text, homeScore: ctx.home.score, awayScore: ctx.away.score,
  })
}

export function beginMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean, userTeamId: string | null = state.userClubId): LiveCtx {
  const home = mkSide(state, fx.homeId, userTeamId)
  const away = mkSide(state, fx.awayId, userTeamId)
  const weather = rollWeather(state.week, rng)
  fx.weather = weather
  const derby = isDerby(fx.homeId, fx.awayId)
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
    // the whistle sets the tone: strict refs card, lenient refs let it flow
    if (ref.style === 'strict') side.cardRisk *= 1.45
    if (ref.style === 'lenient') { side.cardRisk *= 0.62; side.units.attack *= 1.03 }
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
        theirs.units[edge.unit] *= 0.955
        mine.units[edge.unit] *= 1.03
      }
      settleAnalyst(state, oppId)
    }
  }

  // dynamic bad blood: derby-lite heat when there's history between the clubs
  const grudge = !derby ? grudgeBetween(state, fx.homeId, fx.awayId) : null
  if (grudge) { home.cardRisk *= 1.25; away.cardRisk *= 1.25 }
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
      side.units.attack *= 1 + Math.min(n, 3) * 0.008
    }
  }
  if (weather === 'Rain') goalPenalty = 0.09
  if (weather === 'Wind') goalPenalty = 0.09
  if (weather === 'Snow') goalPenalty = 0.1

  // Attendance breathes with success: winning sides pack the ground,
  // struggling ones see gaps - and no two gates are ever identical.
  const hostClub = state.clubs[fx.homeId]
  if (hostClub) {
    const recent = state.fixtures
      .filter(f => f.played && (f.homeId === hostClub.id || f.awayId === hostClub.id))
      .slice(-4)
    let formPts = 0
    for (const f of recent) {
      const us = f.homeId === hostClub.id ? f.homeScore : f.awayScore
      const them = f.homeId === hostClub.id ? f.awayScore : f.homeScore
      formPts += us > them ? 1 : us === them ? 0.5 : 0
    }
    const formF = recent.length ? (formPts / recent.length - 0.5) * 0.16 : 0 // hot streak ±8%
    const confF = (hostClub.boardConfidence - 55) / 800                       // mood around the club
    const fanF = hostClub.id === state.userClubId ? ((state.fanMood ?? 60) - 60) / 900 : 0
    let interest = clamp(
      0.44 + hostClub.rep / 250 + (state.clubs[fx.awayId]?.rep ?? 60) / 430 + formF + confF + fanF + gauss(rng) * 0.05,
      0.24, 0.96)
    if (derby) interest = clamp(interest + 0.16, 0.5, 0.99)
    if (fx.stage) interest = clamp(interest + 0.08, 0.5, 0.99) // knockout fever
    // a live count, never a round sell-out figure twice
    const jitter = Math.floor(rng() * Math.max(60, hostClub.capacity * 0.012))
    // seats you can actually shift: the smaller of the ground and the catchment
    const sellable = Math.min(hostClub.capacity, demandCeiling(hostClub))
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
  if (fx.homeId === state.userClubId) hfa += ((state.fanMood ?? 60) - 60) * 0.0006

  const ctx: LiveCtx = {
    fx, home, away, rng, detail, weather, derby, goalPenalty,
    hfa,
    events: [], lastMin: 0,
    isUser: fx.homeId === userTeamId || fx.awayId === userTeamId,
    userSideId: fx.homeId === userTeamId ? fx.homeId : fx.awayId === userTeamId ? fx.awayId : null,
    tick: 0, seg: 0, awaiting: null, motmId: null, talkUsed: false, subsUsed: 0,
    preTalk: null, decision: null, momo: 0, grudge: grudge?.reason ?? null,
  }

  if (derby) {
    pushEvent(state, ctx, 0, 'KO', home, `${derbyName(fx.homeId, fx.awayId)}! ${fx.att ? `${fx.att.toLocaleString()} packed in and` : 'The crowd is'} making an almighty noise. Kick-off!`)
  } else if (grudge) {
    pushEvent(state, ctx, 0, 'KO', home, `Bad blood in the air - ${grudge.reason}, and nobody here has forgotten it. Kick-off!`)
  } else {
    pushEvent(state, ctx, 0, 'KO', home, `Kick-off!${weather === 'Rain' ? ' Rain sheeting across the pitch.' : weather === 'Wind' ? ' A swirling wind will test the kickers.' : weather === 'Snow' ? ' Snow flurries - proper old-school rugby weather.' : ''}`)
  }
  if (fx.homeId === state.userClubId) {
    const mood = state.fanMood ?? 60
    if (mood >= 80) pushEvent(state, ctx, 1, 'SUB', home, `The ground is absolutely bouncing - the supporters are in full voice before a ball is kicked.`)
    else if (mood <= 30) pushEvent(state, ctx, 1, 'SUB', home, `A flat, edgy atmosphere. The crowd is waiting to be given a reason.`)
  }
  if (fx.testimonial != null && state.players[fx.testimonial]) {
    const hero = state.players[fx.testimonial]
    pushEvent(state, ctx, 1, 'SUB', home,
      `${hero.name}'s testimonial. He leads the teams out with his kids at his side, the ground on its feet, scarves above every head. Then the whistle blows and it is a rugby match again.`,
      hero.id)
  }
  if (returnee && returneeApps >= 10) {
    const exSide = home.exIds.has(returnee.id) ? home : away
    const oldClub = teamShort(state, exSide === home ? fx.awayId : fx.homeId)
    pushEvent(state, ctx, 1, 'SUB', exSide,
      `A familiar face out there: ${returnee.name} lines up against ${oldClub}, where he made ${returneeApps} appearances. ${exSide === home ? 'He knows this opposition inside out.' : 'A polite reception from the home crowd - for now.'}`,
      returnee.id)
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
          pushEvent(state, ctx, 1, 'SUB', side,
            `A milestone afternoon: ${p.name} makes career appearance number ${cApps}. The tunnel applauds him out; the scoreboard will not care.`, p.id)
        }
      }
    }
  }
  return ctx
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
    side.energy.set(id, Math.max(0, e - base * side.tempoF * side.drainF * posF * wF))
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
    pushEvent(state, ctx, min, 'PEN', side, PEN_LINES[Math.floor(rng() * PEN_LINES.length)](kicker?.name ?? 'The kicker'), kicker?.id)
  } else if (detail && rng() < 0.7) {
    pushEvent(state, ctx, min, 'SUB', side, `${kicker?.name ?? 'The kicker'} pushes the penalty attempt wide.`, kicker?.id)
  }
}

/** Score a try (+ conversion attempt) for a side - shared by open play and set-piece strikes. */
function scoreTry(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, line?: string, forceScorer?: Player | null) {
  const { rng, goalPenalty } = ctx
  const scorer = forceScorer ?? tryScorer(state, side, rng)
  side.score += 5
  side.tries += 1
  if (scorer) {
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.9)
    scorer.stats.tries += 1
    scorer.stats.points += 5
  }
  const wetTry = (ctx.weather === 'Rain' || ctx.weather === 'Snow') && rng() < 0.25
  const derbyTry = ctx.derby && rng() < 0.3
  const tryPool = derbyTry ? TRY_LINES_DERBY : wetTry ? TRY_LINES_WET : TRY_LINES
  pushEvent(state, ctx, min, 'TRY', side, line ?? (scorer ? tryPool[Math.floor(rng() * tryPool.length)](scorer.name) : 'TRY! The pack drives over the line!'), scorer?.id)
  const cTries = scorer ? scorer.career.reduce((s, c) => s + c.tries, 0) + scorer.stats.tries + (scorer.hist?.tries ?? 0) : 0
  if (scorer && ctx.detail && [25, 50, 75, 100].includes(cTries)) {
    pushEvent(state, ctx, min + 1, 'SUB', side, `Career try number ${cTries} for ${scorer.name}! Both sets of supporters know a milestone when they see one - the applause takes a while to die down.`, scorer.id)
  } else if (scorer && ctx.detail && [10, 15, 20, 25].includes(scorer.stats.tries)) {
    pushEvent(state, ctx, min + 1, 'SUB', side, `That's try number ${scorer.stats.tries} of the season for ${scorer.name} - some campaign he's having.`, scorer.id)
  } else if (scorer && ctx.detail && scorer.id === ctx.fx.testimonial) {
    pushEvent(state, ctx, min + 1, 'SUB', side, `Of all the people. ${scorer.name} scores at his own testimonial and the ground refuses to sit down. Write the script yourself - you could not do better.`, scorer.id)
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.3)
  } else if (scorer && ctx.detail && side.exIds.has(scorer.id) && (min + scorer.id) % 4 < 3) {
    // deterministic gates on all detail-only flavour: commentary must never
    // consume the shared rng stream (the EK/ER lesson, applied everywhere)
    pushEvent(state, ctx, min + 1, 'SUB', side, `No celebration from ${scorer.name} against his old club - hands raised in apology, but the damage is done.`, scorer.id)
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.2)
  } else if (scorer && ctx.detail && scorer.retiring && (scorer.ca >= 72 || (scorer.caps ?? 0) >= 25) && (min + scorer.id) % 5 < 3) {
    pushEvent(state, ctx, min + 1, 'SUB', side, `The whole ground rises for ${scorer.name} - friend and foe alike. He retires in the summer, and nobody here wants to forget watching him do that.`, scorer.id)
  } else if (scorer && ctx.detail && (scorer.rust ?? 0) >= 2 && (min + scorer.id) % 10 < 7) {
    // gate is deterministic (minute + id), not an rng draw: commentary must
    // never move the sim stream - see the EK lesson
    pushEvent(state, ctx, min + 1, 'SUB', side, `${scorer.name} scores on the comeback trail - weeks of rehab, tackle bags and dark mornings, and that try is the answer to all of it. Look at his face.`, scorer.id)
  }
  const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
  const pCon = kickChance(state, kicker, 0.45, 32, goalPenalty, side)
  if (rng() < pCon) {
    side.score += 2
    if (kicker) { kicker.stats.cons += 1; kicker.stats.points += 2 }
    pushEvent(state, ctx, min + 1, 'CON', side, CON_LINES[Math.floor(rng() * CON_LINES.length)](kicker?.name ?? 'The kicker'), kicker?.id)
  } else {
    pushEvent(state, ctx, min + 1, 'SUB', side, `The conversion drifts wide.`)
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
    return 'Points on the board - or so you hope.'
  }
  if (choice === 'corner') {
    const pTry = clamp(0.26 + (mine.units.lineout - opp.units.defence) * 0.022, 0.12, 0.52)
    pushEvent(state, ctx, min, 'SUB', mine, `To the corner! The maul assembles five metres out...`)
    if (rng() < pTry) {
      const forwards = mine.lineup.slice(0, 8)
        .map(id => id != null ? state.players[id] : null)
        .filter((p): p is Player => !!p && mine.onPitch.has(p.id))
      const scorer = forwards.length ? forwards[Math.floor(rng() * forwards.length)] : null
      scoreTry(state, ctx, mine, min + 1, scorer ? `TRY! The maul rumbles over and ${scorer.name} grounds it!` : undefined, scorer)
      return 'The maul delivers - tries win matches.'
    }
    if (rng() < 0.5) {
      pushEvent(state, ctx, min + 1, 'SUB', opp, `Held up! ${teamShort(state, opp.teamId)} survive and win the scrum.`)
      return 'Nothing. The gamble came up empty this time.'
    }
    mine.poss += 1.2
    pushEvent(state, ctx, min + 1, 'SUB', mine, `They repel the maul but concede another penalty - pressure stays on.`)
    return 'No points yet, but you have them pinned.'
  }
  // tap and go
  mine.poss += 1.4
  if (rng() < 0.17) {
    scoreTry(state, ctx, mine, min, undefined)
    return 'Brilliant! The quick tap catches them asleep!'
  }
  pushEvent(state, ctx, min, 'SUB', mine, `Quick tap! ${teamShort(state, mine.teamId)} go through the phases, camped on the line...`)
  return 'Tempo lifted - the momentum is yours even without points.'
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
    side.energy.set(best.id, Math.max(60, state.players[best.id]?.cond ?? 85))
    const benchSlot = side.lineup.indexOf(best.id)
    side.lineup[slot] = best.id
    if (benchSlot >= 0) side.lineup[benchSlot] = outId
    made++
  }
}

function simTick(state: GameState, ctx: LiveCtx, tick: number) {
  const { rng, detail, derby, goalPenalty, home, away } = ctx
  const min = tick * 4 + Math.floor(rng() * 4) + 1
  const poss0: [number, number] = [home.poss, away.poss]

  drainEnergy(state, ctx, home)
  drainEnergy(state, ctx, away)

  const eF = (s: SideCtx) => 0.78 + 0.22 * (sideEnergy(s) / 100)

  for (const [side, opp, adv] of [[home, away, ctx.hfa], [away, home, 1]] as [SideCtx, SideCtx, number][]) {
    const numF = 1 - 0.07 * ([...side.yellowUntil.values()].filter(u => u > min).length + side.sent)
    const oppNumF = 1 - 0.07 * ([...opp.yellowUntil.values()].filter(u => u > min).length + opp.sent)
    const att = (side.units.attack * 0.55 + side.units.breakdown * 0.25 + side.units.scrum * 0.1 + side.units.lineout * 0.1) * eF(side)
    const def = (opp.units.defence * 0.7 + opp.units.breakdown * 0.3) * eF(opp)
    let ratio = ((att * adv * numF) / Math.max(1, def * oppNumF))
    if (derby) ratio = Math.pow(ratio, 0.72) // form book out the window
    else if (ctx.grudge) ratio = Math.pow(ratio, 0.85) // needle levels the contest
    side.poss += ratio
    const pTry = clamp(0.115 * Math.pow(ratio, 2.6), 0.01, 0.42)
    const r = rng()
    if (r < pTry) {
      scoreTry(state, ctx, side, min)
    } else if (r < pTry + 0.115) {
      // a kickable penalty: yours is a touchline decision, theirs is automatic
      opp.consPens += 1
      // repeated infringements: the count climbs, the referee's patience
      // runs out, and somebody takes ten in the bin for the team
      const ref = refFor(ctx.fx.id)
      const binAt = ref.style === 'strict' ? 4 : ref.style === 'lenient' ? 7 : 5
      if ((opp.consPens === binAt || opp.consPens === binAt * 2) && opp.onPitch.size > 13) {
        const ps = [...opp.onPitch].map(id => state.players[id]).filter(Boolean)
        if (ps.length) {
          const p = wpick(rng, ps, ps.map(x => x.a.agg))
          opp.yellowUntil.set(p.id, min + 10)
          p.stats.yc += 1
          opp.ratings.set(p.id, (opp.ratings.get(p.id) ?? 6) - 0.7)
          pushEvent(state, ctx, min, 'YC', opp, `Repeated infringements! That's ${opp.consPens} penalties against ${teamShort(state, opp.teamId)} and the referee has seen enough - ${p.name} takes ten in the bin for the team.`, p.id)
        }
      }
      if (detail && side.isUser && !ctx.decision) {
        ctx.decision = { kind: 'penalty', min }
        pushEvent(state, ctx, min, 'SUB', side, `PENALTY to ${teamShort(state, side.teamId)} - kickable range. The captain looks to the touchline for the call...`)
      } else {
        takePenaltyShot(state, ctx, side, min)
      }
    } else if (r < pTry + 0.115 + 0.006) {
      const fh = side.lineup[9] != null ? state.players[side.lineup[9]!] : null
      if (fh && rng() < 0.3 + fh.a.kic / 40) {
        side.score += 3
        fh.stats.drops += 1; fh.stats.points += 3
        pushEvent(state, ctx, min, 'DG', side, `Drop goal! ${fh.name} from the pocket!`, fh.id)
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
          pushEvent(state, ctx, min, 'SUB', side, TIRED_LINES[Math.floor(rng() * TIRED_LINES.length)](p.name), p.id)
        } else {
          const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow'
          const pool = derby && rng() < 0.3 ? FLAVOR_DERBY
            : ctx.fx.compId === 'natl1' && rng() < 0.3 ? FLAVOR_GRASSROOTS
            : ctx.fx.compId === 'pnc' && rng() < 0.3 ? FLAVOR_PACIFIC
            : wet && rng() < 0.3 ? FLAVOR_WET
            : ctx.weather === 'Wind' && rng() < 0.25 ? FLAVOR_WIND
            : FLAVOR
          pushEvent(state, ctx, min, 'SUB', side, pool[Math.floor(rng() * pool.length)](p.name, teamShort(state, side.teamId)), p.id)
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
          pushEvent(state, ctx, min, 'RC', side, `RED CARD! ${p.name} is sent off!`, p.id)
        } else {
          side.yellowUntil.set(p.id, min + 10)
          p.stats.yc += 1
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
          pushEvent(state, ctx, min, 'YC', side, `Yellow card - ${p.name} to the bin for ten.`, p.id)
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
        const [desc, lo, hi] = INJURIES[Math.floor(rng() * INJURIES.length)]
        let weeks = lo + Math.floor(rng() * (hi - lo + 1))
        if (weeks <= 1 && (p.rust ?? 0) === 0 && rng() < 0.55) {
          // a knock, not a casualty: he plays on with heavy legs
          side.energy.set(p.id, Math.max(5, (side.energy.get(p.id) ?? 70) - 28))
          pushEvent(state, ctx, min, 'SUB', side, `${p.name} takes a heavy knock - he waves the physio away, but he's moving gingerly.`, p.id)
        } else {
          if (p.clubId === state.userClubId) {
            // the physio and the recovery centre both shorten a lay-off
            const care = (state.staff?.physio ?? 0) * 0.12 + facLevel(state, 'recovery') * 0.03
            if (care > 0) weeks = Math.max(1, Math.round(weeks * (1 - care)))
          }
          p.injury = { desc, until: state.week + weeks, weeks }
          side.onPitch.delete(p.id)
          pushEvent(state, ctx, min, 'INJ', side, `${p.name} is down... ${desc}, he can't continue.${(p.rust ?? 0) > 0 ? ' He was rushed back too soon.' : ''}`, p.id)
          const sub = pickBenchSub(state, side, p.id)
          if (sub) {
            side.onPitch.add(sub.id)
            side.ratings.set(sub.id, 6)
            side.energy.set(sub.id, Math.max(60, sub.cond))
            const slot = side.lineup.indexOf(p.id)
            const bSlot = side.lineup.indexOf(sub.id)
            if (slot >= 0 && slot < 15) {
              side.lineup[slot] = sub.id
              if (bSlot >= 0) side.lineup[bSlot] = p.id
            }
            pushEvent(state, ctx, min, 'SUB', side, `${sub.name} comes on in his place.`, sub.id)
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
          pushEvent(state, ctx, min, 'INJ', side, `${p.name} FAILS his Head Injury Assessment - concussion protocols, no further part. ${sub.name} stays on.`, pid)
        } else {
          side.onPitch.delete(subId)
          side.onPitch.add(pid)
          pushEvent(state, ctx, min, 'SUB', side, `${p.name} passes his HIA and jogs back into the fray.`, pid)
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
        side.energy.set(sub.id, Math.max(60, sub.cond))
        side.hia = { pid: p.id, subId: sub.id, failed: rng() < 0.4, returnTick: ctx.tick + 3 }
        pushEvent(state, ctx, min, 'INJ', side, `${p.name} is led away for a Head Injury Assessment - ${sub.name} on while the doctors do their work.`, p.id)
      }
    }

    // stupid moments - rugby's comedy reel, momentum goes the other way
    if (rng() < 0.006) {
      const ids = [...side.onPitch]
      const p = ids.length ? state.players[ids[Math.floor(rng() * ids.length)]] : null
      if (p) {
        const lines = [
          `${p.name} drops the ball over the line with the try begging! White-line fever at its cruellest.`,
          `${p.name} kicks it dead from halfway - absolutely nothing on. The coach turns away.`,
          `Oh no - ${p.name} throws a wild offload straight to the opposition. Cheap turnover.`,
          `${p.name} completely misses the restart. It bounces once and rolls into touch. Chaos.`,
          `${p.name} runs a lap of honour before grounding it... and the cover knocks it loose! Unforgivable.`,
        ]
        pushEvent(state, ctx, min, 'SUB', side, lines[Math.floor(rng() * lines.length)], p.id)
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
  simTick(state, ctx, ctx.tick)
  ctx.tick += 1
  aiTacticShift(state, ctx)
  if (ctx.tick === 10) {
    ctx.seg = 1
    ctx.awaiting = 'HT'
    pushEvent(state, ctx, 40, 'HT', null, `Half-time: ${teamShort(state, ctx.fx.homeId)} ${ctx.home.score} - ${ctx.away.score} ${teamShort(state, ctx.fx.awayId)}`)
    const t = ctx.home.poss + ctx.away.poss || 1
    pushEvent(state, ctx, 40, 'SUB', null, `First-half numbers: possession ${Math.round((ctx.home.poss / t) * 100)}%–${Math.round((ctx.away.poss / t) * 100)}%, tries ${ctx.home.tries}–${ctx.away.tries}, penalty goals ${ctx.home.pens}–${ctx.away.pens}.`)
    return 'HT'
  }
  if (ctx.tick === 15) {
    ctx.seg = 2
    ctx.awaiting = 'BRK'
    pushEvent(state, ctx, 60, 'BRK', null, `Hour mark - a lull in play. Time to change the picture from the sideline.`)
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
    if (side.isUser || side.shifted) continue
    const opp = side === ctx.home ? ctx.away : ctx.home
    const diff = side.score - opp.score
    const min = ctx.tick * 4
    const coach = state.clubs[side.teamId]?.coach
    const who = coach ?? `The ${teamShort(state, side.teamId)} coach`
    if (ctx.tick >= 12 && diff <= -10) {
      side.shifted = true
      side.units.attack *= 1.06
      side.units.defence *= 0.95
      side.tempoF *= 1.14
      side.cardRisk *= 1.15
      pushEvent(state, ctx, min, 'SUB', side,
        `${who} has seen enough - shackles off, bench emptied. ${teamShort(state, side.teamId)} will run everything as they chase the game.`)
    } else if (ctx.tick >= 16 && diff >= 10) {
      side.shifted = true
      side.units.defence *= 1.05
      side.units.attack *= 0.94
      side.tempoF *= 0.88
      pushEvent(state, ctx, min, 'SUB', side,
        `${who} signals to the corners: game management time. ${teamShort(state, side.teamId)} will strangle the clock from here.`)
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
  if (ctx.preTalk) return 'The speech has been made.'
  ctx.preTalk = kind
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const favourites = mine.units.overall >= opp.units.overall
  const say = (opts: string[]) => opts[Math.floor(ctx.rng() * opts.length)]
  switch (kind) {
    case 'calm':
      mine.units.defence *= 1.06
      mine.cardRisk *= 0.78
      return say([
        'Cool heads. You walk them through the first twenty minutes - no panic, no cheap penalties.',
        'Quiet voice, slow words. By the end the room is breathing at your pace. First twenty on our terms.',
        'You put the game plan on one whiteboard line and cap the pen. "Do the simple things forever." Nods all round.',
      ])
    case 'fire':
      mine.units.attack *= 1.07
      mine.units.breakdown *= 1.05
      mine.cardRisk *= 1.28
      return say([
        'The door rattles on its hinges. They leave the shed snorting - expect fireworks, and watch the referee.',
        'You knock a water bottle across the room on the way out. The studs in the tunnel sound like a drumroll.',
        'Two sentences, both loud. The front row leave first and the door does not survive intact. Mind the penalty count.',
      ])
    case 'underdog':
      if (!favourites) {
        mine.units.attack *= 1.07
        mine.units.defence *= 1.05
        return say([
          `"Nobody gives us a prayer out there. Perfect." The room tightens - shackles off, nothing to lose.`,
          `You read their team sheet out loud, name by name, then bin it. "Now let's ruin their afternoon." Grins everywhere.`,
          `"They have already written their headlines. Make the editors start again." The room hums.`,
        ])
      }
      mine.units.attack *= 0.98
      return say([
        'You talk them down as underdogs... but everyone in the room knows you should win this. A few puzzled looks.',
        'The siege mentality does not fit a side this good, and the room knows it. The captain frowns at his boots.',
      ])
    case 'expect':
      if (favourites) {
        mine.units.attack *= 1.04
        mine.units.defence *= 1.03
        return say([
          'Standards. You expect a professional performance and the senior men nod - this is what we do.',
          '"Win, and win properly." Nothing else needs saying. The leaders take it from there.',
          'You name the standard, not the opposition. The room likes that - this is about us, not them.',
        ])
      }
      if (ctx.rng() < 0.45) {
        mine.units.attack *= 1.06
        return say([
          'A big call against stronger opposition - but they respond. Chests out.',
          'You demand it anyway, and the room decides to believe you. Dangerous men, believers.',
        ])
      }
      mine.units.defence *= 0.96
      return say([
        'You demand a win few expect. One or two shoulders tighten - the pressure lands badly.',
        'The words hang wrong in the air. Young eyes find the floor - that was a speech for a different team.',
      ])
  }
}

/** Half-time team talk for the user's side. One per match. */
export function applyTeamTalk(state: GameState, ctx: LiveCtx, kind: 'fire' | 'calm' | 'praise' | 'demand'): string {
  if (ctx.talkUsed) return 'The talk has been given.'
  ctx.talkUsed = true
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const winning = mine.score > opp.score
  // deterministic rotation (score + tick), never the shared rng - ES rule
  const say = (opts: string[]) => opts[(mine.score + opp.score + ctx.tick) % opts.length]
  switch (kind) {
    case 'fire':
      mine.units.attack *= 1.07; mine.units.breakdown *= 1.05; mine.cardRisk *= 1.3
      return say([
        'The shouting rattles the door on its hinges. They leave snorting - expect fire, and watch the referee.',
        'A cup of tea goes flying. Forty minutes of everything, you tell them, or explain yourselves to the fans outside. They leave at a jog.',
        'You go through the pack man by man, voice up, collar loose. The room is silent, then very loud. Watch the penalty count.',
      ])
    case 'calm':
      mine.units.defence *= 1.06; mine.cardRisk *= 0.8
      return say([
        'Calm, clear, matter-of-fact. The defensive shape gets one more walk-through before they head out.',
        'No theatre. Two fixes on the whiteboard, one reminder about discipline, handshakes on the way out. Grown-up rugby.',
        'You lower the temperature of the room by ten degrees. The message: trust the system, make the tackle in front of you.',
      ])
    case 'praise':
      if (winning) { mine.units.attack *= 1.04; mine.units.defence *= 1.03 }
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
        mine.units.attack *= 1.08; mine.units.defence *= 1.04
        return say([
          'Encouraging, positive, believing - and the senior players nod along. They look ready to empty the tank.',
          'More, you ask - not different, just more. The captain answers for the room: they have more.',
        ])
      }
      mine.units.attack *= 0.97
      return say([
        'You gee them up, but a couple of heads stay down. The message floats past them.',
        'You ask for more and the room hears criticism. Two players study their bootlaces. Wrong crowd, wrong day.',
      ])
    }
  }
}

/** Substitution for the user's side (max 5 tactical subs), any time play is stopped. */
export function makeSubstitution(state: GameState, ctx: LiveCtx, outId: number, inId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return 'The match is over.'
  if (ctx.subsUsed >= 5) return 'All five tactical replacements used.'
  const slotOut = mine.lineup.indexOf(outId)
  const slotIn = mine.lineup.indexOf(inId)
  const pin = state.players[inId]
  const pout = state.players[outId]
  if (slotOut < 0 || slotOut > 14 || !pout) return 'That player is not in the starting side.'
  if (!pin || pin.injury || (mine.ratings.has(inId) && mine.onPitch.has(inId))) return 'He is not available.'
  mine.lineup[slotOut] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = outId
  mine.onPitch.delete(outId)
  mine.onPitch.add(inId)
  if (!mine.ratings.has(inId)) mine.ratings.set(inId, 6)
  mine.energy.set(inId, Math.max(60, pin.cond))
  ctx.subsUsed += 1
  recomputeSideUnits(state, ctx, mine)
  pushEvent(state, ctx, Math.min(79, Math.max(1, ctx.lastMin)), 'SUB', mine, `Change from the bench: ${pin.name} replaces ${pout.name}.`, pin.id)
  return `${pin.name} will come on for ${pout.name}.`
}

/** Rebuild a side's unit strengths from its current lineup, tactics and conditions. */
export function recomputeSideUnits(state: GameState, ctx: LiveCtx, side: SideCtx) {
  side.units = teamUnits(state, side.lineup)
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
  pushEvent(state, ctx, 80, 'FT', null, `Full-time: ${teamShort(state, fx.homeId)} ${home.score} - ${away.score} ${teamShort(state, fx.awayId)}`)
  if (detail) fx.events = ctx.events

  // Test rugby keeps score beyond the scoreboard: the world rankings move
  if (!state.clubs[fx.homeId] && !state.clubs[fx.awayId]) updateNatRank(state, fx)

  // an ill-tempered afternoon starts a feud of its own
  const totalCards = home.yellowUntil.size + home.sent + away.yellowUntil.size + away.sent
  if (totalCards >= 5 && state.clubs[fx.homeId] && state.clubs[fx.awayId] && !isDerby(fx.homeId, fx.awayId)) {
    addGrudge(state, fx.homeId, fx.awayId, `the last meeting boiled over - ${totalCards} cards and a tunnel full of pushing`, 1)
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
        playerId: haunter.id,
        fixtureId: fx.id,
      })
    }
  }

  let motmId: number | null = null
  let motmR = -1
  const debutants: { p: Player; r: number; kind: 'signing' | 'academy' }[] = []
  for (const side of [home, away]) {
    const won = side.score > (side === home ? away.score : home.score)
    const isNation = !state.clubs[side.teamId]
    for (const [pid, r0] of side.ratings) {
      const p = state.players[pid]
      if (!p) continue
      const r = clamp(r0 + (won ? 0.5 : -0.3) + gauss(rng) * 0.8, 1, 10)
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
              ? `${p.name} won his first Test cap for ${nationByCode(side.teamId)?.name ?? side.teamId} this week. The shirt gets framed; the club that made him gets the reflected glow.`
              : `${p.name} brought up his ${p.caps}th cap for ${nationByCode(side.teamId)?.name ?? side.teamId} this week - a special jersey, a guard of honour, and a proud week around the club.`,
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
        p.lastR = r
        p.lastWk = state.week
        p.form = clamp(p.form * 0.65 + r * 0.35, 1, 10)
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
              playerId: p.id,
            })
          }
          if (p.stats.yc > 0 && p.stats.yc % 4 === 0 && ctx.events.some(e => e.type === 'YC' && e.playerId === pid)) {
            p.bans += 1
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
              subject: `${p.name} banned - totting up`,
              body: `${p.stats.yc} yellow cards this season have earned ${p.name} a one-match suspension from the citing commissioner.`,
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
    // so twenty seasons of Monday papers do not all start the same way
    const say = (opts: string[]) => opts[Math.floor(rng() * opts.length)]
    const opener = margin >= 20 ? say([
        `A statement. ${teamShort(state, us.teamId)} were ruthless from the first whistle.`,
        `${oppName} will not want to watch that back. Total control, first minute to last.`,
        `One of those afternoons when everything you drew on the whiteboard actually happened.`,
      ])
      : margin > 7 ? say([
        `A convincing afternoon's work, controlled from the front.`,
        `Professional. Ahead early, managed from there, nobody hurt. Take it and move on.`,
        `The scoreboard says comfortable. The forwards' knuckles say earned.`,
      ])
      : margin > 0 ? say([
        `Tight, tense - and yours. Games like this one win seasons.`,
        `Ugly wins count double in the dressing room. Nobody sings about the performance; everybody sings.`,
        `Decided by inches and nerve. Yours held.`,
      ])
      : margin === 0 ? say([
        `Honours even, and nobody quite sure how to feel about it.`,
        `A draw that will feel like two points dropped or one rescued, depending on the day you had.`,
        `All square. The handshakes were polite and nobody meant them.`,
      ])
      : margin >= -7 ? say([
        `The finest of margins, the wrong side of them. It will sting for a few days.`,
        `Close enough to touch, and that is what makes it worse. One moment, either way.`,
        `Beaten, barely. The review will find three plays that would have flipped it.`,
      ])
      : say([
        `A day to forget. The video session on Monday will be a long one.`,
        `${oppName} were better in every department, and the score was honest about it.`,
        `Second to everything, including the excuses. Training just got harder.`,
      ])
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: true,
      subject: `📰 ${teamShort(state, fx.homeId)} ${home.score}–${away.score} ${teamShort(state, fx.awayId)}`,
      body: [
        opener,
        scorers(us) ? `Tries: ${scorers(us)}` : `No tries for ${teamShort(state, us.teamId)} today.`,
        scorers(them) ? `${oppName} tries: ${scorers(them)}` : '',
        motm ? `Man of the match: ${motm.name} (${motmR.toFixed(1)})` : '',
        fx.att ? [
          `${fx.att.toLocaleString()} at ${state.clubs[fx.homeId]?.stadium ?? 'the ground'}`,
          state.comps[fx.compId]?.name ?? (fx.compId === 'fr' ? 'Friendly' : ''),
          fx.weather && fx.weather !== 'Dry' ? fx.weather : '',
        ].filter(Boolean).join(' · ') : '',
      ].filter(Boolean).join('\n'),
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
