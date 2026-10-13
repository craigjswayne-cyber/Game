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
//   8. no competitive match next week (the summer): the promise is not offered,
//      and one already made waits rather than breaking
//
// Run: npx vite-node scripts/handshakeprobe.ts
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress, generatePress } from '../src/game/media'
import { migrate } from '../src/game/save'
import { canAnswerRequest } from '../src/game/chats'
import { executeTransfer, offerRenewalAt, renewalDemand } from '../src/game/ai'
import { competitiveMatchIn, requestLocked, startPromise } from '../src/game/handshake'
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

// ---- 8. the summer: no match, no promise ----
{
  /** The bench question as the room would ask it this week, if it is one of
   *  the week's candidates: every chance-gated room is shut (the rng reads
   *  0.99), then the pick is walked across the candidate list. */
  const benchAsked = (g: GameState): PressItem | null => {
    let calls = 0
    const probe = clone(g)
    for (const q of probe.press) q.answered = true
    generatePress(probe, () => { calls++; return 0.99 })
    for (let i = 0; i < 40; i++) {
      const h = clone(g)
      for (const q of h.press) q.answered = true
      const before = new Set(h.press.map(q => q.id))
      let k = 0
      generatePress(h, () => { k++; return k < calls ? 0.99 : k === calls ? 0 : (i + 0.5) / 40 })
      const item = h.press.find(q => !before.has(q.id) && (q.qk ?? '').startsWith('press.benchQ'))
      if (item) return item
    }
    return null
  }
  const offersStart = (q: PressItem) => q.options.some(o => o.pledge === 'start')

  // in the season, with a match next week, the promise is on the table
  // (the first such week in which somebody qualifies for the question)
  const g = clone(base)
  let guard = 0
  let inSeason: PressItem | null = null
  while (g.week < 40 && guard++ < 40) {
    if (competitiveMatchIn(g, g.userClubId, g.week + 1) && (inSeason = benchAsked(g))) break
    settle(g)
  }
  ok(!!inSeason && offersStart(inSeason), `week ${g.week}, a match next week: the bench question offers "He'll start next week"`)

  // the summer: the season is over and the next match is weeks away
  guard = 0
  while (g.season === base.season && (g.week < 44 || competitiveMatchIn(g, g.userClubId, g.week + 1)) && guard++ < 60) settle(g)
  ok(g.season === base.season && !competitiveMatchIn(g, g.userClubId, g.week + 1), `week ${g.week}: no competitive match next week`)
  // ANY WEEK OF THE SUMMER, NOT ONLY THE FIRST (1.9.0). The question needs a
  // fit man outside the 23 who minds it, and whether one exists in week 44
  // is the world's business: the set-piece engine replayed the season and
  // nobody qualified that week. So each week of the gap is tried in turn,
  // while it is still the summer, and the first one that asks it is judged.
  let summer = benchAsked(g)
  for (let w = 0; !summer && w < 12 && g.season === base.season && !competitiveMatchIn(g, g.userClubId, g.week + 1); w++) {
    settle(g)
    if (g.season === base.season && !competitiveMatchIn(g, g.userClubId, g.week + 1)) summer = benchAsked(g)
  }
  ok(!!summer, `week ${g.week}: the bench question can still be asked`)
  ok(!!summer && !offersStart(summer) && summer.options.length >= 2,
    `but without the promise of a start (${summer?.options.map(o => o.lk).join(', ')})`)

  // a promise already on the ledger cannot break across weeks with no match
  const h = clone(g)
  const p = promise(h)
  const club = h.clubs[h.userClubId]
  club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
  let quiet = 0
  for (let i = 0; i < 3 && h.season === g.season && !competitiveMatchIn(h, h.userClubId, h.week); i++) { settle(h); quiet++ }
  ok(quiet > 0 && !newsFor(h, p, 'news.startBroke') && !requestLocked(p),
    `${quiet} weeks without a match: the promise has not been judged broken`)
}

console.log(fails ? `HANDSHAKE PROBE FAILED (${fails})` : 'HANDSHAKE PROBE PASSED')
process.exit(fails ? 1 : 0)
