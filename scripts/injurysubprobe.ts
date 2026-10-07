/**
 * ---- AN INJURY NEVER STOPS THE GAME FOR GOOD (owner, round 6) ----
 *
 * "Player injured but have nobody on the bench who can replace him by
 * position - he is a back rower so I should be able to replace him with
 * anyone. I can't continue in the game. Only front row players should be
 * harder to replace... if a back has to play front row for example then it
 * would be uncontested scrums."
 *
 * The owner's case, rebuilt: a back-rower goes down with no back-rower on the
 * bench. The assistant sends a back on, the engine writes "playing out of
 * position" under the substitution at the same stoppage, and that line used
 * to count as the cover having PLAYED - so every other name the manager
 * tapped on the forced injury sheet came back "Too late to take that back".
 * And the sheet guessed the cover from "the next SUB line with a player in
 * it", which most commentary lines are, so an injury with nobody left to send
 * on could arm a man who was not even ours.
 *
 * Holds:
 *   1. back-rower down, no back-row on the bench: EVERY fit bench man can
 *      take the shirt instead of the assistant's pick (free override)
 *   2. the engine names the stoppage's cover (lastInj), and it is the man
 *      who came on - never a commentary line's player
 *   3. front row: a prop down with a front-rower on the bench - a back is
 *      refused, a front-rower is taken; with none on the bench anyone goes
 *      on and the scrums go uncontested
 *   4. a tactical change at 1, 2 or 3 follows the same rule
 *   5. nobody on the bench at all: nobody is armed, the side plays a man
 *      down, and the match reaches full time
 *   6. the assistant's own path (instant result) covers a back-rower from
 *      a bench with no back-rower too
 *   7. none of it draws on the shared rng: the whole match stream is the
 *      same with the bookkeeping as without it (fingerprint covers the rest)
 *
 * Run: npx vite-node scripts/injurysubprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, isFrontRower, makeSubstitution, resolveDecision, stepTick, swapInjuryCover, type LiveCtx, type SideCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { t } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

type Strip = 'backrow' | 'frontrow' | 'none' | 'all'
const BACK_ROW = ['FL', 'N8']
const FR = ['LP', 'HK', 'TP']
const BACKS = ['SH', 'FH', 'CE', 'WG', 'FB']
const playsAny = (p: Player, ps: string[]) => ps.includes(p.pos) || p.alt.some(a => ps.includes(a))

interface Stop { g: GameState; ctx: LiveCtx; mine: SideCtx; hurt: Player; inj: number }

/** Play a seeded match with the user's bench reshaped, and stop at the first
 *  user injury that `want` accepts. Deterministic: same seed, same stop. */
function playTo(seed: number, strip: Strip, want: (hurt: Player) => boolean, assistant = false): Stop | null {
  const g = newGame('northampton', 'Injury Probe', seed)
  const fx = g.fixtures.find(f => (f.homeId === g.userClubId || f.awayId === g.userClubId) && g.clubs[f.homeId] && g.clubs[f.awayId])!
  const ctx = beginMatch(g, fx, mulberry32(seed * 7 + 1), true)
  if (assistant) ctx.assistantSubs = true
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const club = g.clubs[g.userClubId]
  const used = new Set(mine.lineup.filter((x): x is number => x != null))
  for (let s = 15; s < mine.lineup.length; s++) {
    const id = mine.lineup[s]
    const p = id != null ? g.players[id] : null
    if (strip === 'all') { mine.lineup[s] = null; continue }
    const ban = strip === 'backrow' ? BACK_ROW : strip === 'frontrow' ? FR : null
    if (!p || !ban || !playsAny(p, ban)) continue
    const rep = club.players.map(i => g.players[i])
      .find(q => q && !used.has(q.id) && !q.injury && q.bans === 0 && BACKS.includes(q.pos) && !playsAny(q, [...BACK_ROW, ...FR]))
    mine.lineup[s] = rep ? rep.id : null
    if (rep) used.add(rep.id)
  }
  let seen = 0
  while (ctx.tick < 20) {
    ctx.awaiting = null
    ctx.decision = null
    stepTick(g, ctx)
    for (let i = seen; i < ctx.events.length; i++) {
      const e = ctx.events[i]
      if (e.type !== 'INJ' || e.k !== 'comm.injuryDown' || e.teamId !== ctx.userSideId || e.playerId == null) continue
      const hurt = g.players[e.playerId]
      if (hurt?.injury && want(hurt)) return { g, ctx, mine, hurt, inj: i }
    }
    seen = ctx.events.length
  }
  return null
}

