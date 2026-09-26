/**
 * ---- PLAYERS WHO TALK BACK (talkback.ts) ----
 *
 * Owner, 26 Sep 2026: "deeper career - do this", and four new reasons to
 * knock: a dropped senior, the captain on a signing, a leader who wants the
 * armband, a player who wants a new position. This holds the rule:
 *
 *   1. who he is decides how an answer lands: every answer is read against all
 *      six personalities, and in every conversation the answer you choose
 *      changes how it goes
 *   2. the same man given the same answer takes it the same way, every time
 *   3. a senior voice carries it into the room; the captain speaks for the
 *      room; the armband really moves
 *   4. each new knock comes when its reason exists and not otherwise, one at a
 *      time, and the same man does not come back about it next week
 *   5. every line it can print exists in all six languages, with the same holes
 *   6. an office conversation saved before 1.7.3 answers exactly as it did
 *
 * Run: npx vite-node scripts/talkprobe.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress, OFFICE_OUTLET } from '../src/game/media'
import { FIT, fitFor, talkbackWeek } from '../src/game/talkback'
import type { GameState, Personality, Player, PressItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const PERS: Personality[] = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader']
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

/** A career ten weeks in: stats, starts and a table exist. */
function tenWeeksIn(seed = 71): GameState {
  const g = newGame('leicester', 'Talk Probe', seed)
  while (g.week < 10) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    processWeekAndAdvance(g)
    // the probe answers anything the week raised, so the office stays free
    for (const q of g.press) if (!q.answered && q.options.length) answerPress(g, q.id, q.options.length - 1)
  }
  return g
}
const squad = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)

/** A hand-made office conversation, as talkbackWeek would build one. */
function item(g: GameState, topic: PressItem['topic'], p: Player, tags: string[], qv: Record<string, string | number> = {}): PressItem {
  const it: PressItem = {
    id: g.nextId++, week: g.week, season: g.season, outlet: OFFICE_OUTLET,
    question: '', qk: `talk.${topic}Q1`, qv: { player: p.name, ...qv }, playerId: p.id, answered: false, topic,
    options: tags.map(tb => ({ label: tb, lk: `talk.${topic}${tb[0].toUpperCase()}${tb.slice(1)}`, reaction: '', morale: 0, board: 0, tb })),
  }
  g.press.push(it)
  return it
}

console.log('--- 1. who he is decides it')
{
  let full = true, divides = 0
  for (const [topic, answers] of Object.entries(FIT)) {
    for (const [tag, row] of Object.entries(answers)) if (PERS.some(p => !row[p])) full = false
    // some answer in this conversation is taken differently by different men
    if (Object.values(answers).some(row => new Set(PERS.map(p => row[p])).size > 1)) divides++
    // and the answer chosen matters: for every man, two answers land differently
    const matters = PERS.every(p => new Set(Object.values(answers).map(row => row[p])).size > 1)
    ok(matters, `${topic}: for every personality, what you say changes how it lands`)
  }
  ok(full, 'every answer is read against all six personalities')
  ok(divides === Object.keys(FIT).length, `in every conversation the same answer lands differently on different men (${divides}/${Object.keys(FIT).length})`)

  const g = tenWeeksIn()
  const p = squad(g).find(q => q.id !== g.clubs[g.userClubId].captain && q.pers !== 'Leader')!
  const after = (pers: Personality, tag: string) => {
    const h = clone(g)
    const q = h.players[p.id]
    q.pers = pers; q.morale = 6; q.status = 'squad'
    const it = item(h, 'plans', q, ['in', 'out', 'earn'])
    answerPress(h, it.id, ['in', 'out', 'earn'].indexOf(tag))
    return { morale: h.players[p.id].morale, fit: it.fit, rk: it.rk }
  }
  const loyalOut = after('Loyal', 'out'), proOut = after('Professional', 'out')
  ok(loyalOut.fit === 'bad' && proOut.fit === 'mixed', `"he can find a new club": bad for the Loyal, mixed for the Professional (${loyalOut.fit}, ${proOut.fit})`)
  ok(loyalOut.morale < proOut.morale, `and it costs the Loyal man more (${loyalOut.morale.toFixed(2)} v ${proOut.morale.toFixed(2)})`)
  ok(loyalOut.rk !== proOut.rk && /Bad$/.test(loyalOut.rk ?? '') && /Mixed$/.test(proOut.rk ?? ''), 'and each says something different back')
  const again = after('Loyal', 'out')
  ok(JSON.stringify(again) === JSON.stringify(loyalOut), 'the same man, the same answer, the same result')
}

