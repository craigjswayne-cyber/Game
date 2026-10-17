// Friendlies: the idle-week run-out and the midweek development game.
// Split out of season.ts, which re-exports the public parts.
import type { GameState, Player } from '../model'
// FRIENDLY_DAY below is the Wednesday index this hands to dayDate
import { dayDate, type DayIndex } from '../days'
import { fixtureDayOff, leagueTier, SEASON_WEEKS } from '../model'
import { autoSelect } from '../matchEngine'
import { mulberry32, cmpStr } from '../rng'
import { t } from '../i18n'
import { userFixtureThisWeek } from './whose'

/** Idle-week friendly: a home run-out against another idle club. Sharpness
 *  and combinations for the squad - but the injury risk is real. */
export function arrangeFriendly(state: GameState, oppId: string): string {
  if (userFixtureThisWeek(state)) return t('reply.alreadyPlayingThisWeek')
  const opp = state.clubs[oppId]
  if (!opp) return t('reply.noSuchClub')
  const busy = state.fixtures.some(f => f.week === state.week && !f.played && (f.homeId === oppId || f.awayId === oppId))
  if (busy) return t('reply.oppHasFixture', { club: opp.short })
  state.fixtures.push({
    id: state.nextId++, compId: 'fr', round: 0, week: state.week,
    homeId: state.userClubId, awayId: oppId,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
  })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `Friendly arranged: ${opp.short} this week`,
    body: `${opp.name} have agreed to a run-out at your place. Minutes for the fringe men, sharpness for the returners - just don't get anyone hurt.`,
    k: 'news.friendly', v: { short: opp.short, club: opp.name },
  })
  return t('reply.friendlyArranged', { club: opp.name })
}

/**
 * ---- A MIDWEEK RUN-OUT ----
 *
 * Owner, 7 Sep: "you should be able to arrange friendlies in the fixtures and
 * results, below the fixtures - it should have 3 suggestions, only with teams
 * below in leagues or in a different country. Dates should be at least 3 days
 * before and after a game so midweek, financially they dont benefit the club
 * but they do give more game time to academy."
 *
 * Every clause of that is a rule here, and two of them are load-bearing.
 *
 * WHO WILL PLAY YOU. A club below you in the pyramid, or one in another
 * country. Not your own division: a league rival does not give you a free look
 * at his squad, and a friendly against the team you are chasing is not a
 * friendly. Three of them, drawn from the world's own seed so the list is the
 * same every time you open the page in a given week and changes when the week
 * does - a shortlist you can think about, not a fruit machine.
 *
 * WHY WEDNESDAY, AND WHY IT IS SOMETIMES REFUSED. The owner asked for three
 * clear days either side. A league Saturday gives four days back to Wednesday
 * and three days forward to the next one, so Wednesday is the only day of the
 * week that satisfies both. But this game's fixtures do not all fall on
 * Saturday - fixtureDayOff puts a third of them on Friday and a third on
 * Sunday - and a FRIDAY fixture leaves only two days. So the week is checked
 * rather than assumed, and a Friday match week simply cannot take a friendly.
 * Saying "midweek" and then playing a game 48 hours before a league match would
 * be the game breaking its own promise.
 *
 * WHAT IT IS WORTH. Nothing at the gate - simMatch already pays no attendance
 * money on compId 'fr', so "financially they dont benefit the club" needed no
 * new code, only checking. What it is FOR is the academy: the assistant fields
 * a development side, so the minutes go to the boys and the fringe rather than
 * to the men who are playing on Saturday anyway.
 */
export const FRIENDLY_DAY: DayIndex = 2 // Wednesday

/** Where a club's league fixture falls that week, as a day index, or null. */
function leagueDayThatWeek(state: GameState, week: number, clubId: string): number | null {
  const fx = state.fixtures.find(f => f.week === week && f.compId !== 'fr' &&
    (f.homeId === clubId || f.awayId === clubId))
  return fx ? 5 + fixtureDayOff(fx.id) : null
}

/**
 * Three clear days either side of the Wednesday, for whoever is being asked.
 *
 * THE OPPONENT GETS THE SAME RULE, NOT A HARSHER ONE. The first version of this
 * demanded the other club have an entirely empty week, which sounds reasonable
 * and is nonsense: in a normal league week every club in the world is playing,
 * so the shortlist of three came back with one name on it. A club below you can
 * play a midweek friendly for exactly the reason you can - it is Wednesday, and
 * their Saturday is still three days away.
 */
function midweekOk(state: GameState, week: number, clubId: string): boolean {
  const here = leagueDayThatWeek(state, week, clubId)
  if (here != null && here - FRIENDLY_DAY < 3) return false
  const prev = leagueDayThatWeek(state, week - 1, clubId)
  if (prev != null && (7 + FRIENDLY_DAY) - prev < 3) return false
  return true
}

/** Can a Wednesday friendly be played in this week without crowding a match? */
export function friendlyWeekOk(state: GameState, week: number): boolean {
  if (week <= state.week) return false
  if (week > SEASON_WEEKS) return false
  // already have one arranged that week
  if (state.fixtures.some(f => f.compId === 'fr' && f.week === week &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId))) return false
  // three clear days forward to this week's match (a Friday game is only two
  // days after a Wednesday, so that week is out) and back to last week's
  return midweekOk(state, week, state.userClubId)
}

