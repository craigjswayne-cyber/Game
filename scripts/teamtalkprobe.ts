/**
 * ---- READING THE ROOM (teamtalk.ts) ----
 *
 * Owner, round 4: "The impact of a speech should be quite important. The
 * manager needs to judge the room and this should impact performance. Go too
 * big against the wrong team and the team misfires. But get it right and you
 * can cause an upset or deliver the win. It should be balanced and affect
 * players' moods. FM Mobile is the example I'd go with."
 *
 * This holds the rule:
 *
 *   1. no talk spends a draw of the shared match rng, and a match nobody
 *      spoke in is the match it always was (the units do not move)
 *   2. every man in the 23 reacts, in plain words from the dictionary, with
 *      no number and no trait name in them
 *   3. the room is read: in each classic situation the right tone helps and
 *      the wrong tone backfires, the way the owner described
 *   4. bounded: no man's multiplier leaves 1 +/- TALK_CAP
 *   5. it matters: paired simulations of identical matches with the best and
 *      the worst talk, evenly matched and mismatched, report the win-rate
 *      swing; even games swing in the target range, mismatches less
 *   6. morale carries a little of it home
 *
 * Run: npx vite-node scripts/teamtalkprobe.ts
 */
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { applyPreTalk, applyTeamTalk, beginMatch, lineupFor, openDressingRoom, playHalf, paperOverall, recomputeSideUnits, talkListen, type LiveCtx } from '../src/game/matchEngine'
import { HT_TONES, PRE_TONES, TALK_CAP, baseState, bestTone, logPreTalk, roomMood, silenceReads, silenceWeight, talkFactor, talkReads, talkSetting, type HtTone, type PreTone, type TalkSetting } from '../src/game/teamtalk'
import { mulberry32 } from '../src/game/rng'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const clone = <T,>(x: T): T => structuredClone(x)
const QUICK = process.argv.includes('--quick')

const base = newGame('leicester', 'Talk Probe', 4242)
const mineOf = (ctx: LiveCtx) => ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
const userFx = (g: GameState) => g.fixtures.filter(f => (f.homeId === g.userClubId || f.awayId === g.userClubId) && g.clubs[f.homeId] && g.clubs[f.awayId])

// ---------------------------------------------------------------------------
console.log('--- 1. no shared-rng draws; a silent room is the match it always was')
{
  const g = clone(base)
  const fx = userFx(g)[0]
  let draws = 0
  const inner = mulberry32(99)
  const rng = () => { draws++; return inner() }
  const ctx = beginMatch(g, fx, rng, true)
  const mine = mineOf(ctx)
  const before = JSON.stringify(mine.units)
  recomputeSideUnits(g, ctx, mine)
  ok(JSON.stringify(mine.units) === before, 'a rebuild at kick-off with nobody spoken to leaves the units exactly as they were')
  const d0 = draws
  applyPreTalk(g, ctx, 'fire')
  ok(draws === d0, `the pre-match talk drew nothing from the match rng (${draws - d0})`)
  playHalf(g, ctx)
  const d1 = draws
  applyTeamTalk(g, ctx, 'criticise')
  ok(draws === d1, `the half-time talk drew nothing from the match rng (${draws - d1})`)
  // and the same talk on the same match twice is the same reactions twice
  const g2 = clone(base)
  const ctx2 = beginMatch(g2, fx, mulberry32(99), true)
  applyPreTalk(g2, ctx2, 'fire')
  ok(JSON.stringify(ctx2.preReads) === JSON.stringify(ctx.preReads), 'the same talk to the same room lands the same way every time')
}