console.log('--- 3. the room and the armband')
{
  const g = tenWeeksIn()
  const club = g.clubs[g.userClubId]
  const cap = g.players[club.captain!]
  const avg = (h: GameState) => { const s = squad(h).filter(q => q.id !== cap.id); return s.reduce((a, q) => a + q.morale, 0) / s.length }
  const withCaptain = (pers: Personality, tag: string) => {
    const h = clone(g)
    h.players[cap.id].pers = pers
    for (const q of squad(h)) q.morale = 6
    const before = { room: avg(h), trust: h.mgrTrust ?? 30 }
    const it = item(h, 'signing', h.players[cap.id], ['reassure', 'compete', 'help', 'mine'], { signing: 'A. Newman', rival: 'B. Incumbent' })
    answerPress(h, it.id, ['reassure', 'compete', 'help', 'mine'].indexOf(tag))
    return { dRoom: avg(h) - before.room, dTrust: (h.mgrTrust ?? 30) - before.trust, fit: it.fit }
  }
  const bad = withCaptain('Loyal', 'mine'), good = withCaptain('Leader', 'help')
  ok(bad.fit === 'bad' && bad.dRoom < 0 && bad.dTrust < 0, `a Loyal captain told "selection is my job": the room drops and trust with it (${bad.dRoom.toFixed(2)}, ${bad.dTrust})`)
  ok(good.fit === 'good' && good.dRoom > 0 && good.dTrust > 0, `a Leader asked to welcome the new man: the room lifts (${good.dRoom.toFixed(2)}, +${good.dTrust})`)

  const h = clone(g)
  const hc = h.clubs[h.userClubId]
  const asker = squad(h).find(q => q.id !== hc.captain && q.id !== hc.vice)!
  const oldCap = h.players[hc.captain!]
  const oldMorale = oldCap.morale
  const it = item(h, 'armband', asker, ['yes', 'vice', 'earn', 'no'], { captain: oldCap.name })
  answerPress(h, it.id, 0)
  ok(hc.captain === asker.id, `"it's yours": ${asker.name} is captain`)
  ok(oldCap.morale < oldMorale, `and ${oldCap.name}, who had the armband, feels it (${oldMorale.toFixed(2)} -> ${oldCap.morale.toFixed(2)})`)
  const h2 = clone(g)
  const asker2 = h2.players[asker.id]
  const it2 = item(h2, 'armband', asker2, ['yes', 'vice', 'earn', 'no'])
  answerPress(h2, it2.id, 1)
  ok(h2.clubs[h2.userClubId].vice === asker2.id && h2.clubs[h2.userClubId].captain === cap.id, '"vice-captain for now": the vice changes and the captain does not')
}

