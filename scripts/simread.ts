// A MATCH IN WORDS (2.0.0), for a person to read for sense.
// Run: npx vite-node scripts/simread.ts [seed] [from minute] [to minute] [real] [plays] [thin]
// The words are the game's own commentary (src/game/sim/commentary.ts), drawn
// from the match record and nothing else. With "real" the match is the
// user's first fixture in a new game on that seed: real team sheets, real
// strengths, and the men named. With "plays" each line is followed by the
// record entry it was written from, so the two can be checked by eye. With "thin" only
// the lines the viewer gets on the pitch's schedule are printed (thin() in commentary.ts).
// Lines marked * are key moments (the viewer slows down for them); minor
// lines are indented.
import { simSkeleton } from '../src/game/sim/skeleton'
import { commentate, render, thin, type Context } from '../src/game/sim/commentary'
import { schedule } from '../src/ui/livepitch/fromRecord'
import { matchConditions, surfaceOf } from '../src/game/conditions'
import { sortTable } from '../src/game/schedule'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'
import type { SimResult } from '../src/game/sim/record'
import { worldFromMatch } from '../src/game/sim/fromMatch'

const flags = new Set(process.argv.filter(a => a === 'real' || a === 'plays' || a === 'thin'))
const args = process.argv.slice(2).filter(a => !flags.has(a))
const seed = Number(args[0] ?? 1), from = Number(args[1] ?? 0), to = Number(args[2] ?? 80)
let T: [string, string] = ['Home', 'Away']
const names = new Map<string, string>()
const context: Context = {}
let r: SimResult
if (flags.has('real')) {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  if (!fx) throw new Error('no fixture for the user in the first twelve weeks')
  const { world, home, away } = worldFromMatch(g, fx, mulberry32(seed))
  T = [home.name, away.name]
  // the occasion, from the fixture: what the game would pass in
  context.weather = fx.weather ?? matchConditions(g, fx)
  context.surface = surfaceOf(g, fx)
  const comp = g.competitions?.find?.(c => c.id === fx!.compId) ?? (g.competitions as unknown as Record<string, typeof g.competitions[number]>)?.[fx.compId]
  if (comp?.type === 'league' && !fx.stage) {
    context.bonusPoints = true
    const order = sortTable([...comp.table]).map(rw => rw.teamId)
    const hp = order.indexOf(fx.homeId) + 1, ap = order.indexOf(fx.awayId) + 1
    if (hp > 0 && ap > 0 && comp.table.some(rw => rw.p > 0)) context.table = [hp, ap]
  } else if (comp) context.cup = comp.name
  const capOf = (side: typeof home) => { const c = g.clubs[side.teamId]?.captain; return c != null && side.players.some(pl => pl.id === String(c)) ? String(c) : undefined }
  context.captains = [capOf(home), capOf(away)]
  for (const p of [...home.players, ...away.players]) names.set(p.id, `${p.name.split(' ').slice(1).join(' ') || p.name} (${p.shirt})`)
  r = simSkeleton({ seed, world })
} else r = simSkeleton({ seed })

const all = commentate(r, { teams: T, player: id => names.get(id) ?? '' }, context)
const lines = flags.has('thin') ? thin(all, schedule(r.plays)) : all
const minute = (t: number) => Math.min(80, Math.floor(t / 60) + 1)
let lastN = -1
for (const l of lines) {
  // from 0 to 12 is the first twelve minutes of the clock: 0:00 to 11:59
  if (l.t < from * 60 || l.t >= to * 60) continue
  const m = minute(l.t)
  const mark = l.level === 'key' ? '*' : ' '
  const pad = l.level === 'minor' ? '    ' : ''
  console.log(`${String(m).padStart(2)}' ${mark} ${pad}${render(l)}`)
  if (flags.has('plays') && l.n !== lastN) {
    const p = r.plays[l.n]
    console.log(`          [${p.n} ${p.kind}/${p.result} side ${p.side} ball ${p.ball} x ${p.x} y ${p.y}${p.who ? ' who ' + (names.get(p.who) ?? p.who) : ''}]`)
  }
  lastN = l.n
}
const said = new Set(lines.map(l => l.n)).size
console.log(`\n${r.plays.length} entries, ${lines.length} lines about ${said} of them. ${T[0]} ${r.score[0]} (${r.tries[0]} tries), ${T[1]} ${r.score[1]} (${r.tries[1]} tries).`)
