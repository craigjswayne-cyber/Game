import type { Competition, Fixture, GameState, TableRow } from './model'
import { shuffled, type Rng } from './rng'

// ---- Season calendar (week indices 1..42) ----
// 1-14   league rounds (autumn tests overlay weeks 10-12)
// 15,16  Champions Cup pool 1-2 (leagues pause)
// 17,18  league
// 19,20  Champions Cup pool 3-4
// 21-28  league (Six Nations overlay 22-26)
// 29,30  Champions Cup pool 5-6
// 31-34  league
// 35     CC quarter-finals
// 36     CC semi-finals
// 37     league playoff round 1 (QF / barrage)
// 38     CC FINAL
// 39     league semi-finals
// 40     league FINALS
// 41-42  end of season processing

export const LEAGUE_WEEKS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34,
]
export const CC_POOL_WEEKS = [15, 16, 19, 20, 29, 30]
export const CC_KO_WEEKS = [35, 36, 38]
export const AUTUMN_WEEKS = [10, 11, 12]
export const SIX_NATIONS_WEEKS = [22, 23, 24, 25, 26]
export const TRC_WEEKS = [2, 3, 4, 6, 7, 8]
export const PNC_WEEKS = [2, 3, 4, 6, 7]

/** Berger-style round robin. Returns rounds of [home, away] pairs. */
export function roundRobin(teams: string[], rng: Rng, double: boolean): [string, string][][] {
  const ids = shuffled(rng, teams)
  const n = ids.length
  const odd = n % 2 === 1
  const list: (string | null)[] = odd ? [...ids, null] : [...ids]
  const m = list.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < m - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < m / 2; i++) {
      const a = list[i]
      const b = list[m - 1 - i]
      if (a && b) round.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(round)
    // rotate (keep first fixed)
    list.splice(1, 0, list.pop()!)
  }
  if (double) {
    const second = rounds.map(r => r.map(([h, a]) => [a, h] as [string, string]))
    return [...rounds, ...second]
  }
  return rounds
}

export function emptyRow(teamId: string): TableRow {
  return { teamId, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, tf: 0, ta: 0, bp: 0, pts: 0 }
}

export interface LeagueSpec {
  id: string
  name: string
  short: string
  teams: string[]
  double: boolean
  playoffTeams: number // 4, 6, or 8
}

/** Evenly spread `count` rounds across the available league weeks. */
function allocWeeks(count: number): number[] {
  const avail = LEAGUE_WEEKS
  if (count >= avail.length) return avail.slice(0, count)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(avail[Math.round((i * (avail.length - 1)) / (count - 1))])
  }
  return [...new Set(out)].length === count ? out : avail.slice(0, count)
}