console.log('--- 4. the knocks')
{
  // DROPPED: a regular starter, out of the twenty-three for two matches
  const g = tenWeeksIn()
  const club = g.clubs[g.userClubId]
  const p = squad(g).filter(q => q.stats.starts >= 4 && q.age >= 24 && !q.injury).sort((a, b) => b.stats.starts - a.stats.starts)[0]
  let seen: PressItem | undefined
  for (let s = 0; s < 30 && !seen; s++) {
    const h = clone(g)
    h.seed = g.seed + s
    const hp = h.players[p.id]
    hc: {
      const hcl = h.clubs[h.userClubId]
      hcl.tactic.lineup = hcl.tactic.lineup.map(x => (x === hp.id ? null : x))
      hp.lastWk = 1
    }
    talkbackWeek(h)
    seen = h.press.find(q => !q.answered && q.topic === 'dropped' && q.playerId === p.id)
  }
  ok(!!seen, `a starter left out of two matches knocks (${p.name}, ${p.stats.starts} starts)`)
  ok(!!seen && seen.options.length === 4 && seen.options.every(o => !!o.tb), 'with four answers, each one read against who he is')
  const quiet = clone(g)
  for (const q of squad(quiet)) q.lastWk = quiet.week - 1
  let any = false
  for (let s = 0; s < 30; s++) { const h = clone(quiet); h.seed = quiet.seed + s; talkbackWeek(h); if (h.press.some(q => !q.answered && q.topic === 'dropped')) any = true }
  ok(!any, 'and nobody knocks about being dropped when everybody played last week')

  // one at a time: an unanswered office conversation keeps the door shut
  const busy = clone(g)
  item(busy, 'plans', squad(busy)[0], ['in', 'out', 'earn'])
  const n = busy.press.length
  for (let s = 0; s < 20; s++) { busy.seed += 1; talkbackWeek(busy) }
  ok(busy.press.length === n, 'nobody else knocks while a conversation is waiting')

  // ARMBAND: a leader who is not wearing it
  const a = clone(g)
  const leader = squad(a).find(q => q.id !== a.clubs[a.userClubId].captain && q.id !== a.clubs[a.userClubId].vice && q.age >= 25 && q.ca >= 70)!
  leader.pers = 'Leader'; leader.morale = 7; leader.stats.apps = Math.max(leader.stats.apps, 4)
  let armband = false
  for (let s = 0; s < 40 && !armband; s++) { const h = clone(a); h.seed += s; talkbackWeek(h); armband = h.press.some(q => q.topic === 'armband' && q.playerId === leader.id) }
  ok(armband, `a Leader without the armband asks for it (${leader.name})`)

  // POSITION: a squad man with a second position, not getting on
  const m = clone(g)
  const mover = squad(m).find(q => q.alt.length > 0 && q.age >= 21 && q.age <= 31 && q.status !== 'key')
  if (mover) {
    mover.stats.apps = 0
    const ml = m.clubs[m.userClubId]
    ml.tactic.lineup = ml.tactic.lineup.map(x => (x === mover.id ? null : x))
    let pos = false
    for (let s = 0; s < 60 && !pos; s++) { const h = clone(m); h.seed += s; talkbackWeek(h); pos = h.press.some(q => q.topic === 'position' && q.playerId === mover.id) }
    ok(pos, `a squad man with a second position asks to play there (${mover.name}, ${mover.pos} -> ${mover.alt.join('/')})`)
  } else ok(false, 'no squad man with a second position to test')

  // SIGNING: the captain, the week after a signing in a starter's position
  const sg = clone(g)
  const sc = sg.clubs[sg.userClubId]
  const incumbent = squad(sg).filter(q => q.id !== sc.captain && q.stats.starts >= 3).sort((x, y) => y.ca - x.ca)[0]
  const newcomer = squad(sg).find(q => q.id !== incumbent.id && q.id !== sc.captain && q.pos === incumbent.pos) ?? squad(sg).find(q => q.id !== incumbent.id && q.id !== sc.captain)!
  newcomer.pos = incumbent.pos; newcomer.ca = Math.max(newcomer.ca, 72)
  newcomer.joinedAt = sg.season * 48 + sg.week - 1
  let sig: PressItem | undefined
  for (let s = 0; s < 40 && !sig; s++) { const h = clone(sg); h.seed += s; talkbackWeek(h); sig = h.press.find(q => q.topic === 'signing') }
  ok(!!sig && sig.playerId === sc.captain, `the captain comes in about the new signing (${sig?.qv?.signing}, worrying ${sig?.qv?.rival})`)

  // and the same man is not back next week about the same thing
  if (seen) {
    const h = clone(g)
    const hp = h.players[p.id]
    const hl = h.clubs[h.userClubId]
    hl.tactic.lineup = hl.tactic.lineup.map(x => (x === hp.id ? null : x))
    hp.lastWk = 1
    ;(h.officeMemo ??= []).push({ pid: p.id, topic: 'dropped', season: h.season, week: h.week - 1 })
    let back = false
    for (let s = 0; s < 30; s++) { const k = clone(h); k.seed += s; talkbackWeek(k); if (k.press.some(q => q.topic === 'dropped' && q.playerId === p.id)) back = true }
    ok(!back, 'and a man who came in last week is not back this week with the same speech')
  }
}