// ---------------------------------------------------------------------------
console.log('--- 2. every man reacts, in plain words')
{
  const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
  const g = clone(base)
  const fx = userFx(g)[0]
  const ctx = beginMatch(g, fx, mulberry32(5), true)
  applyPreTalk(g, ctx, 'faith')
  const named = mineOf(ctx).lineup.slice(0, 23).filter(id => id != null).length
  ok((ctx.preReads?.length ?? 0) === named, `all ${named} in the 23 react (${ctx.preReads?.length})`)
  const keys = new Set<string>()
  for (const tone of [...PRE_TONES, ...HT_TONES]) {
    for (const exp of [-0.9, -0.3, 0, 0.4, 0.9]) {
      for (const margin of [undefined, -20, -5, 0, 6, 25]) {
        const s: TalkSetting = { exp, home: true, big: exp < 0, margin }
        for (const r of talkReads(g, mineOf(ctx).lineup, s, tone, fx.id, 0.6)) keys.add(r.k)
      }
    }
  }
  const words = [...keys].map(k => k.split('.').reduce((o: any, p) => o?.[p], en) as string | undefined)
  ok(words.every(w => typeof w === 'string' && w.length > 0), `every reaction key exists in English (${keys.size} reactions in use)`)
  ok(words.every(w => !/\d/.test(w!)), 'no reaction carries a number')
  const TRAITS = /professional|loyal|ambitious|mercenary|temperamental|leader|nerve|temperament|consisten/i
  ok(words.every(w => !TRAITS.test(w!)), 'no reaction names a trait or a character')
  console.log('     reactions: ' + words.join(' / '))
  // and every line a talk can print (matchEngine talkLine) is in the dictionary
  const lines = [
    ...PRE_TONES.flatMap(tn => [1, 2].map(n => `tt.pre_${tn}${n}`)),
    ...HT_TONES.flatMap(tn => [1, 2].map(n => `tt.ht_${tn}${n}`)),
    'tt.verdict_good', 'tt.verdict_mixed', 'tt.verdict_bad', 'mood.tooComfortable',
    ...PRE_TONES.map(tn => `matchday.sp${tn[0].toUpperCase()}${tn.slice(1)}`),
  ]
  const missing = lines.filter(k => typeof k.split('.').reduce((o: any, p) => o?.[p], en) !== 'string')
  ok(missing.length === 0, `every speech line, verdict and tile is in the dictionary (${lines.length - missing.length}/${lines.length}${missing.length ? ': ' + missing.join(', ') : ''})`)
}

// ---------------------------------------------------------------------------
console.log('--- 3. the room is read: the right tone helps, the wrong one backfires')
{
  const g = clone(base)
  const squad = g.clubs[g.userClubId].tactic.lineup.slice(0, 23)
  const meanR = (s: TalkSetting, tone: PreTone | HtTone, morale?: number) => {
    if (morale != null) for (const id of squad) if (id != null) g.players[id].morale = morale
    const rs = talkReads(g, squad, s, tone, 77, 0.6)
    return rs.reduce((a, x) => a + x.r, 0) / rs.length
  }
  const row = (label: string, s: TalkSetting, tones: readonly (PreTone | HtTone)[], morale: number) => {
    const v = tones.map(t => [t, meanR(s, t, morale)] as const).sort((a, b) => b[1] - a[1])
    console.log(`     ${label.padEnd(34)} ` + v.map(([t, r]) => `${t} ${r >= 0 ? '+' : ''}${r.toFixed(2)}`).join('  '))
    return Object.fromEntries(v) as Record<string, number>
  }
  const favs = row('pre, big favourites, buoyant', { exp: 0.95, home: true, big: false }, PRE_TONES, 8.5)
  ok(favs.fire < 0 && favs.faith < favs.calm, 'firing up a buoyant favourite backfires, and more belief is the wrong medicine (complacency)')
  ok(favs.expect > 0.1 && favs.expect > favs.fire + 0.2, 'demanding standards of them is right')
  const dogs = row('pre, big underdogs, nervous', { exp: -0.95, home: false, big: false }, PRE_TONES, 4.5)
  ok(dogs.expect < 0, 'demanding a win of a frightened underdog backfires')
  ok(dogs.faith > 0.15, 'faith frees a frightened underdog')
  const even = row('pre, evenly matched, settled', { exp: 0, home: true, big: false }, PRE_TONES, 6.5)
  ok(Math.max(...Object.values(even)) < Math.max(...Object.values(favs)), 'a settled room has less to gain from any speech')
  ok(even.calm >= -0.01, 'calm never hurts a settled room')
  const up = row('ht, favourites 20 up', { exp: 0.6, home: true, big: false, margin: 20 }, HT_TONES, 7.5)
  ok(up.praise < 0 && up.fire < 0, 'praising or firing up a side already twenty up tips it into complacency')
  ok(up.demand > 0.1 || up.criticise > 0.1, 'asking for more keeps it honest')
  const down = row('ht, underdogs 18 down, low', { exp: -0.6, home: false, big: false, margin: -18 }, HT_TONES, 4.5)
  ok(down.criticise < -0.1, 'criticising a beaten underdog collapses its belief')
  ok(down.faith > 0.1, 'showing faith lifts it')
  const close = row('ht, favourites 6 down', { exp: 0.6, home: true, big: false, margin: -6 }, HT_TONES, 6.5)
  ok(close.calm >= 0, 'calm is the safe call when it is close')
}

