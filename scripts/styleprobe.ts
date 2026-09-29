// ---- THE ATTACK AND DEFENCE STYLES (1.8.2, game/styles.ts) ----
//
// Owner: "5 attack and 5 defence styles in Tactics, shown visually". This
// holds the styles to what the screen and the code comments say about them:
//
//   1. THE TABLE. Every row and every column of the matchup sums to zero, and
//      every style has something it beats and something that beats it, so
//      against a world that plays everything no style gains from the table.
//   2. THE PRESETS AND THE OLD SAVES. Picking a style sets its levers, the
//      nearest style to a preset is that style, and an old save (dials, no
//      style) is named the nearest style with its dials left alone.
//   3. THE WORLD. AI clubs play the styles their coach's philosophy leans to,
//      and across a world every style is played.
//   4. THE FIT. A side with the men a style asks for fits it; one without
//      does not; an average XV sits near zero.
//   5. THE WORDS AND THE PICTURES. Every style is named, tagged, explained and
//      said in six languages, and drawn, each picture its own.
//   6. ON THE PITCH. Common random numbers: the same fixtures and dice, only
//      the user's attack and the opponent's defence differ. The measured
//      matchup (each cell less its row and column) follows the table; no
//      attack and no defence is worth more than a few points a match against
//      the others; each style's own effect shows where it says it does (the
//      choke wins the ball, the kicking game gains ground, direct carrying
//      draws penalties); and the kick-off line carries both sides' styles.
//
// Run: npx vite-node scripts/styleprobe.ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, type SideCtx } from '../src/game/matchEngine'
import { migrate } from '../src/game/save'
import { mulberry32 } from '../src/game/rng'
import type { Attrs, Fixture, GameState } from '../src/game/model'
import {
  ATK_PRESET, ATK_STYLES, DEF_PRESET, DEF_STYLES, MATCHUP, PH_STYLES, STYLE_MOVES, STYLE_NEEDS,
  applyAtkStyle, applyDefStyle, atkStyleOfDials, defStyleOfDials, matchStyles, migrateStyles, styleFit, styleTick, stylesOf,
  type AtkStyle, type DefStyle,
} from '../src/game/styles'
import { MOVE_BY_ID } from '../src/game/moves'
import { STYLE_DIAGRAMS, StyleDiagram } from '../src/ui/tacticsArt'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const fmt = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}`

// ------------------------------------------------------------------ 1
console.log('--- 1. the matchup table\n')
{
  const rows = ATK_STYLES.map(a => DEF_STYLES.reduce((s, d) => s + MATCHUP[a][d], 0))
  const cols = DEF_STYLES.map(d => ATK_STYLES.reduce((s, a) => s + MATCHUP[a][d], 0))
  ok(rows.every(x => x === 0), `every attack's row sums to zero (${rows.join(', ')})`)
  ok(cols.every(x => x === 0), `every defence's column sums to zero (${cols.join(', ')})`)
  ok(ATK_STYLES.every(a => DEF_STYLES.some(d => MATCHUP[a][d] > 0) && DEF_STYLES.some(d => MATCHUP[a][d] < 0)),
    'every attack beats a defence and is beaten by one')
  ok(DEF_STYLES.every(d => ATK_STYLES.some(a => MATCHUP[a][d] < 0) && ATK_STYLES.some(a => MATCHUP[a][d] > 0)),
    'every defence beats an attack and is beaten by one')
  ok(ATK_STYLES.every(a => DEF_STYLES.every(d => Math.abs(MATCHUP[a][d]) <= 2)), 'no cell is more than two steps')
  const neutral = styleTick(undefined, undefined, { attSet: 1, defSet: 1, attack: 1, defence: 1 })
  ok(neutral.tryF === 1 && neutral.penF === 1 && neutral.ground === 0 && neutral.m === 0,
    'a side with no style (a Test side) plays exactly as before')
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. presets and old saves\n')
{
  ok(ATK_STYLES.every(a => atkStyleOfDials(ATK_PRESET[a]) === a), 'each attack preset reads back as its own style')
  ok(DEF_STYLES.every(d => defStyleOfDials(DEF_PRESET[d]) === d), 'each defence preset reads back as its own style')
  const g = newGame('leicester', 'Style Probe', 4242)
  const tac = g.clubs[g.userClubId].tactic
  ok(tac.atkStyle != null && tac.defStyle != null, `a new career starts with both styles named (${tac.atkStyle}, ${tac.defStyle})`)
  applyAtkStyle(tac, 'width'); applyDefStyle(tac, 'blitz')
  ok(tac.style === ATK_PRESET.width.style && tac.kicking === ATK_PRESET.width.kicking && tac.defLine === DEF_PRESET.blitz.defLine
    && tac.ruckContest === DEF_PRESET.blitz.ruckContest, 'picking a style sets its levers')
  tac.style = 20; tac.defLine = 30
  ok(stylesOf(g, g.clubs[g.userClubId])!.atk === 'width' && stylesOf(g, g.clubs[g.userClubId])!.def === 'blitz',
    'fine-tuning the dials afterwards does not change the style')
  // an old save: the kicking side's dials, and no style on the tactic
  const old = JSON.parse(JSON.stringify(g)) as GameState
  const ot = old.clubs[old.userClubId].tactic
  delete ot.atkStyle; delete ot.defStyle
  Object.assign(ot, { style: 38, tempo: 42, kicking: 80, defLine: 30, defWidth: 76, ruckContest: 44 })
  const before = JSON.stringify({ ...ot })
  const m = migrate(old)
  const mt = m.clubs[m.userClubId].tactic
  ok(mt.atkStyle === 'kick' && mt.defStyle === 'drift', `an old save is named the nearest styles (${mt.atkStyle}, ${mt.defStyle})`)
  const { atkStyle: _a, defStyle: _d, ...rest } = mt
  ok(JSON.stringify(rest) === JSON.stringify(JSON.parse(before)), 'and its dials are left where they were')
  migrateStyles(m)
  ok(mt.atkStyle === 'kick' && mt.defStyle === 'drift', 'the migration is idempotent')
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. the world\n')
{
  const count: Record<string, number> = {}
  let n = 0, onPhil = 0
  for (const seed of [11, 222, 3333]) {
    const g = newGame('leicester', 'Style Probe', seed)
    for (const c of Object.values(g.clubs)) {
      if (c.id === g.userClubId) continue
      const s = stylesOf(g, c)
      if (!s) continue
      n++
      count[s.atk] = (count[s.atk] ?? 0) + 1
      count[s.def] = (count[s.def] ?? 0) + 1
      const ph = c.philosophy ? PH_STYLES[c.philosophy] : undefined
      if (ph && ph.atk.includes(s.atk) && ph.def.includes(s.def)) onPhil++
    }
  }
  console.log(`  ${n} AI clubs over three worlds: ` + [...ATK_STYLES, ...DEF_STYLES].map(s => `${s} ${((count[s] ?? 0) / n * 100).toFixed(0)}%`).join(' '))
  ok(onPhil / n > 0.9, `AI clubs play the styles their coach's philosophy leans to (${(onPhil / n * 100).toFixed(0)}%)`)
  ok([...ATK_STYLES, ...DEF_STYLES].every(s => (count[s] ?? 0) / n >= 0.08 && (count[s] ?? 0) / n <= 0.36),
    'every style is played by between 8% and 36% of the world')
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. the fit\n')
{
  const at = (bump: number) => (s: number, a: keyof Attrs) => 11 + bump + (s > 8 ? 1 : 2) + (a === 'str' ? 1 : 0)
  const all = [...ATK_STYLES, ...DEF_STYLES]
  ok(all.every(id => styleFit(id, at(8)) === 1) && all.every(id => styleFit(id, at(-10)) === -1),
    'a side far above the average man in the named shirts fits fully, far below not at all')
  ok(all.every(id => styleFit(id, () => null) === -1), 'empty shirts read as unsuited')
  const g = newGame('leicester', 'Style Probe', 4242)
  const fits = all.map(id => mean(Object.values(g.clubs).map(c => {
    const lu = c.tactic.lineup
    return styleFit(id, (s, a) => { const p = lu[s - 1] != null ? g.players[lu[s - 1]!] : undefined; return p ? p.a[a] : null })
  })))
  ok(fits.every(f => Math.abs(f) < 0.25), `the world's average XV sits near zero on every style (${fits.map(f => f.toFixed(2)).join(' ')})`)
  // a wide game asks for pace out wide: slow the back three, and it fits worse
  const c = g.clubs[g.userClubId]
  const read = (id: AtkStyle | DefStyle) => styleFit(id, (s, a) => { const p = c.tactic.lineup[s - 1] != null ? g.players[c.tactic.lineup[s - 1]!] : undefined; return p ? p.a[a] : null })
  const w0 = read('width'), ch0 = read('choke')
  for (const s of [11, 13, 14, 15]) { const p = g.players[c.tactic.lineup[s - 1]!]; if (p) p.a.pac = Math.max(1, p.a.pac - 6) }
  for (const s of [4, 5, 6, 7, 8]) { const p = g.players[c.tactic.lineup[s - 1]!]; if (p) p.a.str = Math.min(20, p.a.str + 5) }
  ok(read('width') < w0 - 0.1, `a slow back three fits the wide game worse (${w0.toFixed(2)} -> ${read('width').toFixed(2)})`)
  ok(read('choke') > ch0 + 0.1, `a stronger pack fits the choke tackle better (${ch0.toFixed(2)} -> ${read('choke').toFixed(2)})`)
  ok(ATK_STYLES.every(a => STYLE_MOVES[a].every(id => !!MOVE_BY_ID[id])) && Object.values(STYLE_NEEDS).every(ns => ns.length > 0),
    'every style names what it needs, and the moves that belong to it exist')
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. the words and the pictures\n')
{
  const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af']
  const dict = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8'))]))
  const get = (l: string, k: string) => k.split('.').reduce((o: any, p) => o?.[p], dict[l])
  const keys = [
    ...ATK_STYLES.flatMap(a => [`atk_${a}`, `atk_${a}Tag`, `atk_${a}Desc`, `sayAtk_${a}`, `cAtk_${a}1`, `cAtk_${a}2`]),
    ...DEF_STYLES.flatMap(d => [`def_${d}`, `def_${d}Tag`, `def_${d}Desc`, `sayDef_${d}`, `cDef_${d}1`, `cDef_${d}2`, `cTurn_${d}`]),
    'oppStyles', 'edgeAtk_good', 'edgeAtk_bad', 'edgeAtk_even', 'edgeDef_good', 'edgeDef_bad', 'edgeDef_even',
  ].map(k => `styles.${k}`)
  ok(LANGS.every(l => keys.every(k => typeof get(l, k) === 'string' && get(l, k).length > 1)), `every style is named, explained and said in six languages (${keys.length} keys)`)
  ok(LANGS.filter(l => l !== 'en').every(l => [...ATK_STYLES.map(a => `styles.atk_${a}Desc`), ...DEF_STYLES.map(d => `styles.def_${d}Desc`)]
    .every(k => get(l, k) !== get('en', k))), 'and the explanations are translated, not copied')
  const ids = [...ATK_STYLES, ...DEF_STYLES]
  ok(ids.every(id => STYLE_DIAGRAMS.includes(id)) && STYLE_DIAGRAMS.length === ids.length, 'every style has a diagram, and every diagram a style')
  const svgs = ids.map(id => renderToStaticMarkup(createElement(StyleDiagram, { id })))
  ok(svgs.every(s => (s.match(/--dg-move/g) ?? []).length >= 3) && new Set(svgs).size === ids.length,
    'every diagram draws its own movement (no two alike)')
}

// ------------------------------------------------------------------ 6
console.log('\n--- 6. on the pitch\n')
const userFixture = (g: GameState) =>
  g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!
const pool: { g: GameState; fx: Fixture }[] = []
for (const seed of [3, 11, 29, 47, 83, 101, 131, 157, 181, 211, 239, 263]) {
  for (const club of ['northampton', 'bath', 'exeter', 'sale', 'leicester']) {
    const g = newGame(club, 'Style Probe', seed)
    pool.push({ g, fx: userFixture(g) })
  }
}
interface Cell { margin: number; xFor: number; turnWon: number; pensFor: number; field: number }
/** the user attacks with `ua` into the opponent's `od`; the user defends with
 *  pendulum and the opponent attacks with pods, so the cell is the attack */
function play(ua: AtkStyle, od: DefStyle, ud: DefStyle = 'pendulum', oa: AtkStyle = 'pods'): Cell {
  const c: Cell = { margin: 0, xFor: 0, turnWon: 0, pensFor: 0, field: 0 }
  pool.forEach(({ g, fx }, i) => {
    const h = structuredClone(g)
    const me = h.userClubId
    const f = h.fixtures.find(x => x.id === fx.id)!
    const oppId = f.homeId === me ? f.awayId : f.homeId
    h.clubs[me].tactic.penaltyCall = 'posts'
    applyAtkStyle(h.clubs[me].tactic, ua); applyDefStyle(h.clubs[me].tactic, ud)
    const o = h.clubs[oppId]
    o.philosophy = undefined
    applyAtkStyle(o.tactic, oa); applyDefStyle(o.tactic, od)
    const ctx = beginMatch(h, f, mulberry32(7000 + i * 13), false, me)
    ctx.assistantSubs = true
    let fieldSum = 0, ticks = 0
    const homeMe = ctx.home.teamId === me
    // the field position, read from the user's side, half by half
    playHalf(h, ctx); fieldSum += homeMe ? ctx.field : 100 - ctx.field; ticks++
    playHalf(h, ctx); fieldSum += homeMe ? ctx.field : 100 - ctx.field; ticks++
    const mine: SideCtx = homeMe ? ctx.home : ctx.away
    const theirs: SideCtx = homeMe ? ctx.away : ctx.home
    c.margin += mine.score - theirs.score
    c.xFor += mine.xTry ?? 0
    c.turnWon += theirs.styTurnWon ?? 0
    c.pensFor += mine.pens
    c.field += fieldSum / ticks
  })
  const n = pool.length
  return { margin: c.margin / n, xFor: c.xFor / n, turnWon: c.turnWon / n, pensFor: c.pensFor / n, field: c.field / n }
}

const cells: Record<string, Record<string, Cell>> = {}
for (const a of ATK_STYLES) { cells[a] = {}; for (const d of DEF_STYLES) cells[a][d] = play(a, d) }
{
  const M = (a: AtkStyle, d: DefStyle) => cells[a][d].margin
  const grand = mean(ATK_STYLES.flatMap(a => DEF_STYLES.map(d => M(a, d))))
  const rowM = Object.fromEntries(ATK_STYLES.map(a => [a, mean(DEF_STYLES.map(d => M(a, d)))]))
  const colM = Object.fromEntries(DEF_STYLES.map(d => [d, mean(ATK_STYLES.map(a => M(a, d)))]))
  console.log(`  margin by cell over ${pool.length} matches (user attack by row into the opposition's defence), [table step]`)
  console.log('            ' + DEF_STYLES.map(d => d.padStart(12)).join(''))
  for (const a of ATK_STYLES) console.log(`  ${a.padEnd(10)}` + DEF_STYLES.map(d => `${fmt(M(a, d)).padStart(8)}[${MATCHUP[a][d] >= 0 ? '+' : ''}${MATCHUP[a][d]}]`).join(''))
  // the interaction: each cell less its row and its column
  const xs: number[] = [], ys: number[] = []
  for (const a of ATK_STYLES) for (const d of DEF_STYLES) { xs.push(MATCHUP[a][d]); ys.push(M(a, d) - rowM[a] - colM[d] + grand) }
  const mx = mean(xs), my = mean(ys)
  const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)))
  const r = cov / Math.sqrt(mean(xs.map(x => (x - mx) ** 2)) * mean(ys.map(y => (y - my) ** 2)))
  const slope = cov / mean(xs.map(x => (x - mx) ** 2))
  ok(r > 0.6 && slope > 0.6, `the measured matchup follows the table (r ${r.toFixed(2)}, ${slope.toFixed(2)} points a match a step)`)
  const spreadA = Math.max(...Object.values(rowM)) - Math.min(...Object.values(rowM))
  const spreadD = Math.max(...Object.values(colM)) - Math.min(...Object.values(colM))
  console.log(`  attack means: ${ATK_STYLES.map(a => `${a} ${fmt(rowM[a] - grand)}`).join('  ')}`)
  console.log(`  defence means (the user's margin into it; lower is the stronger defence): ${DEF_STYLES.map(d => `${d} ${fmt(colM[d] - grand)}`).join('  ')}`)
  ok(spreadA <= 4, `no attack dominates: the best and worst against the whole mix are ${spreadA.toFixed(2)} points a match apart (limit 4)`)
  ok(spreadD <= 4, `no defence dominates: ${spreadD.toFixed(2)} points a match apart (limit 4)`)
  ok(ATK_STYLES.every(a => DEF_STYLES.some(d => M(a, d) - grand > 0) && DEF_STYLES.some(d => M(a, d) - grand < 0)),
    'every attack has a defence it does better than average against, and one it does worse against')

  // each style's own currency
  const avg = (f: (c: Cell) => number, a?: AtkStyle, d?: DefStyle) => mean(ATK_STYLES.filter(x => !a || x === a)
    .flatMap(x => DEF_STYLES.filter(y => !d || y === d).map(y => f(cells[x][y]))))
  const turnD = Object.fromEntries(DEF_STYLES.map(d => [d, avg(c => c.turnWon, undefined, d)]))
  ok(DEF_STYLES.every(d => d === 'choke' || turnD.choke > turnD[d]),
    `the choke tackle wins the ball back most (${DEF_STYLES.map(d => `${d} ${turnD[d].toFixed(2)}`).join(', ')} a match)`)
  const turnA = Object.fromEntries(ATK_STYLES.map(a => [a, avg(c => c.turnWon, a)]))
  ok(ATK_STYLES.every(a => a === 'offload' || turnA.offload > turnA[a]) && ATK_STYLES.every(a => a === 'direct' || turnA.direct < turnA[a]),
    `the offload game gives the ball away most and direct carrying least (${ATK_STYLES.map(a => `${a} ${turnA[a].toFixed(2)}`).join(', ')})`)
  const fieldA = Object.fromEntries(ATK_STYLES.map(a => [a, avg(c => c.field, a)]))
  ok(ATK_STYLES.every(a => a === 'kick' || fieldA.kick > fieldA[a]),
    `the kicking game plays furthest up the pitch (${ATK_STYLES.map(a => `${a} ${fieldA[a].toFixed(1)}`).join(', ')})`)
  const pensA = Object.fromEntries(ATK_STYLES.map(a => [a, avg(c => c.pensFor, a)]))
  ok(pensA.direct > pensA.width && pensA.direct > pensA.offload,
    `direct carrying kicks more penalty goals than the wide and offload games (${ATK_STYLES.map(a => `${a} ${pensA[a].toFixed(2)}`).join(', ')})`)
  const xA = Object.fromEntries(ATK_STYLES.map(a => [a, avg(c => c.xFor, a)]))
  ok(xA.offload > xA.direct && xA.width > xA.direct, `the offload and wide games make more try chances than direct carrying (${ATK_STYLES.map(a => `${a} ${xA[a].toFixed(2)}`).join(', ')})`)
}

