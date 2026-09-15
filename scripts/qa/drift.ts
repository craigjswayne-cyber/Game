// Week-by-week divergence between a live state and its JSON copy, in one process, with the pid counter swapped per branch.
import { createHash } from 'node:crypto'
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { migrate } from '../../src/game/save'
import { resetIds, nextPid } from '../../src/game/attributes'
import type { GameState } from '../../src/game/model'

const N = Number(process.argv[2] ?? 50), K = Number(process.argv[3] ?? 30), seed = Number(process.argv[4] ?? 4242)
const useMigrate = process.argv[5] === 'mig'
const h = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 10)
const step = (g: GameState) => {
  const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}
const readPid = () => { const c = nextPid(); resetIds(c); return c }

const A = newGame('leicester', 'RT', seed)
for (let i = 0; i < N; i++) step(A)

// ---- scan the live state for things JSON cannot carry ----
{
  const seen = new Map<object, string>()
  const shared: string[] = []; const bad: string[] = []
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'number') { if (!Number.isFinite(v)) bad.push(`${path} = ${v}`); else if (Object.is(v, -0)) bad.push(`${path} = -0`); return }
    if (v === undefined) { bad.push(`${path} = undefined (in array?)`); return }
    if (v === null || typeof v !== 'object') return
    const prev = seen.get(v)
    if (prev) { if (shared.length < 40) shared.push(`${path} === ${prev}`); return }
    seen.set(v, path)
    if (Array.isArray(v)) { v.forEach((x, i) => { if (x === undefined) bad.push(`${path}[${i}] = undefined`); else walk(x, `${path}[${i}]`) }); return }
    for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`)
  }
  walk(A, 'g')
  console.log(`scan: ${bad.length} non-JSON values${bad.length ? ': ' + bad.slice(0, 10).join('; ') : ''}`)
  console.log(`scan: ${shared.length} shared object references${shared.length ? ':\n  ' + shared.slice(0, 40).join('\n  ') : ''}`)
}

let B = JSON.parse(JSON.stringify(A)) as GameState
if (useMigrate) B = migrate(B)
let pidA = readPid(), pidB = pidA
console.log(`pid counter at snapshot ${pidA}; branch B ${useMigrate ? 'migrated' : 'plain JSON copy'}`)
const jsonNoUndef = (g: GameState) => JSON.stringify(g)
for (let i = 0; i < K; i++) {
  resetIds(pidA); step(A); pidA = readPid()
  resetIds(pidB); step(B); pidB = readPid()
  const ja = jsonNoUndef(A), jb = jsonNoUndef(B)
  if (ja !== jb) {
    console.log(`DIVERGED at step ${i + 1} (season ${A.season} week ${A.week}); pidA ${pidA} pidB ${pidB}; sizes ${ja.length} vs ${jb.length}`)
    const a = JSON.parse(ja), b = JSON.parse(jb)
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    console.log(`  differing top-level keys: ${keys.join(', ')}`)
    for (const k of keys) {
      const av = a[k], bv = b[k]
      if (av && typeof av === 'object' && !Array.isArray(av)) {
        const ids = [...new Set([...Object.keys(av), ...Object.keys(bv ?? {})])].filter(id => JSON.stringify(av[id]) !== JSON.stringify(bv?.[id]))
        console.log(`  ${k}: ${ids.length} entries differ`)
        for (const id of ids.slice(0, 3)) {
          const fa = av[id] ?? {}, fb = bv?.[id] ?? {}
          const fk = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter(f => JSON.stringify(fa[f]) !== JSON.stringify(fb[f]))
          console.log(`    ${id}: ${fk.map(f => `${f}: ${JSON.stringify(fa[f])?.slice(0, 90)} -> ${JSON.stringify(fb[f])?.slice(0, 90)}`).join(' | ')}`)
        }
      } else if (Array.isArray(av)) {
        const n = Math.max(av.length, bv?.length ?? 0); let shown = 0
        console.log(`  ${k}: arrays len ${av.length} vs ${bv?.length}`)
        for (let j = 0; j < n && shown < 3; j++) if (JSON.stringify(av[j]) !== JSON.stringify(bv?.[j])) { shown++; console.log(`    [${j}] ${JSON.stringify(av[j])?.slice(0, 160)}\n        -> ${JSON.stringify(bv?.[j])?.slice(0, 160)}`) }
      } else console.log(`  ${k}: ${JSON.stringify(av)?.slice(0, 100)} -> ${JSON.stringify(bv)?.slice(0, 100)}`)
    }
    break
  }
  if (i === K - 1) console.log(`no divergence over ${K} weeks (hash ${h(ja)})`)
}
