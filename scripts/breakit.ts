import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng, NEWS_KEEP } from '../src/game/season'
import { simMatch, autoSelect, availablePlayers, beginMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { offerRenewalAt, respondToOffer } from '../src/game/ai'
import { loanOut } from '../src/game/loans'
import { sendToCourse, type StaffRole } from '../src/game/staff'
import { commissionScout } from '../src/game/commission'
import { today } from '../src/game/days'
import { SEASON_WEEKS, fmtMoney, mgrReputation, squadTrust, type GameState, type Player } from '../src/game/model'
// one shared definition of a coherent world, used by every harness that pushes
// the engine somewhere strange
import { bad, ok, finite, checkWorld, failCount } from './worldcheck'

/**
 * ---- FIVE SEASONS, PLAYED BADLY ON PURPOSE ----
 *
 * The UI soak (scripts/soakui.mjs) presses the buttons a player presses. This
 * does the other half: it plays five seasons while behaving like the worst
 * possible manager, and then checks the things a screenshot cannot show you.
 *
 * The abuse is the point. Every week it does something a real player might do
 * carelessly or maliciously - clear the team sheet, loan out the whole squad,
 * offer a man a pound a week, sit every coach for a badge he cannot afford,
 * answer press questions twice, commission a scout while one is already out,
 * pick a lineup with the same man in four shirts - and after every week it
 * checks that the world is still coherent:
 *
 *   no NaN, Infinity or negative age anywhere in the world
 *   every roster entry points at a player who points back
 *   nobody is in two squads, or in the same lineup twice
 *   every league table's played counts match its fixtures
 *   no duplicate news ids, no orphaned fixture references
 *   the reputation and trust scales stay inside their stated bounds
 *   the attribute ratings stay inside 1-100
 *   the day walk still terminates
 *   money is a finite number, however stupid the manager has been
 */

// ------------------------------------------------------------------ the run
const ROLES: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']

/** Play five seasons and check the world after every single week. */
function play(seed: number, label: string, abuse: boolean) {
  const g = newGame('northampton', abuse ? 'Wrecking Ball' : 'Straight Bat', seed)
  const club = g.clubs[g.userClubId]
  let weeks = 0
  let matches = 0
  let abuses = 0
  const attempt = (what: () => void) => {
    try { what(); abuses++ } catch (e) { bad('THREW', `${label}: ${String(e).split('\n')[0].slice(0, 120)}`) }
  }

  for (let season = 0; season < 5; season++) {
    const startYear = g.season
    let wk = 0
    let abusedThisWeek = false
    while (g.season === startYear && wk < SEASON_WEEKS + 4) {
      wk++
      weeks++
      abusedThisWeek = false
      const w = `${label} s${season + 1} wk${g.week}`

      if (abuse) {
        abusedThisWeek = true
        // ---- pick a fight with the game every single week
        switch (weeks % 12) {
          case 0: attempt(() => { club.tactic.lineup = new Array(23).fill(null) }); break
          case 1: attempt(() => {
            const pid = club.players.find(id => g.players[id] && !g.players[id].acad)
            if (pid != null) { club.tactic.lineup[0] = pid; club.tactic.lineup[5] = pid; club.tactic.lineup[9] = pid; club.tactic.lineup[14] = pid }
          }); break
          case 2: attempt(() => {
            const foreign = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id)
            if (foreign) club.tactic.lineup[3] = foreign.id
          }); break
          case 3: attempt(() => {
            const best = club.players.map(id => g.players[id]).filter(Boolean).sort((a, b) => b.ca - a.ca)[0]
            if (best) offerRenewalAt(g, best.id, 1)
          }); break
          case 4: attempt(() => {
            const best = club.players.map(id => g.players[id]).filter(Boolean).sort((a, b) => b.ca - a.ca)[0]
            if (best) offerRenewalAt(g, best.id, 10_000_000)
          }); break
          case 5: attempt(() => { for (const r of ROLES) sendToCourse(g, r) }); break
          case 6: attempt(() => { commissionScout(g, 'any', 3); commissionScout(g, 'FL', 9); commissionScout(g, 'any', 6) }); break
          case 7: attempt(() => {
            for (const pr of g.press.slice(-3)) { answerPress(g, pr.id, 0); answerPress(g, pr.id, 1); answerPress(g, pr.id, 99) }
          }); break
          case 8: attempt(() => { for (const id of club.players.slice(0, 6)) loanOut(g, id) }); break
          case 9: attempt(() => {
            g.offers.filter(o => o.status === 'pending' && o.forUser)
              .forEach((o, i) => respondToOffer(g, o.id, i % 2 === 0))
          }); break
          case 10: attempt(() => { club.balance -= 5_000_000 }); break
          case 11: attempt(() => { club.tactic.lineup = autoSelect(g, availablePlayers(g, club.players), 'balanced') }); break
        }
      } else {
        // a straight bat: answer what has to be answered and pick a legal side
        attempt(() => {
          g.offers.filter(o => o.status === 'pending' && o.forUser).forEach(o => respondToOffer(g, o.id, false))
          for (const pr of g.press) if (!pr.answered) answerPress(g, pr.id, 0)
          if (weeks % 5 === 0) club.tactic.lineup = autoSelect(g, availablePlayers(g, club.players), 'balanced')
        })
      }

      const fx = userFixtureThisWeek(g)
      if (fx) {
        attempt(() => {
          // the two paths a player can take to a result, both exercised
          if (weeks % 2 === 0) {
            const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
            void ctx
          }
          simMatch(g, fx, weekRng(g), weeks % 3 === 0)
          matches++
        })
      }

      g.newsFrom = g.nextId
      attempt(() => processWeekAndAdvance(g))
      g.day = 0

      checkWorld(g, w, abusedThisWeek)
      if (failCount() > 40) { console.log('  (stopping: too many failures to be useful)'); return { g, weeks, matches, abuses } }
    }
    const c2 = g.clubs[g.userClubId]
    console.log(`  ${label} season ${season + 1}: ${g.mgr.m} career matches (${g.mgr.w}W ${g.mgr.d}D ${g.mgr.l}L), `
      + `balance ${fmtMoney(c2?.balance ?? 0)}, rep ${mgrReputation(g)}, trust ${Math.round(squadTrust(g))}, `
      + `${Object.keys(g.players).length} players, ${g.news.length} stories`)
  }
  return { g, weeks, matches, abuses }
}

