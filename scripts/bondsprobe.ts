/**
 * ---- THE SQUAD AS A SOCIAL ECOSYSTEM (bonds.ts) ----
 *
 * Owner's brief (Living Squad): friendships, rivalries for a shirt, cliques and
 * a hierarchy of senior voices, with consequences. This holds the rule:
 *
 *   1. the ledger is seeded on the first weekly pass, from what the save
 *      already knows, and nothing that was already true is announced
 *   2. it moves with events: a shirt lost, a friend sold, the armband changing
 *      hands, a partnership, a feud; a rift is a story and a Club-screen feud
 *   3. selling a close friend costs his mates a bounded amount, and the office
 *      knock that follows is settled by who he is (talkback.ts)
 *   4. a group shut out of the team sheets closes ranks, and says so
 *   5. it stays capped and small, every season, and never touches AI clubs
 *   6. old and damaged saves load: no ledger, a broken one, a good one
 *   7. consequences stay inside their bounds over simulated seasons: per-man
 *      weekly morale moves, stories filed, the engine's cohesion term
 *   8. every line it prints exists in all six languages, no raw keys
 *   9. the weekly pass is cheap
 *
 * Run: npx vite-node scripts/bondsprobe.ts
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress, OFFICE_OUTLET } from '../src/game/media'
import { migrate } from '../src/game/save'
import { activeFeuds } from '../src/game/gossip'
import { FIT } from '../src/game/talkback'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import {
  CLOSE, MAX_PAIRS, RIFT, bondCohesion, bondOf, bondsLine, bondsReport, bondsWeek, flushBondNews,
  groupsOf, migrateBonds, seedBonds, seniorVoices, type BondState,
} from '../src/game/bonds'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const squad = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)

/** One week of a career, answering anything the office raised. */
function week(g: GameState) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), false)
  processWeekAndAdvance(g)
  for (const q of g.press) if (!q.answered && q.options.length) answerPress(g, q.id, 0)
}

const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
for (const l of LANGS) await ensureLang(l)
/** One weekly pass and the end-of-settle flush that files its held stories. */
function pass(g: GameState) { bondsWeek(g); flushBondNews(g) }
const raw = (s: string) => /\{\w+\}|\b(news|bonds|talk|player)\.[a-zA-Z]/.test(s)

// ------------------------------------------------------------------ 1
console.log('--- 1. seeded on the first weekly pass, and quietly')
const fresh = newGame('leicester', 'Bonds Probe', 181)
ok(fresh.bonds === undefined, 'newGame writes no ledger (the world and the fingerprint are untouched)')
const g = clone(fresh)
const newsBefore = g.news.length
week(g)
const bs0 = g.bonds as BondState
ok(!!bs0 && bs0.club === g.userClubId, `the first week seeds a ledger for the user club (${bs0?.pairs.length} pairs)`)
ok(bs0.pairs.length >= 5 && bs0.pairs.length <= MAX_PAIRS, 'the seed is sparse but not empty')
const club = g.clubs[g.userClubId]
const compat = bs0.pairs.filter(p => g.players[p[0]]?.nat === g.players[p[1]]?.nat && g.players[p[0]]?.nat !== club.country)
ok(compat.length > 0, `compatriots abroad find each other (${compat.length} pairs)`)
ok(bs0.pairs.every(p => p[0] < p[1] && Math.abs(p[2]) <= 100), 'every pair is ordered and in range')
ok(bs0.pairs.every(p => (p[2] >= CLOSE ? (p[3] & 2) : true) && (p[2] <= RIFT ? (p[3] & 1) : true)), 'what was already true at the seed is marked, not announced')
ok(!g.news.slice(newsBefore).some(n => n.k?.startsWith('news.bond')), 'no bond story on the seeding week')
const again = seedBonds(clone(fresh))
const again2 = seedBonds(clone(fresh))
ok(JSON.stringify(again.pairs) === JSON.stringify(again2.pairs), 'the seed is deterministic')
const voices = seniorVoices(g)
ok(voices.length >= 2 && voices.length <= 4, `two to four senior voices (${voices.map(v => v.name).join(', ')})`)
ok(voices.some(v => v.id === club.captain), 'the captain is one of them')

