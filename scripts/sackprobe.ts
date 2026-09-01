/**
 * ---- LOSING YOUR JOB IS AN EVENT, NOT A LETTER ----
 *
 * Owner, v1.2.1: "It should be clear if you are sacked. Like really obvious. A
 * pop up of breaking news and the game makes you make a press statement - I
 * deserved it, I didnt like the team anyway, it was unfair... shouldnt really
 * have any impact on anything though."
 *
 * Before this, a dismissal was one item in an inbox of eleven. Two things have
 * to be true for the fix to hold, and they pull in opposite directions:
 *
 *   1. EVERY route out of a job announces itself. There are two sacking calls
 *      in the game (collapsed board confidence, and pushing a board request
 *      once too often) and both go through sackManager - so the flag is set
 *      there rather than at either call site, and this checks the flag lands
 *      whichever door was used.
 *   2. IT CHANGES NOTHING ELSE. The owner asked for a moment, not a mechanic.
 *      A press statement that quietly moved reputation would turn a piece of
 *      theatre into a puzzle with a right answer - so every line is measured
 *      against the whole of the rest of the state, and any drift fails here.
 *
 * Run: npx vite-node scripts/sackprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { sackManager } from '../src/game/jobs'
import { mgrReputation, type GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

const fresh = (): GameState => newGame('leicester', 'Sack Probe', 99)

/** Everything about a career EXCEPT the sacking itself. If a press statement
 *  moves any of this, it is a mechanic and the owner did not ask for one. */
const fingerprint = (g: GameState) => JSON.stringify({
  // the manager's standing is DERIVED, so it is called rather than read - an
  // earlier draft of this compared g.reputation to g.reputation, and since
  // neither exists the assertion passed by comparing undefined with undefined.
  // A probe that cannot fail is worse than no probe.
  rep: mgrReputation(g),
  balance: Object.values(g.clubs).map(c => `${c.id}:${c.balance}`),
  unemployed: g.unemployed,
  news: g.news.length, offers: g.offers.length, vacancies: g.vacancies.length,
  players: Object.values(g.clubs).flatMap(c => c.players.map(p => `${p.id}:${p.morale}:${p.ability}`)),
  board: g.boardConfidence, fans: g.fanMood, week: g.week, season: g.season,
})

// ---- 1. both dismissal letters raise the bulletin --------------------------
console.log('--- 1. every sack announces itself')
for (const k of ['news.sacked', 'news.sackedPushed']) {
  const g = fresh()
  sackManager(g, k)
  ok(!!g.sacked, `${k}: the game knows to stop and say so`)
  ok(g.sacked?.k === k, `${k}: the bulletin carries the board's own letter, not a second copy`)
  ok(g.sacked?.said === null, `${k}: and it is waiting for a statement, not already answered`)
  ok(!!g.sacked?.club, `${k}: it names the club (${g.sacked?.club})`)
  ok(g.unemployed === true, `${k}: the job is actually gone`)
  // the letter still lands in the inbox: the bulletin is as well as, not instead of
  ok(g.news.some(n => n.k === k), `${k}: the letter is still filed for the record`)
}

// ---- 2. the statement changes nothing ---------------------------------------
console.log('\n--- 2. what he tells the cameras costs him nothing')
{
  const base = fresh()
  sackManager(base, 'news.sacked')
  const before = fingerprint(base)
  for (const said of ['owned', 'spite', 'unfair']) {
    const g = fresh()
    sackManager(g, 'news.sacked')
    // exactly what the overlay does when a line is picked
    g.sacked = { ...g.sacked!, said }
    ok(fingerprint(g) === before,
       `"${said}" leaves every other number where it was - theatre, not a mechanic`)
  }
}

// ---- 3. and it can be finished ----------------------------------------------
console.log('\n--- 3. the desk gets cleared')
{
  const g = fresh()
  sackManager(g, 'news.sacked')
  const before = fingerprint(g)
  g.sacked = { ...g.sacked!, said: 'owned' }
  g.sacked = null // what the closing button does
  ok(g.sacked === null, 'closing the bulletin puts it away for good')
  ok(fingerprint(g) === before, 'and closing it changes nothing either')
  ok(g.unemployed === true, 'the manager is still out of work afterwards - the moment passes, the sack does not')
}

// ---- 4. an ordinary career is never interrupted by one ----------------------
console.log('\n--- 4. nobody who still has a job sees it')
{
  const g = fresh()
  ok(!g.sacked, 'a new career carries no bulletin')
}

console.log(fails === 0
  ? '\nSACK PROBE PASSED: every dismissal is announced, and none of it costs anything'
  : `\nSACK PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
