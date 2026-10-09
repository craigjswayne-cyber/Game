// Probe: kicks from hand, charge-downs, drop goals that miss, and a match
// called as it is played (1.8.0).
//
// What the owner asked for in 1.8.0:
//   one kick from hand in forty is charged down, and one in eighty ends in a
//    try for the side that charged it; otherwise the ball goes to a lineout,
//    a scrum, or whoever it falls to.
//   Drop goals can miss, and a miss has its own line; late in a close game
//    they are tried more.
//   More commentary, about 100 to 150 lines a match, from the rugby the
//    engine is already playing, without changing a single result.
//
// So this measures, over a few hundred matches of the real engine:
//   the charge-down rate and the try rate against the kicks from hand counted
//   a charge-down try is a TRY for the side that CHARGED, gets its conversion
//     attempt, and plays as the 'charge' highlight
//   every drop-goal attempt, made or missed, has a line and is a kick at goal
//     on the stats (kickLog), and a late, close one comes on in Key Moments
//   drop goals are tried more often late in a close game than otherwise
//   a watched match runs to 100-150 lines, and the new lines are all words
//     (the same fixture played silently is the same match: detailprobe holds
//     the full version of that, this is the quick one)
//
// Run: npx vite-node scripts/chargeprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, matchStats, CHARGE_RATE, CHARGE_TRY } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { buildClip, momentAt, lateAndClose } from '../src/ui/HighlightClip'
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE', turnover: 'TURNOVER', saved: 'TRY SAVER' }
const colours = { home: ['#c00000', '#ffffff'] as [string, string], away: ['#0000c0', '#ffffff'] as [string, string] }

let matches = 0, hand = 0, charged = 0, chargeTries = 0, lines = 0
const perMatch: number[] = []
let chargeTryBad = 0, chargeNoCon = 0, chargeStyleBad = 0, chargeSeen = 0
let dgLines = 0, dgMissLines = 0, dgUnlogged = 0, missClipBad = 0, missLateKey = 0
let lateTicks = 0, lateDrops = 0, otherTicks = 0, otherDrops = 0
let quietSame = 0, quietN = 0
const outcomes = new Map<string, number>()

