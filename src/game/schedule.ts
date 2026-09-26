import type { Competition, Fixture, GameState, TableRow } from './model'
import { W, genderOf, type Gender } from './gender'
import {absWeek, BASE_YEAR, fixtureDayOff, worldCupSeasonFor } from './model'
import {
  AUTUMN_WEEKS, CC_KO_WEEKS, CC_POOL_WEEKS, PNC_WEEKS, SIX_NATIONS_WEEKS, SUMMER_TEST_WEEKS, TOUR_WEEKS, TRC_WEEKS,
  WC_KO_WEEKS, WC_POOL_WEEKS, W_AUTUMN_WEEKS, W_CC_KO_WEEKS, W_CC_POOL_WEEKS, W_PAC4_WEEKS, W_SIX_NATIONS_WEEKS,
  W_SUMMER_TEST_WEEKS, W_WC_KO_WEEKS, W_WC_POOL_WEEKS, leagueWeeksFor, playoffWeeksFor, preseasonWeeksFor,
} from './calendar'
import { shuffled, type Rng } from './rng'
import { seedNatRank } from './natrank'
import { nationNameIn, nationVars } from './nations'

const ordinalWord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`

// ---- Season calendar ----
// Every week number lives in calendar.ts (1.6.5): both worlds, every season
// type, and the invariant a built season has to pass. The names below are
// re-exported so nothing that imported them from here has to move.
export {
  PRESEASON_WEEKS, LEAGUE_WEEKS, CC_POOL_WEEKS, CC_KO_WEEKS, AUTUMN_WEEKS, SIX_NATIONS_WEEKS,
  TRC_WEEKS, PNC_WEEKS, WC_POOL_WEEKS, WC_KO_WEEKS, SUMMER_TEST_WEEKS, TOUR_WEEKS,
  W_PRESEASON_WEEKS, W_LEAGUE_WEEKS, W_CC_POOL_WEEKS, W_CC_KO_WEEKS, W_AUTUMN_WEEKS, W_SIX_NATIONS_WEEKS,
  W_SUMMER_TEST_WEEKS, W_PAC4_WEEKS, W_WC_POOL_WEEKS, W_WC_KO_WEEKS,
} from './calendar'
/** The six who play the Northern Championship, and the six who do not. */
export const W_NORTH = ['ENG', 'FRA', 'IRE', 'ITA', 'SCO', 'WAL']
export const W_SOUTH = ['NZL', 'AUS', 'CAN', 'USA', 'JPN', 'RSA']

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
      // VENUES BALANCE (1.6.3). Flipping every pair on the round's parity
      // left four URC clubs with six home games and nine away in a single
      // round robin (scripts/qa/urcsplit.ts). The fixed team at index 0
      // alternates by round; every other pair alternates by its own index,
      // which the circle rotation turns into an even split: spread of one
      // home game for every even field size, two for an odd one.
      if (a && b) {
        const flip = i === 0 ? r % 2 === 1 : i % 2 === 1
        round.push(flip ? [b, a] : [a, b])
      }
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
  /** Regional shields (1.6.4): groups of four that play each other home and
   *  away, with everyone else met once. The real United Rugby Championship
   *  format: 18 rounds, nine at home, six of them derbies. When set, `double`
   *  is ignored. */
  shields?: string[][]
}

/**
 * ---- THE SHIELD FORMAT (1.6.4) ----
 *
 * Four groups of four. Inside a group everyone plays home and away (six
 * rounds, two fixtures a round per group, all four groups at once); across
 * groups everyone meets once, three phases of four rounds pairing the groups
 * off two at a time. Eighteen rounds, eighteen games each, nine at home.
 *
 * Venues are balanced by construction rather than by luck: in a cross-group
 * round team i of one group meets team (i + r) mod 4 of the other and hosts
 * when i + j is even, which gives every team two home and two away games per
 * phase; the shield legs mirror each other. The derby legs open and close the
 * season, which is roughly where the real competition puts them.
 */
export function shieldRoundRobin(shields: string[][], rng: Rng): [string, string][][] {
  const groups = shields.map(s => shuffled(rng, s))
  const shieldLegs = groups.map(g => roundRobin(g, rng, false)) // 3 rounds each
  const legRounds = (mirror: boolean): [string, string][][] => {
    const out: [string, string][][] = []
    for (let r = 0; r < 3; r++) {
      const round: [string, string][] = []
      for (const legs of shieldLegs) for (const [h, a] of legs[r]) round.push(mirror ? [a, h] : [h, a])
      out.push(round)
    }
    return out
  }
  const phases: [number, number][][] = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]]
  const cross: [string, string][][] = []
  for (const phase of phases) {
    for (let r = 0; r < 4; r++) {
      const round: [string, string][] = []
      for (const [x, y] of phase) {
        for (let i = 0; i < 4; i++) {
          const j = (i + r) % 4
          const a = groups[x][i], b = groups[y][j]
          round.push((i + j) % 2 === 0 ? [a, b] : [b, a])
        }
      }
      cross.push(round)
    }
  }
  return [...legRounds(false), ...cross.slice(0, 8), ...cross.slice(8), ...legRounds(true)]
}

/** Evenly spread `count` rounds across the league's weeks (calendar.ts). A
 *  league with more rounds than weeks is a calendar error, not a wrap: this
 *  used to hand out `undefined` weeks past the end of the list. */
function allocWeeks(count: number, avail: readonly number[]): number[] {
  if (count > avail.length) throw new Error(`calendar: ${count} rounds do not fit ${avail.length} league weeks`)
  if (count === avail.length) return [...avail]
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(avail[Math.round((i * (avail.length - 1)) / (count - 1))])
  }
  return [...new Set(out)].length === count ? out : avail.slice(0, count)
}

export function buildLeague(spec: LeagueSpec, rng: Rng, state: GameState): Competition {
  const rounds = spec.shields ? shieldRoundRobin(spec.shields, rng) : roundRobin(spec.teams, rng, spec.double)
  const weeks = allocWeeks(rounds.length, leagueWeeksFor(genderOf(state), worldCupSeasonFor(state), spec.id))
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
    koWeeks: playoffWeeksFor(spec.playoffTeams, spec.id),
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

/** Continental Cup: 16 clubs, 4 pools of 4 (double RR = 6 rounds), then QF/SF/F. */
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
  const preWeeks = preseasonWeeksFor(genderOf(state))
  for (const week of preWeeks) {
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
        if (week === preWeeks[1]) mkFr(week, opp.id, user.id)
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
  // THE SEASON OPENS ON A SATURDAY. A fixture's weekday is a hash of its id
  // (model.fixtureDayOff), so a third of all openers fell on a Friday, and a
  // Friday match leaves the first week no Friday bulletin: the day walk goes
  // from Monday straight to kick-off. The Major Rugby Competition (1.7.3)
  // shifted every id and put every club's opener on a Friday. The manager's
  // opener now trades ids with a Saturday friendly in the same week - no id
  // is drawn or wasted, so nothing else in the world moves.
  const openWeek = Math.min(...state.fixtures.filter(f => f.compId === 'fr' && !f.played).map(f => f.week))
  const mine = state.fixtures.find(f => f.compId === 'fr' && f.week === openWeek && !f.played
    && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  if (mine && fixtureDayOff(mine.id) !== 0) {
    const swap = state.fixtures.find(f => f.compId === 'fr' && f.week === openWeek && !f.played && f !== mine
      && fixtureDayOff(f.id) === 0)
    if (swap) [mine.id, swap.id] = [swap.id, mine.id]
  }
}

/**
 * ---- THE ROUND-UP'S SCREEN PARAMETER ----
 *
 * The full-time round-up is reached as "results" with one string carrying which
 * competition and which week. Written in one place and read in another, the
 * format drifted the moment an id could contain the separator.
 *
 * Every men's competition id is a bare word, so "prem:8" split on ':' and took
 * the first two pieces for two years without complaint. Every WOMEN'S id
 * carries the world prefix - 'w:pwr', 'w:celt' - so "w:pwr:8" split into three
 * pieces, the competition became 'w', the week became Number('pwr'), and the
 * entire women's game showed "No other results this round" after every match,
 * including the manager's own.
 *
 * One writer and one reader now, so the next id that carries a colon cannot
 * reopen it. scripts/worldparity.ts round-trips every competition in both
 * worlds through the pair.
 */
export function resultsParam(compId: string, week: number): string {
  return `${compId}:${week}`
}

export function parseResultsParam(param: string): { compId: string; week: number } {
  // the week is what follows the LAST colon; everything before it is the id
  const cut = param.lastIndexOf(':')
  if (cut <= 0) return { compId: param, week: NaN }
  return { compId: param.slice(0, cut), week: Number(param.slice(cut + 1)) }
}

export function buildChampionsCup(clubIds: string[], rng: Rng, state: GameState,
  // just "Continental Cup" (user: "remove the word continental")
  meta: { id: string; name: string; short: string } = { id: 'cc', name: 'Continental Cup', short: 'Continental Cup' },
  // The weeks it plays in. Defaulted to the men's, because they were hard-coded
  // in here and the women's calendar cannot use them - see W_CC_POOL_WEEKS.
  poolWeeks: readonly number[] = CC_POOL_WEEKS,
  koWeeks: readonly number[] = CC_KO_WEEKS,
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
    weeksByRound: [...poolWeeks],
    koWeeks: [...koWeeks],
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
          week: poolWeeks[r],
          homeId: h, awayId: a,
          played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        })
      }
    })
  })
  return comp
}

// FIVE WEEKS, A MIDWEEK GAME AND A WEEKEND GAME IN EACH (owner, 7 Sep: "the
// tour should be over 5 weeks... one midweek game, one weekend game"). The
// season grew from 45 weeks to 48 to hold it, and nothing domestic moved: the
// club finals still end at week 43, so the party leaves after the season rather
// than across it, which is where a real tour goes.
/** Midweek provincial games before the Test series - seven, then three Tests. */
/**
 * THE ORDINARY SUMMER IS STILL TWO TESTS, and it needs its own weeks.
 *
 * In every year that is not a tour year the north goes south for a two-Test
 * series, and that series was reading TOUR_WEEKS - fine when TOUR_WEEKS was two
 * weeks long, and quietly catastrophic when it became five. Every non-tour
 * summer started building FIVE rounds of internationals instead of two: thirty
 * fixtures where there should be twelve, three extra weeks of every country's
 * best players away from their clubs, every year.
 *
 * It took five probes to find - insolvency, board patience, Player of the Month,
 * the defensive dials and the match pitch all failed, none of them obviously
 * about a fixture list - because a constant two things share is a constant one
 * of them will eventually be wrong about.
 */

export const TOUR_PROVINCIAL = 7
export const TEST_NAMES = ['1st Test', '2nd Test', '3rd Test'] as const

/** World Championship: 20 nations, 4 pools of 5, then QF/SF/Final. */
/** The women's tournament (1.6.4): sixteen nations, four pools of four, played
 *  in August and September as the real one is (weeks 1 to 6, calendar.ts).
 *  The 2025 field, which is the best guess anyone has for 2029 until
 *  qualifying settles it. */
const W_WC_NATIONS = [
  'ENG', 'NZL', 'CAN', 'FRA', 'IRE', 'AUS', 'SCO', 'ITA',
  'USA', 'WAL', 'JPN', 'RSA', 'ESP', 'FIJ', 'SAM', 'POR',
]
const M_WC_NATIONS = [
  'RSA', 'NZL', 'IRE', 'FRA', 'ENG', 'ARG', 'SCO', 'AUS', 'FIJ', 'ITA',
  'WAL', 'GEO', 'JPN', 'SAM', 'TGA', 'USA', 'URU', 'POR', 'ESP', 'CHL',
]

function buildWorldCup(rng: Rng, state: GameState, women = false) {
  const nations = women ? W_WC_NATIONS : M_WC_NATIONS
  const poolWeeks = women ? W_WC_POOL_WEEKS : WC_POOL_WEEKS
  const koWeeks = women ? W_WC_KO_WEEKS : WC_KO_WEEKS
  // the draw is seeded from the live world rankings: four years of Test
  // results decide who gets the kind pool and who gets the group of death
  seedNatRank(state)
  const seeded = [...nations].sort((a, b) => (state.natRank![b] ?? 0) - (state.natRank![a] ?? 0))
  const comp: Competition = {
    id: 'wc', name: 'World Championship', short: 'Worlds', type: 'intl',
    teamIds: nations, table: nations.map(emptyRow), rounds: poolWeeks.length, playoffTeams: 8,
    weeksByRound: poolWeeks, koWeeks, isNational: true,
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
  const top4 = seeded.slice(0, 4).map(c => nationNameIn('en', c))
  // the seeds are countries, so the list travels as fragment keys
  const top_l = JSON.stringify(seeded.slice(0, 4).map(c => ({ k: `nation.${c}` })))
  const userSeed = state.natTeam ? seeded.indexOf(state.natTeam) + 1 : 0
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'intl', read: false,
    subject: `🏆 World Championship draw: the rankings pick the pools`,
    body: [
      `The World Championship pools are set, seeded from the world rankings. Top seeds: ${top4.join(', ')}.`,
      userSeed > 0 ? `${nationNameIn('en', state.natTeam!)} go in as the ${ordinalWord(userSeed)} seed - anything short of ${userSeed <= 4 ? 'the semi-finals will be a failure' : userSeed <= 8 ? 'the quarter-finals will raise questions' : 'the knockouts would still be par'}.`
        : women ? `Four pools, four nations each, and somewhere in there a group of death.` : `Four pools, five nations each, and somewhere in there a group of death.`,
    ].join('\n'),
    k: userSeed > 0 ? 'news.wcDrawSeeded' : women ? 'news.wcDrawW' : 'news.wcDraw',
    v: {
      top_l, ...nationVars(state.natTeam ?? ''),
      seed_o: userSeed,
      bar_k: userSeed <= 4 ? 'news.wcBarSemi' : userSeed <= 8 ? 'news.wcBarQuarter' : 'news.wcBarKnockout',
    },
  })
  pools.forEach(pool => {
    const rounds = roundRobin(pool, rng, false)
    rounds.forEach((pairs, r) => {
      for (const [h, a] of pairs) {
        state.fixtures.push({
          id: state.nextId++, compId: 'wc', round: r, week: poolWeeks[r],
          homeId: h, awayId: a, played: false,
          homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        })
      }
    })
  })
  state.comps['wc'] = comp
}

/** Tour years: 2029, 2033, ... (every 4th season, offset from the World
 *  Championship, which puts the tour exactly two years off a World Cup - the
 *  real cycle, and what the owner asked for: "2 away from a world cup").
 *
 *  The FUNCTION and the competition id still say "lions" because both are
 *  written into every save ever made and neither is ever shown to a player. The
 *  display name is the British & Irish Isles XV (owner, 7 Sep: "we shouldn't
 *  say Lions... should just be british and irish isles xv tour"). */
export function isLionsSeason(season: number): boolean {
  return (BASE_YEAR + season) % 4 === 1 && season > 0
}

/** Summer theatre: either an Isles XV series or north-south tours close the season. */
function buildSummer(rng: Rng, state: GameState) {
  const season = state.season
  if (isLionsSeason(season)) {
    const hosts = ['NZL', 'RSA', 'AUS']
    const host = hosts[Math.floor((BASE_YEAR + season - 2029) / 4) % 3]
    // ---- TEN MATCHES, AND A THREE-TEST SERIES AT THE END ----
    //
    // Owner, 7 Sep: "a fixture list of 10 fixtures with a 3 test series at the
    // end in the country". This was two Tests and nothing else, which is not a
    // tour, it is a series.
    //
    // THE MIDWEEK GAMES ARE AGAINST REAL CLUBS. A tour's first month is
    // provincial rugby - the host's franchises, one after another - and this
    // world already holds them, so they are used rather than invented. When the
    // host has fewer clubs than the tour has midweek slots (Australia and South
    // Africa carry four each; New Zealand six) the list is topped up from the
    // other southern countries, which is exactly what a real tour does when it
    // fills a Tuesday with a combined invitational XV.
    //
    // FIVE WEEKS, AFTER THE DOMESTIC SEASON. The club finals end at week 43 and
    // the season runs to 48, so the tour has the summer to itself - which is
    // where a real tour is. It was compressed into two weeks until the owner
    // asked for five ("one midweek game, one weekend game"), and making room
    // meant growing the season, which in turn meant taking every absolute-week
    // stamp off the season length. See WEEK_BASIS in model.ts.
    const hostName = host === 'NZL' ? 'New Zealand' : host === 'RSA' ? 'South Africa' : 'Australia'
    const SOUTH = ['NZL', 'AUS', 'RSA', 'FIJ', 'ARG', 'JPN']
    const provincial = [
      ...Object.values(state.clubs).filter(c => c.country === host),
      ...Object.values(state.clubs).filter(c => c.country !== host && SOUTH.includes(c.country)),
    ].sort((a, b) => (a.country === host ? -1 : 1) - (b.country === host ? -1 : 1) || b.rep - a.rep)
    const midweek = provincial.slice(0, TOUR_PROVINCIAL)
    const comp: Competition = {
      id: 'lions', name: `British & Irish Isles Tour of ${hostName}`,
      short: 'Isles Tour', type: 'intl',
      // the TABLE is the Test series - that is what the tour is judged on, and
      // what rollover.ts reads to decide whether the series was won
      teamIds: ['LIO', host], table: ['LIO', host].map(emptyRow), rounds: 3, playoffTeams: 0,
      weeksByRound: TOUR_WEEKS, koWeeks: [], isNational: true,
    }
    buildTourFixtures(state, 'lions', host, midweek)
    state.comps['lions'] = comp
    // ---- AND THE COUNTRIES STILL PLAY ----
    //
    // A tour year used to mean nobody else had a summer at all: this function
    // returned here, so England, France, Italy and the rest simply did not
    // play, and a manager who coached a country had three empty weeks in a
    // season that was supposed to be the biggest of his career.
    //
    // In reality the unions tour anyway, with what the tour party left behind.
    // That is the point of the owner's "assistant takes over of national team
    // while you do this job" - there has to be a national team doing something
    // for an assistant to take over. Two Tests rather than the usual series,
    // because the best players are on the other side of the world.
    buildSummerTests(rng, state, 2)
    return
  }
  buildSummerTests(rng, state, 2)
}

/** The July programme: north heads south for a short Test series. `rounds` is
 *  two in an ordinary year and two in a tour year as well - but in a tour year
 *  the squads are what the touring party left at home, which the selection
 *  already handles, because a man away with the Isles XV is unavailable to his
 *  country exactly as he is to his club. */
function buildSummerTests(rng: Rng, state: GameState, rounds: number) {
  const north = shuffled(rng, ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA'])
  const south = shuffled(rng, ['NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'JPN'])
  const weeks = SUMMER_TEST_WEEKS.slice(0, rounds)
  const comp: Competition = {
    id: 'tour', name: 'Summer Tours', short: 'Summer Tours', type: 'intl',
    teamIds: [...north, ...south], table: [], rounds: weeks.length, playoffTeams: 0,
    weeksByRound: weeks, koWeeks: [], isNational: true,
  }
  weeks.forEach((week, r) => {
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

/** Northern Championship & Southern Championship (played by national teams, engine-lite). */
export function buildInternationals(rng: Rng, state: GameState, worldCup = false) {
  if (worldCup) buildWorldCup(rng, state)
  if (!worldCup) buildSummer(rng, state)
  const sn = ['ENG', 'FRA', 'IRE', 'ITA', 'SCO', 'WAL']
  const snRounds = roundRobin(sn, rng, false)
  const snComp: Competition = {
    id: 'sn', name: 'Northern Championship', short: 'Northern', type: 'intl',
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

  // In a World Championship year there is no Southern Championship and no autumn series
  if (worldCup) return

  const trc = ['NZL', 'RSA', 'AUS', 'ARG']
  const trcRounds = roundRobin(trc, rng, true)
  const trcComp: Competition = {
    id: 'trc', name: 'The Southern Championship', short: 'Southern', type: 'intl',
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

  // Pacific Islands Cup: the tier-two showpiece, alongside the Championship
  const pnc = ['FIJ', 'JPN', 'SAM', 'TGA', 'USA', 'CAN']
  const pncRounds = roundRobin(pnc, rng, false)
  const pncComp: Competition = {
    id: 'pnc', name: 'Pacific Islands Cup', short: 'Islands Cup', type: 'intl',
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

/**
 * The women's Test competitions: the Six Nations and the Pacific Four Series.
 *
 * Deliberately NOT buildInternationals with different arguments. That function
 * builds five competitions shaped around the men's game - a Southern
 * Championship of four unions, a Pacific Islands Cup of six, an autumn series
 * pairing north against south, an Isles XV tour - and not one of them has a women's
 * counterpart of the same shape. The women's international game is two
 * tournaments, so this builds two, and when WXV is added it will be a third
 * rather than a men's window renamed.
 *
 * Both are RENAMED, like every competition the game ships: the Pacific Four
 * Series is what the real one is called, so it is the Southern Four Series here
 * the way the Rugby Championship is the Southern Championship in the men's.
 *
 * National teams are nation codes rather than club ids, here as in the men's
 * game, so these carry no w: prefix and the squads are picked by season.ts from
 * whichever players in this world hold that passport. That is why the leagues
 * had to exist first: a women's ENG squad is the Red Roses because the only
 * English players in a women's world are the ones in w_pwr.ts.
 */
/**
 * Which Championship a world is running, and when.
 *
 * The Northern Championship is the one competition both games have under the
 * same name, in different windows, with different ids. Three places outside
 * this file read it - the Grand Slam and Wooden Spoon lore, the round-by-round
 * news, and the panel on Home - and all three used to name the men's id and the
 * men's weeks flat, so a women's career saw a Championship it was playing in
 * and never heard a word about it.
 */
export const snIdFor = (g: Gender) => (g === 'w' ? W + 'sn' : 'sn')
export const snWeeksFor = (g: Gender) => (g === 'w' ? W_SIX_NATIONS_WEEKS : SIX_NATIONS_WEEKS)

/**
 * ---- THE WOMEN'S TOUR ----
 *
 * Owner, 7 Sep: "Should also be available on the women's side 2 years after the
 * men and repeated every 4 years... Womens tour should go NZ, Canada and
 * France."
 *
 * Two years after the men's and every four thereafter, so the two never share a
 * summer: men in 2029, 2033, 2037; women in 2031, 2035, 2039. That is the same
 * arithmetic the men's cycle uses, offset by two.
 *
 * AND IT GOES WHERE THE OWNER SENT IT. New Zealand, then Canada, then France -
 * not the men's three. Two of those three are in the north, which is the point:
 * the women's game's strongest sides are not the same three countries, and a
 * tour that visited South Africa because the men's tour does would be copying
 * the men's map rather than reading the women's.
 */
export function isWomensTourSeason(season: number): boolean {
  // TWO YEARS AFTER THE MEN, AND NOT BEFORE THEM. The modulo alone is satisfied
  // by 2027, which is a year into the game and two years BEFORE the first men's
  // tour - the opposite of what was asked for. The floor pins the first one to
  // 2031, so the pattern reads 2029 men, 2031 women, 2033 men, 2035 women.
  //
  // It also lands where the real calendar puts it. The women's World Cup falls
  // on the men's tour years (2029, 2033), so a women's tour in 2031 and 2035
  // sits exactly in the gap between two World Cups - which is where the men's
  // tour sits in their calendar too.
  return (BASE_YEAR + season) % 4 === 3 && BASE_YEAR + season >= 2031
}

/**
 * ---- THE WOMEN'S CONTINENTAL CUP ----
 *
 * Sixteen clubs from the four top tiers - England, France, the Pacific and the
 * Celtic provinces. No second tiers, and so no Shield beneath it either (owner:
 * "celtic sides in but no second tiers"): the men's game has a Continental
 * Shield because it has thirty-odd top-flight clubs and a Championship to feed
 * it, and inventing one here would be filling a competition rather than
 * answering a demand for one.
 *
 * It takes the id 'cc' deliberately, not a namespaced one. A save is one world
 * or the other and never both, so within any career 'cc' means "the continental
 * cup of this game" - which is exactly what every dream, award and
 * trophy-counting path already assumes. A separate id would have meant teaching
 * all of them a second name for the same thing.
 *
 * PLACES ARE ALLOCATED PER LEAGUE, NOT BY REPUTATION ALONE. Taking the best
 * sixteen reputations gave England six, France five, the Pacific five and THE
 * CELTIC PROVINCES NONE - they are a six-club league of provincial sides and
 * every one of them sits below the cut. A continental cup with no Celtic
 * entrants is not the competition the owner asked for, and it is not how any
 * real cross-border cup has ever worked: places go to leagues, and leagues send
 * their best.
 *
 * 5-5-4-2 against league sizes of 9, 10, 9 and 6. England and France get the
 * most because they are the deepest; the Celtic provinces get two, which is a
 * third of their league and the most generous share of the four.
 *
 * Lives here rather than in newgame.ts because AUGUST HAS TO BUILD IT TOO. The
 * first draft built the cup only at the start of a career, so the competition
 * existed for one season and then vanished at the rollover - and with it the
 * two dreams that name it, in the middle of a save that had been offered them.
 */
const WOMENS_CC_PLACES: readonly [string, number][] = [
  [W + 'pwr', 5], [W + 'e1', 5], [W + 'pac', 4], [W + 'celt', 2],
]

export function buildWomensContinentalCup(rng: Rng, state: GameState): Competition {
  const entrants = WOMENS_CC_PLACES.flatMap(([leagueId, places]) =>
    Object.values(state.clubs)
      .filter(c => c.leagueId === leagueId)
      .sort((a, b) => b.rep - a.rep)
      .slice(0, places)
      .map(c => c.id))
  return buildChampionsCup(entrants, rng, state,
    // ITS OWN NAME, NOT THE MEN'S (owner, 1.5.8). Both worlds build a
    // competition with the id 'cc' - deliberately, so every dream, award and
    // trophy-counting path can mean "the continental cup of this game" - but
    // they carried the same NAME too, so a women's career played something
    // called the Continental Cup with nothing on screen saying which game it
    // belonged to. The short name also earns its keep on the fixtures list,
    // where "Continental Cup Quarter-Final" pushed the score off the row.
    { id: 'cc', name: 'The Hemispheric Championship', short: 'Hemispheric' },
    W_CC_POOL_WEEKS, W_CC_KO_WEEKS)
}

export function buildWomensInternationals(rng: Rng, state: GameState, worldCup = false) {
  // a World Championship year (1.6.4: 2029, 2033, ...) opens with the
  // tournament and drops the autumn and summer Tests around it, as the men's
  // calendar does; the Northern Championship and the Southern Four still run
  if (worldCup) buildWorldCup(rng, state, true)
  if (isWomensTourSeason(state.season)) buildWomensTour(state)
  const sn = ['ENG', 'FRA', 'IRE', 'ITA', 'SCO', 'WAL']
  const snComp: Competition = {
    id: W + 'sn', name: "Women's Northern Championship", short: 'Northern', type: 'intl',
    teamIds: sn, table: sn.map(emptyRow), rounds: 5, playoffTeams: 0,
    weeksByRound: W_SIX_NATIONS_WEEKS, koWeeks: [], isNational: true,
  }
  roundRobin(sn, rng, false).forEach((pairs, r) => {
    for (const [h, a] of pairs) {
      state.fixtures.push({
        id: state.nextId++, compId: W + 'sn', round: r, week: W_SIX_NATIONS_WEEKS[r],
        homeId: h, awayId: a, played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  state.comps[W + 'sn'] = snComp

  // Four teams, played once each: three rounds, not the men's home-and-away six.
  // Played after the domestic finals (calendar.ts, 1.6.5: it sat on the league
  // playoffs, and the Pacific clubs' semi-finals lost every New Zealander and
  // Australian to camp). Not in a tour year: the host is playing the Isles XV
  // those same weeks, and a nation plays one Test a week.
  if (!isWomensTourSeason(state.season)) buildPacFour(rng, state)
  if (worldCup) return

  // ---- the autumn: the six at home to the six who are not in it ----
  const autComp: Competition = {
    id: W + 'aut', name: "Women's Autumn Tests", short: 'Autumn Tests', type: 'intl',
    teamIds: [...W_NORTH, ...W_SOUTH], table: [], rounds: W_AUTUMN_WEEKS.length, playoffTeams: 0,
    weeksByRound: W_AUTUMN_WEEKS, koWeeks: [], isNational: true,
  }
  W_AUTUMN_WEEKS.forEach((week, r) => {
    // reshuffled each weekend, so a country does not host the same visitor
    // three times and the fixture list reads like a real November
    const visiting = shuffled(rng, W_SOUTH)
    W_NORTH.forEach((home, i) => {
      state.fixtures.push({
        id: state.nextId++, compId: W + 'aut', round: r, week,
        homeId: home, awayId: visiting[i], played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    })
  })
  state.comps[W + 'aut'] = autComp

  // ---- and the summer, the same twelve with the travel reversed ----
  const sumComp: Competition = {
    id: W + 'sum', name: "Women's Summer Tests", short: 'Summer Tests', type: 'intl',
    teamIds: [...W_NORTH, ...W_SOUTH], table: [], rounds: W_SUMMER_TEST_WEEKS.length, playoffTeams: 0,
    weeksByRound: W_SUMMER_TEST_WEEKS, koWeeks: [], isNational: true,
  }
  W_SUMMER_TEST_WEEKS.forEach((week, r) => {
    const touring = shuffled(rng, W_NORTH)
    W_SOUTH.forEach((home, i) => {
      state.fixtures.push({
        id: state.nextId++, compId: W + 'sum', round: r, week,
        homeId: home, awayId: touring[i], played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    })
  })
  state.comps[W + 'sum'] = sumComp
}

function buildPacFour(rng: Rng, state: GameState) {
  const p4 = ['NZL', 'CAN', 'USA', 'AUS']
  const p4Comp: Competition = {
    id: W + 'p4', name: 'Southern Four Series', short: 'Southern Four', type: 'intl',
    teamIds: p4, table: p4.map(emptyRow), rounds: 3, playoffTeams: 0,
    weeksByRound: W_PAC4_WEEKS, koWeeks: [], isNational: true,
  }
  roundRobin(p4, rng, false).forEach((pairs, r) => {
    for (const [h, a] of pairs) {
      state.fixtures.push({
        id: state.nextId++, compId: W + 'p4', round: r, week: W_PAC4_WEEKS[r],
        homeId: h, awayId: a, played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      })
    }
  })
  state.comps[W + 'p4'] = p4Comp
}

export function sortTable(table: TableRow[]): TableRow[] {
  // Wins before points difference (1.6.3): the Premiership, the URC and the
  // Pacific competitions all separate level clubs on matches won first, and
  // the table ranked a side with a better difference above one with more wins.
  return [...table].sort((a, b) =>
    b.pts - a.pts || b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa) || b.tf - a.tf || b.pf - a.pf)
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

/** The women's Isles XV tour: seven provincial games and three Tests, in the
 *  host the four-year rotation has reached. Same shape as the men's, because
 *  the owner asked for the same tour rather than a smaller version of it. */
function buildWomensTour(state: GameState) {
  const hosts = ['NZL', 'CAN', 'FRA']
  const host = hosts[Math.floor((BASE_YEAR + state.season - 2031) / 4) % 3]
  const hostName = host === 'NZL' ? 'New Zealand' : host === 'CAN' ? 'Canada' : 'France'
  // provincial opposition from the host's own clubs first, then the rest of the
  // women's world. Canada has no club league in this game, so a Canadian tour
  // leans on the wider pool - which is honest: a real tour there would play
  // provincial and invitational sides that no database carries either.
  const provincial = [
    ...Object.values(state.clubs).filter(c => c.country === host),
    ...Object.values(state.clubs).filter(c => c.country !== host),
  ].slice(0, TOUR_PROVINCIAL)
  const comp: Competition = {
    id: W + 'lions', name: `Women's British & Irish Isles Tour of ${hostName}`,
    short: 'Isles Tour', type: 'intl',
    teamIds: ['LIO', host], table: ['LIO', host].map(emptyRow), rounds: 3, playoffTeams: 0,
    weeksByRound: TOUR_WEEKS, koWeeks: [], isNational: true,
  }
  buildTourFixtures(state, W + 'lions', host, provincial)
  state.comps[W + 'lions'] = comp
}

