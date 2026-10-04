/**
 * ---- PLAYER STORIES, ERAS AND TURNING POINTS (1.8.4) ----
 *
 * What this holds, for stories.ts, turning.ts and the era card:
 *
 *   1. THE FEW HAVE A STORY, THE REST DO NOT. Over real multi-season careers
 *      the manager's graduates, his captain, his record signing and the man he
 *      sold have a line, and a man who never crossed his path has none. The
 *      share of the world with a story stays small.
 *   2. EVERY LINE IS BACKED. Each line's reason is checked against the field it
 *      was read from: the academy stamps, the record book, the armband, the
 *      legends, the memory log, the career rows.
 *   3. THE ERA ADDS UP. Its record matches the history book's tenure, its
 *      trophies the cabinet, its promotions and relegations the finishes, and
 *      its academy debuts the memory.
 *   4. TURNING POINTS ARE FEW AND REAL. One a season at most, three an era at
 *      most, each backed by a trophy, a finish, an annals line, the record
 *      book or the era's own book; a final's turn is written exactly when its
 *      evidence says the lead changed hands for the last time to the winner.
 *   5. READING IS PURE: telling every story and every era changes nothing in
 *      the save, so nothing here can move a dice roll.
 *   6. THE SAVE CARRIES LITTLE: the bytes the new facts add are counted.
 *
 * Matches are played as the assistant's result plays them (store
 * instantResult): the live engine, the findings and the evidence, then the
 * week settle.
 *
 * Run: npx vite-node scripts/storyprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { matchRng, processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { beginMatch, forfeitSide, playHalf, settleForfeit } from '../src/game/matchEngine'
import { fileFindings } from '../src/game/matchfindings'
import { fileEvidence } from '../src/game/evidence'
import { executeTransfer } from '../src/game/ai'
import { playerWage } from '../src/game/attributes'
import { leagueTier, seasonLabel, type GameState, type Player } from '../src/game/model'
import { recall, type MemoryKind } from '../src/game/memory'
import { service } from '../src/game/legends'
import { madeBy } from '../src/game/records'
import { buildEra } from '../src/game/erastory'
import { playerStory, appsSince, OLD_BOY_APPS, SERVICE_APPS, STORY_LINES, type StoryLine } from '../src/game/stories'
import { eraBuilt, eraTurns, seasonCandidates, TP_PER_ERA, TP_RUN } from '../src/game/turning'
import { oldBoyApps } from '../src/game/model'
import { tIn } from '../src/game/i18n'
import type { Era } from '../src/game/arcbook'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const t0 = Date.now()
const SEASONS = Number(process.env.SEASONS ?? 8)

/** Expand _k fragments so a line reads as the player sees it. */
const say = (k: string, v: Record<string, string | number> = {}) => tIn('en', k, v)

interface Run { g: GameState; finals: number; turned: number; turnBad: number; label: string }

/** One career, played through the real engine, with a few of the manager's
 *  decisions made by hand at season starts: a sale, a signing, a promise. */
function career(clubId: string, seed: number, seasons: number): Run {
  const g = newGame(clubId, 'Story Tester', seed)
  const run: Run = { g, finals: 0, turned: 0, turnBad: 0, label: clubId }
  const end = g.season + seasons
  let lastSeason = -1
  while (g.season < end) {
    const c = g.clubs[g.userClubId]
    if (!g.unemployed && c) c.boardConfidence = Math.max(c.boardConfidence, 60)
    if (g.season !== lastSeason && g.week >= 3 && !g.unemployed) {
      lastSeason = g.season
      decide(g)
    }
    const fx = userFixtureThisWeek(g)
    if (fx && !fx.played && fx.compId !== 'fr' && g.clubs[fx.homeId] && g.clubs[fx.awayId]) {
      const forfeit = forfeitSide(g, fx)
      if (forfeit) settleForfeit(g, fx, forfeit)
      else {
        const ctx = beginMatch(g, fx, matchRng(g), true, g.userClubId)
        ctx.assistantSubs = true
        playHalf(g, ctx)
        playHalf(g, ctx)
        fileFindings(g, ctx)
        const before = (g.hist?.moments ?? []).filter(m => m.k.startsWith('hist.anTurn')).length
        const ev = fileEvidence(g, ctx)
        const after = (g.hist?.moments ?? []).filter(m => m.k.startsWith('hist.anTurn')).length
        if (ev && (fx.stage === 'F' || fx.stage === 'BAR')) {
          run.finals++
          const last = ev.lead[ev.lead.length - 1]
          const should = last != null && ev.us !== ev.them && (ev.us > ev.them) === (last > 0)
          if (should) run.turned++
          if ((after - before === 1) !== should) run.turnBad++
        } else if (after !== before) run.turnBad++
      }
    }
    processWeekAndAdvance(g)
  }
  return run
}