// 100 seeds, not 30 (28 Sep 2026): the late-and-close drop-goal count was
// about ten events at 30 and swung from 5.2x to 0.6x on unrelated stream
// changes; at 120 seeds both sides of that change read 2x to 3.7x
for (let seed = 1; seed <= 100; seed++) {
  const g = newGame(['leicester', 'toulouse', 'leinster', 'crusaders', 'northampton'][seed % 5], 'Charge Probe', 7100 + seed)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 12)
  for (const [i, fx] of fxs.entries()) {
    const ctx = beginMatch(g, fx, mulberry32(seed * 977 + i), true, null)
    playHalf(g, ctx); playHalf(g, ctx)
    matches++
    const ev = ctx.events
    lines += ev.length; perMatch.push(ev.length)
    const st = matchStats(ctx)
    hand += st.handKicks[0] + st.handKicks[1]
    charged += st.chargedDown[0] + st.chargedDown[1]
    const log = ctx.kickLog ?? []
    for (let j = 0; j < ev.length; j++) {
      const e = ev[j]
      if (e.k?.startsWith('comm.chargeLineout')) outcomes.set('lineout', (outcomes.get('lineout') ?? 0) + 1)
      if (e.k?.startsWith('comm.chargeScrum')) outcomes.set('scrum', (outcomes.get('scrum') ?? 0) + 1)
      if (e.k?.startsWith('comm.chargeRegather')) outcomes.set('chargers regather', (outcomes.get('chargers regather') ?? 0) + 1)
      if (e.k?.startsWith('comm.chargeSafe')) outcomes.set('kickers regather', (outcomes.get('kickers regather') ?? 0) + 1)
      if (e.k?.startsWith('comm.tryCharge')) {
        chargeTries++
        // the try is the charging side's: the charge-down line before it is theirs too
        const block = ev.slice(Math.max(0, j - 3), j).reverse().find(b => b.k?.startsWith('comm.chargeDown'))
        if (e.type !== 'TRY' || !block || block.teamId !== e.teamId) chargeTryBad++
        // and the conversion follows, made or missed
        if (!ev.slice(j + 1, j + 5).some(c => (c.type === 'CON' || c.k === 'comm.conWide' || c.k === 'comm.conPost') && c.teamId === e.teamId)) chargeNoCon++ // (1.8.16: a miss can hit the post, and a hat-trick line can come between)
        if (momentAt(ev, j, fx.homeId, 'key') === 'try') {
          chargeSeen++
          if (buildClip(ev, j, 'try', fx.homeId, () => 6, colours, labels, () => 'N').style !== 'charge') chargeStyleBad++
        }
      }
      const isMiss = !!e.k?.startsWith('comm.dropMiss')
      if (e.type === 'DG' || isMiss) {
        if (e.type === 'DG') dgLines++; else dgMissLines++
        // counted as a kick at goal against this very line, made or missed
        if (!log.some(([at, , made]) => at === j && made === (isMiss ? 0 : 1))) dgUnlogged++
        if (isMiss && lateAndClose(ev, j)) {
          if (momentAt(ev, j, fx.homeId, 'key') !== 'kick') missLateKey++
          else if (buildClip(ev, j, 'kick', fx.homeId, () => 10, colours, labels, () => 'N').label !== 'WIDE') missClipBad++
        }
      }
    }
    // drop-goal attempts per tick, late and close against the rest (a tick
    // is four minutes; an attempt is either line)
    for (let tick = 0; tick < 20; tick++) {
      const inTick = ev.filter(e => e.min > tick * 4 && e.min <= tick * 4 + 4)
      const first = inTick[0]
      if (!first) continue
      const margin = Math.abs(first.homeScore - first.awayScore)
      const drops = inTick.filter(e => e.type === 'DG' || e.k?.startsWith('comm.dropMiss')).length * 1
      if (tick >= 17 && margin <= 3) { lateTicks += 2; lateDrops += drops } else { otherTicks += 2; otherDrops += drops }
    }
    // and the same fixture silently: the same match (quick version of detailprobe)
    if (i % 4 === 0 && seed <= 30) {
      const g2 = newGame(['leicester', 'toulouse', 'leinster', 'crusaders', 'northampton'][seed % 5], 'Charge Probe', 7100 + seed)
      const fx2 = g2.fixtures.find(f => f.id === fx.id)!
      // the watched copy above ran on g, whose earlier fixtures were played:
      // replay those first on g2, silently, so both start from one state
      for (const [k, f0] of fxs.entries()) {
        if (k >= i) break
        const c0 = beginMatch(g2, g2.fixtures.find(f => f.id === f0.id)!, mulberry32(seed * 977 + k), false, null)
        playHalf(g2, c0); playHalf(g2, c0)
      }
      const quiet = beginMatch(g2, fx2, mulberry32(seed * 977 + i), false, null)
      playHalf(g2, quiet); playHalf(g2, quiet)
      quietN++
      if (quiet.home.score === ctx.home.score && quiet.away.score === ctx.away.score && JSON.stringify(matchStats(quiet)) === JSON.stringify(st)) quietSame++
    }
  }
}

