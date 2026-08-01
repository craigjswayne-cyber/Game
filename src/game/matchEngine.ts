import type { Fixture, GameState, MatchEvent, Player, Pos } from './model'
import { BENCH_SLOTS, XV_SLOTS } from './model'
import { effAt } from './attributes'
import { nationByCode } from './nations'
import { clamp, gauss, wpick, type Rng } from './rng'

// ------------------------------------------------------------------
// Selection
// ------------------------------------------------------------------

export function availablePlayers(state: GameState, ids: number[], forNation = false): Player[] {
  return ids
    .map(id => state.players[id])
    .filter(p => p && !p.injury && p.bans === 0 && (forNation || !p.natSquad))
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

interface SideCtx {
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
}

function mkSide(state: GameState, teamId: string): SideCtx {
  const lineup = lineupFor(state, teamId)
  const ratings = new Map<number, number>()
  const onPitch = new Set<number>()
  lineup.slice(0, 15).forEach(id => { if (id != null) { ratings.set(id, 6 + gaussNoise()); onPitch.add(id) } })
  const units = teamUnits(state, lineup)
  // tactics shape the team's output
  const club = state.clubs[teamId]
  let aggBoost = 0
  if (club) {
    const t = club.tactic
    const f = (v: number) => (v - 50) / 50 // -1..1
    units.attack *= 1 + f(t.style) * 0.06 + f(t.tempo) * 0.05
    units.scrum *= 1 - f(t.style) * 0.05
    units.breakdown *= 1 + f(t.aggression) * 0.06 - f(t.style) * 0.03
    units.kicking *= 1 + f(t.kicking) * 0.1
    units.defence *= 1 - f(t.tempo) * 0.03
    aggBoost = f(t.aggression) * 0.006
  }
  return {
    teamId, lineup, units,
    score: 0, tries: 0, ratings, onPitch, yellowUntil: new Map(), sent: 0,
    cardRisk: 0.012 + aggBoost,
  }
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
    return (posW[p.pos] ?? 1) * (0.5 + p.a.pac / 20)
  })
  return wpick(rng, ps, w)
}

export interface SimResult {
  events: MatchEvent[]
  motmId: number | null
}

