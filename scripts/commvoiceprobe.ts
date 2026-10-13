// Probe: the commentary does not repeat itself, and a try's words fit the
// try (1.9.0, matchEngine.ts said / tryLine).
//
// The line picker was uniform with no memory: a ten-line bank could say the
// same thing twice in five minutes, and a try's words ignored the moment (a
// winner at 78 minutes read like a try at 12) and the man (a Jackal's try
// read like anybody's). This plays narrated matches and checks:
//
//   - no line from a bank comes round again inside twelve lines of itself
//     while the bank had a fresh one to give
//   - late tries in a close game (level or within seven), tries off the bench and
//     second tries get their own words, most of the time
//   - a player with a signature trait gets that trait's try lines more often
//     than a player without it
//   - and none of it moves the match: the same seed gives the same score
//     narrated or silent (detailprobe holds that across 120 fixtures)
//
// Run: npx vite-node scripts/commvoiceprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { MatchEvent } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const LATE = new Set(['comm.tryLate1', 'comm.tryLate2', 'comm.tryLate3'])
const BENCH = new Set(['comm.tryBench1', 'comm.tryBench2'])
const BRACE = new Set(['comm.tryBrace1', 'comm.tryBrace2'])
const TRAIT: Record<string, Set<string>> = {
  'The Step': new Set(['comm.try5', 'comm.try19', 'comm.try21']),
  'Offload King': new Set(['comm.try12', 'comm.try26']),
  'Enforcer': new Set(['comm.try11', 'comm.try18']),
  'Jackal': new Set(['comm.try13', 'comm.try24']),
}
// fixed lines that are not drawn from a bank (a card, a conversion, the whistle)
// are allowed to recur; the check is on the drawn ones, which carry a digit
const drawn = (k: string) => /^comm\.[a-zA-Z]+\d+$/.test(k) && !/^comm\.(penTry|heldUp|tmoFwdStands)\d$/.test(k)

let repeats = 0, windows = 0, matches = 0
let lateTries = 0, lateWords = 0, benchTries = 0, benchWords = 0, braceTries = 0, braceWords = 0
// per trait: [holder tries with its lines, holder tries, other tries with its lines, other tries]
const traitHit: Record<string, [number, number, number, number]> = {}

for (let seed = 1; seed <= 20; seed++) {
  const g = newGame('leicester', 'Comm Probe', 900 + seed)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 14)
  for (let i = 0; i < fxs.length; i++) {
    const ctx = beginMatch(g, fxs[i], mulberry32(seed * 977 + i), true, null)
    playHalf(g, ctx); playHalf(g, ctx)
    matches++
    const ev = (ctx as unknown as { events: MatchEvent[] }).events
    const keys = ev.map(e => e.k ?? '')
    keys.forEach((k, j) => {
      if (!drawn(k)) return
      windows++
      const prev = keys.slice(Math.max(0, j - 12), j)
      if (prev.includes(k)) repeats++
    })
    // tries: words against the moment
    const triesBy = new Map<number, number>()
    for (const e of ev) {
      if (e.type !== 'TRY' || e.playerId == null || !e.k) continue
      const side = e.teamId === fxs[i].homeId ? 'home' : 'away'
      const mine = side === 'home' ? e.homeScore : e.awayScore
      const theirs = side === 'home' ? e.awayScore : e.homeScore
      const before = (mine ?? 0) - 5 - (theirs ?? 0)
      const n = (triesBy.get(e.playerId) ?? 0) + 1
      triesBy.set(e.playerId, n)
      // only the tries whose words tryLine chose: a called move, a charge-down,
      // an intercept or a penalty try names itself
      if (!/^comm\.(try\d+|tryWet\d|tryDerby\d|tryLate\d|tryBench\d|tryBrace\d)$/.test(e.k)) continue
      if ((e.min ?? 0) >= 68 && before <= 0 && before >= -7) { lateTries++; if (LATE.has(e.k)) lateWords++ }
      else if (n === 2) { braceTries++; if (BRACE.has(e.k)) braceWords++ }
      const p = g.players[e.playerId]
      if (!LATE.has(e.k) && !BENCH.has(e.k) && !BRACE.has(e.k)) {
        for (const [tr, lines] of Object.entries(TRAIT)) {
          const t = (traitHit[tr] ??= [0, 0, 0, 0])
          if (p?.trait === tr) { t[1]++; if (lines.has(e.k)) t[0]++ }
          else { t[3]++; if (lines.has(e.k)) t[2]++ }
        }
      }
      if (BENCH.has(e.k)) benchWords++
    }
    benchTries += ev.filter(e => e.type === 'TRY' && e.k && BENCH.has(e.k)).length
  }
}

console.log(`${matches} narrated matches`)
const rate = repeats / Math.max(1, windows)
ok(windows > 2000, `enough drawn lines to judge (${windows})`)
ok(rate < 0.01, `a drawn line almost never comes round inside twelve lines of itself (${(rate * 100).toFixed(2)}%, ${repeats} of ${windows})`)
ok(lateTries >= 10 && lateWords / lateTries > 0.4, `a late try for a side behind or level gets late words most of the time (${lateWords}/${lateTries})`)
ok(braceTries >= 10 && braceWords / braceTries > 0.3, `a man's second try is called his second (${braceWords}/${braceTries})`)
ok(benchWords > 0, `a try off the bench is called one (${benchWords})`)
// pooled over the traits: how often a holder's try used his trait's lines,
// against how often anybody else's try used those same lines
let hh = 0, hn = 0, oh = 0, on = 0
for (const [tr, [a, b, c, d]] of Object.entries(traitHit)) {
  console.log(`  ${tr}: holders ${a}/${b}, others ${c}/${d}`)
  hh += a; hn += b; oh += c; on += d
}
const holder = hh / Math.max(1, hn), other = oh / Math.max(1, on)
ok(hn >= 60 && holder > other * 1.6, `a signature trait's try lines come up far more for the men who carry it (${(holder * 100).toFixed(0)}% against ${(other * 100).toFixed(0)}%)`)

console.log(fails ? `COMM VOICE PROBE FAILED (${fails})` : 'COMM VOICE PROBE PASSED: the commentary does not repeat itself, and a try sounds like the try it was')
process.exit(fails ? 1 : 0)