// the styles on the record: the kick-off line and the lines where one told
{
  const { g, fx } = pool[0]
  const h = structuredClone(g)
  const me = h.userClubId
  const f = h.fixtures.find(x => x.id === fx.id)!
  applyAtkStyle(h.clubs[me].tactic, 'width'); applyDefStyle(h.clubs[me].tactic, 'choke')
  const ctx = beginMatch(h, f, mulberry32(99), true, me)
  playHalf(h, ctx); playHalf(h, ctx)
  const ms = matchStyles(ctx.events)
  const mine = ctx.home.teamId === me ? ms?.home : ms?.away
  ok(!!mine && mine.atk === 'width' && mine.def === 'choke', `the kick-off line carries both sides' styles (${JSON.stringify(ms)})`)
  const side = ctx.home.teamId === me ? ctx.home : ctx.away
  ok(side.sty?.atk === 'width' && side.sty?.def === 'choke' && Number.isFinite(side.sty.atkFit), 'and the match context carries them for the clip (SideCtx.sty)')
  // over a few watched matches, the styles are spoken of
  let told = 0
  pool.slice(0, 12).forEach(({ g: g0, fx: fx0 }, i) => {
    const hh = structuredClone(g0)
    const ff = hh.fixtures.find(x => x.id === fx0.id)!
    const c = beginMatch(hh, ff, mulberry32(300 + i), true, hh.userClubId)
    playHalf(hh, c); playHalf(hh, c)
    told += c.events.filter(e => e.k?.startsWith('styles.c') && e.v && 'sa' in e.v && 'sd' in e.v).length
  })
  ok(told / 12 >= 1 && told / 12 <= 8, `the commentary names a style when it tells, ${(told / 12).toFixed(1)} times a match (1 to 8)`)
}

console.log(fails ? `\nSTYLE PROBE FAILED (${fails})` : '\nSTYLE PROBE PASSED: the table is balanced, the styles do what they say, and none is the answer')
process.exit(fails ? 1 : 0)