// ------------------------------------------------------------------ 2
console.log('--- 2. it moves with events')
// a) a shirt lost: put a fit man of the same position into last week's XV
{
  const h = clone(g)
  let w = 0
  while (!userFixtureThisWeek(h) && w++ < 6) week(h)
  const fx = userFixtureThisWeek(h)!
  simMatch(h, fx, weekRng(h), false)
  const c = h.clubs[h.userClubId]
  const xv = c.tactic.lineup.slice(0, 15)
  const in23 = new Set(c.tactic.lineup.slice(0, 23))
  let slot = -1, A: Player | undefined
  for (let i = 0; i < 15 && !A; i++) {
    const B = h.players[xv[i]!]
    A = squad(h).find(p => p.pos === B.pos && !in23.has(p.id) && !p.injury && p.bans === 0 && !p.natSquad && !p.onLoan)
    if (A) slot = i
  }
  if (A) {
    const B = h.players[xv[slot]!]
    A.pers = 'Temperamental'
    const was = A.morale
    const before = bondOf(h, A.id, B.id)
    h.bonds!.xv = [...xv]; h.bonds!.xv[slot] = A.id
    pass(h)
    ok(bondOf(h, A.id, B.id) < before, `${A.name} lost the ${B.pos} shirt to ${B.name}: the pair cools (${before} -> ${bondOf(h, A.id, B.id)})`)
    ok(A.morale < was && was - A.morale <= 0.5, `a temperamental man sulks, a little (${was.toFixed(2)} -> ${A.morale.toFixed(2)})`)
    const h2 = clone(h)
    const A2 = h2.players[A.id]
    A2.pers = 'Professional'
    const was2 = A2.morale
    h2.bonds!.xv = [...xv]; h2.bonds!.xv[slot] = A.id
    pass(h2)
    ok(A2.morale >= was2 - 0.1, `a professional pushes harder instead (${was2.toFixed(2)} -> ${A2.morale.toFixed(2)})`)
  } else ok(false, 'found a man to drop')
}

// b) a close friend sold
{
  const h = clone(g)
  const bs = h.bonds!
  const men = squad(h).filter(p => !p.onLoan)
  const [F, M] = [men[3], men[7]]
  bs.pairs = bs.pairs.filter(p => !(p.includes(F.id) && p.includes(M.id)))
  bs.pairs.push([Math.min(F.id, M.id), Math.max(F.id, M.id), 85, 2])
  F.pers = 'Loyal'
  F.morale = 7
  // the sale, as the transfer executor leaves it
  const to = Object.values(h.clubs).find(c => c.id !== h.userClubId)!
  const c = h.clubs[h.userClubId]
  c.players = c.players.filter(id => id !== M.id)
  c.tactic.lineup = c.tactic.lineup.map(id => (id === M.id ? null : id))
  to.players.push(M.id)
  M.clubId = to.id
  h.press = h.press.map(q => ({ ...q, answered: true }))
  const newsN = h.news.length, pressN = h.press.length, nextSale = h.nextId
  pass(h)
  ok(F.morale < 7 && 7 - F.morale <= 0.9, `a loyal friend takes the sale hard, within bounds (7 -> ${F.morale.toFixed(2)})`)
  ok(!h.bonds!.pairs.some(p => p.includes(M.id)), 'the departed man leaves the ledger')
  ok(h.memory!.entries.some(e => e.kind === 'mate-left' && e.playerId === F.id), 'the career memory remembers who took it hard')
  ok(h.nextId === nextSale, 'the sale\'s story and knock take no id from the fixtures\' counter')
  const knock = h.press.slice(pressN).find(q => q.topic === 'mate')
  const story = h.news.slice(newsN).find(n => n.k === 'news.bondMateGone')
  ok(!!knock || !!story, `the dressing room says so: ${knock ? 'a knock at the office' : 'an inbox story'}`)
  if (knock) {
    ok(knock.outlet === OFFICE_OUTLET && knock.playerId === F.id && knock.options.length === 3, '"you sold my mate" is an office conversation with three answers')
    const was = F.morale
    answerPress(h, knock.id, 0)
    ok(!!knock.fit && knock.rk?.startsWith('talk.mateSorry'), `settled by who he is (${knock.fit}: ${knock.rk})`)
    ok(Math.abs(F.morale - was) <= 2, 'and the answer moves him a bounded amount')
    for (const l of LANGS) ok(!raw(tIn(l, knock.qk!, knock.qv)) && !raw(tIn(l, knock.rk!, knock.rv)), `the knock reads in ${l}`)
  }
  if (story) for (const l of LANGS) ok(!raw(tIn(l, story.k!, story.v)), `the story reads in ${l}`)
}

