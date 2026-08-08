// Probe: is a match REPLAYABLE?
//
// This is the property a mid-match reload depends on. The eighty minutes live in
// memory rather than in the save, so the only way to survive a reload is to
// rebuild the match from its starting conditions - which requires that beginning
// the same fixture from the same state twice gives byte-for-byte the same match.
//
// It did not. Initial player ratings came from a MODULE-LEVEL counter
// (`let _n = 0` feeding gaussNoise), so:
//   - the same fixture played twice in one process gave different ratings
//   - and the ratings depended on how many OTHER matches had simulated first,
//     which is a hidden coupling between unrelated fixtures
// scripts/fingerprint.ts could not see it: the fingerprint compares scores, and
// this only reached ratings. Ratings are not decoration - they feed the season's
// ratingSum, the average a man is judged on, and Player of the Month.
//
// So this checks the whole match, not the scoreline: events, scores AND every
// rating, across repeated runs and with unrelated matches simulated in between.
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick } from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'
import type { GameState } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

/** Everything a player could notice about a match, as one string. */
function signature(seed: number, warmUp: number, ticks: number): string {
  const g: GameState = newGame('northampton', 'Replay', seed)
  const mine = g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))
    ?? g.fixtures.find(f => f.week === g.week)!
  // Simulate unrelated fixtures first. Nothing about them may reach our match.
  for (const other of g.fixtures.filter(f => f.week === g.week && f.id !== mine.id).slice(0, warmUp)) {
    const c = beginMatch(g, other, weekRng(g), false, null)
    for (let i = 0; i < 20; i++) stepTick(g, c)
  }
  const ctx = beginMatch(g, mine, weekRng(g), true, g.userClubId)
  for (let i = 0; i < ticks; i++) stepTick(g, ctx)
  const ev = ctx.events.map(e => `${e.min}${e.type}${e.homeScore}-${e.awayScore}${e.playerId ?? ''}`).join('|')
  const rate = (m: Map<number, number>) => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([id, r]) => `${id}:${r.toFixed(3)}`).join(',')
  return [ev, ctx.home.score, ctx.away.score, rate(ctx.home.ratings), rate(ctx.away.ratings), ctx.motmId].join('#')
}

for (const seed of [4242, 777, 31337]) {
  const a = signature(seed, 0, 12)
  const b = signature(seed, 0, 12)
  const c = signature(seed, 3, 12)
  const full1 = signature(seed, 0, 20)
  const full2 = signature(seed, 5, 20)
  console.log(`seed ${seed}: repeat ${a === b ? 'same' : 'DIFFERENT'}, after 3 other matches ${a === c ? 'same' : 'DIFFERENT'}, full match ${full1 === full2 ? 'same' : 'DIFFERENT'}`)
  if (a !== b) bad(`seed ${seed}: the same match played twice is not the same match`)
  if (a !== c) bad(`seed ${seed}: simulating other fixtures first changed this one`)
  if (full1 !== full2) bad(`seed ${seed}: a full match is not reproducible`)
}

// And a part-played match must be a prefix of the full one: replaying to tick 12
// has to agree with the first 12 ticks of the same match played out to the end.
{
  const twelve = signature(4242, 0, 12).split('#')[0]
  const twenty = signature(4242, 0, 20).split('#')[0]
  const ok = twenty.startsWith(twelve)
  console.log(`the first 12 ticks are a prefix of the full match: ${ok}`)
  if (!ok) bad('stopping at tick 12 does not match the first 12 ticks of the full match, so a resume cannot be trusted')
}

if (fails) { console.error(`REPLAY PROBE: ${fails} failures`); process.exit(1) }
console.log('REPLAY PROBE PASSED')
