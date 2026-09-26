/**
 * ---- WHAT THE MEN DO IN A MOMENT (pitchActs.ts) ----
 *
 * Owner, 26 Sep 2026: "1, 2, 3 & 5": tackles and rucks you can see, cards and
 * substitutions on the pitch, the scrum pushing and the lineout lifting. The
 * browser half is actsprobe.mjs; this holds the rules without a browser:
 *
 *   1. the lines that carry into contact have a tackle, and the ball and the
 *      tackle meet at the same place at the same moment
 *   2. the tackle's cast is sane: a carrier from the side carrying, a tackler
 *      from the other, nobody twice, nobody from the far end of the field, and
 *      every path starts where the man was and ends where he is going
 *   3. an offload has no ruck, and the man over the ball at a turnover stays
 *      on his feet
 *   4. an uncontested scrum does not push, the monster scrum goes straight
 *      back, and the same scrum always goes the same way
 *   5. the lineout is thrown from where the hooker stands and caught where the
 *      jumper stands (the same numbers phaseShape.ts puts them on)
 *   6. a man leaving goes off the field, and none of it touches Math.random
 *
 * Run: npx vite-node scripts/pitchactsprobe.ts
 */
import { readFileSync } from 'node:fs'
import { buildPassage, contactOf, playKind, type Key, type PlayKind, type Pt } from '../src/ui/phasePlay'
import { LINEOUT, benchEntry, lineoutSpots, scrumDrive, tackleActs, touchlineExit, type Man } from '../src/ui/pitchActs'
import { formation } from '../src/ui/phaseShape'
import type { MatchEvent } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** where a path is at fraction t of the beat */
const along = (ks: Key[], t: number): Pt => {
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].at) {
      const a = ks[i - 1], b = ks[i]
      const s = b.at === a.at ? 1 : (t - a.at) / (b.at - a.at)
      return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s }
    }
  }
  return ks[ks.length - 1]
}
const near = (a: Pt, b: Pt, tol = 0.01) => Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol

console.log('--- 1. the carry meets the tackle')
{
  const tackled: PlayKind[] = ['phase', 'offload', 'hit', 'turnover', 'catch']
  const clean: PlayKind[] = ['break', 'wide', 'touch', 'box', 'grubber', 'cross', 'restart', 'goal', 'miss', 'throw', 'none']
  let met = 0, tried = 0
  for (const kind of tackled) {
    for (let seed = 1; seed < 40; seed++) {
      for (const dir of [1, -1]) {
        const from = { x: 30 + (seed * 7) % 40, y: 20 + (seed * 13) % 60 }
        const to = { x: from.x + dir * 6, y: 50 + ((seed * 5) % 30) - 15 }
        const c = contactOf(kind, from, to, dir, seed)
        const ps = buildPassage(kind, from, to, dir, seed, null)
        tried++
        // a turnover is a scrap: the ball is fought over round the tackle, so
        // it is within a metre or so of it rather than on it
        if (c && ps && near(along(ps.ball, c.at), c.pt, kind === 'turnover' ? 1.5 : 0.05)) met++
        else if (tried - met < 4) console.log(`       ${kind} seed ${seed}: ball at ${JSON.stringify(ps && c ? along(ps.ball, c.at) : null)}, tackle at ${JSON.stringify(c?.pt)}`)
      }
    }
  }
  ok(met === tried, `in every carry into contact the ball is where the tackle is, when it is (${met}/${tried})`)
  ok(clean.every(k => contactOf(k, { x: 40, y: 40 }, { x: 50, y: 50 }, 1, 3) === null), 'and a kick, a break or a lineout has no tackle in it')
  const lo = { k: 'comm.flav13', type: 'SUB', fx: 'LINEOUT', min: 10, teamId: 'x', text: '', homeScore: 0, awayScore: 0 } as MatchEvent
  ok(playKind(lo) === 'throw', 'a lineout line is acted out as a throw')
}

