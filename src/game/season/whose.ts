// Whose match is it this week: the club's, the country's, or the
// assistant's. Split out of season.ts (which re-exports it) and kept apart
// from the friendlies so days.ts can read it without an import cycle.
import type { Fixture, GameState } from '../model'
import { islesCoach } from '../isles'

export function userFixtureThisWeek(state: GameState): Fixture | undefined {
  return state.fixtures.find(f =>
    f.week === state.week && !f.played &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId))
}

/** The national side's fixture this week, when the user also coaches one.
 *  A home-nations coach also takes the Isles XV in a tour year. */
export function natFixtureThisWeek(state: GameState): Fixture | undefined {
  if (!state.natTeam) return undefined
  const teams = [state.natTeam]
  // THE TOUR IS NOT A PERK OF THE NATIONAL JOB (owner, 7 Sep: "it is knly offer
  // only"). Coaching one of the four unions used to hand a manager the touring
  // side automatically, which made the pinnacle of a career a side effect of a
  // job he already had. Now the unions have to have asked, and he has to have
  // said yes.
  if (islesCoach(state)) teams.push('LIO')
  // ---- AND THE ASSISTANT TAKES THE COUNTRY ----
  //
  // Owner, 7 Sep: "assistant takes over of national team while you do this
  // job." On tour, the Isles XV is the match the manager stands on the
  // touchline for and his own country's summer Tests are somebody else's
  // problem - which is the cost of accepting, and the reason accepting is a
  // decision rather than a formality.
  //
  // The search is ordered rather than filtered: LIO first, so a week holding
  // both a tour match and a national Test hands him the tour one and leaves the
  // Test to be simmed with the rest of the world.
  const order = islesCoach(state) ? ['LIO', state.natTeam] : teams
  for (const t of order) {
    const fx = state.fixtures.find(f =>
      f.week === state.week && !f.played && (f.homeId === t || f.awayId === t))
    if (fx) return fx
  }
  return undefined
}

/** The national Test the manager is NOT taking, because he is away on tour. */
export function assistantNatFixture(state: GameState): Fixture | undefined {
  if (!islesCoach(state) || !state.natTeam) return undefined
  const nat = state.natTeam
  return state.fixtures.find(f =>
    f.week === state.week && !f.played && (f.homeId === nat || f.awayId === nat))
}

/** THE MATCH THAT IS THE MANAGER'S THIS WEEK - one decision point, read by
 *  the day walk, both match entrances and the probes, so they can never
 *  disagree about whose touchline he stands on.
 *
 *  A Test outranks the club fixture (user, after Scotland's game auto-played
 *  behind his club Saturday: "it didnt show the fixture and just played it...
 *  its meant to be the pinnacle but is hidden away"). When both fall in one
 *  week the manager takes his country and the assistant takes the club - the
 *  settle sims the club game and reports it (see the assistant's Saturday in
 *  processWeekAndAdvance). */
export function userMatchThisWeek(state: GameState): Fixture | undefined {
  return natFixtureThisWeek(state) ?? (state.unemployed ? undefined : userFixtureThisWeek(state))
}

/** THE CLUB GAME THE ASSISTANT TAKES - the other half of the same decision.
 *
 *  Undefined every week without a Test, because every one of those the
 *  manager takes himself. On a week holding both it is the club fixture, and
 *  it is what the Home card and the match screen must SAY is the assistant's,
 *  rather than offering it as the afternoon's work (user: "it showed my club
 *  game, I ran it and it played another international game. its important
 *  that they are clearly separated but work together"). */
export function assistantFixtureThisWeek(state: GameState): Fixture | undefined {
  if (state.unemployed || !natFixtureThisWeek(state)) return undefined
  return userFixtureThisWeek(state)
}
