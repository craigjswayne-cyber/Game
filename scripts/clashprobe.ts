// ---- KIT CLASH (1.8.0) ----
//
// Owner, 27 Sep 2026: "when playing Northampton vs Connacht the colours are
// matching and you can't see on the in game stats". Northampton are black and
// green, Connacht green and black. Every pairing of clubs in the world, both
// ways round, must give the two sides colours that are clear of each other
// (kitGap >= 150) on the dark panel and on the grass, and no near-black bar on
// the dark panel.
//
// Run: npx vite-node scripts/clashprobe.ts
import { newGame } from '../src/game/newgame'
import { kitColours, kitGap, luma } from '../src/ui/kit'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('northampton', 'Kit', 3)
const clubs = Object.values(g.clubs).filter(c => c.colors?.length)
let pairs = 0, before = 0
const bad: string[] = [], dim: string[] = []
for (const h of clubs) for (const a of clubs) {
  if (h.id === a.id) continue
  pairs++
  const old = (c: string[]) => (luma(c[0]) < 40 && c[1] ? c[1] : c[0])
  if (kitGap(old(h.colors), old(a.colors)) < 150) before++
  for (const dark of [true, false]) {
    const k = kitColours(h.colors, a.colors, dark)
    if (kitGap(k.home[0], k.away[0]) < 150) bad.push(`${h.id} v ${a.id}${dark ? '' : ' (grass)'}`)
    if (dark && (luma(k.home[0]) < 40 || luma(k.away[0]) < 40)) dim.push(`${h.id} v ${a.id}`)
  }
}
const nc = kitColours(g.clubs.northampton.colors, g.clubs.connacht.colors)
console.log(`${clubs.length} clubs, ${pairs} pairings; the old stats bars clashed in ${before}`)
console.log(`Northampton v Connacht: ${nc.home[0]} against ${nc.away[0]}`)
ok(kitGap(nc.home[0], nc.away[0]) >= 150, 'Northampton v Connacht: the bars are two colours')
ok(bad.length === 0, `every pairing is two clear colours${bad.length ? ` (not: ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? ` and ${bad.length - 8} more` : ''})` : ''}`)
ok(dim.length === 0, `no near-black bar on the dark panel${dim.length ? ` (${dim.slice(0, 5).join(', ')})` : ''}`)
console.log(fails ? `\nCLASH PROBE FAILED (${fails})` : '\nCLASH PROBE PASSED: every match has two colours')
process.exit(fails ? 1 : 0)