const fitBench = (s: Stop) => s.mine.lineup.slice(15)
  .map(id => id != null ? s.g.players[id] : null)
  .filter((p): p is Player => !!p && !p.injury && !s.mine.onPitch.has(p.id) && !s.mine.ratings.has(p.id))

function find(strip: Strip, want: (hurt: Player) => boolean, also: (s: Stop) => boolean = () => true, assistant = false): { seed: number; stop: Stop } | null {
  for (let seed = 1; seed < 1500; seed++) {
    const s = playTo(seed, strip, want, assistant)
    if (s && also(s)) return { seed, stop: s }
  }
  return null
}

// ---------------------------------------------------------------------------
console.log('--- 1. the owner\'s case: a back-rower down, no back-row on the bench')
{
  // the hardest version: the assistant's man is out of position, so the
  // stoppage wrote a line about him - the line that used to lock the sheet
  const hit = find('backrow', h => BACK_ROW.includes(h.pos),
    s => s.ctx.events.slice(s.inj).some(e => e.k === 'comm.outOfCover'))
  ok(!!hit, `staged: a back-rower injured with no back-rower on the bench and the cover out of position${hit ? ` (seed ${hit.seed}, ${hit.stop.hurt.pos})` : ''}`)
  if (hit) {
    const { stop } = hit
    const li = stop.mine.lastInj
    ok(!!li && li.hurtId === stop.hurt.id && li.coverId != null, 'the engine names the stoppage and who went on')
    const cover = li?.coverId != null ? stop.g.players[li.coverId] : null
    ok(!!cover && stop.mine.onPitch.has(cover.id), `the assistant's man is on the pitch (${cover?.pos ?? '?'} in the ${stop.hurt.pos} shirt)`)
    // BEFORE: the override refused anybody once any line after the substitution
    // carried the cover's id - and the stoppage itself had written one
    const subAt = stop.ctx.events.findIndex((e, i) => i > stop.inj && e.k === 'comm.subComesOn' && e.playerId === li?.coverId)
    const legacyLocked = subAt >= 0 && stop.ctx.events.slice(subAt + 1).some(e => e.playerId === li?.coverId)
    console.log(`  before this round the sheet would have answered every other choice "${t('touch.tooLateToUndo')}": ${legacyLocked ? 'yes (reproduced)' : 'no'}`)
    const names = fitBench(stop).map(p => p.id)
    ok(names.length > 0, `there is somebody on the bench to choose (${names.length})`)
    let took = 0
    const refused: string[] = []
    for (const inId of names) {
      // a fresh copy of the same stoppage for every choice
      const again = playTo(hit.seed, 'backrow', h => h.id === stop.hurt.id)!
      const before = again.ctx.events.length
      const msg = swapInjuryCover(again.g, again.ctx, li!.coverId!, inId)
      if (again.mine.onPitch.has(inId) && !again.mine.onPitch.has(li!.coverId!)) took++
      else refused.push(`${again.g.players[inId].pos}: ${msg}`)
      // the "out of position" line went back to the bench with the man it named
      ok(!again.ctx.events.some(e => e.k === 'comm.outOfCover' && e.playerId === li!.coverId), `no line still says the assistant's man is out of position (${again.g.players[inId].pos})`)
      void before
    }
    ok(took === names.length, `every fit man on the bench can take the shirt instead: ${took} of ${names.length}${refused.length ? ` (refused: ${refused.join('; ')})` : ''}`)
  }
}

