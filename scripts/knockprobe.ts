/**
 * ---- PLAYING THROUGH A KNOCK (knock.ts) ----
 *
 * Owner, 25 Sep 2026: "play-through-injury decisions (non-head only)". This
 * holds the rule:
 *
 *   1. only the last weeks of a lay-off, and never a head injury
 *   2. played through, he is available; rested again, the lay-off is as it was
 *   3. he starts a match short of his usual tank
 *   4. a match played on it flares at about the stated rate, a week without
 *      one never does, and the same week always ends the same way
 *   5. reach the physio's date and the knock is simply gone
 *
 * Run: npx vite-node scripts/knockprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { availablePlayers, beginMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { KNOCK_ENERGY, KNOCK_MAX_WEEKS, canPlayThrough, flareChance, playThrough, restKnock, settleKnocks } from '../src/game/knock'
import type { Fixture, GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g0 = (): GameState => newGame('bath', 'Knock Probe', 17)
const mine = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
const hurt = (g: GameState, p: Player, left: number, dk = 'injury.hamstring', weeks = 4) => {
  p.injury = { desc: dk, dk, until: g.week + left, weeks, seen: true }
}

console.log('--- 1. who may play through it')
{
  const g = g0()
  const [a, b, c, d] = mine(g)
  hurt(g, a, 2)
  hurt(g, b, KNOCK_MAX_WEEKS + 2)
  hurt(g, c, 1, 'injury.concussion', 2)
  hurt(g, d, 1, 'injury.hiaFail', 2)
  ok(canPlayThrough(g, a), 'a hamstring with two weeks left can be played through')
  ok(!canPlayThrough(g, b), `one with ${KNOCK_MAX_WEEKS + 2} weeks left cannot`)
  ok(!canPlayThrough(g, c), 'a concussion never can, however close to fit')
  ok(!canPlayThrough(g, d), 'and nor can a failed HIA')
  ok(!playThrough(g, c.id).ok, 'and asking anyway is refused')
}

console.log('--- 2. played through, and rested again')
{
  const g = g0()
  const [a] = mine(g)
  hurt(g, a, 2)
  const until = a.injury!.until
  ok(!availablePlayers(g, [a.id]).length, 'injured, he is not available')
  const r = playThrough(g, a.id)
  ok(r.ok && !a.injury && !!a.knock, 'played through: the injury becomes a knock')
  ok(availablePlayers(g, [a.id]).length === 1, 'and he is available to pick')
  restKnock(g, a.id)
  ok(!a.knock && a.injury?.until === until, 'rested after all: the lay-off is exactly what it was')
}

console.log('--- 3. he starts short of his tank')
{
  const g = g0()
  const club = g.clubs[g.userClubId]
  const starter = club.tactic.lineup.slice(0, 15).map(id => (id != null ? g.players[id] : null)).find((p): p is Player => !!p && !p.injury)!
  starter.cond = 90
  const opp = Object.keys(g.clubs).find(id => id !== club.id && g.clubs[id].leagueId === club.leagueId)!
  const fx = { id: 999001, compId: 'prem', round: 0, week: g.week, homeId: club.id, awayId: opp, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 } as Fixture
  const fresh = beginMatch(g, fx, mulberry32(5), true).home.energy.get(starter.id)
  hurt(g, starter, 1)
  playThrough(g, starter.id)
  const knocked = beginMatch(g, { ...fx, id: 999002 }, mulberry32(5), true).home.energy.get(starter.id)
  ok(fresh === 90, `fit, he kicks off on his condition (${fresh})`)
  ok(knocked === Math.round(90 * KNOCK_ENERGY * 100) / 100 || Math.abs((knocked ?? 0) - 90 * KNOCK_ENERGY) < 0.01,
    `carrying a knock, on ${KNOCK_ENERGY * 100}% of it (${knocked})`)
}

console.log('--- 4. the flare-up')
{
  const g = g0()
  const team = mine(g)
  let flares = 0, trials = 0
  for (let w = 0; w < 12; w++) {
    g.week = 5 + w
    for (const p of team) {
      hurt(g, p, 1)
      playThrough(g, p.id)
      p.stats.mins += 80           // he played on it
      settleKnocks(g)
      trials++
      if (p.injury) flares++
      p.injury = null; p.knock = undefined
    }
  }
  const rate = flares / trials
  const want = flareChance(1)
  ok(Math.abs(rate - want) < 0.07, `one week early flares at about ${Math.round(want * 100)}% (${Math.round(rate * 100)}% of ${trials})`)
  const [a] = team
  g.week = 9
  hurt(g, a, 3, 'injury.hamstring', 4)
  playThrough(g, a.id)
  settleKnocks(g)
  ok(!!a.knock && !a.injury, 'a week in which he did not play cannot flare')
  // the same week, the same man, the same answer
  const run = () => {
    const h = g0(); const [b] = mine(h); h.week = 12
    hurt(h, b, 2); playThrough(h, b.id); b.stats.mins += 80; settleKnocks(h)
    return b.injury ? `out ${b.injury.until - h.week}` : 'fine'
  }
  ok(run() === run(), `and the same week always ends the same way (${run()})`)
}

console.log('--- 5. he reaches the physio\'s date')
{
  const g = g0()
  const [a] = mine(g)
  g.week = 10
  hurt(g, a, 2)
  playThrough(g, a.id)
  g.week = 12
  settleKnocks(g)
  ok(!a.knock && !a.injury, 'the knock is gone on the day he was due back')
}

console.log(fails ? `\nKNOCK PROBE FAILED (${fails})` : '\nKNOCK PROBE PASSED: never the head, the risk as stated, and the knock ends on the day')
process.exit(fails ? 1 : 0)