console.log('--- 2. the cast')
{
  const men = (seed: number): Man[] => Array.from({ length: 30 }, (_, i) => {
    const side = (i < 15 ? 1 : -1) as 1 | -1
    const now = { x: 10 + ((i * 37 + seed * 11) % 80), y: 8 + ((i * 53 + seed * 7) % 84) }
    return { id: 100 + i, side, was: { x: now.x + ((i + seed) % 9) - 4, y: now.y + ((i * 3 + seed) % 11) - 5 }, now }
  })
  let bad = 0, runs = 0, ruckSize = 0
  for (let seed = 1; seed < 80; seed++) {
    for (const kind of ['phase', 'hit', 'catch', 'turnover'] as PlayKind[]) {
      const ms = men(seed)
      const named = ms[(seed * 5) % 30]
      const dir = seed % 2 ? 1 : -1
      const c = contactOf(kind, { x: 45, y: 50 }, { x: 45 + dir * 5, y: 30 + (seed % 40) }, dir, seed)!
      const acts = tackleActs(c, ms, named.id, dir)
      if (!acts.length) continue
      runs++
      ruckSize += acts.length
      const by = (id: number) => ms.find(m => m.id === id)!
      const carrier = acts.find(a => a.role === 'carrier')!
      const hitter = acts.find(a => a.role === 'tackler' || a.role === 'jackler')!
      const why: string[] = []
      if (by(carrier.id).side !== c.carrying) why.push('carrier from the wrong side')
      if (by(hitter.id).side === c.carrying) why.push('tackler from the carrying side')
      if (new Set(acts.map(a => a.id)).size !== acts.length) why.push('a man cast twice')
      for (const a of acts) {
        const m = by(a.id)
        if (a.role === 'support' && m.side !== c.carrying) why.push('support from the wrong side')
        if (a.role === 'guard' && m.side === c.carrying) why.push('guard from the wrong side')
        if (a.id !== named.id && Math.hypot((m.now.x - c.pt.x) * 4, (m.now.y - c.pt.y) * 1.5) > 70.01) why.push(`${a.role} from ${Math.round(Math.hypot((m.now.x - c.pt.x) * 4, (m.now.y - c.pt.y) * 1.5))}px away`)
        if (a.id === named.id && a.path) why.push('the named man given a second path')
        if (a.path) {
          if (!near(a.path[0], m.was) || !near(a.path[a.path.length - 1], m.now)) why.push(`${a.role} path does not start where he was and end where he goes`)
          if (a.path.some((k, i) => k.at < 0 || k.at > 1 || (i > 0 && k.at < a.path![i - 1].at))) why.push(`${a.role} path out of order`)
        }
        if (a.down && !(a.down[0] >= 0 && a.down[0] < a.down[1] && a.down[1] <= 1)) why.push(`${a.role} down window ${a.down}`)
      }
      if (why.length) { bad++; if (bad < 4) console.log(`       ${kind} seed ${seed}: ${why.join('; ')}`) }
    }
  }
  ok(runs > 200, `tackles cast across seeds and shapes (${runs})`)
  ok(bad === 0, `every cast is sane (${bad} bad)`)
  ok(ruckSize / runs >= 3.5, `and a ruck gathers round most of them (${(ruckSize / runs).toFixed(1)} men a tackle)`)
}

console.log('--- 3. an offload, a turnover')
{
  const ms: Man[] = Array.from({ length: 30 }, (_, i) => ({ id: i, side: (i < 15 ? 1 : -1) as 1 | -1, was: { x: 48 + (i % 5), y: 40 + (i % 7) * 3 }, now: { x: 48 + (i % 5), y: 40 + (i % 7) * 3 } }))
  const off = tackleActs(contactOf('offload', { x: 45, y: 50 }, { x: 52, y: 48 }, 1, 9)!, ms, 3, 1)
  ok(off.length === 2 && off.every(a => a.role === 'carrier' || a.role === 'tackler'), `an offload is a carrier and a tackler, no ruck (${off.map(a => a.role)})`)
  ok(!off.find(a => a.role === 'carrier')!.down, 'and the carrier stays on his feet to get it away')
  const to = tackleActs(contactOf('turnover', { x: 50, y: 50 }, { x: 40, y: 50 }, 1, 9)!, ms, 3, 1)
  const j = to.find(a => a.role === 'jackler')
  ok(!!j && j.id === 3 && !j.down, 'the named man over the ball at a turnover is the jackler, on his feet')
}