// ---------------------------------------------------------------------------
console.log('--- 4. bounded')
{
  const g = clone(base)
  const squad = g.clubs[g.userClubId].tactic.lineup.slice(0, 23)
  let lo = 1, hi = 1
  for (const tone of [...PRE_TONES, ...HT_TONES]) for (const exp of [-1, -0.5, 0, 0.5, 1]) for (const margin of [undefined, -40, 0, 40]) {
    for (const r of talkReads(g, squad, { exp, home: false, big: true, margin }, tone, 3, 1)) {
      const f = talkFactor(r.r * 2) // even with a full pre-match reaction carried on top
      lo = Math.min(lo, f); hi = Math.max(hi, f)
    }
  }
  console.log(`     per-man multiplier range ${lo.toFixed(3)} .. ${hi.toFixed(3)} (cap ${TALK_CAP})`)
  ok(lo >= 1 - TALK_CAP - 1e-9 && hi <= 1 + TALK_CAP + 1e-9, 'no man leaves 1 +/- TALK_CAP, whatever is said')
}

// ---------------------------------------------------------------------------
console.log('--- 5. it matters: paired matches, best talk against worst')
type Plan = 'none' | 'best' | 'worst' | 'habit'
function play(g0: GameState, fx: Fixture, seed: number, plan: Plan): { won: number; drawn: number; margin: number; f1: number; f2: number } {
  const g = clone(g0)
  const ctx = beginMatch(g, fx, mulberry32(seed), false)
  const mine = mineOf(ctx)
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const listen = talkListen(g)
  const pick = <T extends PreTone | HtTone>(tones: readonly T[], s: TalkSetting, ids: (number | null)[], carry?: Map<number, number>): T => {
    if (plan === 'best') return bestTone(tones, g, ids, s, fx.id, listen, carry)
    // the worst: the tone that leaves the room furthest from settled
    let w = tones[0], wv = Infinity
    for (const t of tones) {
      const v = talkReads(g, ids, s, t, fx.id, listen, carry).reduce((a, x) => a + x.r, 0)
      if (v < wv) { wv = v; w = t }
    }
    return w
  }
  if (plan === 'habit') {
    // four silences already in the last five, and silent again: the deepest
    // the habit goes (three steps)
    g.preTalkLog = 'NNNN'
    openDressingRoom(g, ctx, null)
  } else if (plan !== 'none') {
    const s = talkSetting(paperOverall(g, mine.teamId, mine.lineup), paperOverall(g, opp.teamId, opp.lineup), mine === ctx.home, !!fx.stage || ctx.derby)
    applyPreTalk(g, ctx, pick(PRE_TONES, s, mine.lineup.slice(0, 23)))
  }
  const xvF = () => {
    const ids = [...mine.onPitch]
    return ids.reduce((a, id) => a + (mine.talkF?.get(id) ?? 1), 0) / ids.length
  }
  const f1 = xvF()
  playHalf(g, ctx)
  if (plan !== 'none' && plan !== 'habit') {
    const s = talkSetting(paperOverall(g, mine.teamId, mine.lineup), paperOverall(g, opp.teamId, opp.lineup), mine === ctx.home, !!fx.stage || ctx.derby, mine.score - opp.score)
    const ids = mine.lineup.slice(0, 23).filter(id => id != null && (mine.onPitch.has(id) || !mine.ratings.has(id)))
    applyTeamTalk(g, ctx, pick(HT_TONES, s, ids, mine.talkShift))
  }
  const f2 = xvF()
  playHalf(g, ctx)
  const m = mine.score - opp.score
  return { won: m > 0 ? 1 : 0, drawn: m === 0 ? 1 : 0, margin: m, f1, f2 }
}

