import type { Competition, Fixture, GameState, TableRow } from './model'
import { W, type Gender } from './gender'
import {absWeek, BASE_YEAR } from './model'
import { shuffled, type Rng } from './rng'
import { seedNatRank } from './natrank'
import { nationNameIn, nationVars } from './nations'

const ordinalWord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`

// ---- Season calendar (week indices 1..45) ----
// Week N's date is its Saturday, anchored to 16 August: week 34 is early
// April, 38 early May, 41 the end of May, 43 the first Saturday of June.
// The European rounds moved to match the real rhythm (user: "European qtr
// finals are usually early april. Semis early may and final end of may.
// The final of the premiership is usually in june"): the quarters land the
// week after the pools close, the league plays on between the knockout
// rounds the way the Premier Division does, and the showpieces stack up in
// May and June.
// 1-3    PRE-SEASON friendlies (cross-league, every club)
// 4-17   league rounds (autumn tests overlay weeks 13-15)
// 18,19  Continental Cup pool 1-2 (leagues pause)
// 20,21  league
// 22,23  Continental Cup pool 3-4
// 24-31  league (Northern Championship overlay 25-29)
// 32,33  Continental Cup pool 5-6
// 34     CC quarter-finals (early April)
// 35-37  league
// 38     CC semi-finals (early May)
// 39     league
// 40     league playoff round 1 (QF / barrage)
// 41     CC FINAL (end of May)
// 42     league semi-finals
// 43     league FINALS (June)
// 44-45  end of season processing

export const PRESEASON_WEEKS = [1, 2, 3]
export const LEAGUE_WEEKS = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 35, 36, 37, 39,
]
export const CC_POOL_WEEKS = [18, 19, 22, 23, 32, 33]
export const CC_KO_WEEKS = [34, 38, 41]

/**
 * ---- AND THE WOMEN'S CUP, WHICH CANNOT USE THOSE WEEKS ----
 *
 * The men's Continental Cup plays its last two pool rounds in weeks 32 and 33
 * and its knockouts in 34, 38 and 41. Every one of those is an international
 * week in the WOMEN'S calendar: the Northern Championship takes 32, 33, 34, 36
 * and 38, and the Southern Four takes 40, 41 and 42. Reusing the men's weeks
 * would have put a continental quarter-final on the same Saturday as a Test.
 *
 * So the women's cup has its own calendar, and these are the weeks their top
 * four leagues are genuinely idle - checked against a built season rather than
 * chosen by eye. Weeks 28, 31 and 37 carry Championship fixtures and nothing
 * else, and the Championship is a second tier which this cup does not include
 * (owner: "celtic sides in but no second tiers"), so its clubs are free.
 *
 * The whole competition therefore runs from week 8 to a final in week 37 -
 * inside the domestic season, out of every international window, and finishing
 * before the last league round rather than after it.
 */
export const W_CC_POOL_WEEKS = [8, 11, 18, 19, 22, 23]
export const W_CC_KO_WEEKS = [28, 31, 37]
export const AUTUMN_WEEKS = [13, 14, 15]
export const SIX_NATIONS_WEEKS = [25, 26, 27, 28, 29]
export const TRC_WEEKS = [5, 6, 7, 9, 10, 11]
export const PNC_WEEKS = [5, 6, 7, 9, 10]

/**
 * ---- THE WOMEN'S TEST CALENDAR ----
 *
 * Not the men's windows, because the women's game does not play in them. The
 * Women's Six Nations runs from late March into April, where the men's is
 * February and early March, and the Pacific Four Series is a May-into-June
 * competition with no men's equivalent at all - it is not the Southern
 * Championship with different names on it.
 *
 * Against a season that opens mid-August, that puts the Championship around
 * weeks 32 to 38 and the Pacific Four in the low forties, after the last league
 * round in week 39. Two consequences that are the point rather than an
 * accident: a women's manager loses players to a Test window at a different
 * time of year from a men's one, and the Pacific Four sits in a fortnight when
 * no club rugby is being played at all, which is exactly where the real one is.
 */
export const W_SIX_NATIONS_WEEKS = [32, 33, 34, 36, 38]
export const W_PAC4_WEEKS = [40, 41, 42]

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
export const TOUR_WEEKS = [44, 45, 46, 47, 48]
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
export const SUMMER_TEST_WEEKS = [44, 45]

export const TOUR_PROVINCIAL = 7
export const TEST_NAMES = ['1st Test', '2nd Test', '3rd Test'] as const
export const WC_POOL_WEEKS = [5, 6, 7, 8, 9]
export const WC_KO_WEEKS = [10, 11, 12]

/** World Championship: 20 nations, 4 pools of 5, then QF/SF/Final. */
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
    id: 'wc', name: 'World Championship', short: 'Worlds', type: 'intl',
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
        : `Four pools, five nations each, and somewhere in there a group of death.`,
    ].join('\n'),
    k: userSeed > 0 ? 'news.wcDrawSeeded' : 'news.wcDraw',
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
          id: state.nextId++, compId: 'wc', round: r, week: WC_POOL_WEEKS[r],
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

export function buildWomensInternationals(rng: Rng, state: GameState) {
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