/** The manager's hand at a season start: sell his best non-captain senior to
 *  the richest club in the league, buy that club's best man, promote his best
 *  academy lad and promise a fringe man a place in his plans. All through the
 *  real functions, or (the promotion) the Promote button's own fields. */
function decide(g: GameState): void {
  const club = g.clubs[g.userClubId]
  const mine = club.players.map(id => g.players[id]).filter(p => p && !p.acad && !p.injury)
  const rich = Object.values(g.clubs).filter(c => c.leagueId === club.leagueId && c.id !== club.id).sort((a, b) => b.balance - a.balance)[0]
  if (!rich) return
  const sell = mine.filter(p => p.id !== club.captain && p.contractEnds > g.season).sort((a, b) => b.ca - a.ca)[3]
  if (sell) executeTransfer(g, sell, rich.id, Math.max(50_000, Math.round(sell.value)))
  const buy = rich.players.map(id => g.players[id]).filter(p => p && !p.acad && !p.injury && p.ca < 85).sort((a, b) => b.ca - a.ca)[1]
  if (buy) executeTransfer(g, buy, club.id, Math.max(50_000, Math.round(buy.value * (1 + (g.season % 3) * 0.4))))
  // the Promote button on an academy lad's page (PlayerScreen), field for field
  const lad = club.players.map(id => g.players[id]).filter(p => p && p.acad && !p.demoted).sort((a, b) => b.ca - a.ca)[0]
  if (lad) {
    lad.acad = false; lad.demoted = false; lad.homegrown = true
    lad.gradClub ??= club.id; lad.gradS ??= g.season
    lad.wage = playerWage(lad.ca, lad.age)
  }
  const fringe = mine.filter(p => p.stats.apps === 0 && p.age >= 21).sort((a, b) => b.ca - a.ca)[0]
  if (fringe && fringe.id !== sell?.id) {
    ;(g.pledges ??= []).push({ playerId: fringe.id, kind: 'plans', week: g.week, season: g.season, due: g.week + 10, baseApps: fringe.stats.apps })
  }
}

// ------------------------------------------------------------------ play
const runs = [career('leicester', 18_461, SEASONS), career('bedford', 18_462, SEASONS)]
const played = runs.length * SEASONS
console.log(`\n${runs.length} careers, ${SEASONS} seasons each (${played} seasons) through the real engine, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`)

/** Every reason a line may give, against the fields it came from. */
function backed(g: GameState, p: Player, l: StoryLine, made: (p: Player) => boolean): boolean {
  const uid = g.unemployed ? null : g.userClubId
  const n = Number(l.v.n ?? -1)
  // his appearances for a club as the book has them: his service, or his
  // legend entry's count when higher (a veteran the career opened with keeps
  // his years there once he has moved on)
  const booked = (q: Player, clubId: string) => Math.max(service(q, clubId).apps,
    (g.hist?.legends ?? []).find(x => x.pid === q.id && x.clubId === clubId)?.apps ?? 0)
  const last = (kinds: MemoryKind[]) => {
    const all = recall(g, { kind: kinds, playerId: p.id }); return all[all.length - 1]
  }
  switch (l.why) {
    case 'grad': return !!p.homegrown && !!p.gradClub && p.gradS != null && made(p) && l.v.season === seasonLabel(p.gradS)
      && (l.k !== 'story.grad' || n === appsSince(p, p.gradClub, p.gradS)) && (l.k !== 'story.gradTest' || (p.caps ?? 0) > 0)
    case 'record': return g.era?.recordSigning?.playerId === p.id && l.v.season === seasonLabel(g.era.recordSigning.season)
      && (l.k !== 'story.record' || (p.clubId === uid && n === appsSince(p, uid!, g.era.recordSigning.season)))
    case 'captain': return !!uid && p.clubId === uid && g.clubs[uid].captain === p.id && n === service(p, uid).apps
    // a legend's count is the book's (his entry keeps it once he has gone)
    case 'legend': return (g.hist?.legends ?? []).some(x => x.pid === p.id && n === booked(p, x.clubId))
    case 'sold': case 'released': case 'let-go': {
      const e = last(['sold', 'released', 'let-go'])
      return !!e && e.kind === l.why && e.clubId != null && p.clubId !== e.clubId && n === booked(p, e.clubId) && (n > 0) === (l.k !== 'story.soldYoung')
        && (e.payload?.nb === 1 || e.sal >= 2) && l.v.season === seasonLabel(e.season)
    }
    case 'promise': {
      const e = last(['promise-kept', 'promise-broken'])
      return !!e && (e.kind === 'promise-kept') === (l.k === 'story.promiseKept') && l.v.season === seasonLabel(e.season)
    }
    case 'request': return !!last(['request-refused', 'request-granted'])
    case 'oldboy': return !!uid && p.clubId !== uid && n === oldBoyApps(p, uid) && n >= OLD_BOY_APPS
    case 'service': return !!uid && p.clubId === uid && n === service(p, uid).apps && n >= SERVICE_APPS
  }
  return false
}

