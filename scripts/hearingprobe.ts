/**
 * ---- THE HEARING IS A DECISION, NOT A FREE GO ----
 *
 * Until 1.5.8 an appeal against a red-card ban was `(id + season * 7 + week * 3)
 * % 3 !== 0`: two clubs in three won, whoever the player was and whatever he
 * had done. The owner played a season of it and said "reviewing a card seems to
 * always go in my favour - this needs to be more balanced".
 *
 * hearingSucceeds now reads the player's own season. Three properties, and the
 * third is the one that makes it a decision:
 *
 *   1. DETERMINISTIC. The same save gets the same verdict however many times it
 *      is asked. A hearing you can reload past is not a hearing.
 *   2. BALANCED. Across the range of players who actually get cited, the club
 *      wins somewhere near half - not two thirds.
 *   3. ORDERED BY THE RECORD. A clean man on a one-match ban does better than a
 *      man with a season of yellows behind him, who does better than a repeat
 *      offender on a long ban. If that order ever inverts, the mitigation the
 *      judicial process is modelled on has stopped meaning anything, and the
 *      manager's selections stop mattering to the outcome.
 *
 * Run: npx tsx scripts/hearingprobe.ts
 */
import { hearingSucceeds } from '../src/game/media'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, msg: string) => {
  if (!cond) { fails++; console.log('FAIL  ' + msg) } else console.log('  ok  ' + msg)
}

const man = (id: number, yc: number, rc: number, bans: number) =>
  ({ id, bans, stats: { yc, rc } } as unknown as Player)
const day = (season: number, week: number) => ({ season, week } as unknown as GameState)

/** share of hearings won by this kind of player, over six seasons of dates */
function rate(yc: number, rc: number, bans: number): number {
  let up = 0, n = 0
  for (let id = 1; id <= 600; id++) {
    for (let season = 0; season < 6; season++) {
      for (let week = 1; week <= 48; week += 7) {
        n++
        if (hearingSucceeds(day(season, week), man(id, yc, rc, bans))) up++
      }
    }
  }
  return up / n
}

// ---- 1. the same save, the same verdict ----
{
  const p = man(41, 1, 1, 2)
  const first = hearingSucceeds(day(2, 19), p)
  let stable = true
  for (let i = 0; i < 50; i++) if (hearingSucceeds(day(2, 19), p) !== first) stable = false
  ok(stable, 'the same player on the same day gets the same verdict every time it is asked')
}

// ---- 2. and 3. the shape of it ----
const clean1 = rate(0, 1, 1)    // first offence, one-match ban
const clean3 = rate(0, 1, 3)
const yellowy = rate(3, 1, 2)   // a season of indiscipline behind him
const repeat = rate(2, 2, 4)    // second red, long ban

console.log(`\n  clean 1-match ${(100 * clean1).toFixed(0)}% · clean 3-match ${(100 * clean3).toFixed(0)}%`
  + ` · three yellows ${(100 * yellowy).toFixed(0)}% · repeat offender ${(100 * repeat).toFixed(0)}%\n`)

const spread = (clean1 + clean3 + yellowy + repeat) / 4
ok(spread > 0.3 && spread < 0.55,
  `across the range of cited players the club wins near half, not two in three (${(100 * spread).toFixed(0)}%)`)

ok(clean1 > clean3 && clean3 > yellowy && yellowy > repeat,
  'and the order is the record: clean and short beats clean and long beats indisciplined beats repeat offender')

ok(repeat < 0.2, `a second red on a long ban is close to hopeless (${(100 * repeat).toFixed(0)}%)`)
ok(clean1 > 0.5, `a first offender on a one-match ban is still worth lodging (${(100 * clean1).toFixed(0)}%)`)

console.log(fails === 0
  ? '\nHEARING PROBE PASSED: the panel reads the record, and the club does not always win'
  : `\nHEARING PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
