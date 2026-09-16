/**
 * ---- THE ONE CALENDAR (1.6.5) ----
 *
 * Every week number a competition is built on comes from this file, for both
 * worlds and every kind of season, and `validateCalendar` below is the
 * invariant that a built season has to pass (scripts/calinvariant.ts runs it
 * on every season type in both worlds on every push).
 *
 * Until 1.6.5 the weeks lived in half a dozen constants in schedule.ts, each
 * chosen by looking at a built season and finding a gap. That is how the
 * women's cup semi-final and final came to sit inside the Six Nations camp
 * (weeks 31 and 34, windowed 31 to 38), how the women's World Championship
 * landed on league rounds 4, 6 and 7, and how the men's summer-tour camp
 * opened in week 43, which is the finals week - every finalist's
 * internationals left the week before the final (runtime brief, CAL-01 and
 * CAL-02).
 *
 * WHAT IS PROTECTED, AND WHAT IS AN OVERLAY BY DESIGN.
 *
 * A Test window is the span of weeks a nation's squad is away from its clubs:
 * from the camp week (if the window has one) to the last Test. Inside a
 * window the rules are:
 *
 *  1. No club fixture with a knockout stage - a cup tie, a league playoff, a
 *     final, a relegation playoff - is ever inside a window. The manager who
 *     earned the tie plays it with the men who earned it.
 *  2. No cup fixture of any round is inside a window.
 *  3. The women's leagues PAUSE for every Test window and for the World
 *     Championship. The real ones do (the PWR and Élite 1 both break for the
 *     Six Nations), and the arithmetic allows it: 18 rounds, 9 cup weeks, 13
 *     window weeks and 4 playoff weeks fit inside 48 with nothing to spare -
 *     which is why the women's pre-season is two friendlies and the leagues
 *     open in week 3.
 *  4. The men's leagues PLAY THROUGH Test windows, the World Championship
 *     included, as the real ones do (the Top 14 and the Premiership both play
 *     through the Six Nations and the 2023 World Cup), with the called-up
 *     players unavailable to their clubs. This is the one overlay that is
 *     design rather than accident: a 26-round Top 14 needs 26 of the 28 league
 *     weeks and cannot lose the eight a World Cup takes without a shorter
 *     league or a longer year, both of which are the owner's call.
 *  5. Pre-season friendlies may sit inside a window: they have no stakes.
 *  6. A tour's midweek game (fx.midweek) may share a week with the host
 *     club's weekend fixture. That is what midweek means.
 *
 * And outside windows the two rules that hold everywhere: no club and no
 * nation has two weekend fixtures in one week, and every fixture has two
 * different, existing teams.
 */
import { W, type Gender } from './gender'

export const SEASON_LEN = 48

// ---- the men's year ---------------------------------------------------------
// Week N's date is its Saturday, anchored to 16 August: week 34 is early
// April, 38 early May, 41 the end of May, 43 the first Saturday of June.
//
// 1-3    pre-season friendlies (cross-league, every club)
// 4-17   league rounds (autumn tests overlay 13-15; a World Cup overlays 5-12)
// 18,19  Continental Cup pool 1-2 (leagues pause)
// 20,21  league
// 22,23  Continental Cup pool 3-4
// 24-31  league (Northern Championship overlay 25-29)
// 32,33  Continental Cup pool 5-6
// 34     CC quarter-finals (early April)
// 35-37  league
// 38     CC semi-finals (early May)
// 39     league
// 40     league playoff round 1 (QF / barrage); Championship semi-finals
// 41     CC FINAL (end of May)
// 42     league semi-finals; Championship FINAL
// 43     league FINALS (June); the relegation playoff, Premiership bottom v Championship winner
// 44-45  summer Tests (north heads south)
// 44-48  an Isles XV tour, every fourth year
export const PRESEASON_WEEKS = [1, 2, 3]
export const LEAGUE_WEEKS = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 35, 36, 37, 39,
]
export const CC_POOL_WEEKS = [18, 19, 22, 23, 32, 33]
export const CC_KO_WEEKS = [34, 38, 41]
export const AUTUMN_WEEKS = [13, 14, 15]
export const SIX_NATIONS_WEEKS = [25, 26, 27, 28, 29]
export const TRC_WEEKS = [5, 6, 7, 9, 10, 11]
export const PNC_WEEKS = [5, 6, 7, 9, 10]
export const WC_POOL_WEEKS = [5, 6, 7, 8, 9]
export const WC_KO_WEEKS = [10, 11, 12]
export const SUMMER_TEST_WEEKS = [44, 45]
export const TOUR_WEEKS = [44, 45, 46, 47, 48]

