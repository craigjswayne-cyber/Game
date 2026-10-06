// Probe: "He'll start next week" is a handshake (src/game/handshake.ts).
//
//   1. the press answer records a 'start' pledge and puts him in the XV
//   2. he starts the next competitive match: kept, cleared, no request
//   3. he does not: a transfer request that minutes, the answer buttons and a
//      renewal cannot shift, and that lapses only when he leaves
//   4. injured before the match: void, no penalty
//   5. no match played (postponed): the promise waits
//   6. saves: a damaged pledge or lock is dropped, not trusted
//   7. six languages carry every key
//
// Run: npx vite-node scripts/handshakeprobe.ts
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import { migrate } from '../src/game/save'
import { canAnswerRequest } from '../src/game/chats'
import { executeTransfer, offerRenewalAt, renewalDemand } from '../src/game/ai'
import { requestLocked, startPromise } from '../src/game/handshake'
import type { GameState, Player, PressItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const clone = (g: GameState): GameState => JSON.parse(JSON.stringify(g))
const userFixtureAt = (g: GameState, w: number) => g.fixtures.find(f => f.week === w && !f.played && f.compId !== 'fr' &&
  (f.homeId === g.userClubId || f.awayId === g.userClubId))
const fit = (p: Player) => { p.injury = null; p.bans = 0; p.natSquad = false; p.onLoan = false; p.knock = undefined; p.rust = 0; p.cond = 95 }

// the wiring in the press room itself
const media = readFileSync('src/game/media.ts', 'utf8')
ok(/pledge: 'start', lk: 'press\.benchNextWeek'/.test(media), "the bench room's \"He'll start next week\" carries the start pledge")

// a week whose competitive club match is still to come
const base = newGame('leicester', 'Handshake Probe', 4242)
let guard = 0
while ((base.week < 10 || !userFixtureAt(base, base.week)) && guard++ < 40) {
  for (const q of base.press) if (!q.answered) q.answered = true
  processWeekAndAdvance(base)
}
ok(!!userFixtureAt(base, base.week), `a club match to come in week ${base.week}`)

/** The bench question, answered "He'll start next week", for a fit man outside the 23. */
function promise(g: GameState): Player {
  const club = g.clubs[g.userClubId]
  const lu = club.tactic.lineup
  const p = club.players.map(id => g.players[id]).find(q => q && !q.acad && !lu.includes(q.id) && q.pos !== 'HK' && q.pos !== 'LP' && q.pos !== 'TP')!
  fit(p)
  for (const id of lu) if (id != null) fit(g.players[id])
  const item: PressItem = {
    id: g.nextId++, week: g.week, season: g.season, outlet: 'Probe', question: 'q', qk: 'press.benchQ2', playerId: p.id,
    options: [{ label: "He'll start next week.", lk: 'press.benchNextWeek', rk: 'press.benchNextWeekR', rv: { player: p.name },
      reaction: '', morale: 0.7, board: 0, lock: true, pledge: 'start' }],
    answered: false,
  }
  g.press.push(item)
  answerPress(g, item.id, 0)
  return p
}
const settle = (g: GameState) => { for (const q of g.press) if (!q.answered) q.answered = true; processWeekAndAdvance(g) }
const newsFor = (g: GameState, p: Player, k: string) => g.news.some(n => n.k === k && n.playerId === p.id)

// ---- 1. recorded ----
{
  const g = clone(base)
  const p = promise(g)
  const pl = startPromise(g, p)
  ok(!!pl && pl.baseStarts === p.stats.starts && Number.isFinite(pl.baseGames), 'the answer records a start pledge with its two counts')
  ok(g.clubs[g.userClubId].tactic.lineup.slice(0, 15).includes(p.id), 'and the answer puts him in the XV')
}

// ---- 2. kept ----
{
  const g = clone(base)
  const p = promise(g)
  const starts = p.stats.starts
  settle(g)
  ok(p.stats.starts === starts + 1, 'he started the match')
  ok(!startPromise(g, p), 'kept: the promise is cleared')
  ok(!(p.wantsOut ?? 0) && !requestLocked(p), 'kept: no transfer request')
  ok(newsFor(g, p, 'news.startKept'), 'kept: one line in the inbox')
}

// ---- 3. broken ----
{
  const g = clone(base)
  const p = promise(g)
  const club = g.clubs[g.userClubId]
  const lu = club.tactic.lineup
  const at = lu.indexOf(p.id)
  lu[at] = club.players.find(id => !lu.includes(id) && id !== p.id && !g.players[id].acad && !g.players[id].injury && g.players[id].pos === p.pos)
    ?? club.players.find(id => !lu.includes(id) && id !== p.id && !g.players[id].acad && !g.players[id].injury)!
  const starts = p.stats.starts
  settle(g)
  ok(p.stats.starts === starts, 'he did not start')
  ok(!startPromise(g, p), 'broken: the promise is settled')
  ok((p.wantsOut ?? 0) > 0 && requestLocked(p), 'broken: a transfer request, locked')
  ok(newsFor(g, p, 'news.startBroke'), 'broken: one line in the inbox')
  ok(!canAnswerRequest(g, p), 'broken: no accept/refuse buttons to answer it away')
  ok(!offerRenewalAt(g, p.id, renewalDemand(p) * 2).ok, 'broken: he will not sign a new deal')
  // minutes and mood do not withdraw it
  for (let i = 0; i < 6; i++) {
    fit(p)
    p.morale = 9
    if (!lu.slice(0, 15).includes(p.id)) { const j = lu.indexOf(p.id); if (j >= 0) lu[j] = null; lu[0] = p.id }
    settle(g)
  }
  ok((p.wantsOut ?? 0) > 0 && requestLocked(p), 'six weeks of starts later the request still stands')
  ok(!newsFor(g, p, 'news.requestWithdrawn'), 'and no withdrawal was ever filed')
  // it lapses when he leaves
  const buyer = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === club.leagueId)!
  executeTransfer(g, p, buyer.id, 100_000)
  ok(p.clubId === buyer.id && !requestLocked(p) && p.reqLock == null, 'sold: the lock goes with him')
}

