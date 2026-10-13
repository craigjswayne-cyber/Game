// Probe: the feedback report counts what it says, says only that, and is
// offered once (game/usage.ts, ui/FeedbackPrompt.tsx).
//
// The card tells the player: "This is what you have used so far, nothing
// else." That is a promise in the product, so it is a test here: the report
// built from a real career carries no player, manager or club name, no seed
// and no save. Alongside it: the counters count, a mangled ledger heals
// rather than throws, the NEVER OPENED list is right, the mail route fits,
// and the first-season rule fires once and only once.
//
// No browser: the counters run against an in-memory localStorage.
// scripts/feedbackui.mjs holds the card itself.
//
// Run: npx vite-node scripts/feedbackprobe.ts
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { genderOf } from '../src/game/gender'
import { DEV_CONTACT, MAILTO_LIMIT, mailtoUrl, noteScreen } from '../src/game/bugreport'
import {
  ACTIONS, FEEDBACK_SUBJECT, MAIN_SCREENS, USAGE_KEY, buildFeedbackReport, countFinished, countMatch, countWeek,
  countScreen, feedbackDue, freshUsage, neverOpened, noteUse, parseUsage, readUsage, withOffered, writeUsage,
  type Usage,
} from '../src/game/usage'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// an in-memory localStorage, as safeStorage.ts puts in place in a sandbox
const mem = new Map<string, string>()
let refuse = false
const storage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.has(k) ? mem.get(k)! : null },
  key(i: number) { return [...mem.keys()][i] ?? null },
  removeItem(k: string) { mem.delete(k) },
  setItem(k: string, v: string) { if (refuse) throw new Error('QuotaExceededError'); mem.set(k, String(v)) },
}
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })

const g = newGame('northampton', 'Feedback Probe', 4242)
const club = g.clubs[g.userClubId]
const report = (u: Usage = readUsage(), over: Partial<Parameters<typeof buildFeedbackReport>[0]> = {}) => buildFeedbackReport({
  usage: u, version: '1.8.8 (probe)', platform: 'android', lang: 'fr', tablet: false, gender: genderOf(g), store: true, ...over,
})

// ---- the counters count ------------------------------------------------------
console.log('--- counters')
{
  mem.clear()
  noteScreen('squad')
  noteScreen('squad')
  noteScreen('player', 12345)
  noteScreen('tactics')
  countScreen('inbox')
  let u = readUsage()
  ok(u.screens.squad === 2, `a screen opened twice counts two (${u.screens.squad})`)
  ok(u.screens.player === 1 && u.screens.tactics === 1 && u.screens.inbox === 1, 'each screen counts under its name')
  ok(!JSON.stringify(u).includes('12345'), 'the param (a player id) is never stored')

  // per-visit actions count once per screen visit, plain ones every time
  noteUse('tactics', true); noteUse('tactics', true); noteUse('tactics', true)
  noteUse('press'); noteUse('press')
  u = readUsage()
  ok(u.acts.tactics === 1, `a slider dragged on one visit is one tactics change (${u.acts.tactics})`)
  ok(u.acts.press === 2, `two press answers are two (${u.acts.press})`)
  noteScreen('home')
  noteUse('tactics', true)
  ok(readUsage().acts.tactics === 2, 'a new visit counts the next change')
  for (const a of ACTIONS) noteUse(a)
  u = readUsage()
  ok(ACTIONS.every(a => (u.acts[a] ?? 0) >= 1), `every one of the ${ACTIONS.length} actions counts`)
  noteUse('bogus' as never)
  ok(!('bogus' in readUsage().acts), 'an action off the list is not stored')

  // matches: competitive, de-duplicated, seasons counted
  countMatch('4242:0:1', '4242:0')
  countMatch('4242:0:1', '4242:0')
  countMatch('4242:0:2', '4242:0')
  countMatch('4242:1:1', '4242:1')
  u = readUsage()
  ok(u.matches === 3, `one match is never counted twice (${u.matches})`)
  ok(u.seasons === 2, `two seasons counted (${u.seasons})`)

  // never throws, even with storage refusing every write
  refuse = true
  let threw = false
  try { noteScreen('finances'); noteUse('bid'); countMatch('x', 'y') } catch { threw = true }
  ok(!threw, 'a refused write costs a count, never a crash')
  ok(writeUsage(freshUsage()) === false, 'and writeUsage says it did not stick')
  refuse = false
}