/** The first few weeks ahead that could take a midweek friendly: three, so
 *  the dates sit on one line (owner, 27 Sep 2026). */
export function friendlyWeeks(state: GameState, howMany = 3): number[] {
  const out: number[] = []
  for (let w = state.week + 1; w <= SEASON_WEEKS && out.length < howMany; w++) {
    if (friendlyWeekOk(state, w)) out.push(w)
  }
  return out
}

/** Three clubs who would take the game: below you, or from another country. */
export function friendlySuggestions(state: GameState, week: number): string[] {
  const user = state.clubs[state.userClubId]
  if (!user) return []
  const myTier = leagueTier(user.leagueId)
  const pool = Object.values(state.clubs)
    .filter(c => {
      if (c.id === user.id) return false
      // the same Wednesday has to work for him, and he cannot already have one
      if (!midweekOk(state, week, c.id)) return false
      if (state.fixtures.some(f => f.compId === 'fr' && f.week === week && (f.homeId === c.id || f.awayId === c.id))) return false
      const lower = leagueTier(c.leagueId) > myTier
      const abroad = c.country !== user.country
      return lower || abroad
    })
    .sort((a, b) => cmpStr(a.id, b.id))
  if (!pool.length) return []
  // deterministic per (save, week): the same three every time you look, a
  // different three next week. A list that reshuffles on every render is a
  // list nobody can think about.
  const rng = mulberry32(state.seed + week * 7919 + state.season * 31)
  const picked: string[] = []
  const seen = new Set<number>()
  for (let guard = 0; guard < 200 && picked.length < 3; guard++) {
    const i = Math.floor(rng() * pool.length)
    if (seen.has(i)) continue
    seen.add(i)
    picked.push(pool[i].id)
  }
  return picked
}

/** The Wednesday a midweek friendly is played on, as a date the manager reads.
 *
 *  Owner: "arrange a friendly is a great feature but it needs to be date based
 *  rather than week based." Every other fixture in the game announces itself
 *  with a date - the masthead has said MON 28 SEP since the calendar went in -
 *  and this one corner still counted in week numbers, which is an internal
 *  index and not something a manager has any feel for. */
export const friendlyDate = (state: GameState, week: number): string =>
  dayDate(state.season, week, FRIENDLY_DAY)

export function arrangeMidweekFriendly(state: GameState, oppId: string, week: number): string {
  const opp = state.clubs[oppId]
  if (!opp) return t('reply.noSuchClub')
  if (!friendlyWeekOk(state, week)) return t('reply.friendlyWeekBusy')
  if (!friendlySuggestions(state, week).includes(oppId)) return t('reply.friendlyDeclined', { club: opp.short })
  const date = friendlyDate(state, week)
  state.fixtures.push({
    id: state.nextId++, compId: 'fr', round: 0, week,
    homeId: state.userClubId, awayId: oppId,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
    devSide: true,
  })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `Midweek friendly agreed: ${opp.short}`,
    body: `${opp.name} will come to your place on ${date}. There is no gate money worth counting in it - what there is, is eighty minutes for the academy and the men who have not had a game.`,
    k: 'news.friendlyBooked', v: { club: opp.name, short: opp.short, date },
  })
  return t('reply.friendlyBooked', { club: opp.name, date })
}

/**
 * The development XV for a midweek friendly, and putting the real side back
 * afterwards.
 *
 * The engine reads club.tactic.lineup when it builds a side, so a friendly
 * played on the Saturday team is a friendly that teaches nobody anything and
 * risks the men who matter. The academy and the fringe play instead; the first
 * fifteen are stood down. Swapped in and out around the sim so nothing outside
 * this function ever sees the development sheet.
 */
export function withDevelopmentSide(state: GameState, clubId: string, run: () => void): void {
  const club = state.clubs[clubId]
  if (!club) { run(); return }
  const first = new Set(club.tactic.lineup.slice(0, 15).filter((x): x is number => x != null))
  const squad = club.players.map(id => state.players[id]).filter(Boolean)
  const fit = (p: Player) => !first.has(p.id) && !p.injury && !p.natSquad && !p.maternity && p.bans === 0
  // THE ACADEMY FIRST. This handed autoSelect everyone outside the XV, and
  // autoSelect picks seniors before it raids the academy, so the "development
  // side" was the bench: the scholars the fixture exists for watched a
  // reserve team play it (scripts/friendlyprobe.ts, 1.6.5 - the man of the
  // match was a senior every time). Scholars fill the sheet; senior reserves
  // only make up the numbers when the academy cannot field eighteen.
  const scholars = squad.filter(p => p.acad && fit(p))
  const reserves = squad.filter(p => !p.acad && fit(p))
  const devs = scholars.length >= 18 ? scholars : [...scholars, ...reserves]
  // if standing the first team down leaves too few bodies, this is not a
  // development side, it is a forfeit - play the normal one
  if (devs.length < 18) { run(); return }
  const saved = club.tactic.lineup
  club.tactic.lineup = autoSelect(state, devs)
  try { run() } finally { club.tactic.lineup = saved }
}