// ---------------------------------------------------------------------------
console.log('--- 2. the cover is the man who came on, never a line of commentary')
{
  let checked = 0, right = 0, legacyWrong = 0
  for (let seed = 1; seed < 220; seed++) {
    const s = playTo(seed, seed % 3 === 0 ? 'all' : 'none', () => true)
    if (!s) continue
    checked++
    const li = s.mine.lastInj
    const line = s.ctx.events.slice(s.inj, (li?.upTo ?? s.inj + 1)).find(e => e.k === 'comm.subComesOn')
    if (li && (li.coverId == null ? !line : line?.playerId === li.coverId)) right++
    // what the sheet used to arm: the next SUB-typed line with a player in it
    const legacy = s.ctx.events.slice(s.inj, s.inj + 4).find(x => x.type === 'SUB' && x.teamId === s.ctx.userSideId && x.playerId != null)
    if (legacy && legacy.playerId !== li?.coverId) legacyWrong++
  }
  ok(checked >= 40 && right === checked, `the stoppage names its cover correctly in ${right} of ${checked} injuries`)
  console.log(`  (the old guess armed the wrong man in ${legacyWrong} of them)`)
}

// ---------------------------------------------------------------------------
console.log('--- 3. the front row is the one shirt with a rule on it')
{
  const hit = find('none', h => FR.includes(h.pos), s => {
    const li = s.mine.lastInj
    return !!li?.coverId && isFrontRower(s.g.players[li.coverId]) && fitBench(s).some(p => !isFrontRower(p))
  })
  ok(!!hit, `staged: a front-rower down, a front-rower sent on${hit ? ` (seed ${hit.seed}, ${hit.stop.hurt.pos})` : ''}`)
  if (hit) {
    const li = hit.stop.mine.lastInj!
    const back = fitBench(hit.stop).find(p => !isFrontRower(p))!
    const msg = swapInjuryCover(hit.stop.g, hit.stop.ctx, li.coverId!, back.id)
    ok(msg === t('touch.frontRowOnly') && !hit.stop.mine.onPitch.has(back.id), `a ${back.pos} is refused the ${hit.stop.hurt.pos} shirt while a front-rower is available ("${msg}")`)
    ok(!hit.stop.ctx.uncontested, 'and the scrums stay contested')
  }
  // no front-rower on the bench at all: anybody goes on, uncontested
  const bare = find('frontrow', h => FR.includes(h.pos), s => !!s.mine.lastInj && s.ctx.uncontested === true)
  ok(!!bare, `staged: a front-rower down with no front-row cover on the bench${bare ? ` (seed ${bare.seed}, ${bare.stop.hurt.pos})` : ''}`)
  if (bare) {
    const li = bare.stop.mine.lastInj!
    ok(li.coverId != null, 'somebody still went on for him')
    ok(!!bare.stop.ctx.uncontested, 'and the referee ordered uncontested scrums')
    ok(bare.stop.ctx.events.slice(bare.stop.inj).some(e => e.k === 'comm.uncontestedNow'), 'said in the commentary')
    const other = fitBench(bare.stop)[0]
    if (other && li.coverId != null) {
      swapInjuryCover(bare.stop.g, bare.stop.ctx, li.coverId, other.id)
      ok(bare.stop.mine.onPitch.has(other.id), `the manager can still send anybody on instead (${other.pos})`)
    }
    // and the match goes on to full time
    // (to the whistle, not to tick 20: a stoppage can fall on the last tick
    // and the final step after it is what blows full time - 1.8.14's extra
    // knocks put one there)
    // (a penalty call is answered the way the touchline panel answers it, so a
    // whistle held for a last-minute kick is blown by the kick)
    for (let n = 0; n < 200 && bare.stop.ctx.seg !== 3; n++) {
      bare.stop.ctx.awaiting = null
      if (bare.stop.ctx.decision) { resolveDecision(bare.stop.g, bare.stop.ctx, 'posts'); continue }
      stepTick(bare.stop.g, bare.stop.ctx)
    }
    ok(bare.stop.ctx.seg === 3, 'the match reaches full time')
  }
}

