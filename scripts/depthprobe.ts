// ---- TACTICAL DEPTH (1.8.2 depth) ----
//
// Seven small pieces, each hooked into a system that was already there, and
// this probe holds each to what it says, with numbers:
//
//   1. THE POD SHAPE. 1-3-3-1 is the Pods style exactly as it was; 2-4-2 and
//      round-the-nine shift its own effect (width, go-forward, quick ball);
//      picking one names the Pods style; AI pod sides play all three; the
//      clip is handed the shape through the tactic.
//   2. THE WEATHER. Conditions come from the fixture (where and when), the
//      same every time, and a wet day raises handling errors by a measured
//      amount (most for the handling styles); wind cuts the kicking game's
//      territory.
//   3. THE BRIEFING. The conditions card's words exist in six languages, the
//      referee panel keeps its real names, and the half-time read says one or
//      two plain lines, off what has happened.
//   4. THE SPECIALIST SHIRTS AND LAW 3. A non-specialist at prop, hooker or
//      scrum-half costs the platform heavily; uncontested scrums follow the
//      law (injury 14, red card 13, yellow 13 for the ten minutes then 15).
//   5. THE SECRET HABITS. They move outcomes, and no string in any language
//      names one: every dictionary entry is rendered and searched.
//   6. CONTACT AND THE GROUND. The contact styles and an artificial pitch take
//      a bigger share of the injuries, and the world's count barely moves.
//   7. THE LEAGUES. Each league's AI clubs lean to its own rugby, every style
//      is still played, and every club still plays its coach's philosophy.
//
// Run: npx vite-node scripts/depthprobe.ts
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { beginMatch, checkFrontRow, liveFrontRowCover, resolveDecision, specialistGaps, stepTick, teamUnits, SPEC_PROP, type LiveCtx, type SideCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState, Player, Weather } from '../src/game/model'
import {
  ATK_FX, ATK_STYLES, DEF_STYLES, LEAGUE_LEAN, PH_STYLES, POD_FX, POD_SHAPES, WIND_TERR, applyAtkStyle, applyDefStyle, applyPodShape, atkFx,
  styleTerr, styleTick, stylesOf, type AtkStyle, type DefStyle, type PodShape, type SideStyle,
} from '../src/game/styles'
import { INJ_NORM, SURFACES, clubSurface, halfTimeHints, injuryF, matchConditions, surfKey, surfaceNote, surfaceOf, wxEffectKey } from '../src/game/conditions'
import { HABITS, HABIT_RATE, clutchKick, habitFx, habitHint, habits } from '../src/game/habits'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import { buildClip } from '../src/ui/HighlightClip'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
const DICTS = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8'))])) as Record<Lang, Record<string, unknown>>
const has = (lang: Lang, key: string) => {
  let node: unknown = DICTS[lang]
  for (const part of key.split('.')) node = (node as Record<string, unknown>)?.[part]
  return typeof node === 'string' && node.length >= 1
}
const userFixture = (g: GameState) =>
  g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!

/** play a begun match to the whistle, answering every call with the posts */
function playOut(g: GameState, ctx: LiveCtx) {
  for (;;) {
    ctx.awaiting = null
    if (ctx.decision) resolveDecision(g, ctx, 'posts')
    const r = stepTick(g, ctx)
    if (ctx.decision) resolveDecision(g, ctx, 'posts')
    if (r === 'FT') break
  }
}
/** MANY FIXTURES, EACH PLAYED ONCE. The styles' turnovers are read off a
 *  hash of the world, the fixture and the tick (styles.ts), so replaying one
 *  fixture only replays its hash: a rate is measured across fixtures. Every
 *  club league fixture of the opening weeks in four worlds. */
const MANY: { g: GameState; fx: Fixture }[] = []
for (const seed of [3, 11, 29, 47]) {
  const g = newGame('leicester', 'Depth Probe', seed)
  for (const fx of g.fixtures) if (fx.week <= 4 && g.clubs[fx.homeId] && g.clubs[fx.awayId] && g.comps[fx.compId]?.type === 'league') MANY.push({ g, fx })
}
/** play every fixture of MANY once, both clubs set up by `set`, and count */
function playMany(w: Weather, set: (tac: GameState['clubs'][string]['tactic']) => void, detail = false) {
  let lost = 0, x = 0, pts = 0, n = 0
  MANY.forEach(({ g, fx }, i) => {
    const h = structuredClone(g)
    const f = h.fixtures.find(y => y.id === fx.id)!
    f.weather = w
    for (const id of [f.homeId, f.awayId]) { const c = h.clubs[id]; c.philosophy = undefined; set(c.tactic); c.tactic.penaltyCall = 'posts' }
    const ctx = beginMatch(h, f, mulberry32(4400 + i), detail, null)
    playOut(h, ctx)
    for (const s of [ctx.home, ctx.away]) { lost += s.styTurnLost ?? 0; x += s.xTry ?? 0; n++ }
    pts += ctx.home.score + ctx.away.score
  })
  return { lost: lost / n, x: x / n, pts: pts / MANY.length }
}
console.log(`  (${MANY.length} fixtures in the wide pool)`)

/** a pool of fixtures to replay under common random numbers */
const POOL: { g: GameState; fx: Fixture }[] = []
for (const seed of [3, 11, 29, 47, 83, 101, 131, 157]) {
  for (const club of ['northampton', 'bath', 'exeter', 'sale', 'leicester', 'toulouse']) {
    const g = newGame(club, 'Depth Probe', seed)
    POOL.push({ g, fx: userFixture(g) })
  }
}

