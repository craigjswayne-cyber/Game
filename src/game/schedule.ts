import type { Competition, Fixture, GameState, TableRow } from './model'
import { shuffled, type Rng } from './rng'
import { seedNatRank } from './natrank'
import { nationByCode } from './nations'

const ordinalWord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`

// ---- Season calendar (week indices 1..45) ----
// 1-3    PRE-SEASON friendlies (cross-league, every club)
// 4-17   league rounds (autumn tests overlay weeks 13-15)
// 18,19  Champions Cup pool 1-2 (leagues pause)
// 20,21  league
// 22,23  Champions Cup pool 3-4
// 24-31  league (Six Nations overlay 25-29)
// 32,33  Champions Cup pool 5-6
// 34-37  league
// 38     CC quarter-finals
// 39     CC semi-finals
// 40     league playoff round 1 (QF / barrage)
// 41     CC FINAL
// 42     league semi-finals
// 43     league FINALS
// 44-45  end of season processing

export const PRESEASON_WEEKS = [1, 2, 3]
export const LEAGUE_WEEKS = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 34, 35, 36, 37,
]
export const CC_POOL_WEEKS = [18, 19, 22, 23, 32, 33]
export const CC_KO_WEEKS = [38, 39, 41]
export const AUTUMN_WEEKS = [13, 14, 15]
export const SIX_NATIONS_WEEKS = [25, 26, 27, 28, 29]
export const TRC_WEEKS = [5, 6, 7, 9, 10, 11]
export const PNC_WEEKS = [5, 6, 7, 9, 10]

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
    koWeeks: spec.playoffTeams > 4 ? [40, 42, 43] : [42, 43],
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
/** Pre-season: three weeks of friendlies for every club before the real
 *  stuff. The user's run is cross-league opposition, home-away-home. */
export function schedulePreseason(state: GameState, rng: Rng) {
  const mkFr = (week: number, homeId: string, awayId: string) => {
    state.fixtures.push({
      id: state.nextId++, compId: 'fr', round: week - 1, week,
      homeId, awayId, played: false,
      homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
    })
  }
  const user = state.clubs[state.userClubId]
  const usedByUser = new Set<string>()
  for (const week of PRESEASON_WEEKS) {
    const used = new Set<string>([state.userClubId])
    // The user's opponent: another league, never his own, and DRAWN rather than
    // computed. The old pick was the single closest club by reputation, which
    // is a deterministic function of the club - every Northampton career opened
    // against the same three sides (user: "change up who we play in pre seasons
    // so its not all the same three"). Now a hat holds the ten nearest peers
    // from other leagues plus the four best sides from lower-tier leagues (a
    // trip to a Championship ground is a proper pre-season tradition), and the
    // rng draws one per week. New career, new seed, new fixtures.
    if (user) {
      const pool = Object.values(state.clubs)
        .filter(c => c.leagueId !== user.leagueId && !usedByUser.has(c.id))
      const peers = [...pool]
        .sort((a, b) => Math.abs(a.rep - user.rep) - Math.abs(b.rep - user.rep))
        .slice(0, 10)
      const lower = pool
        .filter(c => c.rep <= user.rep - 12)
        .sort((a, b) => b.rep - a.rep)
        .slice(0, 4)
      const hat = [...new Set([...peers, ...lower])]
      const opp = hat.length ? hat[Math.floor(rng() * hat.length)] : null
      if (opp) {
        usedByUser.add(opp.id)
        used.add(opp.id)
        if (week === PRESEASON_WEEKS[1]) mkFr(week, opp.id, user.id)
        else mkFr(week, user.id, opp.id)
      }
    }
    // everyone else pairs up too, cross-league where the draw allows
    const rest = shuffled(rng, Object.values(state.clubs).map(c => c.id).filter(id => !used.has(id)))
    for (const id of rest) {
      if (used.has(id)) continue
      const partner = rest.find(o => !used.has(o) && o !== id && state.clubs[o].leagueId !== state.clubs[id].leagueId)
        ?? rest.find(o => !used.has(o) && o !== id)
      if (!partner) break
      used.add(id)
      used.add(partner)
      mkFr(week, id, partner)
    }
  }
}

export function buildChampionsCup(clubIds: string[], rng: Rng, state: GameState,
  // just "Champions Cup" (user: "remove the word continental")
  meta: { id: string; name: string; short: string } = { id: 'cc', name: 'Champions Cup', short: 'Champions Cup' },
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

export const TOUR_WEEKS = [44, 45]
export const WC_POOL_WEEKS = [5, 6, 7, 8, 9]
export const WC_KO_WEEKS = [10, 11, 12]

/** Rugby World Cup: 20 nations, 4 pools of 5, then QF/SF/Final. */
function buildWorldCup(rng: Rng, state: GameState) {
  const nations = [
    'RSA', 'NZL', 'IRE', 'FRA', 'ENG', 'ARG', 'SCO', 'AUS', 'FIJ', 'ITA',
    'WAL', 'GEO', 'JPN', 'SAM', 'TGA', 'USA', 'URU', 'POR', 'ESP', 'CHL',
  ]
  // the draw is seeded from the live world rankings: four years of Test
  // results decide who gets the kind pool and who gets the group of death
  seedNatRank(state)
  const seeded = [...nations].sort((a, b) => (state.natRank![b] ?? 0) - (state.natRank![a] ?? 0))
  const comp: Competition = {
    id: 'wc', name: 'Rugby World Cup', short: 'World Cup', type: 'intl',
    teamIds: nations, table: nations.map(emptyRow), rounds: 5, playoffTeams: 8,
    weeksByRound: WC_POOL_WEEKS, koWeeks: WC_KO_WEEKS, isNational: true,
    seeds: seeded,
  }
  // seeded pools: snake the top seeds so pools are balanced
  const pools: string[][] = [[], [], [], []]
  seeded.forEach((n, i) => {
    const row = Math.floor(i / 4)
    const idx = row % 2 === 0 ? i % 4 : 3 - (i % 4)
    pools[idx].push(n)
  })
  comp.pools = pools
  const top4 = seeded.slice(0, 4).map(c => nationByCode(c)?.name ?? c)
  const userSeed = state.natTeam ? seeded.indexOf(state.natTeam) + 1 : 0
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'intl', read: false,
    subject: `🏆 World Cup draw: the rankings pick the pools`,
    body: [
      `The World Cup pools are set, seeded from the world rankings. Top seeds: ${top4.join(', ')}.`,
      userSeed > 0 ? `${nationByCode(state.natTeam!)?.name ?? state.natTeam} go in as the ${ordinalWord(userSeed)} seed - anything short of ${userSeed <= 4 ? 'the semi-finals will be a failure' : userSeed <= 8 ? 'the quarter-finals will raise questions' : 'the knockouts would still be par'}.`
        : `Four pools, five nations each, and somewhere in there a group of death.`,
    ].join('\n'),
  })
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

/**
 * Where a club sits in a league, or 0 before a ball has been kicked.
 *
 * Every tiebreak in sortTable is zero for every club until games are played,
 * so the sort is stable and returns insertion order - which is how the Home
 * screen came to tell a brand new manager he was already 6th, and told a side
 * that had won its only match 70-10 that it was 11th. Callers already handle
 * 0 by printing a dash; they were simply never given one.
 */
export function leaguePos(table: TableRow[] | undefined, clubId: string): number {
  if (!table?.length) return 0
  if (table.every(r => r.p === 0)) return 0
  return sortTable(table).findIndex(r => r.teamId === clubId) + 1
}
