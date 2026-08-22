/**
 * ---- THE BOOK, THE BOYS, AND THE ONE WHO OWNS YOU ----
 *
 * Playbook wave 5. What this holds:
 *
 *   1. A RECORD IS ONLY BEATEN BY A BETTER ONE. The book takes the biggest win
 *      and keeps it; a narrower win does not overwrite it. This is the whole
 *      failure mode of a record book and it is one careless comparison away.
 *   2. THE HEAVIEST DEFEAT IS KEPT TOO. A book that only remembers the good
 *      days is a scrapbook.
 *   3. THE NEMESIS IS EARNED, NOT ASSIGNED. It comes from the manager's own
 *      record, needs a real sample, and is null when nobody has your number -
 *      a nemesis everybody has is not a nemesis.
 *   4. THE PROTEGES ARE THE ONES WHO LEFT. A man still at your club is not one
 *      that got away, and neither is an academy boy who never played.
 *   5. BOTH LENSES ARE PURE. Reading them writes nothing, so they can sit on a
 *      screen forever.
 *
 * Run: npx vite-node scripts/recordsprobe.ts
 */
import { newGame } from '../src/game/newgame'
import * as R from '../src/game/records'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

ok(typeof R.offerResult === 'function' && typeof R.nemesis === 'function' && typeof R.proteges === 'function',
  'records.ts exports the book, the nemesis and the proteges')

// ---- 1 + 2. the book keeps the extremes, and only the extremes ----
{
  const g = newGame('northampton', 'Booker', 31)
  R.offerResult(g, 'bath', 30, 10)          // +20
  ok(g.era?.biggestWin?.us === 30, 'the first win goes in the book')
  R.offerResult(g, 'sale', 25, 20)          // +5, narrower
  ok(g.era?.biggestWin?.us === 30 && g.era?.biggestWin?.oppId === 'bath',
    'a narrower win does not overwrite it')
  const msg = R.offerResult(g, 'exeter', 60, 5) // +55
  ok(g.era?.biggestWin?.us === 60 && !!msg, 'a bigger one does, and says so')

  R.offerResult(g, 'bath', 3, 40)           // -37
  ok(g.era?.worstLoss?.them === 40, 'the heaviest defeat is kept too')
  R.offerResult(g, 'sale', 10, 15)          // -5, narrower
  ok(g.era?.worstLoss?.them === 40, 'and a narrower defeat does not replace it')

  R.offerRun(g, 5); R.offerRun(g, 3); R.offerRun(g, 9); R.offerRun(g, 2)
  ok(g.era?.longestUnbeaten?.n === 9, `the longest run is the longest run (${g.era?.longestUnbeaten?.n})`)
  R.offerSigning(g, 1, 500_000); R.offerSigning(g, 2, 2_000_000); R.offerSigning(g, 3, 900_000)
  ok(g.era?.recordSigning?.fee === 2_000_000, 'and the record signing is the biggest cheque')
}

// ---- 3. the nemesis is earned ----
{
  const g = newGame('northampton', 'Haunted', 32)
  ok(R.nemesis(g) === null, 'a manager with no record has no nemesis')
  g.vsBook = {
    bath: { w: 3, d: 0, l: 1 },     // he beats them
    sale: { w: 0, d: 1, l: 5 },     // they own him
    exeter: { w: 1, d: 0, l: 2 },   // bad, but a smaller sample
  }
  const n = R.nemesis(g)
  ok(n?.clubId === 'sale', `the nemesis is the club that actually owns him (${n?.clubId})`)
  ok(!!n && n.line.includes('never beaten'), 'and the line says so plainly')

  const g2 = newGame('northampton', 'Winner', 33)
  g2.vsBook = { bath: { w: 6, d: 0, l: 1 }, sale: { w: 5, d: 1, l: 2 } }
  ok(R.nemesis(g2) === null, 'a manager who beats everybody has no nemesis, rather than a least-favourite')

  const g3 = newGame('northampton', 'Small', 34)
  g3.vsBook = { bath: { w: 0, d: 0, l: 2 } }
  ok(R.nemesis(g3) === null, 'and two bad afternoons is not a career-long torment')
}

// ---- 4. the proteges are the ones who left ----
{
  const g = newGame('northampton', 'Mentor', 35)
  const mine = Object.values(g.players).filter(p => p.clubId === g.userClubId).slice(0, 3)
  const theirs = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId).slice(0, 3)
  for (const p of mine) { p.homegrown = true; p.stats.apps = 20 }
  ok(R.proteges(g).length === 0, 'a graduate still at your club is not one that got away')
  for (const p of theirs) { p.homegrown = true; p.stats.apps = 20 }
  ok(R.proteges(g).length === 3, `the three who left are (${R.proteges(g).length})`)
  const never = theirs[0]
  never.stats.apps = 0
  ok(R.proteges(g).length === 2, 'and one who never played senior rugby is not a protege')
  ok((R.protegeLine(g) ?? '').includes('graduates'), 'the line reads as English')
}

// ---- 5. pure ----
{
  const g = newGame('northampton', 'Lens', 36)
  g.vsBook = { bath: { w: 0, d: 0, l: 6 } }
  const before = JSON.stringify(g)
  for (let i = 0; i < 30; i++) { R.nemesis(g); R.proteges(g); R.protegeLine(g) }
  ok(JSON.stringify(g) === before, 'reading the nemesis and the proteges leaves the save byte-identical')
}

console.log(fails ? `RECORDS PROBE FAILED (${fails})` : 'RECORDS PROBE PASSED: the era leaves something behind')
if (fails) process.exit(1)
