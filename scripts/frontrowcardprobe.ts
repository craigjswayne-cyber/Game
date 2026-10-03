/**
 * LAW 3 WITH THE COVER ON THE BENCH, AND THE KICK-OFF COUNT (1.8.3).
 *
 * Three fixes, one probe:
 *
 *   A carded front-rower with a trained replacement on the bench. The engine
 *   saw the cover (liveFrontRowCover counts the bench), kept the scrum
 *   contested, and brought nobody on: the AI bench skips a shirt nobody is
 *   wearing and the manager's change is refused for a binned man. Now the
 *   replacement comes on and another man makes way (frontRowCardCover); for
 *   a yellow it is all undone when the ten minutes end, for a red it stands.
 *
 *   The kick-off test counted positions: a prop who packs down on both sides
 *   was worth two, so five men passed for six. It counts players now, six in
 *   a 23 and five in a squad of 19 to 22 (frontRowCover).
 *
 *   The random yellow had no floor: the repeated-penalty bin stops at
 *   thirteen on the pitch and this one did not.
 *
 * The first three cases drive checkFrontRow directly on a fresh match and
 * read the ctx; the kick-off cases build team sheets by hand; the last runs
 * 2,000 matches between AI sides and reads every tick.
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick, resolveDecision, checkFrontRow, liveFrontRowCover, frontRowCover, autoSelect, availablePlayers, rosterOf, isFrontRower } from '../src/game/matchEngine'
import type { LiveCtx, SideCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${what}`); if (!c) fails++ }
const has = (ctx: LiveCtx, k: string) => ctx.events.some(e => e.k === k)
const hook = (p: Player) => p.pos === 'HK' || p.alt.includes('HK')
const prop = (p: Player) => p.pos === 'LP' || p.pos === 'TP' || p.alt.includes('LP') || p.alt.includes('TP')
/** the men on the pitch make a trained front row: a hooker and two props */
function wholeFrontRow(g: GameState, s: SideCtx): boolean {
  const fr = [...s.onPitch].map(id => g.players[id]).filter(p => p && !p.injury && isFrontRower(p))
  return fr.some(h => hook(h) && fr.filter(p => p !== h && prop(p)).length >= 2)
}
const heads = (s: SideCtx) => 15 - s.sent - s.short - s.binned.size

function fixture(g: GameState, homeId: string, awayId: string): Fixture {
  return { id: g.nextId++, compId: 'prem', round: 0, week: g.week, homeId, awayId, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 } as Fixture
}
function fresh(seed: number, stripBench = false): { g: GameState; ctx: LiveCtx } {
  const g = newGame('leicester', 'Probe', seed)
  const c = g.clubs[g.userClubId]
  for (const id of c.players) { const p = g.players[id]; if (p) { p.injury = null; p.bans = 0; p.cond = 100 } }
  c.tactic.lineup = autoSelect(g, availablePlayers(g, rosterOf(g, c.id)))
  const oppId = Object.keys(g.clubs).find(id => id !== c.id && g.clubs[id].leagueId === c.leagueId)!
  const ctx = beginMatch(g, fixture(g, c.id, oppId), mulberry32(seed), true)
  if (stripBench) {
    for (const id of ctx.home.lineup.slice(15)) { const p = id != null ? g.players[id] : null; if (p && isFrontRower(p)) p.injury = { desc: 'x', dk: 'injury.knock', until: g.week + 2, weeks: 2 } }
  }
  return { g, ctx }
}
/** the card exactly as the engine shows it, then Law 3 */
function card(g: GameState, ctx: LiveCtx, s: SideCtx, p: Player, kind: 'yellow' | 'red', min: number) {
  s.onPitch.delete(p.id)
  if (kind === 'yellow') { s.binned.add(p.id); s.yellowUntil.set(p.id, min + 10) }
  else { s.sent += 1; s.ratings.set(p.id, (s.ratings.get(p.id) ?? 6) - 2) }
  if (kind === 'yellow') s.ratings.set(p.id, (s.ratings.get(p.id) ?? 6) - 0.7)
  checkFrontRow(g, ctx, s, min, p, kind)
}
function benchMan(g: GameState, s: SideCtx, pos: string): Player | undefined {
  return s.lineup.slice(15).map(id => (id != null ? g.players[id] : undefined))
    .find(p => !!p && p.pos === pos && !s.onPitch.has(p.id) && !s.ratings.has(p.id))
}