// ---- the women's year -------------------------------------------------------
// 1-2    pre-season friendlies
// 3-7    league (a World Championship year opens with the tournament in 1-6
//        instead, the leagues start in week 7, and there are no autumn Tests)
// 8      Hemispheric Championship pool 1
// 9,10   league
// 11     Hemispheric pool 2
// 12-15  autumn Tests (camp 12; the leagues pause)
// 16,17  league
// 18,19  Hemispheric pool 3-4
// 20,21  league
// 22,23  Hemispheric pool 5-6
// 24-27  league
// 28     Hemispheric quarter-finals
// 29,30  league
// 31-36  Northern Championship (camp 31, five rounds 32-36; the leagues pause)
// 37     Hemispheric semi-finals
// 38     Hemispheric FINAL
// 39     last league round
// 40-43  league playoffs and finals
// 44,45  summer Tests
// 46-48  the Southern Four (not in a tour year: the host is busy)
// 44-48  a women's Isles XV tour, every fourth year from 2031
export const W_PRESEASON_WEEKS = [1, 2]
export const W_LEAGUE_WEEKS = [3, 4, 5, 6, 7, 9, 10, 16, 17, 20, 21, 24, 25, 26, 27, 29, 30, 39]
export const W_LEAGUE_WEEKS_WC = [7, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 24, 25, 26, 27, 29, 30, 39]
export const W_CC_POOL_WEEKS = [8, 11, 18, 19, 22, 23]
export const W_CC_KO_WEEKS = [28, 37, 38]
export const W_AUTUMN_WEEKS = [13, 14, 15]
export const W_SIX_NATIONS_WEEKS = [32, 33, 34, 35, 36]
export const W_SUMMER_TEST_WEEKS = [44, 45]
export const W_PAC4_WEEKS = [46, 47, 48]
export const W_WC_POOL_WEEKS = [1, 2, 3]
export const W_WC_KO_WEEKS = [4, 5, 6]
/** The four women's top tiers, whose clubs play the Hemispheric Championship
 *  and so cannot use its weeks for league rounds. The second tiers can. */
export const W_CUP_LEAGUES = [W + 'pwr', W + 'pac', W + 'e1', W + 'celt']

/** The weeks a league's rounds may use. Zero spare in the women's lists is
 *  deliberate: every week of the women's year is spoken for. */
export function leagueWeeksFor(gender: Gender, worldCup: boolean, leagueId: string): number[] {
  if (gender !== 'w') return LEAGUE_WEEKS
  const base = worldCup ? W_LEAGUE_WEEKS_WC : W_LEAGUE_WEEKS
  if (W_CUP_LEAGUES.includes(leagueId)) return base
  return [...base, ...W_CC_POOL_WEEKS].sort((a, b) => a - b)
}

export function preseasonWeeksFor(gender: Gender): number[] {
  return gender === 'w' ? W_PRESEASON_WEEKS : PRESEASON_WEEKS
}

/** The relegation playoff (Premiership bottom v Championship winner) plays on
 *  finals day, inside the season. It was week 44 until 1.6.5, which is the
 *  summer camp week: both clubs played it without their internationals. */
export const BARRAGE_WEEK = 43

export function playoffWeeksFor(playoffTeams: number, leagueId = ''): number[] {
  // the Championship crowns its winner a week early, so the relegation
  // playoff can be played on finals day rather than in the summer camp week
  // (semi-finals in 40, not 41: the Shield final is 41, and a Championship
  // club can be in both - scripts/qa2/matrix.ts caught Exeter drawn twice)
  if (leagueId === 'champ') return playoffTeams > 4 ? [40, 41, 42] : [40, 42]
  return playoffTeams > 4 ? [40, 42, 43] : [42, 43]
}

// ---- Test windows -----------------------------------------------------------
/** [first week away, last week away] for an international competition, by
 *  competition id. A window with a camp week starts the week before its first
 *  fixture; the summer ones do not - the squads leave after the finals. The
 *  men's World Championship camp opens in week 1, the pre-season. */