export function buildLeague(spec: LeagueSpec, rng: Rng, state: GameState): Competition {
  const rounds = roundRobin(spec.teams, rng, spec.double)
  const weeks = allocWeeks(rounds.length)
  const comp: Competition = {
    id: spec.id,
    name: spec.name,
    short: spec.short,
    type: 'league',
    teamIds: spec.teams,
    table: spec.teams.map(emptyRow),
    rounds: rounds.length,
    playoffTeams: spec.playoffTeams,
    weeksByRound: weeks,
    koWeeks: spec.playoffTeams > 4 ? [37, 39, 40] : [39, 40],
  }
  rounds.forEach((pairs, r) => {
    for (const [h, a] of pairs) {
      state.fixtures.push({
        id: state.nextId++,
        compId: spec.id,
        round: r,
        week: weeks[r],
        homeId: h,
        awayId: a,
        played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  return comp
}

/** Champions Cup: 16 clubs, 4 pools of 4 (double RR = 6 rounds), then QF/SF/F. */
export function buildChampionsCup(clubIds: string[], rng: Rng, state: GameState,
  meta: { id: string; name: string; short: string } = { id: 'cc', name: 'Continental Champions Cup', short: 'Champions Cup' },
): Competition {
  const teams = shuffled(rng, clubIds.slice(0, 16))
  const comp: Competition = {
    id: meta.id,
    name: meta.name,
    short: meta.short,
    type: 'cup',
    teamIds: teams,
    table: teams.map(emptyRow),
    rounds: 6,
    playoffTeams: 8,
    weeksByRound: CC_POOL_WEEKS,
    koWeeks: CC_KO_WEEKS,
  }
  // seeded pools: 1 top seed per pool
  const pools: string[][] = [[], [], [], []]
  teams.forEach((t, i) => pools[i % 4].push(t))
  comp.pools = pools
  pools.forEach(pool => {
    const rounds = roundRobin(pool, rng, true)
    rounds.forEach((pairs, r) => {
      for (const [h, a] of pairs) {
        state.fixtures.push({
          id: state.nextId++,
          compId: meta.id,
          round: r,
          week: CC_POOL_WEEKS[r],
          homeId: h, awayId: a,
          played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        })
      }
    })
  })
  return comp
}

export const TOUR_WEEKS = [41, 42]
export const WC_POOL_WEEKS = [2, 3, 4, 5, 6]
export const WC_KO_WEEKS = [7, 8, 9]

/** Rugby World Cup: 20 nations, 4 pools of 5, then QF/SF/Final. */
function buildWorldCup(rng: Rng, state: GameState) {
  const nations = [
    'RSA', 'NZL', 'IRE', 'FRA', 'ENG', 'ARG', 'SCO', 'AUS', 'FIJ', 'ITA',
    'WAL', 'GEO', 'JPN', 'SAM', 'TGA', 'USA', 'URU', 'POR', 'ESP', 'CHL',
  ]
  const comp: Competition = {
    id: 'wc', name: 'Rugby World Cup', short: 'World Cup', type: 'intl',
    teamIds: nations, table: nations.map(emptyRow), rounds: 5, playoffTeams: 8,
    weeksByRound: WC_POOL_WEEKS, koWeeks: WC_KO_WEEKS, isNational: true,
  }
  // seeded pools: snake the top seeds so pools are balanced
  const pools: string[][] = [[], [], [], []]
  nations.forEach((n, i) => {
    const row = Math.floor(i / 4)
    const idx = row % 2 === 0 ? i % 4 : 3 - (i % 4)
    pools[idx].push(n)
  })
  comp.pools = pools
  pools.forEach(pool => {
    const rounds = roundRobin(pool, rng, false)
    rounds.forEach((pairs, r) => {
      for (const [h, a] of pairs) {
        state.fixtures.push({
          id: state.nextId++, compId: 'wc', round: r, week: WC_POOL_WEEKS[r],
          homeId: h, awayId: a, played: false,
          homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        })
      }
    })
  })
  state.comps['wc'] = comp
}

/** Lions years: 2029, 2033, ... (every 4th season, offset from the World Cup). */
export function isLionsSeason(season: number): boolean {
  return (2025 + season) % 4 === 1 && season > 0
}

/** Summer theatre: either a Lions series or north-south tours close the season. */
function buildSummer(rng: Rng, state: GameState) {
  const season = state.season
  if (isLionsSeason(season)) {
    const hosts = ['NZL', 'RSA', 'AUS']
    const host = hosts[Math.floor((2025 + season - 2029) / 4) % 3]
    const comp: Competition = {
      id: 'lions', name: `Lions Tour of ${host === 'NZL' ? 'New Zealand' : host === 'RSA' ? 'South Africa' : 'Australia'}`,
      short: 'Lions Tour', type: 'intl',
      teamIds: ['LIO', host], table: ['LIO', host].map(emptyRow), rounds: 2, playoffTeams: 0,
      weeksByRound: TOUR_WEEKS, koWeeks: [], isNational: true,
    }
    TOUR_WEEKS.forEach((week, r) => {
      state.fixtures.push({
        id: state.nextId++, compId: 'lions', round: r, week,
        homeId: host, awayId: 'LIO', played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        stage: r === 0 ? '1st Test' : '2nd Test',
      })
    })
    state.comps['lions'] = comp
    return
  }
  // classic July tours: north heads south for two-Test series
  const north = shuffled(rng, ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA'])
  const south = shuffled(rng, ['NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'JPN'])
  const comp: Competition = {
    id: 'tour', name: 'Summer Tours', short: 'Summer Tours', type: 'intl',
    teamIds: [...north, ...south], table: [], rounds: 2, playoffTeams: 0,
    weeksByRound: TOUR_WEEKS, koWeeks: [], isNational: true,
  }
  TOUR_WEEKS.forEach((week, r) => {
    north.forEach((n, i) => {
      state.fixtures.push({
        id: state.nextId++, compId: 'tour', round: r, week,
        homeId: south[i], awayId: n, played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        stage: r === 0 ? '1st Test' : '2nd Test',
      })
    })
  })
  state.comps['tour'] = comp
}

/** Six Nations & Rugby Championship (played by national teams, engine-lite). */
export function buildInternationals(rng: Rng, state: GameState, worldCup = false) {
  if (worldCup) buildWorldCup(rng, state)
  if (!worldCup) buildSummer(rng, state)
  const sn = ['ENG', 'FRA', 'IRE', 'ITA', 'SCO', 'WAL']
  const snRounds = roundRobin(sn, rng, false)
  const snComp: Competition = {
    id: 'sn', name: 'Six Nations', short: 'Six Nations', type: 'intl',
    teamIds: sn, table: sn.map(emptyRow), rounds: 5, playoffTeams: 0,
    weeksByRound: SIX_NATIONS_WEEKS, koWeeks: [], isNational: true,
  }
  snRounds.forEach((pairs, r) => {
    for (const [h, a] of pairs) {
      state.fixtures.push({
        id: state.nextId++, compId: 'sn', round: r, week: SIX_NATIONS_WEEKS[r],
        homeId: h, awayId: a, played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  state.comps['sn'] = snComp

  // In a World Cup year there is no Rugby Championship and no autumn series
  if (worldCup) return

  const trc = ['NZL', 'RSA', 'AUS', 'ARG']
  const trcRounds = roundRobin(trc, rng, true)
  const trcComp: Competition = {
    id: 'trc', name: 'The Rugby Championship', short: 'Rugby Champ.', type: 'intl',
    teamIds: trc, table: trc.map(emptyRow), rounds: 6, playoffTeams: 0,
    weeksByRound: TRC_WEEKS, koWeeks: [], isNational: true,
  }
  trcRounds.forEach((pairs, r) => {
    for (const [h, a] of pairs) {
      state.fixtures.push({
        id: state.nextId++, compId: 'trc', round: r, week: TRC_WEEKS[r],
        homeId: h, awayId: a, played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  state.comps['trc'] = trcComp

  // Pacific Nations Cup: the tier-two showpiece, alongside the Championship
  const pnc = ['FIJ', 'JPN', 'SAM', 'TGA', 'USA', 'CAN']
  const pncRounds = roundRobin(pnc, rng, false)
  const pncComp: Competition = {
    id: 'pnc', name: 'Pacific Nations Cup', short: 'Pacific Cup', type: 'intl',
    teamIds: pnc, table: pnc.map(emptyRow), rounds: 5, playoffTeams: 0,
    weeksByRound: PNC_WEEKS, koWeeks: [], isNational: true,
  }
  pncRounds.forEach((pairs, r) => {
    for (const [h, a] of pairs) {
      state.fixtures.push({
        id: state.nextId++, compId: 'pnc', round: r, week: PNC_WEEKS[r],
        homeId: h, awayId: a, played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  state.comps['pnc'] = pncComp

  // Autumn tests: north v south pairings, 3 weekends
  const north = ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA']
  const south = ['NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'JPN']
  const aut: Competition = {
    id: 'aut', name: 'Autumn Internationals', short: 'Autumn Tests', type: 'intl',
    teamIds: [...north, ...south], table: [], rounds: 3, playoffTeams: 0,
    weeksByRound: AUTUMN_WEEKS, koWeeks: [], isNational: true,
  }
  AUTUMN_WEEKS.forEach((week, r) => {
    const s = shuffled(rng, south)
    north.forEach((n, i) => {
      state.fixtures.push({
        id: state.nextId++, compId: 'aut', round: r, week,
        homeId: n, awayId: s[i], played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    })
  })
  state.comps['aut'] = aut
}

export function sortTable(table: TableRow[]): TableRow[] {
  return [...table].sort((a, b) =>
    b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.tf - a.tf || b.pf - a.pf)
}