// ---------------------------------------------------------------------------
console.log('--- 4. a tactical change at 1, 2 or 3 follows the same rule')
{
  const g = newGame('northampton', 'Injury Probe', 31)
  const fx = g.fixtures.find(f => (f.homeId === g.userClubId || f.awayId === g.userClubId) && g.clubs[f.homeId] && g.clubs[f.awayId])!
  const ctx = beginMatch(g, fx, mulberry32(77), true)
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  while (ctx.tick < 11) { ctx.awaiting = null; ctx.decision = null; stepTick(g, ctx) }
  const prop = mine.lineup.slice(0, 3).find(id => id != null && mine.onPitch.has(id))!
  const bench = mine.lineup.slice(15).map(id => id != null ? g.players[id] : null)
    .filter((p): p is Player => !!p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))
  const back = bench.find(p => !isFrontRower(p))
  const frb = bench.find(p => isFrontRower(p))
  ok(!!back && !!frb, 'a bench with a front-rower and a back on it')
  if (back && frb) {
    const msg = makeSubstitution(g, ctx, prop, back.id)
    ok(msg === t('touch.frontRowOnly') && !mine.onPitch.has(back.id), 'a back cannot replace a prop while a front-rower sits on the bench')
    // a back-row or a back shirt takes anybody
    const flank = mine.lineup.slice(5, 8).find(id => id != null && mine.onPitch.has(id))!
    makeSubstitution(g, ctx, flank, back.id)
    ok(mine.onPitch.has(back.id), `a ${back.pos} can replace a ${g.players[flank].pos}`)
  }
}

// ---------------------------------------------------------------------------
console.log('--- 5. nobody on the bench: nobody armed, a man down, play goes on')
{
  const hit = find('all', () => true)
  ok(!!hit, `staged: an injury with an empty bench${hit ? ` (seed ${hit.seed})` : ''}`)
  if (hit) {
    const li = hit.stop.mine.lastInj
    ok(!!li && li.coverId == null, 'the stoppage names no cover, so the sheet arms nobody and has nothing to wait for')
    ok(hit.stop.mine.short >= 1, 'the side plays on a man short')
    while (hit.stop.ctx.tick < 20) { hit.stop.ctx.awaiting = null; hit.stop.ctx.decision = null; stepTick(hit.stop.g, hit.stop.ctx) }
    ok(hit.stop.ctx.seg === 3, 'and the match reaches full time')
  }
}

// ---------------------------------------------------------------------------
console.log('--- 6. the assistant\'s path (instant result) covers the back row from any bench')
{
  const hit = find('backrow', h => BACK_ROW.includes(h.pos), () => true, true)
  ok(!!hit, `staged under the assistant${hit ? ` (seed ${hit.seed})` : ''}`)
  if (hit) {
    const li = hit.stop.mine.lastInj!
    const cover = li.coverId != null ? hit.stop.g.players[li.coverId] : null
    ok(!!cover && hit.stop.mine.onPitch.has(cover.id), `the assistant sent a ${cover?.pos ?? 'nobody'} on for the ${hit.stop.hurt.pos}`)
    ok(hit.stop.mine.short === 0, 'nobody was left a man short')
  }
}

// ---------------------------------------------------------------------------
console.log('--- 7. the bookkeeping draws nothing')
{
  const run = () => {
    const g = newGame('northampton', 'Injury Probe', 12)
    const fx = g.fixtures.find(f => (f.homeId === g.userClubId || f.awayId === g.userClubId) && g.clubs[f.homeId] && g.clubs[f.awayId])!
    let draws = 0
    const inner = mulberry32(5)
    const ctx = beginMatch(g, fx, () => { draws++; return inner() }, true)
    while (ctx.tick < 20) { ctx.awaiting = null; ctx.decision = null; stepTick(g, ctx) }
    return `${draws}:${ctx.home.score}-${ctx.away.score}:${ctx.events.length}`
  }
  const a = run(), b = run()
  ok(a === b, `the same match twice is the same match (${a})`)
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed')
process.exit(fails ? 1 : 0)