console.log('--- PHASE 1: five seasons played straight, every invariant live')
const clean = play(24601, 'clean', false)
console.log(`  ${clean.weeks} weeks, ${clean.matches} matches`)

console.log('\n--- PHASE 2: five seasons played by the worst manager in the league')
const wrecked = play(1337, 'abused', true)
console.log(`  ${wrecked.weeks} weeks, ${wrecked.matches} matches, ${wrecked.abuses} deliberate abuses`)

// ---- and a final look at the things that only show up at the end
for (const [label, r] of [['clean', clean], ['abused', wrecked]] as const) {
  const g = r.g
  console.log(`\n--- the ${label} world after five seasons`)
  const players = Object.values(g.players)
  ok(players.length > 3000, `still has players in it (${players.length})`)
  ok(Object.keys(g.clubs).length >= 100, `and clubs (${Object.keys(g.clubs).length})`)
  const orphans = Object.values(g.clubs).flatMap(c => c.players.filter(id => !g.players[id]))
  ok(orphans.length === 0, `no roster entry points at a player who does not exist (${orphans.length})`)
  const homeless = players.filter(p => p.clubId && !g.clubs[p.clubId])
  ok(homeless.length === 0, `nobody plays for a club that does not exist (${homeless.length})`)
  const unclaimed = players.filter(p => p.clubId && !g.clubs[p.clubId]?.players.includes(p.id))
  ok(unclaimed.length === 0, `every player his club claims, claims him back (${unclaimed.length})`)
  ok(g.news.length <= NEWS_KEEP, `the news list is still trimmed (${g.news.length} <= ${NEWS_KEEP})`)
  ok(finite(g.clubs[g.userClubId]?.balance ?? NaN), 'the club still has a real balance')
  ok(g.season === 5, `five seasons actually elapsed (season index ${g.season})`)
  const seasonsOfHistory = new Set(g.history.map(h => h.season)).size
  ok(seasonsOfHistory >= 4, `the record books filled in along the way (${seasonsOfHistory} seasons of honours)`)
  ok(today(g) >= 0 && today(g) <= 5, `the day cursor is sane (${today(g)})`)
  ok(g.mgr.m === g.mgr.w + g.mgr.d + g.mgr.l,
    `the career record adds up (${g.mgr.m} = ${g.mgr.w}+${g.mgr.d}+${g.mgr.l})`)
}

console.log(failCount() ? `\nBREAK IT FOUND ${failCount()} PROBLEM(S)` : '\nBREAK IT PASSED: ten seasons, five of them abused, and the world held')
if (failCount()) process.exit(1)
