/**
 * ---- DEMOTION IS NOT A LOOPHOLE ----
 *
 * v1.1.18 added the button (owner: "You should be able to demote a player
 * down from the main squad - regardless of age"), and the button is the easy
 * part. The dangerous part is what the academy flag MEANS elsewhere: academy
 * players are exempt from the salary cap and are swept by the season-end
 * academy rules. Set the flag alone and demotion becomes a cap dodge and, at
 * 21+, a free release. The demoted flag exists to close both doors, and this
 * probe holds them shut.
 *
 * Also here: the events department checks the fixture list before booking a
 * stadium concert (owner: "no concerts happen 5 days before a home game") -
 * upkeep rolls at the top of the week, the match is at its end, so a concert
 * in a home week is always inside the five days.
 *
 * Run: npx vite-node scripts/demoteprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { capBill } from '../src/game/ai'
import { upkeepWeek } from '../src/game/upkeep'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

// ---- 1. the cap keeps counting a demoted senior ----------------------------
{
  const g = newGame('northampton', 'Demote Probe', 7)
  const club = g.clubs[g.userClubId]
  const p = club.players.map(id => g.players[id]).find(q => q && !q.acad && q.age >= 25)!
  ok(!!p, `a senior first-teamer to send down exists (${p?.name}, ${p?.age})`)

  const before = capBill(g, club)
  p.acad = true
  p.demoted = true
  ok(capBill(g, club) === before,
    `sent down by hand, his wage still counts: bill unchanged at ${before}`)

  p.demoted = false
  ok(capBill(g, club) < before,
    'a TRUE academy player is exempt, exactly as before - the flag pair is what separates the two')
  p.acad = false
}

// ---- 2. the concert never lands in a home-match week -----------------------
{
  const g = newGame('northampton', 'Concert Probe', 7)
  const club = g.clubs[g.userClubId]
  club.capacity = Math.max(club.capacity, 20_000) // a ground big enough to book one

  // an rng the probe drives: first call decides WHETHER an event fires,
  // the second WHICH - walked over the whole range so every event that can
  // appear, does
  const driven = (pick: number) => {
    let n = 0
    return () => (n++ === 0 ? 0 : pick)
  }

  const homeWeek = g.fixtures.find(f => !f.played && f.homeId === g.userClubId)!.week
  const awayOrFree = (() => {
    for (let w = 3; w < 40; w++) {
      if (!g.fixtures.some(f => !f.played && f.week === w && f.homeId === g.userClubId)) return w
    }
    return -1
  })()
  ok(homeWeek >= 0 && awayOrFree >= 3, `a home week (${homeWeek}) and a free week (${awayOrFree}) both exist to test`)

  const concertsIn = (week: number): number => {
    let seen = 0
    for (let i = 0; i < 200; i++) {
      g.week = week
      const lenBefore = g.news.length
      upkeepWeek(g, driven(i / 200))
      if (g.news.slice(lenBefore).some(n => n.k === 'news.upConcert')) seen++
    }
    return seen
  }
  ok(concertsIn(homeWeek) === 0,
    'two hundred rolls in a home-match week: the events department books NO concert')
  ok(concertsIn(awayOrFree) > 0,
    'the same two hundred rolls in a free week: the concert is still bookable - the gate blocks the week, not the event')
}

console.log(fails === 0
  ? '\nDEMOTE PROBE PASSED: the cap keeps counting, and the groundsman keeps his pitch'
  : `\nDEMOTE PROBE FAILED: ${fails}`)
process.exit(fails ? 1 : 0)
