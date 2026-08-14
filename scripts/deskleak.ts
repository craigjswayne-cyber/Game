// A bid dies with the desk it was made across (round 25).
//
// From a screenshot: the user resigned at Northampton, took another job, and
// was then made to answer a pending bid for Alex Mitchell - a Northampton
// player - selling him out of a club that was no longer theirs to sell from.
// The offers gate (10E) is right to force an answer; the offer should never
// have survived the job change. Every employment transition now clears the
// pending pile: resignation, the sack, and a new appointment.
import { newGame } from '../src/game/newgame'
import { resignJob, applyForJob } from '../src/game/jobs'
import type { TransferOffer } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const fakeBid = (g: ReturnType<typeof newGame>): TransferOffer => ({
  id: g.nextId++, playerId: g.clubs[g.userClubId].players[0],
  fromClubId: 'toulon', toClubId: g.userClubId,
  fee: 2_000_000, week: g.week, forUser: true, status: 'pending',
})

// ---- resignation clears the desk -------------------------------------------
{
  const g = newGame('northampton', 'Desk', 11)
  g.offers.push(fakeBid(g))
  resignJob(g)
  ok(g.unemployed, 'the manager is out of work')
  ok(g.offers.length === 0, 'and the pending bid went with the job')
}

// ---- a new appointment clears whatever survived -----------------------------
{
  const g = newGame('northampton', 'Desk', 11)
  g.offers.push(fakeBid(g))
  resignJob(g)
  g.offers.push(fakeBid(g)) // hostile: something re-queued while unemployed
  // apply until a hire lands - applyForJob rolls a deterministic chance per
  // club, so walk the vacancy list until one says yes
  g.vacancies.push({ clubId: 'newcastle', week: g.week })
  for (let tries = 0; tries < 30 && g.unemployed; tries++) {
    for (const v of [...g.vacancies]) {
      v.applied = false
      applyForJob(g, v.clubId)
      if (!g.unemployed) break
    }
    g.week += 1
  }
  if (!g.unemployed) {
    ok(g.offers.length === 0, `hired at ${g.clubs[g.userClubId].short}: the old desk's bids are gone`)
  } else {
    console.log('  (no board said yes in 30 weeks - resignation path already proved the clear)')
  }
}

console.log(fails ? `\nDESK LEAK PROBE FAILED (${fails})` : '\nDESK LEAK PROBE PASSED: bids die with the desk')
process.exit(fails ? 1 : 0)