// ---- 1. a hooker binned with a hooker on the bench ----------------------
console.log('\n=== HK yellow, HK on the bench ===')
{
  const { g, ctx } = fresh(21)
  const s = ctx.home
  const hk = g.players[s.lineup[1]!]
  const rep = benchMan(g, s, 'HK')!
  ok(hk.pos === 'HK' && !!rep, `hooker ${hk.name} in 2, ${rep?.name} on the bench`)
  const before = new Set(s.onPitch)
  const used = ctx.subsUsed
  card(g, ctx, s, hk, 'yellow', 30)
  const off = [...before].filter(id => id !== hk.id && !s.onPitch.has(id))
  ok(s.onPitch.has(rep.id) && s.lineup[1] === rep.id, 'the bench hooker comes on and wears 2')
  ok(off.length === 1 && !isFrontRower(g.players[off[0]]), `one non-front-rower makes way (${off.map(id => g.players[id].pos).join(',')})`)
  ok(s.onPitch.size === 14 && heads(s) === 14, `fourteen on the pitch, as the card says (${s.onPitch.size})`)
  ok(!ctx.uncontested && wholeFrontRow(g, s), 'scrums stay contested, with a trained front row')
  ok(has(ctx, 'comm.frontRowBinCover') && !has(ctx, 'comm.uncontestedNow'), 'the ticker says why, and no uncontested call')
  ok(ctx.subsUsed === used, 'forced, so it spends none of the manager\'s changes')
  // the ten minutes end on the next tick
  s.yellowUntil.set(hk.id, 0)
  ctx.tick = 8
  stepTick(g, ctx)
  ok(s.onPitch.has(hk.id) && s.lineup[1] === hk.id, 'the binned hooker takes his shirt back')
  ok(!s.onPitch.has(rep.id) && s.lineup.indexOf(rep.id) >= 15, 'the replacement goes back to the bench')
  ok(s.onPitch.has(off[0]), 'the man who made way comes back on')
  ok(s.onPitch.size === heads(s), `heads add up after the return (${s.onPitch.size} on, ${heads(s)} accounted)`)
  ok(!ctx.uncontested && has(ctx, 'comm.frontRowBinBack'), 'still contested, and the ticker says who came back')
  ok(!(s.frCover ?? []).length, 'nothing left owed')
}

// ---- 2. a tighthead sent off with a tighthead on the bench --------------
console.log('\n=== TP red, TP on the bench ===')
{
  const { g, ctx } = fresh(22)
  const s = ctx.home
  const tp = g.players[s.lineup[2]!]
  const rep = benchMan(g, s, 'TP')!
  ok(tp.pos === 'TP' && !!rep, `tighthead ${tp.name} in 3, ${rep?.name} on the bench`)
  const before = new Set(s.onPitch)
  card(g, ctx, s, tp, 'red', 30)
  const off = [...before].filter(id => id !== tp.id && !s.onPitch.has(id))
  ok(s.onPitch.has(rep.id) && s.lineup[2] === rep.id, 'the bench tighthead comes on and wears 3')
  ok(off.length === 1 && !isFrontRower(g.players[off[0]]), 'one non-front-rower makes way')
  ok(s.onPitch.size === 14 && heads(s) === 14, `fourteen on the pitch (${s.onPitch.size})`)
  ok(!ctx.uncontested && has(ctx, 'comm.frontRowRedCover'), 'contested, and the ticker says why')
  ok(!!s.sentOff?.has(tp.id), 'the sent-off man is marked, so he can never count as cover')
  let back = false, over = false
  ctx.tick = 8
  while (ctx.tick < 20) {
    if (ctx.decision) resolveDecision(g, ctx, 'posts')
    stepTick(g, ctx)
    if (s.onPitch.has(tp.id) || s.onPitch.has(off[0])) back = true
    if (s.onPitch.size > 14) over = true
  }
  ok(!back, 'permanent: neither the sent-off man nor the man who made way comes back')
  ok(!over, 'never more than fourteen for the rest of the match')
}

// ---- 3. no trained cover: uncontested, as before ------------------------
console.log('\n=== HK yellow, no cover on the bench ===')
{
  const { g, ctx } = fresh(23, true)
  const s = ctx.home
  const hk = g.players[s.lineup[1]!]
  card(g, ctx, s, hk, 'yellow', 30)
  ok(!liveFrontRowCover(g, s), 'no cover anywhere')
  ok(ctx.uncontested === true && has(ctx, 'comm.uncontestedNow') && has(ctx, 'comm.uncontestedBin'), 'uncontested, and a second man sits the ten out')
  ok(s.onPitch.size === 13 && !has(ctx, 'comm.frontRowBinCover'), `thirteen on the pitch, nobody came on (${s.onPitch.size})`)
}