const WINDOW_SPANS: Record<string, [number, number]> = {
  wc: [1, WC_KO_WEEKS[WC_KO_WEEKS.length - 1]],
  trc: [TRC_WEEKS[0] - 1, TRC_WEEKS[TRC_WEEKS.length - 1]],
  pnc: [PNC_WEEKS[0] - 1, PNC_WEEKS[PNC_WEEKS.length - 1]],
  aut: [AUTUMN_WEEKS[0] - 1, AUTUMN_WEEKS[AUTUMN_WEEKS.length - 1]],
  sn: [SIX_NATIONS_WEEKS[0] - 1, SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1]],
  tour: [SUMMER_TEST_WEEKS[0], SUMMER_TEST_WEEKS[SUMMER_TEST_WEEKS.length - 1]],
  lions: [TOUR_WEEKS[0], TOUR_WEEKS[TOUR_WEEKS.length - 1]],
  [W + 'aut']: [W_AUTUMN_WEEKS[0] - 1, W_AUTUMN_WEEKS[W_AUTUMN_WEEKS.length - 1]],
  [W + 'sn']: [W_SIX_NATIONS_WEEKS[0] - 1, W_SIX_NATIONS_WEEKS[W_SIX_NATIONS_WEEKS.length - 1]],
  [W + 'sum']: [W_SUMMER_TEST_WEEKS[0], W_SUMMER_TEST_WEEKS[W_SUMMER_TEST_WEEKS.length - 1]],
  [W + 'p4']: [W_PAC4_WEEKS[0], W_PAC4_WEEKS[W_PAC4_WEEKS.length - 1]],
  [W + 'lions']: [TOUR_WEEKS[0], TOUR_WEEKS[TOUR_WEEKS.length - 1]],
}
/** The women's World Championship shares the men's competition id. */
const W_WC_SPAN: [number, number] = [1, W_WC_KO_WEEKS[W_WC_KO_WEEKS.length - 1]]

export function windowSpan(compId: string, gender: Gender): [number, number] | null {
  if (compId === 'wc' && gender === 'w') return W_WC_SPAN
  return WINDOW_SPANS[compId] ?? null
}

/** Does a Test window in this world cover the week? The competition ids are
 *  the ones present in the season (a tour year has a tour, a World
 *  Championship year has no autumn). */
export function windowsCovering(week: number, compIds: string[], gender: Gender): string[] {
  return compIds.filter(id => {
    const span = windowSpan(id, gender)
    return !!span && week >= span[0] && week <= span[1]
  })
}

// ---- the invariant ----------------------------------------------------------
export interface CalFixture {
  compId: string
  week: number
  homeId: string
  awayId: string
  stage?: string
  midweek?: boolean
  devSide?: boolean
}
export interface CalComp {
  id: string
  type: string
  teamIds: string[]
  rounds: number
  weeksByRound?: number[]
  koWeeks?: number[]
  playoffTeams: number
  pools?: string[][]
}
export interface CalWorld {
  gender: Gender
  fixtures: CalFixture[]
  comps: Record<string, CalComp>
  isClub: (id: string) => boolean
  isNation: (id: string) => boolean
}

/** Every calendar rule, against a built season. Returns the violations; an
 *  empty list is a pass. Meant to run on a fresh season and again after every
 *  week, because knockout ties are drawn as the season goes. */
