/**
 * LAW 3 MID-MATCH: the last trained front-rower goes off and the referee
 * orders uncontested scrums from there; a card costs a second player; a
 * sin-bin gives the contest back when the man returns.
 *
 * The release audit for 1.5.0 found the kick-off check was the only one: a
 * tighthead sent off in the 30th minute with nobody on the bench who had ever
 * packed down left the scrum contested for fifty minutes. This drives the
 * three causes through checkFrontRow directly, on a side whose bench cover
 * has been sent to the treatment table, and reads the ctx and the ticker.
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick, checkFrontRow, liveFrontRowCover, autoSelect, availablePlayers, rosterOf } from '../src/game/matchEngine'
import type { LiveCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${what}`); if (!c) fails++ }
const FR = new Set(['LP', 'HK', 'TP'])
const isFR = (p: Player) => FR.has(p.pos) || p.alt.some(a => FR.has(a))

function fresh(seed: number): { g: GameState; ctx: LiveCtx } {
  const g = newGame('leicester', 'Probe', seed)
  const c = g.clubs[g.userClubId]
  for (const id of c.players) { const p = g.players[id]; if (p) { p.injury = null; p.bans = 0; p.cond = 100 } }
  c.tactic.lineup = autoSelect(g, availablePlayers(g, rosterOf(g, c.id)))
  const oppId = Object.keys(g.clubs).find(id => id !== c.id && g.clubs[id].leagueId === c.leagueId)!
  const fx = { id: g.nextId++, compId: 'prem', round: 0, week: g.week, homeId: c.id, awayId: oppId, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 } as Fixture
  const ctx = beginMatch(g, fx, mulberry32(seed), true)
  // the bench's front-row cover goes down with something in the warm-up
  for (const id of ctx.home.lineup.slice(15)) { const p = id != null ? g.players[id] : null; if (p && isFR(p)) p.injury = { desc: 'x', dk: 'injury.knock', until: g.week + 2, weeks: 2 } }
  return { g, ctx }
}
const has = (ctx: LiveCtx, k: string) => ctx.events.some(e => e.k === k)
const scrumGap = (ctx: LiveCtx) => Math.abs(ctx.home.units.scrum - ctx.away.units.scrum)

for (const [seed, cause] of [[11, 'red'], [12, 'yellow'], [13, 'injury']] as const) {
  console.log(`\n=== ${cause} ===`)
  const { g, ctx } = fresh(seed)
  ok(!ctx.uncontested, 'contested at kick-off with a legal 23')
  ok(liveFrontRowCover(g, ctx.home), 'live cover is fine with three front-rowers on the pitch')
  const before = scrumGap(ctx)
  const hooker = [...ctx.home.onPitch].map(id => g.players[id]).find(p => p.pos === 'HK')!
  ctx.home.onPitch.delete(hooker.id)
  if (cause === 'yellow') { ctx.home.binned.add(hooker.id); ctx.home.yellowUntil.set(hooker.id, 40) }
  if (cause === 'injury') hooker.injury = { desc: 'x', dk: 'injury.knock', until: g.week + 2, weeks: 2 }
  ok(!liveFrontRowCover(g, ctx.home), `${cause}: without the hooker there is no cover`)
  checkFrontRow(g, ctx, ctx.home, 30, hooker, cause)
  ok(ctx.uncontested === true, 'referee orders uncontested scrums')
  ok(has(ctx, 'comm.uncontestedNow'), 'ticker says so')
  ok(scrumGap(ctx) < 0.001 && before > 0.001, `scrum units levelled (gap ${before.toFixed(2)} -> ${scrumGap(ctx).toFixed(3)})`)
  if (cause === 'red') {
    ok(ctx.home.short === 1 && has(ctx, 'comm.uncontestedShort'), 'Law 3.20: a second player leaves after a card')
    ok(ctx.home.onPitch.size === 13, `thirteen left on the pitch (${ctx.home.onPitch.size})`)
    ok(!ctx.uncontestedUndo, 'no way back after a red')
  }
  if (cause === 'injury') ok(ctx.home.short === 0 && !has(ctx, 'comm.uncontestedShort'), 'an injury costs nobody else')
  if (cause === 'yellow') {
    ok(!!ctx.uncontestedUndo, 'a sin-bin keeps the levelling to undo')
    ctx.home.yellowUntil.set(hooker.id, 0)
    // the next tick empties the bin and gives the contest back
    ctx.tick = 8
    stepTick(g, ctx)
    ok(ctx.home.onPitch.has(hooker.id), 'hooker back from the bin')
    ok(ctx.uncontested === false && has(ctx, 'comm.contestedAgain'), 'contested scrums restored on his return')
    ok(Math.abs(scrumGap(ctx) - before) < 0.05, `scrum gap back where it was (${scrumGap(ctx).toFixed(2)} vs ${before.toFixed(2)})`)
  }
  // a second call never orders it twice
  const n = ctx.events.filter(e => e.k === 'comm.uncontestedNow').length
  checkFrontRow(g, ctx, ctx.home, 50, hooker, cause)
  ok(ctx.events.filter(e => e.k === 'comm.uncontestedNow').length === n, 'not ordered twice while already uncontested, nor once the cover is back')
}
console.log(fails ? `\nSCRUMLAW FAIL (${fails})` : '\nSCRUMLAW OK')
process.exit(fails ? 1 : 0)