console.log(`${matches} matches watched: ${(hand / matches).toFixed(1)} kicks from hand, ${(charged / matches).toFixed(2)} charged down, ${(chargeTries / matches).toFixed(2)} charge-down tries a match`)
console.log(`lines a match: mean ${(lines / matches).toFixed(1)}, min ${Math.min(...perMatch)}, max ${Math.max(...perMatch)}`)
console.log(`charge-downs that did not score: ${[...outcomes.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`drop goals: ${dgLines} over, ${dgMissLines} missed; attempts per side-tick late and within a score ${(lateDrops / Math.max(1, lateTicks)).toFixed(4)}, otherwise ${(otherDrops / Math.max(1, otherTicks)).toFixed(4)}\n`)

console.log('--- charge-downs\n')
// binomial tolerance: about four standard errors either side
const rate = charged / hand, want = CHARGE_RATE, se = Math.sqrt(want * (1 - want) / hand)
ok(Math.abs(rate - want) < 4 * se, `1 in 40 kicks from hand is charged down (1 in ${(1 / rate).toFixed(1)}, ${charged} of ${hand})`)
const tr = chargeTries / hand, wantT = CHARGE_RATE * CHARGE_TRY, seT = Math.sqrt(wantT * (1 - wantT) / hand)
ok(Math.abs(tr - wantT) < 4 * seT, `1 in 80 kicks from hand ends in a try for the chargers (1 in ${(1 / tr).toFixed(1)}, ${chargeTries})`)
ok((hand / matches) >= 25 && (hand / matches) <= 45, `a believable number of kicks from hand (${(hand / matches).toFixed(1)} a match)`)
ok(chargeTryBad === 0, `every charge-down try is a TRY for the side that charged it (${chargeTryBad} not)`)
ok(chargeNoCon === 0, `and every one gets its conversion attempt (${chargeNoCon} did not)`)
ok(chargeSeen > 0 && chargeStyleBad === 0, `and plays as the charge-down highlight (${chargeSeen - chargeStyleBad}/${chargeSeen})`)
ok(['lineout', 'scrum', 'chargers regather', 'kickers regather'].every(k => (outcomes.get(k) ?? 0) > 0), 'the ones that do not score land every way: lineout, scrum, either side')

console.log('\n--- drop goals\n')
ok(dgMissLines > 0 && dgLines > 0, `drop goals are made and missed (${dgLines} over, ${dgMissLines} missed)`)
ok(dgUnlogged === 0, `every attempt, made or missed, is a kick at goal on the stats against its own line (${dgUnlogged} not)`)
ok(missLateKey === 0 && missClipBad === 0, 'a late, close miss comes on in Key Moments as a kick that ends WIDE')
ok(lateDrops / Math.max(1, lateTicks) > 1.6 * (otherDrops / Math.max(1, otherTicks)), `drop goals are tried more often late in a close game (${((lateDrops / Math.max(1, lateTicks)) / Math.max(1e-9, otherDrops / Math.max(1, otherTicks))).toFixed(1)}x the rate)`)

console.log('\n--- the match, called as it is played\n')
const mean = lines / matches
ok(mean >= 100 && mean <= 150, `a watched match runs to 100-150 lines (${mean.toFixed(1)})`)
const inBand = perMatch.filter(n => n >= 90 && n <= 165).length / perMatch.length
ok(inBand >= 0.95, `and nearly every match is near that (${(inBand * 100).toFixed(0)}% between 90 and 165)`)
ok(quietSame === quietN, `the same fixture played silently is the same match (${quietSame}/${quietN})`)
// no em or en dashes in any commentary line, in any language (owner)
const bad: string[] = []
for (const l of ['en', 'fr', 'es', 'it', 'ja', 'af']) {
  const comm = JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8')).comm as Record<string, string>
  for (const k of Object.keys(comm)) {
    if (!/^(pbp|def|lineout|scrum|restart|terr|late|kick|charge|tryCharge|dropMiss)/.test(k)) continue
    if (/[–—―]/.test(comm[k])) bad.push(`${l}:${k}`)
  }
}
ok(bad.length === 0, `no dashes in the new commentary, in any language${bad.length ? ` (${bad.slice(0, 5).join(', ')})` : ''}`)

console.log(fails ? `\nCHARGE PROBE FAILED (${fails})` : '\nCHARGE PROBE PASSED: kicks, charge-downs, drop goals and a match called as it is played')
process.exit(fails ? 1 : 0)