/**
 * The ten fixtures of a tour, laid out the way a tour actually runs.
 *
 * A midweek game and a weekend game in each of five weeks. The Tests take the
 * last three WEEKENDS, and the midweek games carry on between them - which is
 * exactly the rhythm of a real tour, where the Wednesday side plays a province
 * while the Test side prepares.
 *
 *   wk 44   Wed: tour 1      Sat: tour 2
 *   wk 45   Wed: tour 3      Sat: tour 4
 *   wk 46   Wed: tour 5      Sat: 1st Test
 *   wk 47   Wed: tour 6      Sat: 2nd Test
 *   wk 48   Wed: tour 7      Sat: 3rd Test
 */
function buildTourFixtures(state: GameState, compId: string, host: string, provincial: { id: string }[]) {
  let prov = 0
  let round = 0
  TOUR_WEEKS.forEach((week, i) => {
    // the Wednesday game is always a province
    const club = provincial[prov++]
    if (club) {
      state.fixtures.push({
        id: state.nextId++, compId, round: round++, week,
        homeId: club.id, awayId: 'LIO', played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        stage: `Tour match ${prov}`, tourMatch: true, midweek: true,
      })
    }
    // the weekend is a province for the first two weeks, then a Test
    const testIndex = i - (TOUR_WEEKS.length - TEST_NAMES.length)
    if (testIndex >= 0) {
      state.fixtures.push({
        id: state.nextId++, compId, round: round++, week,
        homeId: host, awayId: 'LIO', played: false,
        homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
        stage: TEST_NAMES[testIndex],
      })
    } else {
      const w = provincial[prov++]
      if (w) {
        state.fixtures.push({
          id: state.nextId++, compId, round: round++, week,
          homeId: w.id, awayId: 'LIO', played: false,
          homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
          stage: `Tour match ${prov}`, tourMatch: true,
        })
      }
    }
  })
}
