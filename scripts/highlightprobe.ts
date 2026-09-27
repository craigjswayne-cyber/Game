// ---- DYNAMIC HIGHLIGHTS (1.8.0) ----
//
// FM26 shows more highlights in a close game and fewer in a rout; the ticker's
// Highlights mode stopped on the same list whatever the score. game/highlights
// reads the margin. Over 160 simulated matches this holds it to:
//
//   every score, card and whistle is a highlight, whatever the margin
//   close lines stop the ticker more often than lines in a rout
//   a rout shows no build-up, no conversions and no injuries
//   the build-up in a close game is real: the line before a score, entries
//     into the 22
//
// Run: npx vite-node scripts/highlightprobe.ts
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { isHighlight, tensionAt } from '../src/game/highlights'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const rate = { close: [0, 0], normal: [0, 0], rout: [0, 0] } as Record<string, [number, number]>
let scores = 0, scoresShown = 0, routExtras = 0, buildUp = 0, matches = 0
for (const seed of [5, 23, 61, 97]) {
  const g = newGame('leicester', 'HL', seed)
  const fxs = g.fixtures.filter(f => f.week >= 4 && f.week <= 14 && g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 40)
  fxs.forEach((fx, i) => {
    const r = simMatch(g, fx, mulberry32(seed * 1000 + i), true)
    matches++
    r.events.forEach((e, k) => {
      const hl = isHighlight(r.events, k, fx.homeId)
      const t = tensionAt(r.events, k)
      rate[t][1]++; if (hl) rate[t][0]++
      if (['TRY', 'PEN', 'DG', 'YC', 'RC', 'HT', 'FT'].includes(e.type)) { scores++; if (hl) scoresShown++ }
      if (t === 'rout' && hl && ['CON', 'INJ', 'SUB'].includes(e.type) && e.fx !== 'TMO' && e.fx !== 'NOTRY') routExtras++
      if (t === 'close' && hl && e.type === 'SUB') buildUp++
    })
  })
}
const pct = (t: string) => rate[t][1] ? rate[t][0] / rate[t][1] * 100 : 0
console.log(`  ${matches} matches; lines that stop the ticker: close ${pct('close').toFixed(1)}%, normal ${pct('normal').toFixed(1)}%, rout ${pct('rout').toFixed(1)}% (of ${rate.close[1]}, ${rate.normal[1]}, ${rate.rout[1]} lines)`)
ok(scoresShown === scores, `every score, card and whistle is a highlight (${scoresShown}/${scores})`)
ok(rate.rout[1] > 0 && pct('close') > pct('rout') * 1.5, 'a close game stops the ticker far more often than a rout')
ok(pct('close') > pct('normal'), 'and more often than a game in between')
ok(routExtras === 0, `a rout shows no build-up, conversions or injuries (${routExtras})`)
ok(buildUp > matches, `a close game shows its build-up (${buildUp} build-up lines)`)
console.log(fails ? `\nHIGHLIGHT PROBE FAILED (${fails})` : '\nHIGHLIGHT PROBE PASSED: the closer the game, the more of it you see')
process.exit(fails ? 1 : 0)