console.log('--- 5. every line in six languages')
{
  const langs = ['en', 'fr', 'es', 'it', 'ja', 'af']
  const dicts = Object.fromEntries(langs.map(l => [l, JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8'))]))
  const keys: string[] = []
  for (const [topic, answers] of Object.entries(FIT)) {
    for (const tag of Object.keys(answers)) {
      const T = tag[0].toUpperCase() + tag.slice(1)
      for (const f of ['Good', 'Mixed', 'Bad']) keys.push(`${topic}${T}${f}`)
      if (!['plans', 'loan', 'deal'].includes(topic)) keys.push(`${topic}${T}`)
    }
    if (!['plans', 'loan', 'deal'].includes(topic)) keys.push(`${topic}Q1`, `${topic}Q2`)
  }
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join()
  for (const l of langs) {
    const missing = keys.filter(k => typeof dicts[l].talk?.[k] !== 'string')
    const skew = keys.filter(k => typeof dicts[l].talk?.[k] === 'string' && holes(dicts[l].talk[k]) !== holes(dicts.en.talk[k]))
    ok(missing.length === 0 && skew.length === 0, `${l}: all ${keys.length} lines, same holes as the English (${missing.length} missing${missing.length ? `: ${missing.slice(0, 3)}` : ''}, ${skew.length} mismatched${skew.length ? `: ${skew.slice(0, 3)}` : ''})`)
  }
}

console.log('--- 6. a conversation saved before 1.7.3')
{
  const g = tenWeeksIn()
  const p = squad(g)[3]
  p.pers = 'Loyal'; p.morale = 6
  const old: PressItem = {
    id: g.nextId++, week: g.week, season: g.season, outlet: OFFICE_OUTLET, question: 'x', playerId: p.id,
    answered: false, topic: 'plans',
    options: [{ label: 'in', reaction: 'r', morale: 1.1, board: 0 }],
  }
  g.press.push(old)
  answerPress(g, old.id, 0)
  ok(Math.abs(p.morale - 7.1) < 1e-9 && old.fit == null, `an untagged answer moves him by its own fixed number, as it always did (6 -> ${p.morale.toFixed(2)})`)
  ok(fitFor('plans', 'in', p) === 'good', 'while the same answer, tagged, is read against who he is')
}

console.log('--- 7. the scale')
{
  // attributes run 1-20; a comparison against 21 or more can never be true,
  // which is how a leadership check sat dead in chats.ts and talkback.ts
  const bad: string[] = []
  for (const f of readdirSync('src/game')) {
    if (!f.endsWith('.ts')) continue
    const src = readFileSync(`src/game/${f}`, 'utf8')
    for (const m of src.matchAll(/\.a\.(tac|str|scr|lin|ruc|han|pas|kic|goa|pac|sta|agi|vis|dec|pos|agg|lea|wor)\s*(>=|>|<=|<)\s*(\d+)/g)) {
      if (Number(m[3]) > 20) bad.push(`${f}: ${m[0]}`)
    }
  }
  ok(bad.length === 0, `no attribute is compared against a number it can never reach (${bad.join('; ') || 'none'})`)
  const g = tenWeeksIn()
  const club = g.clubs[g.userClubId]
  const p = squad(g).find(q => q.id !== club.captain && q.id !== club.vice && q.age >= 25 && q.ca >= 70)!
  p.pers = 'Professional'; p.a.lea = 17; p.morale = 7; p.stats.apps = Math.max(p.stats.apps, 4)
  let asked = false
  for (let s = 0; s < 40 && !asked; s++) { const h = clone(g); h.seed += s; talkbackWeek(h); asked = h.press.some(q => q.topic === 'armband' && q.playerId === p.id) }
  ok(asked, 'a natural leader by attribute, not only by personality, asks for the armband')
}

console.log('--- 8. its own dice')
{
  const src = readFileSync('src/game/talkback.ts', 'utf8')
  ok(!/Math\.random|weekRng|\brng\s*:\s*Rng/.test(src), 'talk-back never touches Math.random or the week\'s shared stream')
}

console.log(fails ? `\nTALK PROBE FAILED (${fails})` : '\nTALK PROBE PASSED: who he is decides how it lands, the room hears it, and every word is in six languages')
process.exit(fails ? 1 : 0)