// c) the armband changes hands
{
  const h = clone(g)
  const c = h.clubs[h.userClubId]
  const old = h.players[c.captain!]
  old.pers = 'Leader'
  const nu = squad(h).find(p => p.id !== old.id && !p.onLoan)!
  c.captain = nu.id
  const before = bondOf(h, old.id, nu.id)
  pass(h)
  ok(bondOf(h, old.id, nu.id) < before, `a leader who loses the armband cools on his successor (${before} -> ${bondOf(h, old.id, nu.id)})`)
  ok(h.bonds!.cap === nu.id, 'and the ledger remembers the new captain')
}

// d) a rift that crosses the line is a story and a Club-screen feud
{
  const h = clone(g)
  const [a, b] = squad(h).filter(p => !p.onLoan).slice(10, 12)
  h.bonds!.pairs = h.bonds!.pairs.filter(p => !(p.includes(a.id) && p.includes(b.id)))
  h.bonds!.pairs.push([Math.min(a.id, b.id), Math.max(a.id, b.id), -55, 0])
  ;(h as GameState & { feuds?: unknown[] }).feuds = []
  const n = h.news.length
  const nextBefore = h.nextId
  pass(h)
  const s = h.news.slice(n).find(x => x.k === 'news.bondRift')
  ok(!!s, 'a new rift files one Wire story')
  ok(!!s && s.id !== Math.floor(s.id) && h.nextId === nextBefore, 'on a fractional id, without advancing the counter the fixtures draw from')
  ok(activeFeuds(h).length === 0, 'and opens no gossip feud (those settle on the shared weekly stream)')
  ok(h.memory!.entries.some(e => e.kind === 'rift' && e.playerId === a.id), 'the career memory remembers the rift')
  if (s) for (const l of LANGS) ok(!raw(tIn(l, s.k!, s.v)) && !raw(tIn(l, s.k! + 'Subj', s.v)), `the rift reads in ${l}`)
  const n2 = h.news.length
  pass(h)
  ok(!h.news.slice(n2).some(x => x.k === 'news.bondRift'), 'and is not announced twice')
  // a Wire feud between the pair, then peace brokered: the rift heals to a coolness
  ;(h as GameState & { feuds?: unknown[] }).feuds = [{ a: a.id, b: b.id, week: h.week }]
  pass(h)
  ;(h as GameState & { feuds?: unknown[] }).feuds = []
  pass(h)
  ok(bondOf(h, a.id, b.id) > RIFT, `a Wire feud that ends heals the rift (${bondOf(h, a.id, b.id)})`)
}

// e) a clique: the senior pros shut out of the team sheets
{
  const h = clone(g)
  while (h.week < 12) week(h)
  const c = h.clubs[h.userClubId]
  const men = squad(h).filter(p => !p.onLoan)
  const top = new Set([...men].sort((x, y) => y.ca - x.ca).slice(0, Math.ceil(men.length * 0.6)).map(p => p.id))
  // make four good men into a group of veterans who never play
  const vets = men.filter(p => top.has(p.id)).slice(0, 4)
  for (const p of men) { if (p.age >= 30) p.age = 29; p.stats.apps = Math.max(p.stats.apps, 6); p.avail = 8 }
  for (const p of vets) { p.age = 31; p.stats.apps = 0; p.stats.starts = 0; p.morale = 7 }
  c.tactic.lineup = c.tactic.lineup.map(id => (vets.some(v => v.id === id) ? null : id))
  while (h.week % 6 !== 0) h.week++
  h.bonds!.cl = []
  const n = h.news.length
  pass(h)
  const s = h.news.slice(n).find(x => x.k === 'news.bondClique')
  ok(!!s && h.bonds!.cl.some(x => x.g === 'vets'), 'a group shut out of the team sheets closes ranks, and the Wire says so')
  if (s) for (const l of LANGS) ok(!raw(tIn(l, s.k!, s.v)), `the clique reads in ${l}`)
  const was = vets.map(p => p.morale)
  h.week++
  pass(h)
  ok(vets.every((p, i) => p.morale <= was[i] && was[i] - p.morale <= 0.2), 'the clique sours its members, gently')
  // play them and it breaks up
  for (const p of vets) { p.stats.apps = 8 }
  while (h.week % 6 !== 0) h.week++
  const n2 = h.news.length
  pass(h)
  ok(!h.bonds!.cl.some(x => x.g === 'vets'), 'minutes given, the clique dissolves')
  const e = h.news.slice(n2).find(x => x.k === 'news.bondCliqueEnds')
  ok(!!e, 'and that is a story too')
  if (e) for (const l of LANGS) ok(!raw(tIn(l, e.k!, e.v)), `the clique ending reads in ${l}`)
  ok(groupsOf(c, vets[0]).includes('vets'), 'groups are derived from the man, not stored')
}