// ---- the report: the right sections, and nothing it did not promise ----------
console.log('--- the report')
{
  mem.clear()
  for (const s of ['squad', 'squad', 'tactics', 'training', 'transfers', 'player', 'player', 'player']) noteScreen(s, s === 'player' ? 777 : undefined)
  noteUse('tactics'); noteUse('watched'); noteUse('watched'); noteUse('instant')
  for (let i = 1; i <= 4; i++) countMatch(`4242:0:${i}`, '4242:0')
  const r = report()
  console.log(r.split('\n').map(l => '      | ' + l).join('\n'))
  ok(r.startsWith('PHASE: RUGBY MANAGER - FEEDBACK REPORT'), 'it says what it is')
  for (const want of [/version\s+1\.8\.8/, /platform\s+android/, /language\s+fr/, /device\s+phone/, /game\s+men's/, /seasons\s+1/, /matches\s+4 competitive/]) {
    ok(want.test(r), `it carries ${want.source.replace(/\\s\+/g, ' ').replace(/\\/g, '')}`)
  }
  ok(/game\s+women's/.test(report(undefined, { gender: 'w' })) && /device\s+tablet/.test(report(undefined, { tablet: true })),
    "and says women's and tablet when they are")
  for (const sec of ['SCREENS OPENED', 'NEVER OPENED', 'ACTIONS']) ok(r.includes(`\n${sec}\n`), `it has a ${sec} section`)
  ok(/Team 2/.test(r) && /Player page 3/.test(r) && /Tactics 1/.test(r), 'screens read by name, with their counts')
  ok(/Match watched 2/.test(r) && /Instant result 1/.test(r) && /Transfer bid made 0/.test(r), 'actions read by name, zeros included')

  // nothing identifying
  const names = club.players.slice(0, 40).map(id => g.players[id].name)
  ok(names.every(n => !r.includes(n)), `no player names in it (checked ${names.length})`)
  ok(!r.includes('Feedback Probe'), 'the manager name is not in it')
  const clubNames = Object.values(g.clubs).map(c => c.name).filter(n => n.length > 3)
  const hit = clubNames.find(n => r.includes(n))
  ok(!hit, `no club name in it (checked ${clubNames.length}${hit ? `, found ${hit}` : ''})`)
  ok(!r.includes(club.id) && !r.includes(club.short), "the manager's club id and short name are not in it")
  ok(!r.includes('4242') && !r.includes('777'), 'no seed, no match key, no param')
  ok(!/@/.test(r) && !/\bid\b/i.test(r.replace(/didn|valid/gi, '')), 'no address and no device id')
  ok(!/—|–/.test(r), 'no em or en dashes')

  // NEVER OPENED
  const never = neverOpened(readUsage(), true)
  ok(!never.includes('squad') && !never.includes('tactics') && !never.includes('training') && !never.includes('transfers'),
    'screens opened are not listed as never opened')
  ok(never.includes('academy') && never.includes('medical') && never.includes('press') && never.includes('supporter'),
    'screens not opened are listed')
  ok(never.length === MAIN_SCREENS.length + 1 - 4, `exactly the unopened main screens, plus the Store (${never.length})`)
  ok(!neverOpened(readUsage(), false).includes('supporter'), 'no Store is listed where the build has none')
  ok(!never.includes('player') && !never.includes('matchday'), 'only main places, not pages reached through them')
  const all = freshUsage()
  for (const s of [...MAIN_SCREENS, 'supporter']) all.screens[s] = 1
  ok(neverOpened(all, true).length === 0 && /every main screen was opened/.test(report(all)), 'and none when everything was opened')

  // the mail route
  const m = mailtoUrl(r, FEEDBACK_SUBJECT, '[trimmed for e-mail - use Copy for the full report]')
  ok(m.startsWith(`mailto:${DEV_CONTACT}?subject=`), `the mail goes to ${DEV_CONTACT}`)
  ok(decodeURIComponent(m).includes('feedback report'), 'with the subject filled in')
  ok(r.length <= MAILTO_LIMIT && decodeURIComponent(m.split('&body=')[1]) === r, `a month's report fits a mail body whole (${r.length} chars)`)
  // a heavy user: every screen visited thousands of times
  const heavy = freshUsage()
  for (const s of [...MAIN_SCREENS, 'supporter', 'player', 'matchday', 'results', 'day', 'wire', 'country', 'seasonreview', 'annual', 'draw']) heavy.screens[s] = 12345
  for (const a of ACTIONS) heavy.acts[a] = 9999
  heavy.matches = 9999; heavy.seasons = 99
  const hr = report(heavy)
  ok(hr.length <= MAILTO_LIMIT, `even a heavy user's report fits (${hr.length} of ${MAILTO_LIMIT})`)
}

// ---- a mangled ledger heals ----------------------------------------------------
console.log('--- corrupt storage')
{
  const bad = ['{', 'null', '[]', '42', '"x"', JSON.stringify({ screens: [1, 2], acts: 'no', matches: 'many', offered: 'yes', seen: 7, offeredAt: NaN }),
    JSON.stringify({ screens: { squad: -3, 'Bad Key': 4, tactics: 2.7, 'x<y': 1 }, acts: { press: Infinity, bid: 3, nope: 9 }, matches: -5, offeredAt: -9 })]
  for (const raw of bad) {
    let u: Usage | null = null
    let threw = false
    try { mem.set(USAGE_KEY, raw); u = readUsage() } catch { threw = true }
    ok(!threw && !!u && u.v === 1 && typeof u.screens === 'object' && typeof u.acts === 'object' && u.matches >= 0 && u.offeredAt >= -1,
      `heals ${raw.slice(0, 40)}`)
  }
  const h = parseUsage(bad[bad.length - 1])
  ok(h.screens.tactics === 2 && !('squad' in h.screens) && !('Bad Key' in h.screens) && !('x<y' in h.screens),
    'keeps the sound counts and drops the rest')
  ok(h.acts.bid === 3 && !('press' in h.acts) && !('nope' in h.acts), 'actions likewise')
  // counting carries on over a healed ledger
  mem.set(USAGE_KEY, '{not json')
  noteScreen('legacy')
  ok(readUsage().screens.legacy === 1, 'and counting carries on over it')
}

// ---- the first-season rule fires once ---------------------------------------------
//
// 1.9.0 (owner): "push the feedback report til the first season is completed
// so we have enough data." It was the first month, and the reports that came
// back read "weeks 4, matches 1".
console.log('--- the first season')
{
  mem.clear()
  const due: boolean[] = []
  // a first career from week 1 to week 40: a month, two months, a whole
  // season of weeks, and no card until a season has been finished
  for (let w = 2; w <= 40; w++) {
    countWeek(`4242:0:${w}`)
    countWeek(`4242:0:${w}`) // a reload landing on the same week again
    if (w % 2 === 0) countMatch(`4242:0:${w}`, '4242:0')
    due.push(feedbackDue(readUsage()))
  }
  ok(!due.some(Boolean), `not due across a season's worth of weeks (${readUsage().weeks} weeks, ${readUsage().matches} matches)`)
  // the season is finished: its review opens over the new Monday
  countWeek('4242:1:1'); countFinished('4242:0')
  countWeek('4242:1:1'); countFinished('4242:0') // reloaded on the review: counted once
  ok(readUsage().finished === 1, `a season is finished once however often its review is landed on (${readUsage().finished})`)
  ok(feedbackDue(readUsage()), 'due once the first season is finished')
  ok(writeUsage(withOffered(readUsage())), 'the offer is recorded before the card shows')
  const u = readUsage()
  ok(u.weeks === 40, `a week is counted once however often it is landed on (${u.weeks})`)
  ok(u.offered && u.offeredAt === 20, `offeredAt marks that match flow (${u.offeredAt})`)
  ok(withOffered(u).offeredAt === u.offeredAt, 'opening it again later does not move the mark')
  ok(/weeks\s+40\n/.test(report(u)) && /finished\s+1 season\n/.test(report(u)), 'the report says how many weeks, and seasons finished')
  // the next season finished, and a new career on the same device: the
  // ledger is the device's, and it is offered once, ever
  countFinished('4242:1')
  countWeek('9999:0:2'); countMatch('9999:0:1', '9999:0')
  ok(!feedbackDue(readUsage()) && readUsage().finished === 2 && readUsage().seasons === 2,
    'a second season or a second career does not bring it back, and both count')
  // a device that has never been offered it, a month in: not yet
  mem.clear()
  for (let w = 2; w <= 6; w++) countWeek(`1:0:${w}`)
  ok(!feedbackDue(readUsage()), 'a month in is not yet a season')
  // a ledger from before 1.9.0, a month in and never offered: it now waits
  ok(!feedbackDue(parseUsage(JSON.stringify({ v: 1, weeks: 6, matches: 3, offered: false }))), 'an old ledger a month in waits for the season too')
  const st = readFileSync('src/store.ts', 'utf8')
  const low = st.slice(st.indexOf('function landOnNextWeek('), st.indexOf('function landOnNextWeek(') + 1100)
  ok(/countWeek\(`\$\{g\.seed\}:\$\{g\.season\}:\$\{g\.week\}`\)/.test(low), 'every way a week ends counts it (landOnNextWeek)')
  ok(/if \(g\.annual\) countFinished\(`\$\{g\.seed\}:\$\{g\.annual\.season\}`\)/.test(low), 'and the Monday a season review opens counts the season finished')
}

// ---- no network, no simulation ---------------------------------------------------
{
  const src = readFileSync('src/game/usage.ts', 'utf8') + readFileSync('src/ui/FeedbackPrompt.tsx', 'utf8')
  ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src), 'no network call in the counters or the card')
  ok(!/Math\.random|matchRng|from '\.\/rng'/.test(readFileSync('src/game/usage.ts', 'utf8')), 'no randomness in the counters')
  const store = readFileSync('src/store.ts', 'utf8')
  const cfp = store.slice(store.indexOf('function countForPro'), store.indexOf('function countForPro') + 600)
  ok(/compId === 'fr'\) return[\s\S]*countMatch\(/.test(cfp), 'friendlies return before the match is counted')
}

console.log(fails ? `FEEDBACK PROBE FAILED (${fails})` : 'FEEDBACK PROBE PASSED')
process.exit(fails ? 1 : 0)