/** Build a fixture-world where the user's side meets an opponent of a chosen
 *  relative strength: evenly matched or a clear mismatch either way. */
function world(club: string, seed: number) {
  const g = newGame(club, 'Talk Probe', seed)
  const out: { fx: Fixture; exp: number }[] = []
  for (const fx of userFx(g).slice(0, 26)) {
    const home = fx.homeId === g.userClubId
    const oppId = home ? fx.awayId : fx.homeId
    const my = paperOverall(g, g.userClubId, lineupFor(g, g.userClubId))
    const op = paperOverall(g, oppId, lineupFor(g, oppId))
    out.push({ fx, exp: talkSetting(my, op, home, false).exp })
  }
  return { g, out }
}

const N = QUICK ? 60 : 220
const rows: { band: string; none: number; best: number; worst: number; bm: number; wm: number; n: number; fb: string; fw: string }[] = []
for (const [band, lo, hi] of [['evenly matched', -0.25, 0.25], ['clear favourites', 0.4, 1.01], ['clear underdogs', -1.01, -0.4]] as const) {
  let n = 0, wn = 0, wb = 0, ww = 0, mb = 0, mw = 0, fb1 = 0, fb2 = 0, fw1 = 0, fw2 = 0
  for (const [club, seed] of [['leicester', 4242], ['toulouse', 9], ['leinster', 31337], ['northampton', 777]] as const) {
    const { g, out } = world(club, seed)
    const fxs = out.filter(x => x.exp >= lo && x.exp <= hi).slice(0, 3)
    for (const { fx } of fxs) {
      for (let k = 0; k < Math.ceil(N / 3); k++) {
        const sd = 1000 + k * 7919 + fx.id
        const a = play(g, fx, sd, 'none'), b = play(g, fx, sd, 'best'), c = play(g, fx, sd, 'worst')
        n++; wn += a.won + a.drawn / 2; wb += b.won + b.drawn / 2; ww += c.won + c.drawn / 2
        mb += b.margin - a.margin; mw += c.margin - a.margin
        fb1 += b.f1; fb2 += b.f2; fw1 += c.f1; fw2 += c.f2
      }
    }
  }
  if (!n) { console.log(`     ${band}: no fixtures in band`); continue }
  const pc = (x: number) => `${x >= 1 ? '+' : ''}${((x - 1) * 100).toFixed(1)}%`
  rows.push({ band, none: wn / n, best: wb / n, worst: ww / n, bm: mb / n, wm: mw / n, n, fb: `${pc(fb1 / n)} then ${pc(fb2 / n)}`, fw: `${pc(fw1 / n)} then ${pc(fw2 / n)}` })
}
console.log('     band               games   none    best   worst   swing   margin best/worst vs none   XV factor 1st/2nd half best | worst')
for (const r of rows) {
  console.log(`     ${r.band.padEnd(18)} ${String(r.n).padStart(5)}  ${(r.none * 100).toFixed(1).padStart(5)}%  ${(r.best * 100).toFixed(1).padStart(5)}%  ${(r.worst * 100).toFixed(1).padStart(5)}%  ${((r.best - r.worst) * 100).toFixed(1).padStart(5)}pp  ${r.bm >= 0 ? '+' : ''}${r.bm.toFixed(1)} / ${r.wm.toFixed(1)}      ${r.fb} | ${r.fw}`)
}
const ev = rows.find(r => r.band === 'evenly matched')
if (ev) {
  ok(ev.best > ev.none && ev.none > ev.worst, 'in even games the best talk wins more than silence, and the worst wins less')
  const sw = (ev.best - ev.worst) * 100
  ok(sw >= (QUICK ? 5 : 7) && sw <= 17, `the even-game swing is in the target band (${sw.toFixed(1)}pp, target ~8-15)`)
  for (const r of rows.filter(r => r !== ev)) {
    ok((r.best - r.worst) <= (ev.best - ev.worst) + (QUICK ? 0.06 : 0.03), `a mismatch (${r.band}) swings no more than an even game (${((r.best - r.worst) * 100).toFixed(1)}pp)`)
  }
}

