import type { GameState, Player, Pos } from './model'
import { boardObjective, emptyStats, fmtMoney, seasonLabel } from './model'
import { buildChampionsCup, buildInternationals, buildLeague, sortTable } from './schedule'
import { LEAGUE_DEFS } from './newgame'
import { autoSelect } from './matchEngine'
import { deriveAttrs, nextPid, playerValue, playerWage } from './attributes'
import { regenName } from './nations'
import { clamp, mulberry32, pick, type Rng } from './rng'

const ordinal = (n: number) =>
  n <= 0 ? '—' : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

function seasonAwards(state: GameState) {
  const userLeague = state.clubs[state.userClubId].leagueId
  const leaguePlayers = Object.values(state.players).filter(p =>
    p.clubId && state.clubs[p.clubId]?.leagueId === userLeague && p.stats.apps >= 8)
  if (!leaguePlayers.length) return
  const topPoints = [...leaguePlayers].sort((a, b) => b.stats.points - a.stats.points)[0]
  const topTries = [...leaguePlayers].sort((a, b) => b.stats.tries - a.stats.tries)[0]
  const potm = [...leaguePlayers].sort((a, b) =>
    b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))[0]
  const leagueName = state.comps[userLeague]?.name ?? 'the league'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `${seasonLabel(state.season)} ${leagueName} awards`,
    body: [
      `Player of the Season: ${potm.name} (${state.clubs[potm.clubId!]?.short}) — avg rating ${(potm.stats.ratingSum / Math.max(1, potm.stats.apps)).toFixed(2)}`,
      `Top Points Scorer: ${topPoints.name} — ${topPoints.stats.points} points`,
      `Top Try Scorer: ${topTries.name} — ${topTries.stats.tries} tries`,
    ].join('\n'),
  })
}

function agePlayers(state: GameState, rng: Rng) {
  const retirees: Player[] = []
  for (const p of Object.values(state.players)) {
    p.age += 1
    // development / decline
    if (p.age <= 23 && p.ca < p.pa) p.ca = clamp(p.ca + 2 + Math.floor(rng() * 3), 1, p.pa)
    else if (p.age <= 27 && p.ca < p.pa) p.ca = clamp(p.ca + 1 + Math.floor(rng() * 2), 1, p.pa)
    else if (p.age >= 33) p.ca = clamp(p.ca - (2 + Math.floor(rng() * 3)), 30, 99)
    else if (p.age >= 31) p.ca = clamp(p.ca - (1 + Math.floor(rng() * 2)), 30, 99)
    // attribute drift toward new ca
    const scale = p.ca / Math.max(30, p.q0)
    if (Math.abs(scale - 1) > 0.05) {
      for (const k of Object.keys(p.a) as (keyof Player['a'])[]) {
        p.a[k] = clamp(Math.round(p.a[k] * (0.85 + 0.15 * scale) + (scale > 1 ? 0.5 : -0.5)), 1, 20)
      }
    }
    // retirement
    const retireChance = p.age >= 38 ? 1 : p.age >= 36 ? 0.6 : p.age >= 34 ? (p.ca < 72 ? 0.45 : 0.2) : p.age >= 33 && p.ca < 60 ? 0.3 : 0
    if (rng() < retireChance) retirees.push(p)
    p.value = playerValue(p.ca, p.age, p.pa)
  }
  const userRetirees = retirees.filter(p => p.clubId === state.userClubId)
  for (const p of retirees) {
    if (p.clubId) {
      const c = state.clubs[p.clubId]
      c.players = c.players.filter(id => id !== p.id)
    }
    delete state.players[p.id]
  }
  if (userRetirees.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'general', read: false,
      subject: 'Retirements',
      body: `Hanging up the boots: ${userRetirees.map(p => `${p.name} (${p.age})`).join(', ')}. The dressing room won't be the same.`,
    })
  }
}

