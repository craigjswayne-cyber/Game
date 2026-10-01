// ---- THE ASSISTANT'S WORD ON A THIN POSITION (owner, round 4) ----
//
// The depth chart moved to the Team Report and stopped flagging thin
// positions on screen. The assistant says it instead: one short inbox message
// naming the position, once per spell of thinness. This holds it to that:
//
//   1. a position goes thin -> exactly one message, naming it
//   2. it stays thin for weeks -> no more messages
//   3. it recovers, then goes thin again -> one new message
//   4. cover from another position does not count as fit
//   5. no shared-rng draws, and the words exist in all six languages
//   6. the depth chart carries no warning any more
//
// Run: npx vite-node scripts/depthwatchprobe.ts
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { depthNeed, depthWatch, fitAt } from '../src/game/depthwatch'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import type { GameState, Player, Pos } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g: GameState = newGame('leicester', 'Depth Watch', 4242)
const club = g.clubs[g.userClubId]
const men = (pos: Pos): Player[] => club.players.map(id => g.players[id]).filter(p => p && !p.acad && p.pos === pos)
// a clean slate: everybody fit, so only what the probe does makes anything thin
for (const id of club.players) { const p = g.players[id]; if (p) { p.injury = null as never; p.bans = 0; p.natSquad = undefined as never; p.onLoan = undefined as never } }
// owner, round 7: nothing before the first match. Thin at week 1 with no game
// played says nothing; one played fixture and the watch is on.
{
  const lk = men('LK'); for (const p of lk.slice(1)) p.injury = { type: 'Hamstring', until: g.week + 20 } as never
  const n0 = g.news.length; depthWatch(g)
  ok(g.news.length === n0, 'no depth message before the first match is played')
  for (const p of lk) p.injury = null as never
  const fx = g.fixtures.find(f => f.homeId === club.id || f.awayId === club.id)!
  fx.played = true; fx.week = Math.min(fx.week, g.week)
}
depthWatch(g)
const base = g.news.length
const told = () => g.news.slice(base).filter(n => n.k === 'news.depthShort' || n.k === 'news.depthShortNone')
const week = () => { g.week++; depthWatch(g) }

// make sure the probe position starts healthy
const POS: Pos = 'LK'
const locks = men(POS)
ok(locks.length >= 3, `the club has ${locks.length} specialist locks to work with`)
ok(fitAt(g, POS) >= depthNeed(POS), `and the locks start above the line (${fitAt(g, POS)} fit, need ${depthNeed(POS)})`)
ok(told().length === 0, 'a healthy squad draws no message')

// 1. go thin: injure all but one lock
const hurt = (p: Player) => { p.injury = { type: 'Hamstring', until: g.week + 20 } as never }
const heal = (p: Player) => { p.injury = null as never }
for (const p of locks.slice(1)) hurt(p)
const rngBefore = Math.random
let draws = 0
Math.random = () => { draws++; return rngBefore() }
week()
Math.random = rngBefore
let msgs = told()
ok(msgs.length === 1, `going thin sends exactly one message (${msgs.length})`)
ok(msgs[0]?.v?.pos_k === `pos.${POS}` && msgs[0]?.v?.n === 1, `naming the position and the count (${JSON.stringify(msgs[0]?.v)})`)
ok(/Lock/.test(msgs[0]?.subject ?? '') && msgs[0]!.body.length < 120, `short, and it names the position in English: "${msgs[0]?.subject}" / "${msgs[0]?.body}"`)
ok(draws === 0, 'and the check draws nothing from any rng')

// 2. stay thin for six weeks
for (let i = 0; i < 6; i++) week()
msgs = told()
ok(msgs.length === 1, `six more weeks of the same thinness send nothing more (${msgs.length})`)

// worse inside the same spell is still the same spell
hurt(locks[0])
week()
ok(told().length === 1, 'down to none inside the same spell is still one message')