export function validateCalendar(world: CalWorld): string[] {
  const out: string[] = []
  const { gender, fixtures, comps } = world
  const intl = new Set(Object.values(comps).filter(c => c.type === 'intl').map(c => c.id))
  const compIds = Object.keys(comps)
  const isCupComp = (id: string) => comps[id]?.type === 'cup'
  const isClubComp = (id: string) => !!comps[id] && comps[id].type !== 'intl' && id !== 'fr'

  // 1. every fixture has two different, existing teams
  for (const f of fixtures) {
    if (f.homeId === f.awayId) out.push(`${f.compId} week ${f.week}: ${f.homeId} drawn against itself`)
    for (const id of [f.homeId, f.awayId]) {
      if (!world.isClub(id) && !world.isNation(id)) out.push(`${f.compId} week ${f.week}: unknown team ${id}`)
    }
    if (!(f.week >= 1 && f.week <= SEASON_LEN)) out.push(`${f.compId}: fixture in week ${f.week}`)
  }

  // 2. no team has two weekend fixtures in one week (a tour midweek game beside
  //    a weekend one is allowed, and so is an assistant's development friendly)
  const byTeamWeek = new Map<string, CalFixture[]>()
  for (const f of fixtures) {
    if (f.midweek || f.devSide) continue
    for (const id of [f.homeId, f.awayId]) {
      const k = `${id}|${f.week}`
      byTeamWeek.set(k, [...(byTeamWeek.get(k) ?? []), f])
    }
  }
  for (const [k, fs] of byTeamWeek) {
    if (fs.length > 1) out.push(`${k.replace('|', ' has two fixtures in week ')}: ${fs.map(f => f.compId + (f.stage ? ` ${f.stage}` : '')).join(' and ')}`)
  }

  // 3. knockout ties and cup fixtures stay out of every Test window;
  //    the women's leagues stay out of them too, and out of the World Championship
  for (const f of fixtures) {
    if (!isClubComp(f.compId)) continue
    const inWindow = windowsCovering(f.week, compIds.filter(id => intl.has(id)), gender)
    if (!inWindow.length) continue
    const knockout = !!f.stage
    const cup = isCupComp(f.compId)
    const womensLeague = gender === 'w' && comps[f.compId]?.type === 'league'
    if (knockout || cup || womensLeague) {
      out.push(`${f.compId}${f.stage ? ` ${f.stage}` : ''} in week ${f.week} sits in the ${inWindow.join('/')} window`)
    }
  }

  // 4. a league's rounds fit its weeks, once each, and inside the right list
  for (const c of Object.values(comps)) {
    if (c.type !== 'league') continue
    const weeks = c.weeksByRound ?? []
    if (weeks.length !== c.rounds) out.push(`${c.id}: ${c.rounds} rounds on ${weeks.length} weeks`)
    if (new Set(weeks).size !== weeks.length) out.push(`${c.id}: a week carries two rounds`)
    const allowed = leagueWeeksFor(gender, 'wc' in comps, c.id)
    for (const w of weeks) if (!allowed.includes(w)) out.push(`${c.id}: round in week ${w}, not a league week`)
  }

  // 5. a World Championship is a valid tournament: equal pools, eight
  //    qualifiers, three knockout weeks, every nation plays its pool once
  const wc = comps['wc']
  if (wc) {
    const pools = wc.pools ?? []
    const size = pools[0]?.length ?? 0
    if (pools.length !== 4 || pools.some(p => p.length !== size)) out.push(`wc: pools are ${pools.map(p => p.length).join('/')}`)
    if (pools.flat().length !== wc.teamIds.length) out.push('wc: the pools do not hold every nation once')
    if (wc.playoffTeams !== 8) out.push(`wc: ${wc.playoffTeams} qualifiers, not 8`)
    if ((wc.koWeeks ?? []).length !== 3) out.push(`wc: ${(wc.koWeeks ?? []).length} knockout weeks, not 3`)
    const poolFx = fixtures.filter(f => f.compId === 'wc' && !f.stage)
    const expected = pools.length * (size * (size - 1)) / 2
    if (poolFx.length !== expected) out.push(`wc: ${poolFx.length} pool fixtures, expected ${expected}`)
    for (const n of wc.teamIds) {
      const games = poolFx.filter(f => f.homeId === n || f.awayId === n).length
      if (games !== size - 1) out.push(`wc: ${n} plays ${games} pool games, not ${size - 1}`)
    }
  }
  // 7. two club competitions that share a club never share a knockout week,
  //    and a cup never plays in a week its clubs' leagues use: the structural
  //    form of rule 2 in the header, checked without needing a seed to draw
  //    the same club into both
  const clubComps = Object.values(comps).filter(c => c.type === 'league' || c.type === 'cup')
  for (let i = 0; i < clubComps.length; i++) {
    for (let j = i + 1; j < clubComps.length; j++) {
      const a = clubComps[i], b = clubComps[j]
      const shared = a.teamIds.some(t => b.teamIds.includes(t))
      if (!shared) continue
      const ka = new Set(a.koWeeks ?? []), kb = new Set(b.koWeeks ?? [])
      for (const w of ka) if (kb.has(w)) out.push(`${a.id} and ${b.id} share clubs and both play knockout ties in week ${w}`)
      const ra = new Set(a.weeksByRound ?? []), rb = new Set([...(b.weeksByRound ?? []), ...kb])
      for (const w of ra) if (rb.has(w)) out.push(`${a.id} round in week ${w} while ${b.id}, which shares its clubs, also plays`)
      for (const w of ka) if (new Set(b.weeksByRound ?? []).has(w)) out.push(`${a.id} knockout in week ${w} while ${b.id}, which shares its clubs, plays a round`)
    }
  }

  // 6. in a World Championship year no other international competition plays
  //    inside the tournament (runtime brief, section 4)
  if (wc) {
    const span = windowSpan('wc', gender)!
    for (const f of fixtures) {
      if (f.compId !== 'wc' && intl.has(f.compId) && f.week >= span[0] && f.week <= span[1]) {
        out.push(`${f.compId} in week ${f.week} sits inside the World Championship`)
      }
    }
  }
  return out
}