function handleContracts(state: GameState, rng: Rng) {
  const freed: Player[] = []
  for (const p of Object.values(state.players)) {
    if (p.clubId && p.contractEnds < state.season + 1) {
      const club = state.clubs[p.clubId]
      if (p.clubId !== state.userClubId && rng() < 0.5) {
        // quiet AI renewal
        p.contractEnds = state.season + 2
        p.wage = playerWage(p.ca, p.age)
        continue
      }
      club.players = club.players.filter(id => id !== p.id)
      if (p.clubId === state.userClubId) freed.push(p)
      p.clubId = null
      p.transferListed = false
    }
  }
  if (freed.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'contract', read: false,
      subject: 'Contracts expired',
      body: `Departed on free transfers after their deals expired: ${freed.map(p => p.name).join(', ')}.`,
    })
  }
}

const YOUTH_POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']

function youthIntake(state: GameState, rng: Rng) {
  for (const club of Object.values(state.clubs)) {
    const n = 2 + Math.floor(rng() * 3)
    const names: string[] = []
    for (let i = 0; i < n; i++) {
      const pos = pick(rng, YOUTH_POS)
      const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12)
      const raw = {
        name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country),
        pos, age: 17 + Math.floor(rng() * 2), nat: club.country, q,
        gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      }
      const p: Player = {
        id: nextPid(),
        name: raw.name, pos, alt: [], age: raw.age, nat: raw.nat, clubId: club.id,
        a: deriveAttrs(raw, state.seed + state.season * 977 + i),
        ca: q, pa: clamp(q + 25 + Math.floor(rng() * 30), q, 99), q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true,
      }
      p.value = playerValue(p.ca, p.age, p.pa)
      state.players[p.id] = p
      club.players.push(p.id)
      names.push(`${p.name} (${pos})`)
    }
    if (club.id === state.userClubId) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
        subject: 'Academy intake arrives',
        body: `The academy has promoted this year's crop: ${names.join(', ')}. The coaches are excited about one or two of them.`,
      })
    }
  }
}

/** Any club left short of bodies signs free agents (board-driven squad fillers). */
function replenishSquads(state: GameState, rng: Rng) {
  const freeAgents = () => Object.values(state.players)
    .filter(p => !p.clubId && p.age <= 34)
    .sort((a, b) => b.ca - a.ca)
  for (const club of Object.values(state.clubs)) {
    let guard = 0
    while (club.players.length < 26 && guard++ < 15) {
      // biggest positional hole
      const byPos: Record<string, number> = {}
      for (const id of club.players) {
        const p = state.players[id]
        if (p) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
      }
      const need = YOUTH_POS.find(pos => (byPos[pos] ?? 0) < 2) ?? pick(rng, YOUTH_POS)
      const fa = freeAgents().find(p => p.pos === need || p.alt.includes(need)) ?? freeAgents()[0]
      if (!fa) break
      fa.clubId = club.id
      fa.wage = playerWage(fa.ca, fa.age)
      fa.contractEnds = state.season + 1
      fa.morale = 7
      club.players.push(fa.id)
      if (club.id === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
          subject: `Board signing: ${fa.name}`,
          body: `With the squad short of numbers, the board moved to sign free agent ${fa.name} (${fa.pos}, ${fa.age}) on a one-year deal.`,
          playerId: fa.id,
        })
      }
    }
  }
}