console.log('--- 4. the scrum')
{
  const ev = (k: string) => ({ k, type: 'SUB', fx: 'SCRUM', min: 20, teamId: 'x', text: '', homeScore: 0, awayScore: 0 }) as MatchEvent
  ok(['comm.uncontested', 'comm.uncontestedNow', 'comm.uncontestedShort'].every(k => scrumDrive(ev(k), 7).push === 0), 'an uncontested scrum does not push')
  const monster = Array.from({ length: 40 }, (_, s) => scrumDrive(ev('comm.flav4'), s))
  const inch = Array.from({ length: 40 }, (_, s) => scrumDrive(ev('comm.flav21'), s))
  ok(monster.every(d => d.push > 3 && d.wheel === 0), 'the monster scrum goes straight back, and furthest')
  ok(inch.every(d => d.push > 0 && d.push < monster[0].push), 'an ordinary one goes forward, less far')
  const wheels = inch.filter(d => d.wheel !== 0).length
  ok(wheels >= 4 && wheels <= 18, `and some of them wheel (${wheels} of 40)`)
  ok(JSON.stringify(scrumDrive(ev('comm.flav21'), 12)) === JSON.stringify(scrumDrive(ev('comm.flav21'), 12)), 'the same scrum always goes the same way')
}

console.log('--- 5. the lineout')
{
  let same = 0
  for (const mark of [{ x: 30, y: 6 }, { x: 70, y: 94 }]) {
    for (const dir of [1, -1]) {
      const f = formation({ shape: 'lineout', ball: mark, dir, attacking: true, seed: 3 })
      const s = lineoutSpots(mark, dir)
      if (near(s.hooker, f[1]) && near(s.jumper, f[LINEOUT.jumper])) same++
    }
  }
  ok(same === 4, `thrown from the hooker's spot and caught at the jumper's, as the shape stands them (${same}/4)`)
  const mark = { x: 40, y: 6 }
  const rest = { x: 40, y: lineoutSpots(mark, 1).jumper.y }
  const ps = buildPassage('throw', lineoutSpots(mark, 1).hooker, rest, 1, 5, null)!
  const top = Math.max(...ps.ball.map(k => k.h))
  ok(near(ps.ball[0], lineoutSpots(mark, 1).hooker) && near(ps.ball[ps.ball.length - 1], rest), 'the throw starts with the hooker and comes to rest with the jumper')
  ok(top > 0.3, `and is caught high, at the top of the lift (${top.toFixed(2)})`)
}

console.log('--- 6. off and on, and no dice')
{
  const spots = [{ x: 20, y: 30 }, { x: 80, y: 90 }, { x: 50, y: 10 }]
  ok(spots.every(p => touchlineExit(p, true).y > 100 && touchlineExit(p, false).y > 100), 'a man leaving goes off the field')
  ok(spots.every(p => touchlineExit(p, true).x === p.x), 'a man shown a card walks straight off')
  ok(spots.every(p => benchEntry(p).y > 100), 'and a replacement comes on from off it')
  const src = readFileSync('src/ui/pitchActs.ts', 'utf8') + readFileSync('src/ui/phasePlay.ts', 'utf8')
  ok(!/Math\.random/.test(src), 'none of it rolls Math.random: the same line always plays the same way')
}

console.log(fails ? `\nPITCH ACTS PROBE FAILED (${fails})` : '\nPITCH ACTS PROBE PASSED: the tackle meets the ball, the cast is sane, the scrum pushes and the jumper goes up')
process.exit(fails ? 1 : 0)
