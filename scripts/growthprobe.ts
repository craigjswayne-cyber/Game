// Probe: development is earned, and the world's average is untouched.
//
// User: "there should be more wonderkids in academy's but whether they get
// better or not is down to the facilities, coaching, mentorship and work
// ethics." The annual growth roll in rollover.agePlayers is scaled by
// devFactor, and this pins the two properties that matter:
//
//   THE INPUTS PULL THE RIGHT WAY. A Professional outgrows a Mercenary in the
//   same shirt; a level-5 estate outgrows a tin shack; a mentored kid at the
//   user's club outgrows an unmentored twin.
//
//   THE WORLD MEAN STAYS PUT. Every dial here is a redistribution, not a
//   handout: the average devFactor across a fresh world must sit on 1.0, or
//   the whole world inflates (or deflates) a little every season and the
//   simtest bands drift for a reason nobody can find. Measured before/after
//   on two seeds when this shipped: 11.148 vs 11.108 mean 2-season u22
//   growth, inside seed noise.
import { newGame } from '../src/game/newgame'
import { devFactor } from '../src/game/rollover'
import type { Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'Growth', 9)

// ---- the world mean sits on 1.0 --------------------------------------------
{
  const all = Object.values(g.players)
  const mean = all.reduce((s, p) => s + devFactor(g, p), 0) / all.length
  console.log(`  mean devFactor across ${all.length} players: ${mean.toFixed(4)}`)
  ok(Math.abs(mean - 1) < 0.02, `the world average is centred on 1.0 (${mean.toFixed(4)})`)
}

// ---- the inputs pull the right way ------------------------------------------
{
  const base = Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId)!
  const at = (over: Partial<Player>, clubId?: string) =>
    devFactor(g, { ...base, ...over, clubId: clubId ?? base.clubId } as Player)

  const pro = at({ pers: 'Professional' })
  const merc = at({ pers: 'Mercenary' })
  ok(pro > merc, `work ethic counts: Professional ${pro.toFixed(3)} > Mercenary ${merc.toFixed(3)}`)

  // same man, two estates: rank every club by paddock+gym and compare the ends
  const clubs = Object.values(g.clubs)
    .sort((a, b) => ((a.facilities?.paddock ?? 0) + (a.facilities?.gym ?? 0)) - ((b.facilities?.paddock ?? 0) + (b.facilities?.gym ?? 0)))
  const shack = at({ pers: 'Loyal' }, clubs[0].id)
  const palace = at({ pers: 'Loyal' }, clubs[clubs.length - 1].id)
  ok(palace > shack, `facilities count: best estate ${palace.toFixed(3)} > worst ${shack.toFixed(3)}`)

  // a mentored kid at the user's club beats his unmentored twin
  const kid = Object.values(g.players).find(p => p.clubId === g.userClubId && p.age <= 20)!
  const senior = Object.values(g.players).find(p => p.clubId === g.userClubId && p.pers === 'Leader' && p.age >= 27)
    ?? Object.values(g.players).find(p => p.clubId === g.userClubId && p.age >= 27)!
  const before = devFactor(g, kid)
  g.mentors = [...(g.mentors ?? []), { kid: kid.id, senior: senior.id }]
  const after = devFactor(g, kid)
  ok(after > before, `mentoring counts: paired ${after.toFixed(3)} > alone ${before.toFixed(3)}`)
  g.mentors = g.mentors.filter(mp => mp.kid !== kid.id)

  // clamps: nothing escapes the band however the inputs stack
  const lo = at({ pers: 'Mercenary' }, clubs[0].id)
  const hi = at({ pers: 'Professional' }, clubs[clubs.length - 1].id)
  ok(lo >= 0.65 && hi <= 1.4, `the band holds (${lo.toFixed(3)}..${hi.toFixed(3)} within 0.65..1.4)`)
}

console.log(fails ? `\nGROWTH PROBE FAILED (${fails})` : '\nGROWTH PROBE PASSED: development follows the inputs and the world mean stays put')
process.exit(fails ? 1 : 0)