// f) the profile line
{
  const bs = g.bonds!
  const v = seniorVoices(g)[0]
  ok(!!bondsLine(g, v)?.voice, `the profile names ${v.name} as a senior voice`)
  const pr = [...bs.pairs].sort((a, b) => b[2] - a[2])[0]
  const p = g.players[pr[0]]
  const line = bondsLine(g, p)
  ok(pr[2] < CLOSE || (!!line && line.close.some(x => x.id === pr[1])), `the profile says who ${p.name} is close to`)
  const other = Object.values(g.players).find(x => x.clubId && x.clubId !== g.userClubId)!
  ok(bondsLine(g, other) === null, 'and nothing about another club\'s man')
}

// ------------------------------------------------------------------ 5 + 7
console.log('--- 5 + 7. capped, small and bounded over simulated seasons')
{
  const h = clone(fresh)
  let maxPairs = 0, maxBytes = 0, maxDelta = 0, stories = 0, maxMs = 0, sumMs = 0, calls = 0, idsSpent = 0
  let cohMin = 1, cohMax = 1, cohSum = 0, cohN = 0
  const seasons0 = h.season
  let weeks = 0
  while (h.season < seasons0 + 2 && weeks++ < 200) {
    const fx = userFixtureThisWeek(h)
    if (fx) {
      const c = h.clubs[h.userClubId]
      const f = bondCohesion(h, c.id, c.tactic.lineup)
      cohMin = Math.min(cohMin, f); cohMax = Math.max(cohMax, f); cohSum += f; cohN++
    }
    week(h)
    if (bondsReport.week >= 0) {
      maxDelta = Math.max(maxDelta, bondsReport.maxDelta)
      stories += bondsReport.stories
      idsSpent += bondsReport.ids
      maxMs = Math.max(maxMs, bondsReport.ms); sumMs += bondsReport.ms; calls++
    }
    if (h.bonds) {
      maxPairs = Math.max(maxPairs, h.bonds.pairs.length)
      maxBytes = Math.max(maxBytes, JSON.stringify(h.bonds).length)
    }
  }
  const aiLedger = Object.values(h.clubs).every(c => c.id === h.userClubId || bondCohesion(h, c.id, c.tactic.lineup) === 1)
  console.log(`      two seasons: max pairs ${maxPairs}, max ${maxBytes} bytes, max weekly morale move ${maxDelta.toFixed(2)}, ${stories} stories, cohesion ${cohMin.toFixed(4)}..${cohMax.toFixed(4)} (mean ${(cohSum / Math.max(1, cohN)).toFixed(4)}), pass ${(sumMs / Math.max(1, calls)).toFixed(2)}ms mean / ${maxMs.toFixed(1)}ms max`)
  ok(maxPairs <= MAX_PAIRS, `never more than ${MAX_PAIRS} pairs`)
  ok(idsSpent === 0, `the ledger, its stories and its knocks spend no id from the counter fixtures draw from (${idsSpent} in two seasons)`)
  ok(maxBytes < 2500, 'the ledger stays under 2.5KB in the save')
  ok(maxDelta <= 1.0, 'no man moves more than a point of morale in a week because of it')
  ok(stories >= 1 && stories <= 40, 'it has something to say, and does not flood the inbox (1-40 stories in two seasons)')
  ok(cohMin >= 0.994 && cohMax <= 1.006, 'the cohesion term stays inside 0.6% either way')
  ok(aiLedger, 'no AI club has a ledger or a cohesion term')
  const strays = (h.bonds?.pairs ?? []).filter(p => !h.clubs[h.userClubId].players.includes(p[0]) || !h.clubs[h.userClubId].players.includes(p[1]))
  // the summer's departures happen after the last pass; the next one settles them
  if (strays.length) console.log(`      ${strays.length} pairs wait on the next pass after the summer's departures`)
  bondsWeek(h)
  ok(!!h.bonds && h.bonds.pairs.every(p => h.clubs[h.userClubId].players.includes(p[0]) && h.clubs[h.userClubId].players.includes(p[1])), 'after a weekly pass, every pair is two men still on the books')
  // ------------------------------------------------------------------ 9
  console.log('--- 9. cheap')
  // the in-career timings above share the box with everything else; the
  // budget is held on a repeated pass over one mid-career week, by median
  const times: number[] = []
  for (let i = 0; i < 41; i++) {
    const k = clone(h)
    const t0 = performance.now(); bondsWeek(k); times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  const seedT: number[] = []
  for (let i = 0; i < 11; i++) { const k = clone(fresh); const t0 = performance.now(); seedBonds(k); seedT.push(performance.now() - t0) }
  seedT.sort((a, b) => a - b)
  console.log(`      repeated pass: median ${times[20].toFixed(2)}ms, seeding median ${seedT[5].toFixed(2)}ms`)
  ok(times[20] < 5, 'the weekly pass takes under 5ms (median)')
  ok(seedT[5] < 20, 'seeding the ledger takes under 20ms (median)')
  void sumMs; void calls; void maxMs
}

// ------------------------------------------------------------------ 6
console.log('--- 6. old and damaged saves')
{
  const old = clone(g)
  delete old.bonds
  const m = migrate(old)
  ok(m.bonds === undefined, 'a save from before the ledger loads without one')
  week(m)
  ok(!!m.bonds && m.bonds.pairs.length > 0, 'and seeds one on its first week')
  const bad = clone(g) as GameState & { bonds: unknown }
  bad.bonds = { club: g.userClubId, pairs: [[1, 1, 5, 0], [3, 2, NaN, 0], 'x', [4, 9, 400, 7], null], sq: 'no', xv: [1, 'a'], cap: 'x', cl: [{ g: 'vets', at: 'no' }], fe: [1] }
  const mb = migrate(bad as GameState)
  ok(!!mb.bonds && mb.bonds.pairs.length === 1 && mb.bonds.pairs[0][2] === 100 && mb.bonds.pairs[0][3] === 3, 'a damaged ledger is cleaned, not fatal')
  ok(Array.isArray(mb.bonds!.sq) && mb.bonds!.cap === null && mb.bonds!.cl.length === 0 && mb.bonds!.fe.length === 0, 'every field comes back the right shape')
  const junk = clone(g) as GameState & { bonds: unknown }
  junk.bonds = 'corrupt'
  ok(migrate(junk as GameState).bonds === undefined, 'a ledger that is not an object is dropped and reseeded')
  const good = migrateBonds(clone(g.bonds))
  ok(JSON.stringify(good) === JSON.stringify(g.bonds), 'a good ledger round-trips exactly')
  // a new job starts a new ledger
  const moved = clone(g)
  const other = Object.keys(moved.clubs).find(id => id !== moved.userClubId)!
  moved.userClubId = other
  bondsWeek(moved)
  ok(moved.bonds!.club === other, 'a manager who changes clubs starts a new ledger there')
}

// ------------------------------------------------------------------ 8
console.log('--- 8. every line in six languages')
{
  for (const [tag, fits] of Object.entries(FIT.mate)) {
    const Tag = tag[0].toUpperCase() + tag.slice(1)
    for (const l of LANGS) {
      const v = { player: 'A. Player', mate: 'B. Mate' }
      ok([`talk.mate${Tag}`, ...['Good', 'Mixed', 'Bad'].map(f => `talk.mate${Tag}${f}`)].every(k => !raw(tIn(l, k, v))), `talk.mate${Tag} and its replies in ${l}`)
    }
    ok(Object.keys(fits).length === 6, `talk.mate${Tag} has a fit for all six characters`)
  }
  for (const l of LANGS) {
    ok(['bonds.gHome', 'bonds.gVets', 'bonds.gYoung'].every(k => !raw(tIn(l, 'news.bondClique', { group_k: k, names_l: '[]', n: 3 }))), `every clique group reads in ${l}`)
    ok(!raw(tIn(l, 'news.bondClique', { group_k: 'bonds.gNat', nation_k: 'nation.TGA', names_l: '[]', n: 3 })), `a national clique reads in ${l}`)
    ok(['player.bondsLabel', 'player.bondsVoice'].every(k => !raw(tIn(l, k))) && !raw(tIn(l, 'player.bondsClose', { names: 'X' })) && !raw(tIn(l, 'player.bondsClash', { names: 'Y' })), `the profile lines read in ${l}`)
  }
}

// ------------------------------------------------------------------ 10
console.log('--- 10. the rest of the world does not notice')
/** Which settle an id-ledger row belongs to: its label is w<season>.<week>. */
function weekIndex(t: { weeks: string[]; weekLabels?: string[] }, row: string): number {
  const lab = row.split(':')[0]
  const i = (t.weekLabels ?? []).indexOf(lab)
  return i < 0 ? 0 : i
}
{
  // Twin careers from one seed, a season and a half each (scripts/lib/
  // bondstwin.ts): the ledger live in one, switched off in the other. Every
  // AI-v-AI fixture must carry the same id and the same score, week by week.
  // Each twin is its own process: two careers in one process drift apart even
  // with the ledger off in both, which a third run shows (the control).
  const dir = mkdtempSync(join(tmpdir(), 'bondstwin-'))
  const twin = (mode: string, tag: string) => {
    const f = join(dir, `${tag}.json`)
    execFileSync('npx', ['vite-node', 'scripts/lib/bondstwin.ts', mode, f], { stdio: 'ignore', timeout: 1_200_000 })
    return JSON.parse(readFileSync(f, 'utf8')) as { weeks: string[]; list: string; pairs: number; stories: number }
  }
  type Twin = { weeks: string[]; weekLabels: string[]; list: string; pairs: number; stories: number; ids: string[] }
  const A = twin('on', 'on') as Twin, B = twin('off', 'off') as Twin, C = twin('off', 'control') as Twin
  const diff = A.weeks.findIndex((w, i) => w !== B.weeks[i])
  const results = A.weeks[A.weeks.length - 1]?.split('|').length ?? 0
  // THE ONE HONEST EXCEPTION. The ledger moves the user club's morale, and two
  // existing systems read morale and file a story on a WHOLE id mid-settle
  // (gametime.ts transfer requests, authority.ts discipline incidents). Once
  // one of those fires in one world and not the other, every later fixture id
  // shifts by one and the dice move with it: the same thing happens when the
  // manager praises a player. So the AI's results must be identical up to the
  // first week the two worlds' id ledgers differ, and that difference must be
  // one of those existing stories, never the ledger's own.
  const idDiff = A.ids.findIndex((w, i) => w !== B.ids[i])
  const at = (t: Twin) => (idDiff >= 0 ? t.ids[idDiff] : '')
  const week = (row: string) => row.split(':')[0]
  const cause = idDiff >= 0 ? `${at(B).slice(0, 160)} | ${at(A).slice(0, 160)}` : ''
  console.log(`      ${A.weeks.length} weeks, ${results} AI results on the books; ledger on: ${A.pairs} pairs, ${A.stories} stories`)
  console.log(`      AI results first differ at week ${diff < 0 ? 'never' : diff + 1}; the id ledgers first differ ${idDiff < 0 ? 'never' : `at ${week(at(A))}`}${cause ? `: off ${cause}` : ''}`)
  ok(B.weeks.join() === C.weeks.join() && B.ids.join() === C.ids.join(), 'control: two runs with the ledger off agree with each other')
  ok(A.pairs > 0 && B.pairs === 0, 'one twin kept a ledger, the other none')
  ok(A.weeks.length > 60 && A.weeks.length === B.weeks.length, 'both twins played a season and a half')
  // the id row's label names the settle it happened in
  const firstIdWeekIdx = idDiff < 0 ? A.weeks.length : weekIndex(A, at(A))
  ok(diff < 0 || diff >= firstIdWeekIdx, `every AI-v-AI result matched, id and score, until the id ledgers parted (${diff < 0 ? 'all' : diff} of ${A.weeks.length} weeks identical)`)
  const ownStory = /news\.bond|talk\.mate|\bmate\b/
  ok(idDiff < 0 || (!ownStory.test(at(A)) && !ownStory.test(at(B))), 'and what parted them was an existing morale-driven story, not one of the ledger\'s own')
  if (diff < 0) ok(A.list === B.list, 'the AI fixture list the two worlds hold is id for id the same')
  rmSync(dir, { recursive: true, force: true })
}

console.log(fails ? `BONDS PROBE FAILED (${fails})` : 'BONDS PROBE PASSED: seeded quietly, moved by events, capped, bounded, migrated and in six languages')
process.exit(fails ? 1 : 0)