// ---- 4. injury voids it ----
{
  const g = clone(base)
  const p = promise(g)
  const lu = g.clubs[g.userClubId].tactic.lineup
  p.injury = { desc: 'hamstring strain', until: g.week + 3 } as Player['injury']
  lu[lu.indexOf(p.id)] = null
  settle(g)
  ok(!startPromise(g, p), 'injured: the promise is cleared')
  ok(!(p.wantsOut ?? 0) && !requestLocked(p), 'injured: no transfer request')
  ok(newsFor(g, p, 'news.startVoid'), 'injured: one line saying it is off')
}

// ---- 5. postponed: it waits ----
{
  const g = clone(base)
  const p = promise(g)
  const fx = userFixtureAt(g, g.week)!
  fx.week = 99 // never played this season
  const others = g.fixtures.filter(f => f.week === g.week && f !== fx && (f.homeId === g.userClubId || f.awayId === g.userClubId))
  for (const f of others) f.week = 99
  const lu = g.clubs[g.userClubId].tactic.lineup
  lu[lu.indexOf(p.id)] = null
  settle(g)
  ok(!!startPromise(g, p), 'no match played: the promise still stands')
  ok(!(p.wantsOut ?? 0), 'and nothing has been broken')
}

// ---- 6. saves ----
{
  const g = clone(base)
  const p = promise(g)
  const raw = clone(g)
  const pl = raw.pledges!.find(x => x.kind === 'start')!
  delete pl.baseGames
  raw.players[p.id].reqLock = 7 as unknown as string
  const m = migrate(raw)
  ok(!(m.pledges ?? []).some(x => x.kind === 'start'), 'save: a start pledge without its counts is dropped')
  ok(m.players[p.id].reqLock === undefined, 'save: a lock that is not a club id is dropped')
  const rt = migrate(clone(g))
  ok(!!rt.pledges?.some(x => x.kind === 'start' && x.playerId === p.id), 'save: a sound start pledge survives a load')
}

// ---- 7. six languages ----
{
  const keys = ['news.startKeptSubj', 'news.startKept', 'news.startBrokeSubj', 'news.startBroke', 'news.startVoidSubj', 'news.startVoid',
    'player.promiseStart', 'player.promiseStartTitle', 'player.transferRequestLocked', 'matchday.warnPromise',
    'reply.requestLockedRenew', 'desk.tPromise_start', 'story.what.start']
  for (const lang of ['en', 'fr', 'es', 'it', 'af', 'ja']) {
    const o = JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8'))
    const missing = keys.filter(k => typeof k.split('.').reduce((x: unknown, s) => (x as Record<string, unknown>)?.[s], o) !== 'string')
    ok(!missing.length, `${lang}: every key${missing.length ? ` (missing ${missing.join(', ')})` : ''}`)
  }
}

console.log(fails ? `HANDSHAKE PROBE FAILED (${fails})` : 'HANDSHAKE PROBE PASSED')
process.exit(fails ? 1 : 0)