// ---- 4. the kick-off count: players, not positions ----------------------
console.log('\n=== kick-off: players, not positions ===')
{
  const g = newGame('leicester', 'Probe', 24)
  const c = g.clubs[g.userClubId]
  const all = c.players.map(id => g.players[id]).filter(Boolean)
  for (const p of all) { p.injury = null; p.bans = 0; p.natSquad = false }
  // his own sheet, kept as written (lineupFor re-picks a sheet the game chose)
  c.tactic.userPicked = true
  const others = all.filter(p => !isFrontRower(p)).slice(0, 18)
  const of = (pos: string) => all.filter(p => p.pos === pos && p.alt.every(a => !['LP', 'HK', 'TP'].includes(a)))
  const [lp1, lp2] = of('LP'), [hk1, hk2] = of('HK'), [tp1, tp2] = of('TP')
  ok(others.length === 18 && !!lp2 && !!hk2 && !!tp2, 'enough men to build the sheets')
  // a two-sided prop: the loosehead on the bench packs down at tighthead too
  lp2.alt = ['TP']
  const sheet = (fr: Player[], size: number) => {
    const lu: (number | null)[] = [fr[0].id, fr[1].id, fr[2].id, ...others.slice(0, 12).map(p => p.id)]
    for (const p of fr.slice(3)) lu.push(p.id)
    for (const p of others.slice(12)) if (lu.length < size) lu.push(p.id)
    while (lu.length < 23) lu.push(null)
    return lu
  }
  const five = sheet([lp1, hk1, tp1, hk2, lp2], 23)
  const fr5 = frontRowCover(g, five)
  ok(fr5.LP >= 2 && fr5.HK >= 2 && fr5.TP >= 2, `five men cover every position twice by the old count (${fr5.LP}/${fr5.HK}/${fr5.TP})`)
  ok(!fr5.legal && fr5.players === 5 && fr5.need === 6, `but five players in a 23 is short (${fr5.players} of ${fr5.need})`)
  const six = sheet([lp1, hk1, tp1, hk2, lp2, tp2], 23)
  const fr6 = frontRowCover(g, six)
  ok(fr6.legal && fr6.players === 6, `six different men in a 23 is legal (${fr6.players})`)
  const fiveOf20 = sheet([lp1, hk1, tp1, hk2, lp2], 20)
  const f20 = frontRowCover(g, fiveOf20)
  ok(f20.need === 5 && f20.legal, `a squad of 20 needs five, and five will do (${f20.players} of ${f20.need})`)
  const fourOf22 = sheet([lp1, hk1, tp1, lp2], 22)
  const f22 = frontRowCover(g, fourOf22)
  ok(f22.need === 5 && !f22.legal, `a squad of 22 with four is short (${f22.players} of ${f22.need})`)
  const dup = five.slice(); dup[22] = hk2.id
  ok(frontRowCover(g, dup).players === 5, 'the same man named twice counts once')
  // and the engine: the five-man 23 kicks off uncontested, the six-man one does not
  const oppId = Object.keys(g.clubs).find(id => id !== c.id && g.clubs[id].leagueId === c.leagueId)!
  c.tactic.lineup = five
  const a = beginMatch(g, fixture(g, c.id, oppId), mulberry32(24), true)
  ok(a.uncontested === true && has(a, 'comm.uncontested'), 'five with a two-sided prop: the referee orders uncontested scrums at kick-off')
  c.tactic.lineup = six
  const b = beginMatch(g, fixture(g, c.id, oppId), mulberry32(24), true)
  ok(!b.uncontested, 'six different front-rowers: contested')
}