// ---------------------------------------------------------------------------
console.log('--- 6. morale carries a little of it home')
{
  const g = clone(base)
  const fx = userFx(g)[0]
  const ctx = beginMatch(g, fx, mulberry32(11), false)
  const mine = mineOf(ctx)
  const ids = mine.lineup.slice(0, 15).filter((id): id is number => id != null)
  const g2 = clone(base)
  const ctx2 = beginMatch(g2, fx, mulberry32(11), false)
  applyPreTalk(g2, ctx2, 'fire')
  playHalf(g, ctx); playHalf(g, ctx); playHalf(g2, ctx2); playHalf(g2, ctx2)
  const diffs = ids.map(id => g2.players[id].morale - g.players[id].morale)
  const maxAbs = Math.max(...diffs.map(Math.abs))
  console.log(`     morale moved by the talk: up to ${maxAbs.toFixed(2)} a man`)
  ok(diffs.some(d => Math.abs(d) > 0.01), 'a talk leaves a trace in the men who heard it')
  ok(maxAbs <= 0.6, 'and only a trace: a match result moves morale more')
}

// ---------------------------------------------------------------------------
console.log('--- 8. saying nothing: once is nothing, a habit drains the room (owner, round 6)')
{
  const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
  ok(PRE_TONES.length === 4 && new Set(PRE_TONES).size === 4, `exactly four pre-match tones (${PRE_TONES.join(', ')})`)
  // once: exactly the match it always was, and nothing on screen
  {
    const g = clone(base)
    const fx = userFx(g)[0]
    let draws = 0
    const inner = mulberry32(21)
    const ctx = beginMatch(g, fx, () => { draws++; return inner() }, true)
    const mine = mineOf(ctx)
    const units = JSON.stringify([ctx.home.units, ctx.away.units])
    const d0 = draws
    const msg = openDressingRoom(g, ctx, null)
    ok(msg === null && !ctx.preReads && !mine.talkF, 'one silence: no reactions, no line, no multiplier')
    ok(JSON.stringify([ctx.home.units, ctx.away.units]) === units, 'and both sides\' units are exactly as they were')
    ok(draws === d0, 'and the match rng was not touched')
    ok(g.preTalkLog === 'N', `the room remembers it (${g.preTalkLog})`)
  }
  // twice in five is forgiven; the third is a habit
  ok(silenceWeight('NN') === 0 && silenceWeight('TNTNT') === 0, 'two silences in the last five are forgiven')
  ok(silenceWeight('NNN') === 1 && silenceWeight('NNNN') === 2 && silenceWeight('NNNNN') === 3, 'each one past that is a step, three at most')
  ok(silenceWeight('NNNNNNNNNN') === 3, 'and it never goes deeper than three')
  // recovers when talks resume: the window slides
  let log = 'NNNNN'
  const path: number[] = []
  for (let i = 0; i < 5; i++) { log = logPreTalk(log, true); path.push(silenceWeight(log)) }
  ok(path.join(',') === '2,1,0,0,0', `talking again brings it back (${path.join(' -> ')})`)
  // the habit: every man takes the silence badly, in words, bounded
  {
    const g = clone(base)
    const fx = userFx(g)[0]
    let draws = 0
    const inner = mulberry32(22)
    const ctx = beginMatch(g, fx, () => { draws++; return inner() }, true)
    const mine = mineOf(ctx)
    const opp = mine === ctx.home ? ctx.away : ctx.home
    const oppUnits = JSON.stringify(opp.units)
    g.preTalkLog = 'TNTN'
    const d0 = draws
    const msg = openDressingRoom(g, ctx, null)
    const reads = ctx.preReads ?? []
    ok(draws === d0, 'the habit draws nothing from the match rng')
    ok(reads.length === mine.lineup.slice(0, 23).filter(id => id != null).length, `the third silence in five: all ${reads.length} react`)
    ok(reads.every(r => r.r < 0), 'and every one of them takes it as a small knock')
    ok(typeof msg === 'string' && msg.length > 0 && !/\d/.test(msg), `the assistant says it once, in words: "${msg}"`)
    const words = [...new Set(reads.map(r => r.k))].map(k => k.split('.').reduce((o: any, p) => o?.[p], en) as string | undefined)
    ok(words.every(w => typeof w === 'string' && !/\d/.test(w)), `reactions in plain words (${words.join(' / ')})`)
    ok(JSON.stringify(opp.units) === oppUnits, 'the other side is untouched (AI talks stay neutral)')
    ok(g.preTalkLog === 'TNTNN', `logged (${g.preTalkLog})`)
    // bounded at the deepest step
    const deep = silenceReads(g, mine.lineup.slice(0, 23), { exp: 0, home: true, big: false }, fx.id, 1, 3)
    const lo = Math.min(...deep.map(r => talkFactor(r.r)))
    ok(lo >= 1 - TALK_CAP, `three steps deep, nobody drops below the talk cap (worst man ${((lo - 1) * 100).toFixed(1)}%)`)
  }
  // belief: the room the preview shows is flatter after a habit of silence
  {
    const g = clone(base)
    const ids = g.clubs[g.userClubId].tactic.lineup.slice(0, 23).filter((id): id is number => id != null)
    const s: TalkSetting = { exp: 0, home: true, big: false }
    const mean = () => ids.reduce((a, id) => a + baseState(g, g.players[id], s, 5), 0) / ids.length
    const low = () => ids.filter(id => roomMood(baseState(g, g.players[id], s, 5), g.players[id]).tone === 'low').length
    g.preTalkLog = 'TTTTT'
    const m0 = mean(), l0 = low()
    g.preTalkLog = 'NNNNN'
    const m1 = mean(), l1 = low()
    ok(m1 < m0 && l1 >= l0, `a habit of silence shows in the moods (room ${m0.toFixed(2)} -> ${m1.toFixed(2)}, low moods ${l0} -> ${l1})`)
    // and a talk has more to do: faith helps a neglected room more
    const sum = (tn: PreTone) => talkReads(g, ids, s, tn, 5, 0.6).reduce((a, r) => a + r.r, 0)
    const fNeglect = sum('faith')
    g.preTalkLog = 'TTTTT'
    const fFine = sum('faith')
    ok(fNeglect > fFine, 'and a word of faith does more for a neglected room than for a looked-after one')
  }
  // what it costs on the pitch: paired matches, even games.
  //
  // THE COST IS ASSERTED ON THE XV, NOT ON THE WIN RATE (1.8.14). The habit
  // takes about half a percent off the side on the day (the mean per-man
  // factor read 0.9947), worth a point or so of wins. But the two arms of a
  // pair part ways the moment one man's rating moves, so the paired win
  // difference has the noise of two independent samples: two to three
  // points at these sizes. Over the 1.8.13 and 1.8.14 worlds this check read
  // +2.8pp, then -1.1 and -1.8 (the last on twice the fixtures) with the
  // habit's factor unchanged: the sign was the dice. So the claim it can
  // actually carry is the mechanism - every man the habit reaches is a
  // little worse, never better - and the result is printed for the record.
  {
    let n = 0, wn = 0, wh = 0, mh = 0, fh = 0, fmax = 0
    for (const [club, seed] of [['leicester', 4242], ['toulouse', 9], ['leinster', 31337], ['northampton', 777]] as const) {
      const { g, out } = world(club, seed)
      for (const { fx } of out.filter(x => x.exp >= -0.25 && x.exp <= 0.25).slice(0, 3)) {
        for (let k = 0; k < Math.ceil((QUICK ? 40 : 120) / 3); k++) {
          const sd = 5000 + k * 7919 + fx.id
          const a = play(g, fx, sd, 'none'), h = play(g, fx, sd, 'habit')
          n++; wn += a.won + a.drawn / 2; wh += h.won + h.drawn / 2; mh += h.margin - a.margin
          fh += h.f1; fmax = Math.max(fmax, h.f1)
        }
      }
    }
    const cost = (wn - wh) / n * 100
    console.log(`     even games: one-off silence ${(wn / n * 100).toFixed(1)}%  a habit of it ${(wh / n * 100).toFixed(1)}%  (${cost.toFixed(1)}pp, margin ${(mh / n).toFixed(1)}); the XV on the day x${(fh / n).toFixed(4)}`)
    ok(fh / n < 0.999 && fmax <= 1, `a habit of silence takes something off the side on the day (mean x${(fh / n).toFixed(4)}, never above 1)`)
    ok(cost <= 8, 'but less than a badly judged talk does: a slow leak, not a cliff')
  }
}