// ------------------------------------------------------------------ 1
console.log('\n--- 1. the pod shape\n')
{
  const base = ATK_FX.pods
  const a1331 = atkFx('pods', '1331')
  ok(a1331 === base && atkFx('pods') === base, 'the 1-3-3-1 (and no shape at all) is the Pods style exactly as it was')
  const w = atkFx('pods', '242'), n = atkFx('pods', 'nine')
  console.log(`  tryF / turnovers / ground:  1-3-3-1 ${base.tryF.toFixed(3)} ${base.turn.toFixed(3)} ${base.ground.toFixed(2)}m`
    + `   2-4-2 ${w.tryF.toFixed(3)} ${w.turn.toFixed(3)} ${w.ground.toFixed(2)}m   nine ${n.tryF.toFixed(3)} ${n.turn.toFixed(3)} ${n.ground.toFixed(2)}m`)
  ok(w.tryF > base.tryF && n.tryF < base.tryF, 'the 2-4-2 makes more breaks out wide, round the nine fewer')
  ok(n.ground > base.ground && w.ground < base.ground, 'round the nine wins the most gain line, the 2-4-2 the least')
  ok(n.turn < base.turn && w.turn > base.turn, 'round the nine gives the ball away least (quick, short ball), the 2-4-2 most')
  ok(POD_SHAPES.every(p => Math.abs(POD_FX[p].tryF - 1) <= 0.05 && Math.abs(POD_FX[p].turn - 1) <= 0.15), 'each shape only shifts the style a little')
  const g = newGame('leicester', 'Pods', 5)
  const tac = g.clubs[g.userClubId].tactic
  applyAtkStyle(tac, 'width')
  applyPodShape(tac, 'nine')
  ok(tac.atkStyle === 'pods' && tac.podShape === 'nine' && stylesOf(g, g.clubs[g.userClubId])!.pod === 'nine', 'picking a shape names the Pods style and the shape is played')
  applyAtkStyle(tac, 'kick')
  ok(stylesOf(g, g.clubs[g.userClubId])!.pod === undefined, 'a side not playing pods has no shape')
  // the AI's pod sides
  const count: Record<string, number> = {}
  for (const seed of [11, 222, 3333]) {
    const h = newGame('leicester', 'Pods', seed)
    for (const c of Object.values(h.clubs)) {
      if (c.id === h.userClubId) continue
      const s = stylesOf(h, c)
      if (s?.atk === 'pods') count[s.pod ?? 'none'] = (count[s.pod ?? 'none'] ?? 0) + 1
    }
  }
  console.log(`  AI pod sides over three worlds: ${Object.entries(count).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  ok(POD_SHAPES.every(p => (count[p] ?? 0) >= 3) && !count.none, 'AI pod sides play all three shapes')
  // on the pitch, every fixture of the wide pool with both sides playing pods in the shape
  const r = Object.fromEntries(POD_SHAPES.map(p => [p, playMany('Dry', t => applyPodShape(t, p))])) as Record<PodShape, { lost: number; x: number }>
  console.log(`  over ${MANY.length} matches, a side: ball lost ${POD_SHAPES.map(p => `${p} ${r[p].lost.toFixed(2)}`).join('  ')};  expected tries ${POD_SHAPES.map(p => `${p} ${r[p].x.toFixed(2)}`).join('  ')}`)
  ok(r.nine.lost < r['1331'].lost && r['1331'].lost < r['242'].lost, 'on the pitch: round the nine loses the ball least and the 2-4-2 most')
  ok(r['242'].x > r['1331'].x && r['1331'].x > r.nine.x, 'on the pitch: the 2-4-2 makes the most try chances and round the nine the fewest')
  // the clip reads the shape off the tactic
  const ev = [{ min: 10, type: 'TRY', teamId: 'a', k: 'comm.try1', text: '', playerId: 1, homeScore: 5, awayScore: 0 }] as unknown as Parameters<typeof buildClip>[0]
  const spec = buildClip(ev, 0, 'try', 'a', () => 10, { home: ['#000', '#fff'], away: ['#fff', '#000'] },
    { try: 'Try', review: '', notry: '', good: '', wide: '', turnover: '', saved: '' }, () => 'X', undefined,
    home => (home ? { atkStyle: 'pods', podShape: '242' } : { defStyle: 'drift' }))
  ok(spec.atkStyle === 'pods' && spec.podShape === '242', `the highlight clip is handed the pod shape (${spec.atkStyle}/${spec.podShape})`)
  ok(POD_SHAPES.every(p => LANGS.every(l => has(l, `styles.pod_${p}`) && has(l, `styles.pod_${p}Desc`))) && LANGS.every(l => has(l, 'styles.podHeading')),
    'every shape is named and explained in six languages')
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. the weather\n')
{
  const g = newGame('leicester', 'Weather', 77)
  const counts: Record<string, number> = {}
  let same = 0, n = 0
  for (const fx of g.fixtures) {
    const w = matchConditions(g, fx)
    counts[w] = (counts[w] ?? 0) + 1
    if (matchConditions(g, fx) === w) same++
    n++
  }
  console.log(`  ${n} fixtures: ${Object.entries(counts).map(([k, v]) => `${k} ${pct(v / n)}`).join(' ')}`)
  ok(same === n, 'the conditions are the fixture\'s: the same every time they are asked')
  ok(['Dry', 'Damp', 'Rain', 'Wind'].every(w => (counts[w] ?? 0) / n > 0.05) && (counts.Dry ?? 0) / n > 0.35, 'dry, damp, wet and windy days all happen, and dry is the most common')
  // the season: wetter in the winter of each hemisphere
  const wetShare = (pred: (f: Fixture) => boolean) => {
    const fs = g.fixtures.filter(f => g.clubs[f.homeId] && pred(f))
    return fs.filter(f => ['Rain', 'Snow'].includes(matchConditions(g, f))).length / Math.max(1, fs.length)
  }
  const north = (f: Fixture) => g.clubs[f.homeId].leagueId === 'prem'
  const south = (f: Fixture) => g.clubs[f.homeId].leagueId === 'srp'
  const mid = (f: Fixture) => f.week >= 17 && f.week <= 31
  const nWin = wetShare(f => north(f) && mid(f)), nEnd = wetShare(f => north(f) && !mid(f))
  const sWin = wetShare(f => south(f) && mid(f)), sEnd = wetShare(f => south(f) && !mid(f))
  console.log(`  wet days: England mid-season ${pct(nWin)} v the ends ${pct(nEnd)};  the Pacific mid-season ${pct(sWin)} v the ends ${pct(sEnd)}`)
  ok(nWin > nEnd && sEnd > sWin, 'the English winter is mid-season, the southern winter at the ends of it')
  // a probe's day is kept, the game's is the hash; no draw on the shared rng
  const h = structuredClone(g)
  const f = userFixture(h)
  const want = matchConditions(h, f)
  const ctx = beginMatch(h, f, mulberry32(1), false)
  ok(ctx.weather === want && f.weather === want, `the match plays the forecast (${want})`)
  const a = structuredClone(g), b = structuredClone(g)
  const fa = userFixture(a), fb = userFixture(b)
  fa.weather = 'Dry'; fb.weather = 'Rain'
  const ra = mulberry32(42), rb = mulberry32(42)
  beginMatch(a, fa, ra, false); beginMatch(b, fb, rb, false)
  ok(ra() === rb(), 'the day takes the same one draw whatever it is, so the dice after it are where they were')

  // handling errors over the wide pool, dry, damp and wet, every side playing its own pods-and-pendulum
  const base = (t: GameState['clubs'][string]['tactic']) => { applyAtkStyle(t, 'pods'); applyDefStyle(t, 'pendulum') }
  const dry = playMany('Dry', base), damp = playMany('Damp', base), wet = playMany('Rain', base)
  console.log(`  handling errors turned over a side a match: dry ${dry.lost.toFixed(2)}, damp ${damp.lost.toFixed(2)} (+${pct(damp.lost / dry.lost - 1)}), wet ${wet.lost.toFixed(2)} (+${pct(wet.lost / dry.lost - 1)});  points a match ${dry.pts.toFixed(1)} / ${damp.pts.toFixed(1)} / ${wet.pts.toFixed(1)}`)
  ok(wet.lost > dry.lost * 1.2 && damp.lost > dry.lost && wet.lost > damp.lost, 'a wet ball is dropped more (at least a fifth more), a damp one in between')
  const byStyle = Object.fromEntries((['direct', 'kick', 'width', 'offload'] as AtkStyle[]).map(a => {
    const st = (t: GameState['clubs'][string]['tactic']) => { applyAtkStyle(t, a); applyDefStyle(t, 'pendulum') }
    const d = playMany('Dry', st), r = playMany('Rain', st)
    return [a, { up: r.lost / Math.max(0.01, d.lost) - 1, add: r.lost - d.lost }]
  })) as Record<string, { up: number; add: number }>
  console.log(`  what the wet adds by style (a side a match): ${Object.entries(byStyle).map(([k, v]) => `${k} +${v.add.toFixed(2)} (+${pct(v.up)})`).join(', ')}`)
  ok(byStyle.offload.add > byStyle.direct.add && byStyle.width.add > byStyle.kick.add, 'the handling games lose more extra ball in the wet than the carrying and kicking games')
  // the styles' own reading of a wet tick
  const side = (atk: AtkStyle, def: DefStyle): SideStyle => ({ atk, def, atkFit: 0, defFit: 0 })
  const u = { attSet: 30, defSet: 30, attack: 15, defence: 15 }
  const t = (a: AtkStyle, wet: number) => styleTick(side(a, 'pendulum'), side('pods', 'pendulum'), u, { wet, windy: false }).tryF / styleTick(side(a, 'pendulum'), side('pods', 'pendulum'), u).tryF
  ok(t('direct', 1) > 1 && t('kick', 1) > 1 && t('offload', 1) < 1 && t('width', 1) < 1, `the wet favours the direct and kicking games (direct x${t('direct', 1).toFixed(3)}, offload x${t('offload', 1).toFixed(3)})`)
  const terrDry = styleTerr(side('kick', 'pendulum'), side('pods', 'drift')), terrWind = styleTerr(side('kick', 'pendulum'), side('pods', 'drift'), true)
  ok(terrWind < terrDry && Math.abs(terrWind / terrDry - WIND_TERR) < 1e-9, `the wind cuts what the kicking game's territory is worth (${terrDry.toFixed(2)} -> ${terrWind.toFixed(2)})`)
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. the briefing\n')
{
  const WX: Weather[] = ['Dry', 'Damp', 'Rain', 'Wind', 'Snow']
  const keys = [...WX.flatMap(w => [`matchday.wx${w}`, wxEffectKey(w)]), ...SURFACES.flatMap(s => [surfKey(s), surfaceNote(s)]), 'matchday.theConditions', 'matchday.htWord',
    ...['htPensBin', 'htRefTight', 'htRefLoose', 'htWetHands', 'htWetTight', 'htWind', 'htUncontested', 'htScrumBad', 'htScrumGood', 'htDefWorks'].map(k => `matchday.${k}`)]
  ok(LANGS.every(l => keys.every(k => has(l, k))), `the conditions card and the half-time read speak six languages (${keys.length} keys)`)
  const src = readFileSync('src/game/matchEngine.ts', 'utf8')
  ok(['L. Pearce', 'K. Dickson', 'N. Amashukeli', 'P. Brousset'].every(n => src.includes(`name: '${n}'`)), 'the referee panel keeps its real names')
  const md = readFileSync('src/ui/screens/MatchDay.tsx', 'utf8')
  ok(md.includes('data-conditions') && md.includes('refNotes(ref)') && md.includes('surfaceOf(game, fx)'), 'the pre-match card reads the referee, the weather and the ground')
  const ref = { name: 'A. Referee', scrum: 1, breakdown: 0.9, patience: 5, flow: 1 }
  const calm = { consPens: 1, turnLost: 0, turnWon: 1, scrum: 15, score: 7 }
  const hot = { consPens: 4, turnLost: 4, turnWon: 0, scrum: 13, score: 3 }
  const a = halfTimeHints(ref, 'Rain', hot, calm, false)
  const b = halfTimeHints({ ...ref, breakdown: 1 }, 'Dry', calm, calm, false)
  console.log(`  a hard half in the wet: ${a.map(l => tIn('en', l.k, l.v)).join(' / ')}`)
  ok(a.length === 2 && a[0].k === 'matchday.htPensBin' && a.some(l => l.k === 'matchday.htWetHands'), 'a side giving away penalties in the wet hears about both, the most pressing first')
  ok(b.length === 0, 'a quiet half says nothing')
  ok(halfTimeHints({ ...ref, breakdown: 1 }, 'Dry', calm, calm, true).some(l => l.k === 'matchday.htUncontested'), 'uncontested scrums are named at half time')
  ok(halfTimeHints(ref, 'Dry', { ...calm, consPens: 3 }, calm, false)[0]?.k === 'matchday.htRefTight', 'a tight whistle at the breakdown: fewer bodies in the ruck')
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. the specialist shirts and Law 3\n')
{
  const g = newGame('leicester', 'Law Three', 21)
  const club = g.clubs[g.userClubId]
  const lu = club.tactic.lineup.slice()
  const xv = lu.slice(0, 15).map(id => (id != null ? g.players[id] : null))
  ok(specialistGaps(xv).length === 0, 'a picked side has a specialist in every specialist shirt')
  // the same man, the same attributes, a different trade
  const swap = (slot: number, pos: Player['pos']) => {
    const h = structuredClone(g)
    const p = h.players[lu[slot]!]
    const before = teamUnits(h, lu)
    p.pos = pos; p.alt = []
    return { before, after: teamUnits(h, lu) }
  }
  const prop = swap(0, 'FL'), hook = swap(1, 'LK'), nine = swap(8, 'CE')
  console.log(`  a flanker at loosehead: scrum ${prop.before.scrum.toFixed(2)} -> ${prop.after.scrum.toFixed(2)};  a lock at hooker: scrum ${hook.before.scrum.toFixed(2)} -> ${hook.after.scrum.toFixed(2)}, lineout ${hook.before.lineout.toFixed(2)} -> ${hook.after.lineout.toFixed(2)};  a centre at nine: attack ${nine.before.attack.toFixed(2)} -> ${nine.after.attack.toFixed(2)}`)
  ok(Math.abs(prop.after.scrum / prop.before.scrum - SPEC_PROP) < 1e-9, `a non-specialist prop costs the scrum ${pct(1 - SPEC_PROP)} on top of his attributes`)
  ok(hook.after.lineout / hook.before.lineout < 0.85 && hook.after.scrum < hook.before.scrum, 'a non-specialist hooker costs the lineout a fifth and the scrum too')
  ok(nine.after.attack / nine.before.attack < 0.95, 'a non-specialist scrum-half slows the service')
  const tp = swap(0, 'TP')
  ok(tp.after.scrum === tp.before.scrum, 'a tighthead at loosehead is a trained prop: no charge')

  // THE LAW. A side with no front-row cover on the bench, and a prop leaves.
  const setUp = () => {
    const h = structuredClone(g)
    const me = h.clubs[h.userClubId]
    // strip the bench of every front-rower, so nobody trained is left
    const FR = ['LP', 'HK', 'TP']
    const spare = Object.values(h.players).filter(p => p.clubId === me.id && !FR.includes(p.pos) && !p.alt.some(a => FR.includes(a)) && !me.tactic.lineup.includes(p.id) && !p.injury)
    for (let i = 15; i < 23; i++) {
      const p = me.tactic.lineup[i] != null ? h.players[me.tactic.lineup[i]!] : null
      if (p && (FR.includes(p.pos) || p.alt.some(a => FR.includes(a)))) me.tactic.lineup[i] = spare.pop()?.id ?? null
    }
    me.tactic.userPicked = true
    const f = userFixture(h)
    const ctx = beginMatch(h, f, mulberry32(5), true, me.id)
    const side = ctx.home.teamId === me.id ? ctx.home : ctx.away
    // a thin bench is ordered uncontested at kick-off (no player lost: it is
    // not a card or an injury); the scrum was contested until the prop went
    // off, which is the case the law's sanction is about
    ctx.uncontested = false
    return { h, ctx, side }
  }
  const lp = (h: GameState, side: SideCtx) => h.players[side.lineup[0]!]
  {
    // injury: the prop is hurt and a back-rower comes on for him
    const { h, ctx, side } = setUp()
    const p = lp(h, side)
    side.onPitch.delete(p.id)
    const sub = side.lineup.slice(15).map(id => (id != null ? h.players[id] : null)).find(x => x && !['LP', 'HK', 'TP'].includes(x.pos))!
    side.onPitch.add(sub.id); side.lineup[0] = sub.id
    ok(!liveFrontRowCover(h, side), 'with the bench stripped, nobody is left to prop')
    checkFrontRow(h, ctx, side, 30, p, 'injury', true)
    console.log(`  injury: ${side.onPitch.size} on the pitch, uncontested ${!!ctx.uncontested}`)
    ok(!!ctx.uncontested && side.onPitch.size === 14 && side.short === 1 && ctx.events.some(e => e.k === 'comm.uncontestedNoRep'),
      'an injured prop with no cover: uncontested scrums, and he cannot be replaced (fourteen)')
  }
  {
    const { h, ctx, side } = setUp()
    const p = lp(h, side)
    side.onPitch.delete(p.id); side.sent += 1
    checkFrontRow(h, ctx, side, 30, p, 'red')
    ok(!!ctx.uncontested && side.onPitch.size === 13 && ctx.events.some(e => e.k === 'comm.uncontestedShort'),
      `a red card to a prop with no cover: a second man goes, thirteen on the pitch (${side.onPitch.size})`)
  }
  {
    const { h, ctx, side } = setUp()
    const p = lp(h, side)
    side.onPitch.delete(p.id); side.binned.add(p.id); side.yellowUntil.set(p.id, 8)
    checkFrontRow(h, ctx, side, 1, p, 'yellow')
    const during = side.onPitch.size
    ok(!!ctx.uncontested && during === 13 && !!side.lawOut && ctx.events.some(e => e.k === 'comm.uncontestedBin'),
      `a yellow card to a prop with no cover: a second man sits the ten minutes out too (${during} on)`)
    ctx.awaiting = null
    for (let i = 0; i < 4; i++) { if (ctx.decision) resolveDecision(h, ctx, 'posts'); stepTick(h, ctx) }
    const back = side.onPitch.size + side.binned.size
    ok(back >= 15 - side.sent - (side.short) && side.onPitch.has(p.id) && !side.lawOut && side.short === 0 && !ctx.uncontested,
      `and both come back together when the bin ends, the scrum contested again (${side.onPitch.size} on, short ${side.short})`)
  }
  {
    const { h, ctx, side } = setUp()
    const p = lp(h, side)
    side.onPitch.delete(p.id)
    checkFrontRow(h, ctx, side, 30, p, 'hia')
    ok(!!ctx.uncontested && side.short === 0, 'a head injury replacement made permanent is treated like a blood one: no player lost')
  }
  const src = readFileSync('src/game/matchEngine.ts', 'utf8')
  ok(/THE LAW AS IMPLEMENTED \(World Rugby Law 3/.test(src), 'the rule implemented is stated in the engine, with its source')
  ok(LANGS.every(l => ['comm.uncontestedNoRep', 'comm.uncontestedBin', 'comm.specProp', 'comm.specHook', 'comm.specNine'].every(k => has(l, k))), 'the law and the specialist shirts are said in six languages')
  // and the commentary names a non-specialist when he is out there
  {
    const h = structuredClone(g)
    const me = h.clubs[h.userClubId]
    const p = h.players[me.tactic.lineup[8]!]
    p.pos = 'WG'; p.alt = []
    me.tactic.userPicked = true
    const ctx = beginMatch(h, userFixture(h), mulberry32(9), true, me.id)
    ok(ctx.events.some(e => e.k === 'comm.specNine' && e.playerId === p.id), 'a wing at scrum-half is named at kick-off')
  }
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. the secret habits\n')
{
  const g = newGame('leicester', 'Habits', 99)
  const ps = Object.values(g.players)
  const rates = Object.fromEntries((Object.keys(HABIT_RATE) as (keyof typeof HABIT_RATE)[]).map(k => [k, ps.filter(p => habits(g.seed, p.id)[k]).length / ps.length]))
  console.log(`  ${ps.length} men: ${Object.entries(rates).map(([k, v]) => `${pct(v)}`).join(', ')} carry each of the six`)
  ok(Object.entries(rates).every(([k, v]) => Math.abs(v - HABIT_RATE[k as keyof typeof HABIT_RATE]) < 0.02), 'each habit is carried at its stated rate')
  ok(ps.every(p => JSON.stringify(habits(g.seed, p.id)) === JSON.stringify(habits(g.seed, p.id))) && JSON.stringify(ps.slice(0, 50).map(p => habits(g.seed, p.id))) !== JSON.stringify(ps.slice(0, 50).map(p => habits(g.seed + 1, p.id))),
    'derived from the world and the man: the same every time, different in another world')
  // centred: the world's average side is unmoved
  const sides = Object.values(g.clubs).map(c => c.tactic.lineup.slice(0, 15).map(id => (id != null ? g.players[id] : null)))
  const fx = sides.map(s => habitFx(g.seed, s, 1))
  const m = (k: keyof ReturnType<typeof habitFx>) => mean(fx.map(f => f[k]))
  console.log(`  the world's sides, mean multiplier: lineout ${m('lineout').toFixed(3)}, penalties ${m('pen').toFixed(3)}, defence ${m('defence').toFixed(3)}, handling ${m('hands').toFixed(3)}, wet attack ${m('mudAtk').toFixed(3)}`)
  ok(['lineout', 'pen', 'defence', 'hands', 'mudAtk'].every(k => Math.abs(m(k as keyof ReturnType<typeof habitFx>) - 1) < 0.03), 'centred: the world\'s average side is within 3% of neutral on each')
  const spread = (k: keyof ReturnType<typeof habitFx>) => Math.max(...fx.map(f => f[k])) - Math.min(...fx.map(f => f[k]))
  ok(spread('pen') > 0.06 && spread('lineout') > 0.02 && spread('hands') > 0.1, `and sides differ: penalties spread ${pct(spread('pen'))}, handling ${pct(spread('hands'))}, lineout ${pct(spread('lineout'))}`)
  // ON THE PITCH, THE SAME MATCHES WITH THE HABITS AND WITHOUT THEM (the
  // probe switch HABITS.on): what a side's penalty-prone men and its sure
  // hands cost or save it, against the same fixtures and dice
  const onOff = (on: boolean) => {
    HABITS.on = on
    const rows: { pr: number; sh: number; pens: number; lost: number }[] = []
    MANY.forEach(({ g: g0, fx: f0 }, i) => {
      const h = structuredClone(g0)
      const f = h.fixtures.find(y => y.id === f0.id)!
      f.weather = 'Dry'
      const ctx = beginMatch(h, f, mulberry32(8800 + i), false, null)
      playOut(h, ctx)
      for (const s of [ctx.home, ctx.away]) {
        const xv = s.lineup.slice(0, 15)
        rows.push({
          pr: xv.filter(id => id != null && habits(h.seed, id).pr).length,
          sh: xv.slice(8).filter(id => id != null && habits(h.seed, id).sh).length,
          pens: s.consPens, lost: s.styTurnLost ?? 0,
        })
      }
    })
    HABITS.on = true
    return rows
  }
  const on = onOff(true), off = onOff(false)
  const delta = (pick: (r: typeof on[number]) => boolean, v: (r: typeof on[number]) => number) => {
    const idx = on.map((r, i) => (pick(r) ? i : -1)).filter(i => i >= 0)
    return { d: mean(idx.map(i => v(on[i]) - v(off[i]))), n: idx.length }
  }
  const pHi = delta(r => r.pr >= 3, r => r.pens), pLo = delta(r => r.pr === 0, r => r.pens)
  const hHi = delta(r => r.sh >= 2, r => r.lost), hLo = delta(r => r.sh === 0, r => r.lost)
  console.log(`  penalties conceded a match, the habits on less off: three or more penalty-prone men ${pHi.d >= 0 ? '+' : ''}${pHi.d.toFixed(2)} (${pHi.n} sides), none ${pLo.d >= 0 ? '+' : ''}${pLo.d.toFixed(2)} (${pLo.n})`)
  console.log(`  ball lost a match, the habits on less off: two or more sure-handed backs ${hHi.d >= 0 ? '+' : ''}${hHi.d.toFixed(2)} (${hHi.n}), none ${hLo.d >= 0 ? '+' : ''}${hLo.d.toFixed(2)} (${hLo.n})`)
  ok(pHi.d > pLo.d, 'on the pitch, the penalty-prone men make their side concede more than a side without them')
  ok(hHi.d < hLo.d, 'and sure hands in the backs lose less ball than a back line without them')
  const kicker = ps.find(p => habits(g.seed, p.id).ck)!, other = ps.find(p => !habits(g.seed, p.id).ck)!
  ok(clutchKick(g.seed, kicker, 70, 3) > 0 && clutchKick(g.seed, other, 70, 3) < 0 && clutchKick(g.seed, kicker, 30, 3) === 0 && clutchKick(g.seed, kicker, 70, 20) === 0,
    'the kicker who wants it is better from the hour in a close match, and only then')
  const rateCk = HABIT_RATE.ck
  ok(Math.abs(rateCk * 0.06 + (1 - rateCk) * -0.015) < 1e-9, 'and the world\'s late kicking is unchanged (centred)')

  // NEVER NAMED. Every string of every dictionary, rendered, searched for any
  // label a manager would read as the habit, and for the internal names.
  const BANNED: RegExp[] = [
    /lineout[\s-]?caller/i, /calls? the lineouts?/i, /clutch/i, /penalty[\s-]?(risk|prone|magnet)/i, /(safe|sure)[\s-]?hands/i,
    /out of (the )?line[\s-]?drifter/i, /mudlark/i, /\bmudder\b/i, /big[\s-]?game kicker/i,
    /aboyeur/i, /lanceur attitré/i, /buteur décisif/i, /mains sûres/i,
    /cantador/i, /manos seguras/i, /pateador decisivo/i, /mani sicure/i, /calciatore decisivo/i,
    /lynstaanroeper/i, /veilige hande/i,
    /コーラー/, /クラッチ/, /勝負強いキッカー/,
    /habitFx|habitHint|clutchKick|HABIT_RATE|\bhabits\(/,
  ]
  // entries that predate the habits and use a word in its everyday sense
  // the handling attribute and a clean catch, in their everyday words: they
  // read a man's visible handling or describe one catch, never the habit
  const KNOWN = new Set<string>(['comm.kickField2', 'recruit.s_han', 'handbook.a87'])
  const leaves = (d: Record<string, unknown>, pre = ''): string[] => Object.entries(d).flatMap(([k, v]) => {
    if (!pre && k === '_meta') return []
    const path = pre ? `${pre}.${k}` : k
    if (typeof v === 'string') return [path]
    if (v && typeof v === 'object') return 'other' in (v as object) ? [path] : leaves(v as Record<string, unknown>, path)
    return []
  })
  const rawOf = (d: unknown, k: string): string => {
    let node: unknown = d
    for (const part of k.split('.')) node = (node as Record<string, unknown>)?.[part]
    return typeof node === 'string' ? node : JSON.stringify(node ?? '')
  }
  const hits: string[] = []
  let rendered = 0
  for (const lang of LANGS) {
    await ensureLang(lang)
    const dict = DICTS[lang]
    for (const k of leaves(dict)) {
      const vars: Record<string, string | number> = {}
      for (const mm of rawOf(dict, k).matchAll(/\{(\w+)\}/g)) {
        const v = mm[1]
        vars[v] = v.endsWith('_k') ? 'common.nothing' : v.endsWith('_ll') ? '[]' : 1
      }
      let s: string
      try { s = tIn(lang, k, vars) } catch { s = rawOf(dict, k) }
      rendered++
      if (BANNED.some(re => re.test(s)) && !KNOWN.has(k.replace(/_[fw]+$/, ''))) hits.push(`${lang} ${k}: ${s.slice(0, 80)}`)
    }
  }
  if (hits.length) console.log(hits.slice(0, 20).map(h => `        ${h}`).join('\n'))
  ok(hits.length === 0, `${rendered} strings rendered across six languages, none names a habit`)
  // the only UI door is habitHint, own men only, at the full read
  const ui = ['src/ui/screens/PlayerScreen.tsx', 'src/ui/screens/MatchDay.tsx', 'src/ui/StylesSection.tsx', 'src/ui/screens/Squad.tsx']
    .map(f => { try { return readFileSync(f, 'utf8') } catch { return '' } }).join('\n')
  ok(!/\bhabits\(|habitFx|HABIT_RATE/.test(ui), 'no screen reads the habits themselves, only the plain-words hint')
  let shown = 0, strangers = 0
  for (const p of ps) {
    const k = habitHint(g, p)
    if (k) { shown++; if (p.clubId !== g.userClubId) strangers++ }
  }
  ok(strangers === 0, 'nothing about another club\'s man, whatever the scouts have filed')
  // a manager's own man, known fully: a line of plain words
  const mine = ps.filter(p => p.clubId === g.userClubId)
  for (const p of mine) p.stats.apps += 40
  const own = mine.find(p => habitHint(g, p) != null) ?? mine[0]
  const hint = habitHint(g, own)
  const told = mine.filter(p => habitHint(g, p) != null).length
  console.log(`  ${told} of ${mine.length} of the manager's own men, known fully, have a line`)
  console.log(`  ${own.name}, forty matches for the club: "${hint ? tIn('en', hint) : '(nothing to say)'}"`)
  ok(hint == null || LANGS.every(l => has(l, hint)), 'what the staff say is words in six languages')
  for (const p of mine) p.stats.apps -= 40
  const fresh = mine.find(p => p.stats.apps === 0 && Object.values(habits(g.seed, p.id)).some(Boolean) && p.career.every(c => c.clubId !== g.userClubId))
  ok(!fresh || habitHint(g, fresh) == null, 'a man the staff do not know yet gives nothing away')
}

// ------------------------------------------------------------------ 6
console.log('\n--- 6. contact and the ground\n')
{
  // the world's mean factor, which INJ_NORM holds at one
  let sum = 0, n = 0
  const surf: Record<string, number> = {}
  for (const seed of [11, 222, 3333]) {
    const g = newGame('leicester', 'Contact', seed)
    for (const fx of g.fixtures) {
      const h = g.clubs[fx.homeId], a = g.clubs[fx.awayId]
      if (!h || !a) continue
      const hs = stylesOf(g, h) as SideStyle, as = stylesOf(g, a) as SideStyle
      const s = surfaceOf(g, fx)
      sum += injuryF(hs, as, s) + injuryF(as, hs, s); n += 2
      surf[s] = (surf[s] ?? 0) + 1
    }
  }
  console.log(`  ${n / 2} fixtures: pitches ${Object.entries(surf).map(([k, v]) => `${k} ${pct(v / (n / 2))}`).join(', ')}; mean share of the injury roll ${(sum / n).toFixed(4)} (INJ_NORM ${INJ_NORM})`)
  ok(Math.abs(sum / n - 1) < 0.01, 'the world\'s injury roll is where it was, within 1%')
  ok(SURFACES.every(s => (surf[s] ?? 0) > 0) && clubSurface({ id: 'saracens', leagueId: 'prem' }) === 'artificial' &&
    clubSurface({ id: 'gloucester', leagueId: 'prem' }) === 'artificial', 'all three surfaces are played on, Saracens and Kingsholm among the artificial grounds')
  const sd = (atk: AtkStyle, def: DefStyle): SideStyle => ({ atk, def, atkFit: 0, defFit: 0 })
  const hard = injuryF(sd('direct', 'choke'), sd('pods', 'blitz'), 'artificial'), soft = injuryF(sd('width', 'drift'), sd('pods', 'drift'), 'grass')
  ok(hard > 1.2 && soft < 0.9, `a carrying side against a rush defence on an artificial pitch takes ${hard.toFixed(2)}x its share; a wide side against a drift on grass ${soft.toFixed(2)}x`)
  // on the pitch, common random numbers, detail on so every injury is a line
  const run = (surface: 'grass' | 'artificial', contact: boolean) => {
    let inj = 0, matches = 0
    POOL.forEach(({ g: g0, fx }, i) => {
      for (let rep = 0; rep < 2; rep++) {
        const h = structuredClone(g0)
        const f = h.fixtures.find(y => y.id === fx.id)!
        f.weather = 'Dry'
        for (const id of [f.homeId, f.awayId]) {
          const c = h.clubs[id]; if (!c) continue
          c.philosophy = undefined
          applyAtkStyle(c.tactic, contact ? 'direct' : 'width'); applyDefStyle(c.tactic, contact ? 'blitz' : 'drift')
          c.tactic.penaltyCall = 'posts'
        }
        const ctx = beginMatch(h, f, mulberry32(6100 + i * 3 + rep), true, h.userClubId)
        ctx.surface = surface
        ctx.assistantSubs = true
        playOut(h, ctx)
        inj += ctx.events.filter(e => e.k === 'comm.injuryDown' || e.k === 'comm.heavyKnock').length
        matches++
      }
    })
    return inj / matches
  }
  const gW = run('grass', false), aW = run('artificial', false), gC = run('grass', true), aC = run('artificial', true)
  console.log(`  injuries and knocks a match: width/drift on grass ${gW.toFixed(2)}, on artificial ${aW.toFixed(2)};  direct/blitz on grass ${gC.toFixed(2)}, on artificial ${aC.toFixed(2)}`)
  ok(aW > gW && aC > gC, 'an artificial pitch costs more knocks than grass')
  ok(gC > gW && aC > aW, 'the contact styles cost more knocks than the wide game and the drift')
}

// ------------------------------------------------------------------ 7
console.log('\n--- 7. the leagues\n')
{
  const byLeague: Record<string, Record<string, number>> = {}
  const clubsIn: Record<string, number> = {}
  let n = 0, onPhil = 0
  const all: Record<string, number> = {}
  for (const seed of [11, 222, 3333, 4444, 555]) {
    for (const w of [false, true]) {
      const g = w ? newGame('w:saracens', 'Leagues', seed, undefined, 'coach', 'w') : newGame('leicester', 'Leagues', seed)
      for (const c of Object.values(g.clubs)) {
        if (c.id === g.userClubId) continue
        const s = stylesOf(g, c)
        if (!s || !c.philosophy) continue
        const lg = c.leagueId.replace(/^w:/, '')
        byLeague[lg] ??= {}
        byLeague[lg][s.atk] = (byLeague[lg][s.atk] ?? 0) + 1
        byLeague[lg][s.def] = (byLeague[lg][s.def] ?? 0) + 1
        all[s.atk] = (all[s.atk] ?? 0) + 1; all[s.def] = (all[s.def] ?? 0) + 1
        clubsIn[lg] = (clubsIn[lg] ?? 0) + 1
        n++
        const ph = PH_STYLES[c.philosophy]
        if (ph.atk.includes(s.atk) && ph.def.includes(s.def)) onPhil++
      }
    }
  }
  const share = (lg: string, s: string) => (byLeague[lg]?.[s] ?? 0) / Math.max(1, clubsIn[lg] ?? 0)
  for (const lg of Object.keys(byLeague).sort()) {
    console.log(`  ${lg.padEnd(6)} ${String(clubsIn[lg]).padStart(4)}  ` + [...ATK_STYLES, ...DEF_STYLES].map(s => `${s} ${(share(lg, s) * 100).toFixed(0)}%`).join(' '))
  }
  ok(onPhil === n, `every AI club still plays its coach's philosophy (${onPhil}/${n})`)
  ok([...ATK_STYLES, ...DEF_STYLES].every(s => (all[s] ?? 0) / n >= 0.06), 'every style is still played somewhere, by at least 6% of the world')
  ok(share('top14', 'direct') + share('top14', 'offload') > share('prem', 'direct') + share('prem', 'offload'), `the French lean to forward power and the offload (${pct(share('top14', 'direct') + share('top14', 'offload'))} v the Premier ${pct(share('prem', 'direct') + share('prem', 'offload'))})`)
  ok(share('prem', 'kick') > share('top14', 'kick') && share('prem', 'blitz') > share('top14', 'blitz'), `the English kick and blitz more (kick ${pct(share('prem', 'kick'))} v ${pct(share('top14', 'kick'))})`)
  ok(share('srp', 'width') > share('prem', 'width') && share('srp', 'width') > share('top14', 'width'), `the Southern Hemisphere plays wider (width ${pct(share('srp', 'width'))} v the Premier ${pct(share('prem', 'width'))})`)
  ok(share('top14', 'choke') > share('srp', 'choke'), 'and the choke tackle is a French defence more than a Pacific one')
  ok(Object.keys(LEAGUE_LEAN).length >= 10, 'every league has a lean')
  // no style is left without a league that favours it
  const favoured = new Set<string>()
  for (const l of Object.values(LEAGUE_LEAN)) {
    for (const [k, v] of Object.entries(l.atk ?? {})) if (v > 1) favoured.add(k)
    for (const [k, v] of Object.entries(l.def ?? {})) if (v > 1) favoured.add(k)
  }
  ok([...ATK_STYLES, ...DEF_STYLES].every(s => favoured.has(s)), 'every style is favoured by at least one league')
}

console.log(fails ? `\nDEPTH PROBE FAILED (${fails})` : '\nDEPTH PROBE PASSED: the shapes, the weather, the whistle, the law, the habits, the ground and the leagues each do what they say')
process.exit(fails ? 1 : 0)
