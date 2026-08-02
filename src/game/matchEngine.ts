import type { Fixture, GameState, MatchEvent, Player, Pos, Weather } from './model'
import { BENCH_SLOTS, XV_SLOTS } from './model'
import { effAt } from './attributes'
import { nationByCode } from './nations'
import { derbyName, isDerby } from './rivalries'
import { clamp, gauss, wpick, type Rng } from './rng'

/** Seasonal weather: wetter and colder through the winter weeks. */
export function rollWeather(week: number, rng: Rng): Weather {
  const winter = week >= 10 && week <= 26
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
  const used = new Set<number>()
  const lineup: (number | null)[] = new Array(23).fill(null)
  const score = (p: Player, pos: Pos) =>
    effAt(p, pos) * (0.7 + 0.3 * (p.cond / 100)) * (0.85 + 0.03 * p.form)

  for (let i = 0; i < 15; i++) {
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
  for (let b = 0; b < 8; b++) {
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
    return p.a[k] * fit * frm
  }
  const fw = [0, 1, 2, 3, 4, 5, 6, 7]
  const bk = [8, 9, 10, 11, 12, 13, 14]
  const scrum = avg([at(0, 'scr'), at(1, 'scr'), at(2, 'scr'), at(3, 'str'), at(4, 'str'), at(0, 'str'), at(2, 'str')])
  const lineout = avg([at(1, 'lin'), at(3, 'lin'), at(4, 'lin'), at(5, 'lin'), at(7, 'lin')])
  const breakdown = avg(fw.map(i => at(i, 'ruc')))
  const attack = avg([
    ...bk.map(i => at(i, 'han')),
    at(9, 'vis') * 1.5, at(8, 'pas') * 1.3, at(11, 'pac'), at(12, 'pac'),
    at(10, 'pac'), at(13, 'pac'), at(14, 'pos'),
  ])
  const defence = avg([...fw.map(i => at(i, 'tac')), ...bk.map(i => at(i, 'tac')), at(14, 'pos') * 1.2])
  const kicking = avg([at(9, 'kic') * 1.6, at(8, 'kic'), at(14, 'kic')])
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

function lineupFor(state: GameState, teamId: string): (number | null)[] {
  const club = state.clubs[teamId]
  const isNation = !club
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
  /** per-player petrol tank, 0-100 — drains with minutes played */
  energy: Map<number, number>
  /** drain multiplier from tempo tactics */
  tempoF: number
  /** goal-kicking bonus from the kicking coach */
  goalBonus: number
  isUser: boolean
}

/** Tactic + weather + coaching modifiers, applied to freshly computed units. */
function applyModifiers(state: GameState, side: SideCtx, weather: Weather | null) {
  const club = state.clubs[side.teamId]
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
  // a proper captain in the XV steadies the ship and keeps discipline
  if (club?.captain != null && side.lineup.slice(0, 15).includes(club.captain)) {
    const cap = state.players[club.captain]
    if (cap && cap.a.lea >= 12) {
      const f = 1 + (cap.a.lea - 11) * 0.0022 // up to ~+2% at lea 20
      side.units.attack *= f
      side.units.defence *= f
      side.cardRisk *= 0.93
    }
  }
  // your backroom staff sharpen the matchday units
  if (side.isUser && state.staff) {
    const s = state.staff
    side.units.attack *= 1 + (s.attack ?? 0) * 0.016
    side.units.defence *= 1 + (s.defence ?? 0) * 0.016
    side.units.scrum *= 1 + (s.scrumCoach ?? 0) * 0.015
    side.units.lineout *= 1 + (s.scrumCoach ?? 0) * 0.015
    side.units.kicking *= 1 + (s.kicking ?? 0) * 0.02
    side.goalBonus = (s.kicking ?? 0) * 0.012
  }
  if (weather === 'Rain' || weather === 'Snow') {
    side.units.attack *= weather === 'Snow' ? 0.9 : 0.94
    side.units.breakdown *= 1.03 // wet weather is forward weather
  }
  if (weather === 'Wind') side.units.kicking *= 0.92
}

function mkSide(state: GameState, teamId: string): SideCtx {
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
    poss: 0, pens: 0,
    energy, tempoF: 1, goalBonus: 0,
    isUser: teamId === state.userClubId,
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
    return (posW[p.pos] ?? 1) * (0.5 + p.a.pac / 20) * fresh
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
]
const PEN_LINES = [
  (n: string) => `${n} slots the penalty.`,
  (n: string) => `${n} makes no mistake from the tee.`,
  (n: string) => `${n} strikes it true — three more points.`,
  (n: string) => `${n} bisects the uprights from distance.`,
]
const CON_LINES = [
  (n: string) => `${n} adds the extras.`,
  (n: string) => `${n} curls the conversion over.`,
  (n: string) => `${n} converts from the touchline!`,
]
const FLAVOR = [
  (n: string, t: string) => `Big carry from ${n} takes ${t} into the 22.`,
  (n: string, t: string) => `${n} makes a searing half-break for ${t}.`,
  (n: string, t: string) => `Turnover! ${n} wins the breakdown battle for ${t}.`,
  (n: string, t: string) => `Monster scrum from the ${t} pack — penalty advantage.`,
  (n: string, t: string) => `${n} claims the high ball under pressure.`,
  (n: string, t: string) => `Rolling maul from ${t} eats up twenty metres.`,
  (n: string, t: string) => `${n} clears the lines with a booming touch-finder.`,
  (n: string, t: string) => `Thunderous hit by ${n} — the crowd roars.`,
]
const TIRED_LINES = [
  (n: string) => `${n} has his hands on his knees — the tank is emptying.`,
  (n: string) => `${n} is blowing hard out there.`,
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

export function beginMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean): LiveCtx {
  const home = mkSide(state, fx.homeId)
  const away = mkSide(state, fx.awayId)
  const weather = rollWeather(state.week, rng)
  fx.weather = weather
  const derby = isDerby(fx.homeId, fx.awayId)
  fx.derby = derby
  let goalPenalty = 0
  for (const side of [home, away]) {
    if (weather === 'Rain' || weather === 'Snow') {
      side.units.attack *= weather === 'Snow' ? 0.9 : 0.94
      side.units.breakdown *= 1.03
    }
    if (weather === 'Wind') side.units.kicking *= 0.92
    if (derby) side.cardRisk *= 1.35
  }
  if (weather === 'Rain') goalPenalty = 0.06
  if (weather === 'Wind') goalPenalty = 0.09
  if (weather === 'Snow') goalPenalty = 0.1

  const hostClub = state.clubs[fx.homeId]
  if (hostClub) {
    const interest = derby ? 0.99 : clamp(
      0.5 + hostClub.rep / 200 + (state.clubs[fx.awayId]?.rep ?? 60) / 400 + gauss(rng) * 0.08, 0.3, 1)
    fx.att = Math.round(hostClub.capacity * interest)
  }

  const ctx: LiveCtx = {
    fx, home, away, rng, detail, weather, derby, goalPenalty,
    hfa: state.clubs[fx.homeId] ? 1.06 : 1.03,
    events: [], lastMin: 0,
    isUser: fx.homeId === state.userClubId || fx.awayId === state.userClubId,
    tick: 0, seg: 0, awaiting: null, motmId: null, talkUsed: false, subsUsed: 0,
    preTalk: null, decision: null, momo: 0,
  }

  if (derby) {
    pushEvent(state, ctx, 0, 'KO', home, `${derbyName(fx.homeId, fx.awayId)}! ${fx.att ? `${fx.att.toLocaleString()} packed in and` : 'The crowd is'} making an almighty noise. Kick-off!`)
  } else {
    pushEvent(state, ctx, 0, 'KO', home, `Kick-off!${weather === 'Rain' ? ' Rain sheeting across the pitch.' : weather === 'Wind' ? ' A swirling wind will test the kickers.' : weather === 'Snow' ? ' Snow flurries — proper old-school rugby weather.' : ''}`)
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
    const base = 2.0 + (20 - p.a.sta) * 0.14
    const posF = FW_POS.has(p.pos) ? 1.1 : 1
    const e = side.energy.get(id) ?? 80
    side.energy.set(id, Math.max(0, e - base * side.tempoF * posF * wF))
  }
}

/** Take the three points: roll the kick at goal. */
function takePenaltyShot(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  const { rng, detail, goalPenalty } = ctx
  const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
  const pPen = (kicker ? clamp(0.5 + kicker.a.goa / 34, 0.5, 0.92) : 0.55) - goalPenalty + side.goalBonus
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

/** Score a try (+ conversion attempt) for a side — shared by open play and set-piece strikes. */
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
  pushEvent(state, ctx, min, 'TRY', side, line ?? (scorer ? TRY_LINES[Math.floor(rng() * TRY_LINES.length)](scorer.name) : 'TRY! The pack drives over the line!'), scorer?.id)
  const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
  const pCon = (kicker ? clamp(0.45 + kicker.a.goa / 32, 0.5, 0.94) : 0.55) - goalPenalty + side.goalBonus
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
  const mine = ctx.home.teamId === state.userClubId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const min = Math.min(79, d.min + 1)
  const rng = ctx.rng
  if (choice === 'posts') {
    takePenaltyShot(state, ctx, mine, min)
    return 'Points on the board — or so you hope.'
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
      return 'The maul delivers — tries win matches.'
    }
    if (rng() < 0.5) {
      pushEvent(state, ctx, min + 1, 'SUB', opp, `Held up! ${teamShort(state, opp.teamId)} survive and win the scrum.`)
      return 'Nothing. The gamble came up empty this time.'
    }
    mine.poss += 1.2
    pushEvent(state, ctx, min + 1, 'SUB', mine, `They repel the maul but concede another penalty — pressure stays on.`)
    return 'No points yet, but you have them pinned.'
  }
  // tap and go
  mine.poss += 1.4
  if (rng() < 0.17) {
    scoreTry(state, ctx, mine, min, undefined)
    return 'Brilliant! The quick tap catches them asleep!'
  }
  pushEvent(state, ctx, min, 'SUB', mine, `Quick tap! ${teamShort(state, mine.teamId)} go through the phases, camped on the line...`)
  return 'Tempo lifted — the momentum is yours even without points.'
}

/** AI (and injury-forced) bench management: tired starters are replaced. */
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
    side.poss += ratio
    const pTry = clamp(0.115 * Math.pow(ratio, 2.6), 0.01, 0.42)
    const r = rng()
    if (r < pTry) {
      scoreTry(state, ctx, side, min)
    } else if (r < pTry + 0.115) {
      // a kickable penalty: yours is a touchline decision, theirs is automatic
      if (detail && side.isUser && !ctx.decision) {
        ctx.decision = { kind: 'penalty', min }
        pushEvent(state, ctx, min, 'SUB', side, `PENALTY to ${teamShort(state, side.teamId)} — kickable range. The captain looks to the touchline for the call...`)
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
          pushEvent(state, ctx, min, 'SUB', side, FLAVOR[Math.floor(rng() * FLAVOR.length)](p.name, teamShort(state, side.teamId)), p.id)
        }
      }
    }

    // discipline — tired sides give away more
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
          pushEvent(state, ctx, min, 'YC', side, `Yellow card — ${p.name} to the bin for ten.`, p.id)
        }
      }
    }

    // injury — tired legs and rusty returners break down more
    if (rng() < 0.019) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(p => p && !p.injury)
      if (ps.length) {
        const w = ps.map(p => {
          const rustF = (p.rust ?? 0) > 0 ? 3.4 : 1
          const tiredF = (side.energy.get(p.id) ?? 70) < 25 ? 1.8 : 1
          return rustF * tiredF
        })
        const p = wpick(rng, ps, w)
        const [desc, lo, hi] = INJURIES[Math.floor(rng() * INJURIES.length)]
        let weeks = lo + Math.floor(rng() * (hi - lo + 1))
        if (p.clubId === state.userClubId && state.staff?.physio) {
          weeks = Math.max(1, Math.round(weeks * (1 - state.staff.physio * 0.12)))
        }
        p.injury = { desc, until: state.week + weeks, weeks }
        side.onPitch.delete(p.id)
        pushEvent(state, ctx, min, 'INJ', side, `${p.name} is down... ${desc}, he can't continue.${(p.rust ?? 0) > 0 ? ' He was rushed back too soon.' : ''}`, p.id)
        const sub = side.lineup.slice(15).map(id => id != null ? state.players[id] : null)
          .find(s => s && !side.onPitch.has(s.id) && !s.injury && !side.ratings.has(s.id))
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
        }
      }
    }

    aiAutoSubs(state, ctx, side, min)
  }

  // momentum needle: who owned the last few minutes
  const dh = home.poss - poss0[0]
  const da = away.poss - poss0[1]
  ctx.momo = clamp(ctx.momo * 0.62 + (dh - da) * 0.55, -1, 1)
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
  if (ctx.tick === 10) {
    ctx.seg = 1
    ctx.awaiting = 'HT'
    pushEvent(state, ctx, 40, 'HT', null, `Half-time: ${teamShort(state, ctx.fx.homeId)} ${ctx.home.score} - ${ctx.away.score} ${teamShort(state, ctx.fx.awayId)}`)
    return 'HT'
  }
  if (ctx.tick === 15) {
    ctx.seg = 2
    ctx.awaiting = 'BRK'
    pushEvent(state, ctx, 60, 'BRK', null, `Hour mark — a lull in play. Time to change the picture from the sideline.`)
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
export function applyPreTalk(state: GameState, ctx: LiveCtx, kind: 'calm' | 'fire' | 'underdog' | 'expect' | 'enjoy'): string {
  if (ctx.preTalk) return 'The speech has been made.'
  ctx.preTalk = kind
  const mine = ctx.home.teamId === state.userClubId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const favourites = mine.units.overall >= opp.units.overall
  switch (kind) {
    case 'calm':
      mine.units.defence *= 1.05
      mine.cardRisk *= 0.82
      return 'Cool heads. You walk them through the first twenty minutes — no panic, no cheap penalties.'
    case 'fire':
      mine.units.attack *= 1.06
      mine.units.breakdown *= 1.04
      mine.cardRisk *= 1.28
      return 'The door rattles on its hinges. They leave the shed snorting — expect fireworks, and watch the referee.'
    case 'underdog':
      if (!favourites) {
        mine.units.attack *= 1.07
        mine.units.defence *= 1.05
        return `"Nobody gives us a prayer out there. Perfect." The room tightens — shackles off, nothing to lose.`
      }
      mine.units.attack *= 0.98
      return 'You talk them down as underdogs... but everyone in the room knows you should win this. A few puzzled looks.'
    case 'expect':
      if (favourites) {
        mine.units.attack *= 1.04
        mine.units.defence *= 1.03
        return 'Standards. You expect a professional performance and the senior men nod — this is what we do.'
      }
      if (ctx.rng() < 0.45) {
        mine.units.attack *= 1.06
        return 'A big call against stronger opposition — but they respond. Chests out.'
      }
      mine.units.defence *= 0.96
      return 'You demand a win few expect. One or two shoulders tighten — the pressure lands badly.'
    case 'enjoy':
      mine.units.attack *= 1.03
      mine.cardRisk *= 0.92
      return `"Go and enjoy it." Smiles in the shed. Loose, confident — sometimes that's everything.`
  }
}

/** Half-time team talk for the user's side. One per match. */
export function applyTeamTalk(state: GameState, ctx: LiveCtx, kind: 'fire' | 'calm' | 'praise' | 'demand'): string {
  if (ctx.talkUsed) return 'The talk has been given.'
  ctx.talkUsed = true
  const mine = ctx.home.teamId === state.userClubId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const winning = mine.score > opp.score
  switch (kind) {
    case 'fire':
      mine.units.attack *= 1.07; mine.units.breakdown *= 1.05; mine.cardRisk *= 1.3
      return 'You let them have it. Studs rattle the floor on the way out — expect fire, and maybe a card.'
    case 'calm':
      mine.units.defence *= 1.06; mine.cardRisk *= 0.8
      return 'Composed and clear. The defensive shape gets one more walk-through before they head out.'
    case 'praise':
      if (winning) { mine.units.attack *= 1.04; mine.units.defence *= 1.03 }
      return winning
        ? 'Confidence flows — keep doing exactly this.'
        : 'Generous words, though a few eyebrows rise given the scoreboard.'
    case 'demand': {
      const roll = ctx.rng()
      if (roll < 0.5) {
        mine.units.attack *= 1.08; mine.units.defence *= 1.04
        return 'You demand more, and the senior players nod. They look ready to empty the tank.'
      }
      mine.units.attack *= 0.97
      return 'You demand more — but a couple of heads drop. The gamble may backfire.'
    }
  }
}

/** Substitution for the user's side (max 5 tactical subs), any time play is stopped. */
export function makeSubstitution(state: GameState, ctx: LiveCtx, outId: number, inId: number): string {
  const mine = ctx.home.teamId === state.userClubId ? ctx.home : ctx.away
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
  const mine = ctx.home.teamId === state.userClubId ? ctx.home : ctx.away
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

  let motmId: number | null = null
  let motmR = -1
  for (const side of [home, away]) {
    const won = side.score > (side === home ? away.score : home.score)
    const isNation = !state.clubs[side.teamId]
    for (const [pid, r0] of side.ratings) {
      const p = state.players[pid]
      if (!p) continue
      const r = clamp(r0 + (won ? 0.5 : -0.3) + gauss(rng) * 0.8, 1, 10)
      if (!isNation) {
        p.stats.apps += 1
        if (side.lineup.slice(0, 15).includes(pid)) p.stats.starts += 1
        p.stats.ratingSum += r
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
              subject: `${p.name} banned — totting up`,
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
}

/** Simulate a full match in one go (AI fixtures, tests, quick sims). */
export function simMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean): SimResult {
  const ctx = beginMatch(state, fx, rng, detail)
  playHalf(state, ctx)
  playHalf(state, ctx)
  return { events: ctx.events, motmId: ctx.motmId }
}