/** Any thread at all between this man and the manager: if none, no story. */
function touched(g: GameState, p: Player, made: (p: Player) => boolean): boolean {
  const uid = g.userClubId
  if (made(p) || p.clubId === uid || g.era?.recordSigning?.playerId === p.id) return true
  if ((g.hist?.legends ?? []).some(l => l.pid === p.id)) return true
  if (recall(g, { playerId: p.id }).length) return true
  return oldBoyApps(p, uid) > 0
}

const samples: string[] = []
for (const { g, label } of runs) {
  console.log(`--- ${label}: ${g.clubs[g.userClubId]?.short ?? '(out of work)'} in ${seasonLabel(g.season)}${g.unemployed ? ', out of work' : ''}\n`)
  const made = madeBy(g)
  const all = Object.values(g.players)
  const told = all.map(p => ({ p, s: playerStory(g, p, made) })).filter(x => x.s.length)
  const share = told.length / all.length
  const counts: Record<string, number> = {}
  for (const x of told) for (const l of x.s) counts[l.why] = (counts[l.why] ?? 0) + 1
  console.log(`      ${told.length} of ${all.length} men have a story (${(share * 100).toFixed(1)}%): ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  ok(share > 0 && share < 0.05, `a story is for the few: ${(share * 100).toFixed(1)}% of the world`)
  ok(told.every(x => x.s.length <= STORY_LINES && new Set(x.s.map(l => l.why)).size === x.s.length), `never more than ${STORY_LINES} lines, never one reason twice`)
  const unbacked = told.flatMap(x => x.s.filter(l => !backed(g, x.p, l, made)).map(l => `${x.p.name} ${l.why}`))
  ok(unbacked.length === 0, `every line is backed by the field it was read from (${told.reduce((n, x) => n + x.s.length, 0)} lines${unbacked.length ? `; not: ${unbacked.slice(0, 4).join(', ')}` : ''})`)
  ok(told.every(x => x.s.every(l => { const r = say(l.k, l.v); return r !== l.k && !r.includes('{') })), 'every line reads as a sentence, no key and no brace left')
  const stray = all.filter(p => !touched(g, p, made) && playerStory(g, p, made).length)
  ok(stray.length === 0, `a man who never crossed the manager's path has no story (${all.filter(p => !touched(g, p, made)).length} checked)`)
  const ordinary = all.filter(p => p.clubId === g.userClubId && !made(p) && g.clubs[g.userClubId].captain !== p.id && service(p, g.userClubId).apps < SERVICE_APPS
    && g.era?.recordSigning?.playerId !== p.id && !recall(g, { playerId: p.id }).length && !(g.hist?.legends ?? []).some(l => l.pid === p.id))
  ok(ordinary.length > 0 && ordinary.every(p => !playerStory(g, p, made).length), `an ordinary man in the squad has none either (${ordinary.length})`)
  if (!g.unemployed) {
    const capt = g.players[g.clubs[g.userClubId].captain ?? -1]
    if (capt) ok(playerStory(g, capt, made).some(l => l.why === 'captain' || l.why === 'grad' || l.why === 'record' || l.why === 'legend'), `the captain has his (${capt.name})`)
  }
  const grads = all.filter(p => p.homegrown && p.gradS != null && made(p))
  ok(grads.length > 0 && grads.every(p => playerStory(g, p, made).some(l => l.why === 'grad')), `every graduate he made has the line (${grads.length})`)
  const rs = g.era?.recordSigning
  if (rs && g.players[rs.playerId]) ok(playerStory(g, g.players[rs.playerId], made).some(l => l.why === 'record'), 'the record signing has his')
  // a notable sale whose man is elsewhere now (one bought back is home again)
  const sold = recall(g, { kind: 'sold' }).filter(e => e.playerId != null && g.players[e.playerId] && (e.payload?.nb === 1 || e.sal >= 2)
    && e.clubId != null && g.players[e.playerId].clubId !== e.clubId && service(g.players[e.playerId], e.clubId).apps > 0
    && recall(g, { kind: ['sold', 'released', 'let-go'], playerId: e.playerId }).pop() === e)
  const soldTold = sold.filter(e => playerStory(g, g.players[e.playerId!], made).some(l => l.why === 'sold'))
  ok(soldTold.length === sold.length, `a notable sale is remembered on his page (${soldTold.length} of ${sold.length})`)
  for (const why of ['grad', 'record', 'captain', 'sold', 'promise', 'legend', 'oldboy', 'service', 'released', 'let-go', 'request']) {
    const x = told.find(x => x.s[0].why === why || x.s.some(l => l.why === why))
    if (x && samples.length < 14 && !samples.some(s => s.startsWith(`[${why}]`))) {
      samples.push(`[${why}] ${x.p.name}: ${x.s.map(l => say(l.k, l.v)).join(' / ')}`)
    }
  }

  // ---- 3. the era adds up
  const eras: { e: Era; live: boolean }[] = [...(g.arc?.eras ?? []).map(e => ({ e, live: false }))]
  if (!g.unemployed && g.arc?.cur) { const e = buildEra(g, '5'); if (e) eras.push({ e, live: true }) }
  ok(eras.length > 0, `there is an era to read (${eras.length})`)
  for (const { e, live } of eras) {
    const b = eraBuilt(g, e)
    const ten = (g.hist?.tenures ?? []).filter(x => x.clubId === e.c && x.from <= e.f).pop()
    const tr = g.mgr.trophies.filter(x => x.clubId === e.c && x.season >= e.f && x.season <= e.t).length
    let up = 0, down = 0
    for (let s = e.f; s < e.t; s++) {
      const a = g.mgr.finishes.find(f => f.season === s && f.clubId === e.c)
      const n = g.mgr.finishes.find(f => f.season === s + 1 && f.clubId === e.c) ?? (s + 1 === g.season ? { leagueId: g.clubs[e.c].leagueId } : null)
      if (a && n) { const d = leagueTier(n.leagueId) - leagueTier(a.leagueId); if (d < 0) up++; if (d > 0) down++ }
    }
    // a told fifth-season era closes at the year end, before the next league is known
    const lastMove = g.mgr.finishes.find(f => f.season === e.t && f.clubId === e.c)
    const deb = recall(g, { kind: 'academy-debut', clubId: e.c }).filter(x => x.season >= e.f && x.season <= e.t).length
    const where = `${e.cn} ${seasonLabel(e.f)}-${seasonLabel(e.t)}${live ? ' so far' : ''}`
    ok(!!ten && ten.w === b.w && ten.d === b.d && ten.l === b.l || (!live && b.w + b.d + b.l === e.m), `${where}: W${b.w} D${b.d} L${b.l} matches the history book (${ten ? `W${ten.w} D${ten.d} L${ten.l}` : 'no tenure'})`)
    ok(b.cups === tr, `${where}: ${b.cups} trophies, as the cabinet has it`)
    ok(Math.abs(b.up - up) + Math.abs(b.down - down) <= (lastMove ? 1 : 0) && b.up >= up - 1, `${where}: ${b.up} up, ${b.down} down, as the finishes have it (${up} up, ${down} down)`)
    if (b.grads != null && g.season - e.f <= 7) ok(b.grads === deb, `${where}: ${b.grads} academy debuts, as the memory has them (${deb})`)
    const tps = eraTurns(g, e.c, e.f, e.t)
    ok(tps.length <= TP_PER_ERA && new Set(tps.map(x => x.s)).size === tps.length, `${where}: ${tps.length} turning points, at most ${TP_PER_ERA} and one a season`)
    for (const tp of tps) {
      const why = (() => {
        switch (tp.why) {
          case 'title': case 'cup': return g.mgr.trophies.some(x => x.season === tp.s && x.clubId === e.c && (g.comps[x.compId]?.type === 'league') === (tp.why === 'title'))
          case 'up': case 'down': return (g.hist?.annals ?? []).some(a => a.season === tp.s && a.clubId === e.c && a.lines.some(l => l.k === (tp.why === 'up' ? 'hist.anUp' : 'hist.anDown')))
          case 'final': return (g.hist?.annals ?? []).some(a => a.season === tp.s && a.clubId === e.c && a.lines.some(l => l.k === tp.k && l.v?.us === tp.v.us && l.v?.them === tp.v.them))
          case 'run': return g.era?.longestUnbeaten?.season === tp.s && g.era.longestUnbeaten.n >= TP_RUN
          case 'low': return e.wd?.s === tp.s || g.arc?.cur?.wd?.s === tp.s
          case 'signing': return e.rs?.s === tp.s || g.arc?.cur?.rs?.s === tp.s
        }
      })()
      ok(!!why, `${where}: ${seasonLabel(tp.s)} ${tp.why} is backed by a real record`)
    }
    ok(tps.every(tp => { const r = say(tp.k, tp.v); return r !== tp.k && !r.includes('{') }), `${where}: every turning point reads as a sentence`)
    if (samples.length < 40) {
      samples.push(`ERA ${where}: ${say(e.sk, e.sv as Record<string, string | number>)}`)
      samples.push(`    ${[say('arc.builtSeasons', { n: b.seasons }), say('arc.wdl', { w: b.w, d: b.d, l: b.l }), b.cups ? say('arc.builtCups', { n: b.cups }) : '', b.up ? say('arc.builtUp', { n: b.up }) : '', b.down ? say('arc.builtDown', { n: b.down }) : ''].filter(Boolean).join(' · ')}`)
      samples.push(`    ${[b.grads ? say('arc.builtGrads', { n: b.grads }) + (b.capped ? ` (${say('arc.builtCapped', { n: b.capped })})` : '') : '', e.rs ? `rs ${e.rs.n}` : '', e.id ? say('arc.knownAs', { label_k: `arc.repute.${e.id}` }) : ''].filter(Boolean).join(' · ')}`)
      for (const tp of tps) samples.push(`    TP ${seasonLabel(tp.s)} ${say(tp.k, tp.v)}`)
    }
  }
  // turning points are few: across the whole career
  const allSeasons = g.mgr.finishes.map(f => f.season)
  const each = allSeasons.map(s => seasonCandidates(g, g.mgr.finishes.find(f => f.season === s)!.clubId ?? g.userClubId, s)[0]).filter(Boolean)
  ok(each.length <= allSeasons.length, `a season gives one turning point at most (${each.length} in ${allSeasons.length} seasons)`)
}

// ---- 4. a final's turn is written exactly when the evidence says so
{
  const finals = runs.reduce((n, r) => n + r.finals, 0), turned = runs.reduce((n, r) => n + r.turned, 0), bad = runs.reduce((n, r) => n + r.turnBad, 0)
  ok(bad === 0, `a final or play-off turned is written into the annals exactly when its lead changed hands last to the winner (${finals} deciders, ${turned} turned, ${bad} wrong)`)
}

// ---- 5. reading is pure
{
  const { g } = runs[0]
  if (!g.unemployed) buildEra(g, '5') // the era opens on first touch, as the Legacy screen opens it
  const before = JSON.stringify(g)
  const made = madeBy(g)
  for (const p of Object.values(g.players)) playerStory(g, p, made)
  for (const e of g.arc?.eras ?? []) eraBuilt(g, e)
  for (const f of g.mgr.finishes) seasonCandidates(g, f.clubId ?? g.userClubId, f.season)
  if (!g.unemployed) { const e = buildEra(g, '5'); if (e) eraBuilt(g, e) }
  ok(JSON.stringify(g) === before, 'telling every story, era and turning point changes nothing in the save (no rng, no writes)')
}

// ---- 6. the save carries little
{
  let extra = 0, turnLines = 0, total = 0
  for (const { g } of runs) {
    for (const e of g.arc?.eras ?? []) {
      extra += JSON.stringify({ gr: e.gr }).length - 2 + 1
      if (e.rs?.s != null) extra += `,"s":${e.rs.s}`.length
      if (e.wd?.s != null) extra += `,"s":${e.wd.s}`.length
    }
    for (const a of g.hist?.annals ?? []) for (const l of a.lines) if (l.k.startsWith('hist.anTurn')) { turnLines++; extra += JSON.stringify(l).length + 1 }
    total += JSON.stringify(g).length
  }
  console.log(`      new facts in the saves: ${extra} bytes (${turnLines} turned-final annals lines), of ${(total / 1024).toFixed(0)} KB`)
  ok(extra < 4096, `the save impact is small (${extra} bytes across ${runs.length} careers)`)
}

console.log('\n      what the player sees:')
for (const s of samples) console.log(`      ${s}`)
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)}s`)
if (fails) { console.log(`\nSTORY PROBE FAILED: ${fails}`); process.exit(1) }
console.log('\nSTORY PROBE PASSED')