// 3. recover, then go thin again
for (const p of locks) heal(p)
week()
ok(told().length === 1, 'recovering sends nothing')
ok(!(g.depthShort?.pos ?? []).includes(POS), 'and clears the position from the reported list')
for (const p of locks.slice(1)) hurt(p)
week()
msgs = told()
ok(msgs.length === 2, `a new spell of thinness sends one new message (${msgs.length})`)
for (let i = 0; i < 3; i++) week()
ok(told().length === 2, 'and only one for that spell too')
for (const p of locks) heal(p)
week()

// 4. cover does not count: a flanker who can play lock is not a fit lock
const fl = men('FL')[0]
if (fl && !fl.alt.includes(POS)) fl.alt.push(POS)
for (const p of locks.slice(1)) hurt(p)
week()
ok(fitAt(g, POS) === 1, `cover from another position is not counted (${fitAt(g, POS)} fit lock with a flanker who covers)`)
ok(told().length === 3, 'so the assistant still speaks')
for (const p of locks) heal(p)
week()

// a new club is a new squad: the reported list does not follow him
g.depthShort = { club: 'someone-else', pos: ['LK'] }
week()
ok(g.depthShort?.club === club.id && !g.depthShort.pos.includes('LK'), 'a new club starts with nothing carried over from the last one')

// unemployed: silent
g.unemployed = true
for (const p of locks.slice(1)) hurt(p)
const before = told().length
week()
ok(told().length === before, 'an unemployed manager gets no depth messages')
g.unemployed = false

// 5. six languages, one and other, and the none line
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
for (const l of LANGS) {
  await ensureLang(l)
  for (const [k, n] of [['news.depthShort', 1], ['news.depthShort', 2], ['news.depthShortNone', 0]] as const) {
    const v = { n, pos_k: 'pos.LP' }
    const body = tIn(l, k, v), subj = tIn(l, `${k}Subj`, v)
    const pos = tIn(l, 'pos.LP')
    ok(body.includes(pos) && subj.includes(pos) && !/[{}]/.test(body + subj) && !body.includes('news.'), `${l} ${k} (${n}): "${subj}" / "${body}"`)
  }
}

// 6. the chart itself: no warning row, no red edge, no thin keys
const chart = readFileSync('src/ui/screens/DepthChart.tsx', 'utf8')
ok(!/thin|depth-warn|warn'/.test(chart.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'the depth chart carries no thin-position warning')
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
ok(!en.squad.depthThin && !en.squad.depthThinFront, 'and its warning lines are gone from the dictionary')
const squad = readFileSync('src/ui/screens/Squad.tsx', 'utf8')
ok(!/DepthPane|'depth'/.test(squad) && /DepthPane/.test(readFileSync('src/ui/screens/TeamReport.tsx', 'utf8')), 'the chart is on the Team Report, not the Team tabs')

// owner, round 7: the back row is one unit. Two flankers out with a fit
// number 8 and a fit flanker left is not a message about either position.
{
  const fl = men('FL'), n8 = men('N8')
  for (const p of [...fl, ...n8]) p.injury = null as never
  week()
  const n0 = told().length
  for (const p of fl.slice(1)) p.injury = { type: 'Hamstring', until: g.week + 20 } as never
  week()
  const fresh = told().slice(n0)
  const fit = fitAt(g, 'FL') + fitAt(g, 'N8')
  ok(!fresh.some(n => (n.v as { pos_k?: string })?.pos_k === 'pos.FL' || (n.v as { pos_k?: string })?.pos_k === 'pos.N8'),
    'flanker and number 8 are never reported on their own')
  ok(fit >= 3 ? fresh.length === 0 : fresh.some(n => (n.v as { pos_k?: string })?.pos_k === 'pos.backRow'),
    `the back row is counted as one (${fit} fit across FL and N8)`)
  for (const p of fl) p.injury = null as never
}
console.log(fails ? `\nDEPTH WATCH FAILED (${fails})` : '\nDEPTH WATCH PASSED: one word per spell, and the chart is just a chart')
process.exit(fails ? 1 : 0)