/** Full end-of-season rollover into a fresh campaign. */
export function rebuildSeason(state: GameState) {
  const rng = mulberry32(state.seed ^ ((state.season + 1) * 60013))

  seasonAwards(state)

  // board verdict on the season vs their stated objective
  {
    const club = state.clubs[state.userClubId]
    const comp = state.comps[club.leagueId]
    if (comp) {
      const pos = sortTable(comp.table).findIndex(r => r.teamId === club.id) + 1
      const obj = boardObjective(club.rep)
      const wonLeague = comp.champion === club.id
      const met = wonLeague || (pos > 0 && pos <= obj.pos)
      club.boardConfidence = clamp(club.boardConfidence + (wonLeague ? 25 : met ? 12 : -14), 5, 100)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: met ? 'Board delighted with the season' : 'Board verdict: not good enough',
        body: `The objective was to ${obj.text}. You finished ${ordinal(pos)}${wonLeague ? ' and won the title' : ''}. ${met
          ? 'The chairman shakes your hand warmly — keep building.'
          : 'The chairman expects markedly better next season.'}`,
      })
    }
  }

  // prize money & budget refresh (uses final tables before wipe)
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const order = sortTable(comp.table).map(r => r.teamId)
    order.forEach((teamId, idx) => {
      const club = state.clubs[teamId]
      if (!club) return
      const prize = Math.max(0, (order.length - idx)) * 120_000 + (comp.champion === teamId ? 1_500_000 : 0)
      club.balance += prize
    })
  }

  // archive player season -> career
  for (const p of Object.values(state.players)) {
    if (p.stats.apps > 0 && p.clubId) {
      p.career.push({ season: state.season, clubId: p.clubId, apps: p.stats.apps, tries: p.stats.tries, points: p.stats.points })
      if (p.career.length > 20) p.career = p.career.slice(-20)
    }
    p.stats = emptyStats()
    p.form = 6
    p.morale = clamp(p.morale, 5, 10)
    p.cond = 100
    p.sharp = 60
    p.injury = null
    p.bans = 0
    p.natSquad = false
  }
  state.natSquads = {}

  agePlayers(state, rng)
  handleContracts(state, rng)
  youthIntake(state, rng)
  replenishSquads(state, rng)

  // keep the free-agent pool from growing without bound over long careers
  const fas = Object.values(state.players)
    .filter(p => !p.clubId)
    .sort((a, b) => b.ca - a.ca)
  for (const p of fas.slice(120)) delete state.players[p.id]
  for (const p of fas.slice(0, 120)) if (p.age >= 35) delete state.players[p.id]

  // Champions Cup qualification for next season from final league standings
  const euroSlots: string[] = []
  const slotMap: Record<string, number> = { prem: 5, top14: 6, urc: 5 }
  for (const [leagueId, slots] of Object.entries(slotMap)) {
    const comp = state.comps[leagueId]
    if (comp) euroSlots.push(...sortTable(comp.table).map(r => r.teamId).slice(0, slots))
  }

  // wipe season structures & rebuild
  state.season += 1
  state.week = 1
  state.fixtures = []
  state.offers = []
  state.press = state.press.filter(p => !p.answered).slice(-5)
  state.comps = {}

  for (const def of LEAGUE_DEFS()) {
    const teamIds = Object.values(state.clubs).filter(c => c.leagueId === def.id).map(c => c.id)
    state.comps[def.id] = buildLeague(
      { id: def.id, name: def.name, short: def.short, teams: teamIds, double: def.double, playoffTeams: def.playoffTeams },
      rng, state,
    )
  }
  state.comps['cc'] = buildChampionsCup(euroSlots.slice(0, 16), rng, state)
  buildInternationals(rng, state)

  // budgets: base by rep + carryover health
  for (const club of Object.values(state.clubs)) {
    club.budget = Math.max(200_000, Math.round((club.rep * 45_000 + Math.max(0, club.balance) * 0.15) / 50_000) * 50_000)
    club.boardConfidence = clamp(club.boardConfidence * 0.6 + 30, 0, 100)
    const pool = club.players.map(id => state.players[id]).filter(Boolean)
    club.tactic.lineup = autoSelect(state, pool)
  }

  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
    subject: `The ${seasonLabel(state.season)} season begins`,
    body: `Pre-season is over. Your transfer budget has been set at ${fmtMoney(state.clubs[state.userClubId].budget)}. Bring us silverware.`,
  })
}