export function simMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean): SimResult {
  const home = mkSide(state, fx.homeId)
  const away = mkSide(state, fx.awayId)
  const events: MatchEvent[] = []
  const isUser = fx.homeId === state.userClubId || fx.awayId === state.userClubId

  let lastMin = 0
  const push = (min: number, type: MatchEvent['type'], side: SideCtx | null, text: string, playerId?: number) => {
    if (!detail) return
    if (type !== 'HT' && type !== 'FT') {
      min = Math.max(min, lastMin)
      lastMin = Math.min(80, min)
    }
    events.push({
      min, type, teamId: side?.teamId ?? '',
      playerId, playerName: playerId != null ? state.players[playerId]?.name : undefined,
      text, homeScore: home.score, awayScore: away.score,
    })
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

  push(0, 'KO', home, 'Kick-off!')

  // home advantage
  const HFA = state.clubs[fx.homeId] ? 1.06 : 1.03

  for (let tick = 0; tick < 20; tick++) {
    const min = tick * 4 + Math.floor(rng() * 4) + 1
    if (tick === 10) push(40, 'HT', null, 'Half-time')

    for (const [side, opp, adv] of [[home, away, HFA], [away, home, 1]] as [SideCtx, SideCtx, number][]) {
      // numeric disadvantage from cards
      const numF = 1 - 0.07 * ([...side.yellowUntil.values()].filter(u => u > min).length + side.sent)
      const oppNumF = 1 - 0.07 * ([...opp.yellowUntil.values()].filter(u => u > min).length + opp.sent)
      const att = side.units.attack * 0.55 + side.units.breakdown * 0.25 + side.units.scrum * 0.1 + side.units.lineout * 0.1
      const def = opp.units.defence * 0.7 + opp.units.breakdown * 0.3
      const ratio = ((att * adv * numF) / Math.max(1, def * oppNumF))
      const pTry = clamp(0.115 * Math.pow(ratio, 2.6), 0.01, 0.42)
      const r = rng()
      if (r < pTry) {
        const scorer = tryScorer(state, side, rng)
        side.score += 5
        side.tries += 1
        if (scorer) {
          side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.9)
          scorer.stats.tries += 1
          scorer.stats.points += 5
        }
        push(min, 'TRY', side, scorer ? TRY_LINES[Math.floor(rng() * TRY_LINES.length)](scorer.name) : 'TRY! The pack drives over the line!', scorer?.id)
        // conversion
        const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
        const pCon = kicker ? clamp(0.45 + kicker.a.goa / 32, 0.5, 0.94) : 0.55
        if (rng() < pCon) {
          side.score += 2
          if (kicker) { kicker.stats.cons += 1; kicker.stats.points += 2 }
          push(min + 1, 'CON', side, CON_LINES[Math.floor(rng() * CON_LINES.length)](kicker?.name ?? 'The kicker'), kicker?.id)
        } else {
          push(min + 1, 'SUB', side, `The conversion drifts wide.`)
        }
      } else if (r < pTry + 0.115) {
        // penalty opportunity — kick at goal
        const kicker = side.units.kickerId != null ? state.players[side.units.kickerId] : null
        const pPen = kicker ? clamp(0.5 + kicker.a.goa / 34, 0.5, 0.92) : 0.55
        if (rng() < pPen) {
          side.score += 3
          if (kicker) {
            kicker.stats.pens += 1; kicker.stats.points += 3
            side.ratings.set(kicker.id, (side.ratings.get(kicker.id) ?? 6) + 0.15)
          }
          push(min, 'PEN', side, PEN_LINES[Math.floor(rng() * PEN_LINES.length)](kicker?.name ?? 'The kicker'), kicker?.id)
        } else if (detail && rng() < 0.5) {
          push(min, 'SUB', side, `${kicker?.name ?? 'The kicker'} pushes the penalty attempt wide.`, kicker?.id)
        }
      } else if (r < pTry + 0.115 + 0.006) {
        const fh = side.lineup[9] != null ? state.players[side.lineup[9]!] : null
        if (fh && rng() < 0.3 + fh.a.kic / 40) {
          side.score += 3
          fh.stats.drops += 1; fh.stats.points += 3
          push(min, 'DG', side, `Drop goal! ${fh.name} from the pocket!`, fh.id)
        }
      }

      // atmosphere lines for the live ticker
      if (detail && rng() < 0.3) {
        const ids = [...side.onPitch]
        const ps = ids.map(id => state.players[id]).filter(Boolean)
        if (ps.length) {
          const p = ps[Math.floor(rng() * ps.length)]
          push(min, 'SUB', side, FLAVOR[Math.floor(rng() * FLAVOR.length)](p.name, teamShort(state, side.teamId)), p.id)
        }
      }

      // discipline
      if (rng() < side.cardRisk) {
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
            push(min, 'RC', side, `RED CARD! ${p.name} is sent off!`, p.id)
          } else {
            side.yellowUntil.set(p.id, min + 10)
            p.stats.yc += 1
            side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
            push(min, 'YC', side, `Yellow card — ${p.name} to the bin for ten.`, p.id)
          }
        }
      }

      // injury
      if (rng() < 0.019) {
        const ids = [...side.onPitch]
        const ps = ids.map(id => state.players[id]).filter(p => p && !p.injury)
        if (ps.length) {
          const p = ps[Math.floor(rng() * ps.length)]
          const [desc, lo, hi] = INJURIES[Math.floor(rng() * INJURIES.length)]
          const weeks = lo + Math.floor(rng() * (hi - lo + 1))
          p.injury = { desc, until: state.week + weeks }
          side.onPitch.delete(p.id)
          push(min, 'INJ', side, `${p.name} is down... ${desc}, he can't continue.`, p.id)
          // bench replacement joins
          const sub = side.lineup.slice(15).map(id => id != null ? state.players[id] : null)
            .find(s => s && !side.onPitch.has(s.id) && !s.injury && !side.ratings.has(s.id))
          if (sub) { side.onPitch.add(sub.id); side.ratings.set(sub.id, 6) }
        }
      }
    }

    // tactical subs around 55-68 mins
    if (tick === 15) {
      for (const side of [home, away]) {
        let subs = 0
        for (let b = 15; b < 23 && subs < 5; b++) {
          const id = side.lineup[b]
          if (id == null) continue
          const p = state.players[id]
          if (!p || p.injury || side.ratings.has(id)) continue
          side.onPitch.add(id)
          side.ratings.set(id, 6)
          subs++
        }
      }
    }
  }

  fx.played = true
  fx.homeScore = home.score
  fx.awayScore = away.score
  fx.homeTries = home.tries
  fx.awayTries = away.tries
  push(80, 'FT', null, `Full-time: ${teamShort(state, fx.homeId)} ${home.score} - ${away.score} ${teamShort(state, fx.awayId)}`)
  if (detail) fx.events = events

  // attendance + gate for club home games
  const hc = state.clubs[fx.homeId]
  if (hc) {
    const interest = clamp(0.5 + hc.rep / 200 + (state.clubs[fx.awayId]?.rep ?? 60) / 400 + gauss(rng) * 0.08, 0.3, 1)
    fx.att = Math.round(hc.capacity * interest)
  }

  // finalize ratings -> stats, form
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
        p.morale = clamp(p.morale + (won ? 0.4 : -0.5), 1, 10)
        p.cond = clamp(p.cond - (14 + Math.floor(rng() * 10)), 20, 100)
        p.sharp = clamp(p.sharp + 12, 0, 100)
      }
      if (r > motmR) { motmR = r; motmId = pid }
    }
  }
  if (motmId != null && isUser) {
    const p = state.players[motmId]
    if (p) p.stats.motm += 1
    fx.motm = motmId
  }

  return { events, motmId }
}
