// Probe: the job market gives a second chance, without becoming a giveaway.
//
// Reported live with a Job Centre screenshot: unemployed after resigning, three
// vacancies on the board, every one of them reading "Interview prospects: Long
// shot" - including two second division clubs at rep 45 and 50 (user: "ive
// resigned from a job and trying to get a job but no-one is interested - we
// need to make it so a lower level team will gove a second chance").
//
// The cause was arithmetic. jobChance was a pure reputation-gap formula, and a
// manager who resigns early carries a reputation near the floor of 22, so a
// rep 45 board rolled him at about twenty percent. There was no concept of a
// modest club being GLAD to land an available manager with a body of work.
//
// Four properties, and the last one matters as much as the first three:
//
//   a modest club gives an unemployed manager a fair hearing, rookie or not
//   experience deepens the welcome: matches managed substitute for reputation
//   the ladder still slopes: a lower-rep club is never a worse bet than a
//     higher-rep one
//   the giants are unmoved: rep 84 stays a genuine long shot, and an EMPLOYED
//     manager's odds are exactly what they were - the second chance is for the
//     out-of-work, not a market-wide inflation
import { newGame } from '../src/game/newgame'
import { jobChance } from '../src/game/jobs'
import { mgrReputation } from '../src/game/model'
import type { GameState } from '../src/game/model'
import { clamp } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g: GameState = newGame('northampton', 'Second Chance', 77)

// the cast: real clubs from the world, picked by standing
const byRep = Object.values(g.clubs).sort((a, b) => a.rep - b.rep)
const modest = byRep.find(c => c.rep <= 45) ?? byRep[0]
const middling = byRep.find(c => c.rep >= 50 && c.rep <= 58) ?? byRep[Math.floor(byRep.length / 2)]
const giant = [...byRep].reverse().find(c => c.rep >= 80) ?? byRep[byRep.length - 1]
console.log(`cast: modest ${modest.short} (rep ${modest.rep}), middling ${middling.short} (rep ${middling.rep}), giant ${giant.short} (rep ${giant.rep})\n`)

// ---- the screenshot: a rookie who resigned in season one -------------------
// a losing half-season, then the resignation: reputation lands in the mid 20s,
// which is exactly the manager the Job Centre was calling a Long shot at every
// club on the board, second division included
g.unemployed = true
g.mgr.m = 22; g.mgr.w = 4; g.mgr.d = 1; g.mgr.l = 17
console.log(`rookie out of work: reputation ${mgrReputation(g)}/95`)
const rookieModest = jobChance(g, modest.id)
const rookieMiddling = jobChance(g, middling.id)
const rookieGiant = jobChance(g, giant.id)
ok(rookieModest > 0.3, `a modest board gives him a hearing: ${modest.short} at ${(rookieModest * 100).toFixed(0)}% (Long shot ends at 30%)`)
ok(rookieMiddling > 0.3, `and so does a second division board at rep ${middling.rep} - the Biarritz case: ${middling.short} at ${(rookieMiddling * 100).toFixed(0)}%`)
ok(rookieGiant <= 0.15, `the giant is unmoved: ${giant.short} at ${(rookieGiant * 100).toFixed(0)}%`)

// ---- experience deepens the welcome ----------------------------------------
const rookieMid = jobChance(g, middling.id)
g.mgr.m = 130; g.mgr.w = 55; g.mgr.l = 70; g.mgr.d = 5
console.log(`veteran out of work: reputation ${mgrReputation(g)}/95`)
const vetMid = jobChance(g, middling.id)
ok(vetMid > rookieMid, `a body of work counts: ${middling.short} moves ${(rookieMid * 100).toFixed(0)}% to ${(vetMid * 100).toFixed(0)}% for a 130-match veteran`)

// ---- the ladder still slopes ------------------------------------------------
{
  let prev = -1
  let sloped = true
  for (const c of [...byRep].reverse()) { // highest rep first: odds must never FALL as rep falls
    const ch = jobChance(g, c.id)
    if (prev >= 0 && ch < prev - 1e-9) {
      sloped = false
      console.log(`    slope breaks at ${c.short} (rep ${c.rep}): ${ch.toFixed(3)} after ${prev.toFixed(3)}`)
    }
    prev = ch
  }
  ok(sloped, 'walking down the ladder never lowers the odds')
}

// ---- employed managers are priced exactly as before ------------------------
g.unemployed = false
for (const c of [modest, middling, giant]) {
  const rep = mgrReputation(g)
  const old = clamp(0.92 - (c.rep - rep) / 32, 0.05, 0.95)
  const now = jobChance(g, c.id)
  ok(Math.abs(now - old) < 1e-9, `${c.short} prices an EMPLOYED manager as before (${(now * 100).toFixed(0)}%)`)
}

if (fails) { console.error(`\nSECOND CHANCE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nSECOND CHANCE PROBE PASSED: the way back in is a rung or two down')