// ---------------------------------------------------------------------------
console.log('--- 7. the bands hold with a manager who always judges the room')
// The AI clubs' talk is the engine's baseline (every AI side is talked to
// competently, which is what the calibration already assumes), so nothing
// changes for them and silence is neutral for the manager. The question left
// is whether a manager who reads the room perfectly every week bends the
// league: four seeds, a season each, the best pre-match and half-time talk in
// every one of his matches, against the bandcheck bands.
if (!QUICK) {
  interface Row { games: number; pts: number; tries: number; home: number; draw: number }
  const season = (club: string, seed: number): Row => {
    const g = newGame(club, 'Bands', seed)
    while (g.week < 36) {
      const fx = userFixtureThisWeek(g)
      if (fx) {
        const ctx = beginMatch(g, fx, weekRng(g), false)
        ctx.assistantSubs = true
        const mine = mineOf(ctx)
        const opp = mine === ctx.home ? ctx.away : ctx.home
        const big = !!fx.stage || ctx.derby
        const listen = talkListen(g)
        applyPreTalk(g, ctx, bestTone(PRE_TONES, g, mine.lineup.slice(0, 23),
          talkSetting(paperOverall(g, mine.teamId, mine.lineup), paperOverall(g, opp.teamId, opp.lineup), mine === ctx.home, big), fx.id, listen))
        playHalf(g, ctx)
        if (ctx.seg < 3) {
          const ids = mine.lineup.slice(0, 23).filter(id => id != null && (mine.onPitch.has(id) || !mine.ratings.has(id)))
          applyTeamTalk(g, ctx, bestTone(HT_TONES, g, ids,
            talkSetting(paperOverall(g, mine.teamId, mine.lineup), paperOverall(g, opp.teamId, opp.lineup), mine === ctx.home, big, mine.score - opp.score), fx.id, listen, mine.talkShift))
          playHalf(g, ctx)
        }
      }
      processWeekAndAdvance(g)
    }
    const played = g.fixtures.filter(f => f.played && g.comps[f.compId]?.type === 'league')
    const n = played.length
    return {
      games: n,
      pts: played.reduce((a, f) => a + f.homeScore + f.awayScore, 0) / n,
      tries: played.reduce((a, f) => a + f.homeTries + f.awayTries, 0) / n,
      home: played.filter(f => f.homeScore > f.awayScore).length / n,
      draw: played.filter(f => f.homeScore === f.awayScore).length / n,
    }
  }
  const rs = ([['toulouse', 777], ['northampton', 9], ['leinster', 4242], ['crusaders', 31337]] as const).map(([c, sd]) => season(c, sd))
  const tot = rs.reduce((a, r) => a + r.games, 0)
  const w = (f: (r: Row) => number) => rs.reduce((a, r) => a + f(r) * r.games, 0) / tot
  const pts = w(r => r.pts), tries = w(r => r.tries), home = w(r => r.home), draw = w(r => r.draw)
  console.log(`     POOLED (${tot} games) ${pts.toFixed(1)}pts  ${tries.toFixed(2)} tries  ${(home * 100).toFixed(1)}% home  ${(draw * 100).toFixed(1)}% draws`)
  ok(pts >= 48 && pts <= 53, `scoring in band (${pts.toFixed(1)}, 48-53)`)
  ok(tries >= 6.0 && tries <= 6.6, `tries in band (${tries.toFixed(2)}, 6.0-6.6)`)
  ok(home >= 0.51 && home <= 0.57, `home wins in band (${(home * 100).toFixed(1)}%, 51-57)`)
  ok(draw >= 0.014 && draw <= 0.030, `draws in band (${(draw * 100).toFixed(1)}%, 1.4-3.0)`)
} else console.log('     (skipped with --quick)')

console.log(fails ? `\nTEAM TALK PROBE FAILED (${fails})` : '\nTEAM TALK PROBE PASSED')
process.exit(fails ? 1 : 0)
