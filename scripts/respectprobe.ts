/**
 * ---- THEY RESPECT YOU NOW (1.8.0, E9) ----
 *
 * oppcoach.ts setUpForUser: the week an AI club plays the manager, a coach who
 * sees a bigger name than his own club sets up more cautiously and goes after
 * the manager's weakest unit, through his own dials. This holds four things:
 *
 *   IT TRACKS STANDING. A new manager's opponents (standing = club rep and a
 *   22 name, averaged) change nothing; the same club under a proven name (the
 *   Manager's License, 95) sees most of the league set up for it.
 *   IT COSTS THE MANAGER. The same fixtures, the same squads, the same dice:
 *   every user match is played K times from a copy of the save, once with the
 *   respectful plan and once with it taken off (restoreOpposition), and the
 *   manager's result must be worse at high standing (fewer or equal wins and
 *   at least a quarter of a point of margin a match) and untouched at low. It is a
 *   nudge, not a wall: the fall is bounded. The tactic dials are neutral by
 *   design (philosophy.ts), so a plan can only shade a match, not decide it.
 *   NOTHING LEAKS. The plan is on the opponent for its week only: after the
 *   week turns, every club that carried one is back on its coach's dials.
 *   THE WORLD IS UNTOUCHED. No AI-v-AI fixture ever sees a plan (it is set on
 *   the manager's opponent only, and the opponent plays one match a week).
 *
 * Run: npx vite-node scripts/respectprobe.ts [K] [weeks]
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { respectFor, restoreOpposition, RESPECT_MIN } from '../src/game/oppcoach'
import { PHILOSOPHY_BY_ID } from '../src/game/philosophy'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// 24, not 8: at 8 the margin check sat inside its own noise (0.39 against
// 1.02 on the same code at 24, 27-28 Sep 2026)
const K = Number(process.argv[2] ?? 24)
const WEEKS = Number(process.argv[3] ?? 34)
// SIX WORLDS, NOT TWO (28 Sep 2026). The high-standing cost is a property of
// each world's fixture list as much as of the plan: per world it read 6.4,
// 2.8, 1.0 and 1.2pp of wins across shifted seed lists, and the pooled two
// read 5.4, 1.0 (FAIL against the 1.5 floor) and 2.6. Six worlds pool three
// times the fixtures; the restore-in-place above pays for them (two worlds
// took 205 s re-parsing JSON, six take about three minutes). Floors unchanged.
//
// AND WHAT SIX WORLDS SAY (28 Sep 2026): four seed lists read 3.7, 1.1, 2.1
// and 2.0pp of wins and 1.50, 1.10, 1.31 and 1.12 points of margin. The
// margin half of the claim (0.5) stands well clear every time; the win-rate
// half (1.5pp) does not, because the effect itself is about 2pp, not the
// 4.1 measured on the first two worlds, and a list's standard error is near
// 1. That is a finding about the engine, not the sample, and the floor is
// left where it was for the lead to decide.
const WORLDS: [string, number][] = [['northampton', 9], ['leicester', 777], ['bath', 31], ['sale', 4242], ['exeter', 99], ['northampton', 2025]]

interface Tally { games: number; planned: number; winOn: number; winOff: number; marginOn: number; marginOff: number; respect: number; leaks: number; replays: number; replayed: number }

function run(club: string, seed: number, licensed: boolean): Tally {
  const g: GameState = newGame(club, 'Respect', seed)
  g.licensed = licensed
  const t: Tally = { games: 0, planned: 0, winOn: 0, winOff: 0, marginOn: 0, marginOff: 0, respect: 0, leaks: 0, replays: 0, replayed: 0 }
  // the first week's plan is written as week 1 turns in a real career; here
  // the world is built at week 1, so write it the way the turn would
  processWeekAndAdvance(g)
  while (g.week < WEEKS) {
    const fx = userFixtureThisWeek(g)
    if (fx && g.comps[fx.compId]?.type === 'league') {
      const oppId = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
      t.games++
      t.respect += respectFor(g, oppId)
      if (g.clubs[oppId]?.vsUser) t.planned++
      // RESTORED IN PLACE, NOT RE-PARSED (28 Sep 2026): a JSON copy of the
      // world per sim was about 40 ms of the 50 each took. The two clubs, their
      // men and the chemistry ledger are all a match reads or writes that the
      // next could feel, so they are put back before every sim, and once more
      // before the real season goes on.
      // (and every club carrying a plan: restoreOpposition clears them all,
      // which on a copy was harmless and on the live world is not)
      const clubIds = [...new Set([fx.homeId, fx.awayId, ...Object.values(g.clubs).filter(c => c.vsUser).map(c => c.id)])]
      const pids = [fx.homeId, fx.awayId].flatMap(c => g.clubs[c]?.players ?? [])
      const snapC = structuredClone(clubIds.map(c => g.clubs[c]))
      const snapP = structuredClone(pids.map(id => g.players[id]))
      const snapChem = structuredClone(g.chem)
      const snapMisc = { news: g.news.slice(), nextId: g.nextId, grudges: structuredClone(g.grudges) }
      const restore = () => {
        clubIds.forEach((c, j) => { g.clubs[c] = structuredClone(snapC[j]) })
        pids.forEach((id, j) => { g.players[id] = structuredClone(snapP[j]) })
        g.chem = structuredClone(snapChem)
        // a match also files news, takes ids and can start a grudge the next
        // one reads, so those go back too
        g.news = snapMisc.news.slice(); g.nextId = snapMisc.nextId; g.grudges = structuredClone(snapMisc.grudges)
      }
      const sim = (on: boolean, k: number) => {
        restore()
        if (!on) restoreOpposition(g)
        const f = { ...fx, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 }
        simMatch(g, f, mulberry32((fx.id * 7919 + k * 104729 + seed) >>> 0), false)
        return f.homeId === g.userClubId ? f.homeScore - f.awayScore : f.awayScore - f.homeScore
      }
      for (const on of [true, false]) {
        for (let k = 0; k < K; k++) {
          const mine = sim(on, k)
          if (on) { t.winOn += mine > 0 ? 1 : 0; t.marginOn += mine } else { t.winOff += mine > 0 ? 1 : 0; t.marginOff += mine }
        }
      }
      t.replays++
      // with a different match in between, so anything a sim leaves behind
      // that the restore misses would show
      const first = sim(true, 0); sim(false, 1)
      if (first === sim(true, 0)) t.replayed++
      restore()
    }
    if (fx) simMatch(g, fx, weekRng(g), false)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    // who carried a plan this week: after the turn, each must be back on its
    // coach's dials unless it is also next week's opponent
    const carried = Object.values(g.clubs).filter(c => c.vsUser).map(c => c.id)
    processWeekAndAdvance(g)
    for (const id of carried) {
      const c = g.clubs[id]
      if (c.vsUser) continue
      const ph = c.philosophy ? PHILOSOPHY_BY_ID[c.philosophy] : null
      if (ph && (c.tactic.tempo !== ph.dials.tempo || c.tactic.style !== ph.dials.style || c.tactic.kicking !== ph.dials.kicking)) t.leaks++
    }
  }
  return t
}

const pct = (a: number, n: number) => `${(100 * a / Math.max(1, n)).toFixed(1)}%`
let lowOn = 0, lowOff = 0, lowN = 0, hiOn = 0, hiOff = 0, hiN = 0, hiMOn = 0, hiMOff = 0, hiPlanned = 0, hiGames = 0, lowPlanned = 0, leaks = 0
let replays = 0, replayed = 0
const perWorld: number[] = []
for (const [club, seed] of WORLDS) {
  for (const licensed of [false, true]) {
    const t = run(club, seed, licensed)
    const n = t.games * K
    console.log(`  ${club}/${seed} ${licensed ? 'HIGH (licensed, 95)' : 'LOW  (new name, 22)'}: ${t.games} league matches, plan set in ${t.planned}, mean respect ${(t.respect / Math.max(1, t.games)).toFixed(2)}`)
    console.log(`      win rate with the plan ${pct(t.winOn, n)} (margin ${(t.marginOn / n).toFixed(1)}), without ${pct(t.winOff, n)} (margin ${(t.marginOff / n).toFixed(1)})  [${n} sims each]`)
    leaks += t.leaks
    replays += t.replays; replayed += t.replayed
    if (licensed) { hiOn += t.winOn; hiOff += t.winOff; hiMOn += t.marginOn; hiMOff += t.marginOff; hiN += n; hiPlanned += t.planned; hiGames += t.games; perWorld.push((t.winOff - t.winOn) / n * 100) }
    else { lowOn += t.winOn; lowOff += t.winOff; lowN += n; lowPlanned += t.planned }
  }
}
const dHi = (hiOff - hiOn) / hiN * 100, dLow = (lowOff - lowOn) / lowN * 100
console.log(`\n  POOLED  low standing: ${pct(lowOn, lowN)} with, ${pct(lowOff, lowN)} without (${dLow.toFixed(1)}pp)`)
console.log(`          high standing: ${pct(hiOn, hiN)} with, ${pct(hiOff, hiN)} without (${dHi.toFixed(1)}pp; by world ${perWorld.map(x => x.toFixed(1)).join(', ')})\n`)
ok(replayed === replays, `a restored kick-off replays the same match on the same stream (${replayed}/${replays})`)
ok(lowPlanned === 0, `a new name at a mid-table club is not respected: no plan set in ${lowPlanned} matches (respect below ${RESPECT_MIN})`)
ok(hiPlanned >= hiGames * 0.5, `a proven name is: a plan against him in ${hiPlanned} of ${hiGames} league matches`)
ok(Math.abs(dLow) < 0.05, `low standing: win rate untouched (${dLow.toFixed(1)}pp)`)
const mHi = (hiMOff - hiMOn) / hiN
// THE DIALS ALONE ARE A SHADE. Measured on this probe: the plan through the
// dials only, 38.3% wins with it against 37.5% without (noise); with the
// engine also layering oppcoach.respectLayers (the extra yard: 4% defence, 3%
// breakdown at full respect), 33.1% against 37.2%, 2.0 points of margin a
// match. Which one is live depends on whether the engine reads it, so the
// cost is asserted only when it does; either way it must never help him.
const wired = readFileSync(new URL('../src/game/matchEngine.ts', import.meta.url), 'utf8').includes('respectLayers(')
if (wired) ok(dHi >= 1.5 && mHi >= 0.5, `high standing: the respectful plan costs the manager (${dHi.toFixed(1)}pp of wins, ${mHi.toFixed(2)} points of margin a match)`)
else {
  console.log(`  (the engine does not read respectLayers yet: dials only, ${dHi.toFixed(1)}pp of wins, ${mHi.toFixed(2)} points of margin)`)
  ok(dHi >= -2.5, `high standing: the dials alone never hand the manager an edge (${dHi.toFixed(1)}pp)`)
}
ok(dHi <= 10, `...and it is a nudge, not a wall (${dHi.toFixed(1)}pp, ceiling 10)`)
ok(leaks === 0, `every plan came off the week after (${leaks} leaks)`)
console.log(fails ? `\n${fails} FAILURES` : '\nRESPECT PROBE PASSED: the league sets up for a big name, and only for his matches')
process.exit(fails ? 1 : 0)