// ---- 5. 2,000 matches between AI sides ----------------------------------
console.log('\n=== 2,000 matches ===')
{
  const N = 2000
  let made = 0, seed = 1
  let ycLow = 0, yc = 0, frCards = 0, cover = 0, back = 0, coverHole = 0, badHeads = 0
  while (made < N) {
    const g = newGame('leicester', 'Soak', 9000 + seed++)
    const byLeague: Record<string, string[]> = {}
    for (const cl of Object.values(g.clubs)) (byLeague[cl.leagueId] ??= []).push(cl.id)
    const pairs: [string, string][] = []
    for (const L of Object.values(byLeague)) for (let i = 0; i + 1 < L.length; i += 2) pairs.push([L[i], L[i + 1]])
    for (const [h, a] of pairs) {
      if (made >= N) break
      for (const id of [...g.clubs[h].players, ...g.clubs[a].players]) { const p = g.players[id]; if (p) { p.injury = null; p.bans = 0 } }
      const ctx = beginMatch(g, fixture(g, h, a), mulberry32(made * 7919 + 13), true, null)
      made++
      while (ctx.tick < 20 || ctx.decision) {
        if (ctx.decision) { resolveDecision(g, ctx, 'posts'); continue }
        const pre = [ctx.home, ctx.away].map(s => ({ on: s.onPitch.size, ids: new Set(s.onPitch), binned: new Set(s.binned), lawOut: !!s.lawOut }))
        const e0 = ctx.events.length
        stepTick(g, ctx)
        const evs = ctx.events.slice(e0)
        ;[ctx.home, ctx.away].forEach((s, k) => {
          // a running head count through the tick's lines: who is out there
          // when each yellow is shown
          let run = pre[k].on + (pre[k].lawOut && !s.lawOut ? 1 : 0)
          for (const id of pre[k].binned) if (!s.binned.has(id)) run++
          let cardAt = -1
          evs.forEach((e, i) => {
            if (e.teamId !== s.teamId) return
            const p = e.playerId != null ? g.players[e.playerId] : undefined
            if (e.type === 'YC') { yc++; if (run <= 13) ycLow++; run--; if (isFrontRower(p)) { frCards++; cardAt = i } }
            else if (e.type === 'RC') { run--; if (isFrontRower(p)) { frCards++; cardAt = i } }
            else if (e.k === 'comm.injuryDown' || e.k === 'comm.uncontestedShort' || e.k === 'comm.uncontestedNoRep' || e.k === 'comm.uncontestedBin') run--
            else if (e.k === 'comm.subComesOn' || e.k === 'comm.frontRowReturns') run++
            if (e.k === 'comm.frontRowBinCover' || e.k === 'comm.frontRowRedCover') cover++
            if (e.k === 'comm.frontRowBinBack') back++
          })
          // a front-row card this tick and nothing after it but play: the
          // side has a whole front row, or the referee has called it off
          // (the AI's changes for tired legs are not written, so a man on the
          // pitch who came on this tick with no line is one of them)
          const named = new Set([...pre[k].binned, ...evs.filter(e => e.teamId === s.teamId && e.playerId != null).map(e => e.playerId!)])
          const silent = [...s.onPitch].some(id => !pre[k].ids.has(id) && !named.has(id))
          const later = cardAt >= 0 && (silent || evs.slice(cardAt + 1).some(e => e.teamId === s.teamId && (e.type === 'INJ' || e.type === 'YC' || e.type === 'RC' || e.k === 'comm.subComesOn' || e.k === 'comm.hiaPassed')))
          if (cardAt >= 0 && !later && !ctx.uncontested && !wholeFrontRow(g, s)) {
            coverHole++
            console.log(`    hole: ${s.teamId} at ${ctx.tick * 4}', ${evs.filter(e => e.teamId === s.teamId).map(e => `${e.k}${e.playerId != null ? ':' + g.players[e.playerId].pos : ''}`).join(' ')}`)
            console.log(`      pitch ${[...s.onPitch].map(id => g.players[id]).filter(p => isFrontRower(p)).map(p => p.pos + '/' + p.alt.join('')).join(',')}; bench ${s.lineup.slice(15).map(id => (id != null ? `${g.players[id].pos}${g.players[id].alt.join('')}${s.ratings.has(id) ? '*' : ''}${s.binned.has(id) ? 'b' : ''}${g.players[id].injury ? 'i' : ''}` : '-')).join(',')}`)
          }
          if (s.onPitch.size > heads(s)) badHeads++
        })
      }
    }
  }
  const per = (x: number) => (x * 1000 / N).toFixed(1)
  console.log(`  per 1,000 matches: yellows ${per(yc)}, front-row cards ${per(frCards)}, bench cover on ${per(cover)}, back from the bin ${per(back)}`)
  ok(ycLow === 0, `no yellow is shown to a side already down to thirteen (${ycLow})`)
  ok(cover > 0 && back > 0, 'the bench cover is used, and undone at the end of a bin')
  ok(coverHole === 0, `no front-row card leaves a contested scrum without a trained front row (${coverHole})`)
  ok(badHeads === 0, `never more men on the pitch than the cards allow (${badHeads})`)
}

console.log(fails ? `\nFRONTROWCARD FAIL (${fails})` : '\nFRONTROWCARD OK')
process.exit(fails ? 1 : 0)
