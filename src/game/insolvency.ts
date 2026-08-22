/**
 * ---- ADMINISTRATION: what happens when the money actually runs out ----
 *
 * The fifteen-season audit found the one thing the ledger was missing. Money
 * arrived in the world (aiecon.ts) and clubs already RESPOND to debt - they shed
 * their best-paid man past twelve weeks of wages in the red, and they list
 * surplus bodies past four million - but nothing ever happened TO them. Measured
 * over fifteen seasons: about 41 clubs of 101 sit permanently in the red from
 * season nine on, most of them parked on the hard floor of minus twenty weeks'
 * wages, coping forever. Two fifths of the sport quietly ignoring bankruptcy for
 * a decade is not an economy; it is a rounding error with a league table.
 *
 * So: a club that ends a season genuinely insolvent goes into administration,
 * and administration is the real thing in both directions.
 *
 *   IT COSTS POINTS. Ten of them, in the season that follows, exactly as it does
 *   in the leagues this game is modelled on. That is the whole reason this
 *   matters to a manager: it turns a number on a finance screen into a relegation
 *   fight, and it is the only thing in the economy that can put a rival DOWN.
 *
 *   IT CLEARS THE DEBT. Creditors take the haircut and the club comes out the
 *   other side owing about a fortnight's wages instead of five months of them.
 *   This half is not mercy, it is what stops the permanent-limbo equilibrium the
 *   audit measured: without it a club sits on the floor forever and administration
 *   fires every single season, which is neither realistic nor interesting.
 *
 *   IT COSTS PLAYERS. Two of the best-paid men the club can live without go, on
 *   the same rule the wage-shedding pass uses.
 *
 * DETERMINISM. Not one draw from the shared rng, for the reason aiecon.ts gives:
 * a ledger is arithmetic, and drawing here would move every match in the world.
 * Who goes into administration is decided by a balance and a wage bill.
 *
 * THE MANAGER IS NOT EXEMPT. His club plays by the same rule, which is why the
 * warning exists a season ahead of the penalty - a points deduction nobody saw
 * coming is a bug report, not a drama.
 */
import type { Club, GameState } from './model'
import { shedWages } from './aiecon'

/** Weeks of wages in the red at season's end that a club cannot come back from.
 *  Just inside aiecon's hard floor of 20, so reaching it means a club spent the
 *  season pinned against the bottom rather than having one bad month. */
const ADMIN_WEEKS = 18

/** Weeks of wages in the red that should have the board sweating a year out. */
const WARN_WEEKS = 13

/** The standard penalty in the leagues this is modelled on. */
export const ADMIN_PENALTY = 10

/** What the club still owes once the creditors have taken their haircut. */
const AFTER_ADMIN_WEEKS = 2

const weeklyWages = (state: GameState, club: Club): number =>
  club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)

/** The points a club is docked in the season currently being played. */
export function adminPenalty(club: Club | undefined, season: number): number {
  return club?.admin && club.admin.season === season ? club.admin.penalty : 0
}

/** Is this club sliding towards it? Used for the warning, and by the UI. */
export function insolvencyRisk(state: GameState, club: Club): 'none' | 'warned' | 'gone' {
  const w = weeklyWages(state, club)
  if (w <= 0) return 'none'
  if (club.balance < -ADMIN_WEEKS * w) return 'gone'
  if (club.balance < -WARN_WEEKS * w) return 'warned'
  return 'none'
}

/**
 * The season-end reckoning. Called from the rollover, after the year's money has
 * been settled and before the new table is built, so a penalty applies to the
 * season the club is about to play.
 */
export function settleInsolvency(state: GameState): string[] {
  const gone: string[] = []
  const nextSeason = state.season + 1
  for (const club of Object.values(state.clubs)) {
    // last year's punishment is served; it does not follow a club around
    if (club.admin && club.admin.season < state.season) delete club.admin
    const wages = weeklyWages(state, club)
    if (wages <= 0) continue
    if (club.balance >= -ADMIN_WEEKS * wages) continue
    // already being punished for this: a club does not go into administration
    // twice for the same collapse
    if (club.admin) continue

    club.admin = { season: nextSeason, penalty: ADMIN_PENALTY }
    // the creditors' haircut, and the squad cuts that come with it
    club.balance = -AFTER_ADMIN_WEEKS * wages
    shedWages(state, club)
    shedWages(state, club)
    gone.push(club.id)

    const mine = club.id === state.userClubId
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `${mine ? '🚨 ' : ''}${club.short} go into administration`,
      body: mine
        ? [
          `The club could not pay what it owed, and the board has filed. ${club.short} enter administration.`,
          '',
          `The debt is gone: the creditors have taken their haircut and the books open next season nearly clean. Everything else about this is a punishment. The league docks ${ADMIN_PENALTY} points before a ball is kicked, two of the wage bill's biggest names have been let go, and every rival in the division now knows exactly how much trouble you are in.`,
          '',
          'You start the season on minus ten. Get out of it.',
        ].join('\n')
        : `${club.name} have gone into administration after a season they could not pay for. The league will dock them ${ADMIN_PENALTY} points, and two senior men have already been released as the administrators cut the wage bill.`,
    })
  }
  return gone
}

/**
 * A year's notice, for the manager only.
 *
 * The AI does not need telling - it is already shedding wages and listing men.
 * The manager does, because the alternative is a ten-point deduction landing on
 * a save he thought was fine.
 */
export function insolvencyWarning(state: GameState): void {
  const club = state.clubs[state.userClubId]
  if (!club || club.admin) return
  if (insolvencyRisk(state, club) === 'none') return
  if (state.news.some(n => n.season === state.season && n.subject.includes('cannot go on like this'))) return
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: '⚠ The board: we cannot go on like this',
    body: [
      `The finance director has put a number in front of the board and it is not one they can live with. ${club.short} are spending money the club does not have, and at this rate the accounts will not survive the summer.`,
      '',
      `What happens then is not a warning letter. A club that cannot pay goes into administration, and the league docks it ${ADMIN_PENALTY} points the following season. The debt would be written off and so would the season.`,
      '',
      'Sell somebody, cut the wage bill, or fill the ground. There is still time, and there is not much of it.',
    ].join('\n'),
  })
}
