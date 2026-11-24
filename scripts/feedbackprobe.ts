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
  REPORT_ROOM, careerSnap, countScreen, dueMilestone, feedbackDue, freshUsage, neverOpened, noteBuyFail, noteBuyTap, noteUse, parseUsage, readUsage, withBuyFail, withBuyTap, withOffered, withTime, writeUsage,
  type Usage,
} from '../src/game/usage'
import { bridge, buyConsumable, buyOwnable, CHARTER_SKU, HEAL_SKU, setBillingCause, setBillingCode, SUPPORTER_SKU, type BillingBridge, type PurchaseOutcome } from '../src/game/monetise'
import { ok, done } from './lib/probe'
import { storeSource } from './lib/storefiles'

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
  const st = storeSource()
  const low = st.slice(st.indexOf('function landOnNextWeek('), st.indexOf('function landOnNextWeek(') + 1100)
  ok(/countWeek\(`\$\{g\.seed\}:\$\{g\.season\}:\$\{g\.week\}`\)/.test(low), 'every way a week ends counts it (landOnNextWeek)')
  ok(/if \(g\.annual\) countFinished\(`\$\{g\.seed\}:\$\{g\.annual\.season\}`\)/.test(low), 'and the Monday a season review opens counts the season finished')
}

// ---- no network, no simulation ---------------------------------------------------
{
  const src = readFileSync('src/game/usage.ts', 'utf8') + readFileSync('src/ui/FeedbackPrompt.tsx', 'utf8')
  ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src), 'no network call in the counters or the card')
  ok(!/Math\.random|matchRng|from '\.\/rng'/.test(readFileSync('src/game/usage.ts', 'utf8')), 'no randomness in the counters')
  const store = storeSource()
  const cfp = store.slice(store.indexOf('function countForPro'), store.indexOf('function countForPro') + 600)
  ok(/compId === 'fr'\) return[\s\S]*countMatch\(/.test(cfp), 'friendlies return before the match is counted')
}

// ---- 1.9.13: offered again at seasons 3, 5, 10 and 20 --------------------------
// Owner: "add it for the end of season 3,5 and 10 and 20".
console.log('--- the season milestones')
{
  const at = (finished: number, offeredFor: number[] = []) => ({ ...freshUsage(), finished, offered: offeredFor.length > 0, offeredFor })
  ok(dueMilestone(at(1)) === 1 && dueMilestone(at(2, [1])) === null, 'season one, and not again at two')
  ok(dueMilestone(at(3, [1])) === 3 && dueMilestone(at(4, [1, 3])) === null, 'season three, and not again at four')
  ok(dueMilestone(at(5, [1, 3])) === 5 && dueMilestone(at(10, [1, 3, 5])) === 10 && dueMilestone(at(20, [1, 3, 5, 10])) === 20, 'five, ten and twenty')
  ok(dueMilestone(at(25, [1, 3, 5, 10, 20])) === null, 'and nothing after twenty')
  // a long gap between visits: from one season to four is one card, at three
  ok(dueMilestone(at(4, [1])) === 3, 'a career that jumps from one to four is asked once, at three')
  const w = withOffered(at(4, [1]))
  ok(dueMilestone(w) === null && w.offeredFor.includes(3), 'and is not asked again until five')
  // a ledger from before 1.9.13 that was offered had its first card
  const old = parseUsage(JSON.stringify({ v: 1, finished: 3, offered: true, offeredAt: 20 }))
  ok(old.offeredFor.includes(1) && dueMilestone(old) === 3, 'an old ledger already offered at one is asked at three')
  // opening it from the menu answers every milestone reached so far
  ok(dueMilestone(withOffered(at(6))) === null, 'opened by hand, nothing is left queued behind it')
}

// ---- 1.9.13: play time, by screen, in sessions ----------------------------------
console.log('--- play time')
{
  let u = freshUsage()
  const t0 = 1_000_000_000_000
  u = withTime(u, t0, 'squad')                       // a session opens on Team
  u = withTime(u, t0 + 90_000, 'player')             // 90 seconds on Team
  u = withTime(u, t0 + 90_000 + 40 * 60_000, 'player') // left for 40 minutes on Player: a new session, nothing counted
  u = withTime(u, t0 + 90_000 + 40 * 60_000 + 12 * 60_000, 'tactics') // 12 minutes, capped at 5
  ok(u.sessions === 2, `a gap over half an hour is a new session (${u.sessions})`)
  ok(u.time.squad === 90 && u.time.player === 300, `time goes to the screen it was spent on, an idle stretch capped (${JSON.stringify(u.time)})`)
  ok(u.secs === 390, `and adds up (${u.secs}s)`)
  const r = report({ ...u, secs: 7_800, sessions: 12, time: { squad: 3_000, player: 1_800, tactics: 900, inbox: 120, press: 61, fixtures: 30 } })
  ok(/PLAY TIME\n2h 10m over 12 sessions, 11m average\n/.test(r), 'the report gives the total, the sessions and the average')
  ok(/most time: Team 50m, Player page 30m, Tactics 15m, Inbox 2m, Press room 1m\n/.test(r), 'and the five screens most time went to, by name')
  ok(!/Fixtures and results \d+m/.test(r.split('SCREENS OPENED')[0]), 'under a minute is left out')
  ok(/PLAY TIME\nnot measured yet\n/.test(report(freshUsage())), 'a ledger from before 1.9.13 says so rather than reading zero')
}

// ---- 1.9.13: the career and the settings, as numbers -----------------------------
console.log('--- the career')
{
  const g = newGame('bath', 'Career Probe', 4242)
  g.mgr.w = 30; g.mgr.d = 2; g.mgr.l = 14
  g.mgr.finishes = [{ season: 0, leagueId: 'prem', pos: 4, clubId: 'bath' }, { season: 1, leagueId: 'prem', pos: 1, clubId: 'bath' }]
  g.mgr.trophies = [{ compId: 'prem', season: 1, clubId: 'bath' }]
  const snap = careerSnap(g, false)
  const r = report(readUsage(), { career: snap, prefs: { haptics: false, sound: true, night: true, text: 1.15 } })
  ok(/CAREER\nrecord 30-2-14, trophies 1, clubs 1\n/.test(r), 'the record, the silverware and the clubs')
  ok(/finishes \(pos\/tier\) 4\/1, 1\/1\n/.test(r), 'the league finishes with their tier')
  ok(/board \d+, fans \d+, in (debt|credit), squad \d+, free\n/.test(r), 'the board, the terraces, the books, the squad and Pro')
  ok(/SETTINGS\nhaptics off, sound on, night on, text 115%\n/.test(r), 'and the settings')
  const club = g.clubs[g.userClubId]
  ok(!r.includes('Career Probe') && !r.includes(club.name) && !r.includes(club.short) && !/\bprem\b|\bbath\b/.test(r), 'no manager, club or league named in the career section')
  ok(!/—|–/.test(r), 'no em or en dashes')
  // the heaviest report there can be still fits a mail body
  const heavy = freshUsage()
  for (const s of [...MAIN_SCREENS, 'supporter', 'player', 'matchday', 'results', 'day', 'wire', 'country', 'seasonreview', 'annual', 'draw']) { heavy.screens[s] = 12345; heavy.time[s] = 999_999 }
  for (const a of ACTIONS) heavy.acts[a] = 9999
  heavy.matches = 9999; heavy.seasons = 99; heavy.finished = 99; heavy.secs = 9_999_999; heavy.sessions = 9999
  const big: typeof snap = { w: 999, d: 999, l: 999, fin: Array.from({ length: 5 }, () => ({ pos: 12, tier: 3 })), trophies: 99, clubs: 12, board: 100, fans: 100, debt: true, squad: 60, pro: true }
  const hr = report(heavy, { career: big, prefs: { haptics: true, sound: true, night: true, text: 1.3 } })
  ok(hr.length <= MAILTO_LIMIT, `the heaviest full report still fits a mail body (${hr.length} of ${MAILTO_LIMIT})`)
}

console.log('--- the store (1.9.14)')
{
  const u = freshUsage()
  u.screens.supporter = 4
  u.acts.buyTap = 3; u.acts.bought = 1; u.acts.buyCancel = 1; u.acts.buyFail = 1
  const r = report(u)
  ok(/\nSTORE\nvisits 4, taps 3, bought 1, cancelled 1, failed 1\n/.test(r), 'the STORE line: visits, Buy taps and how they ended')
  ok(!/Buy tapped|Purchase cancelled/.test(r), 'and the purchase counts are not repeated on the ACTIONS line')
  ok(!report(u, { store: false }).includes('\nSTORE\n'), 'a build with no store (the website) has no STORE line')
}

console.log('--- which product, and why it failed (1.9.18)')
{
  ok(REPORT_ROOM === MAILTO_LIMIT, `the report is fitted to the mail body's own limit (${REPORT_ROOM})`)
  mem.clear()
  noteBuyTap('phase.supporter'); noteBuyFail('phase.supporter', 'refused/fastAbort/playClosed')
  noteBuyTap('phase.supporter'); noteBuyFail('phase.supporter', 'refused/fastAbort/playClosed')
  noteBuyTap('phase.inject.xl'); noteBuyFail('phase.inject.xl', 'refused/unreachable/stall')
  noteBuyTap('phase.heal')
  let u = readUsage()
  ok(u.acts.buyTap === 4 && u.acts.buyFail === 3, 'the totals on the STORE line still count every tap and failure')
  ok(u.buys.supporter === 2 && u.buys['inject.xl'] === 1 && u.buys.heal === 1, `taps are kept by product (${JSON.stringify(u.buys)})`)
  ok(u.fails['supporter refused/fastAbort/playClosed'] === 2 && u.fails['inject.xl refused/unreachable/stall'] === 1, 'failures by product and reason')
  u.screens.supporter = 6
  const r = report(u)
  ok(/\nSTORE\nvisits 6, taps 4, bought 0, cancelled 0, failed 3\ntapped: supporter 2, heal 1, inject\.xl 1\nfailed: supporter refused\/fastAbort\/playClosed 2, inject\.xl refused\/unreachable\/stall 1\n\nSCREENS OPENED\n/.test(r), 'the report names the products tapped and why each failure happened')
  ok(!report(u, { store: false }).includes('tapped:') && !report(u, { store: false }).includes('failed:'), 'a build with no store has neither line')
  const plain = freshUsage(); plain.screens.supporter = 2; plain.acts.buyTap = 5; plain.acts.buyFail = 3
  ok(/failed 3\n\nSCREENS OPENED/.test(report(plain)), 'a ledger from before 1.9.18 keeps its totals and adds no empty lines')

  // fixed words only: nothing a store or a wrapper says is kept as written
  let odd = withBuyFail(freshUsage(), 'phase.heal', 'AbortError: Payment declined for j.smith@example.com')
  ok(odd.fails['heal unknown'] === 1 && !JSON.stringify(odd).includes('smith'), "a reason that is not fixed words is kept as 'unknown', never as written")
  odd = withBuyFail(withBuyTap(freshUsage(), 'someone@example.com'), '../../etc 9', 'refused')
  ok(odd.acts.buyTap === 1 && odd.acts.buyFail === 1 && !Object.keys(odd.buys).length && !Object.keys(odd.fails).length, 'an id that is not one of ours counts in the totals and is named nowhere')
  const healed = parseUsage(JSON.stringify({ ...freshUsage(), buys: { supporter: 2, 'Bad Key': 3, heal: -1 }, fails: { 'heal refused/stall': 1, 'heal refused stall': 4, 'x y z': 2, 'heal <b>': 1 } }))
  ok(JSON.stringify(healed.buys) === '{"supporter":2}' && JSON.stringify(healed.fails) === '{"heal refused/stall":1}', 'a mangled tally heals: sound keys kept, the rest dropped')
  ok(!Object.keys(parseUsage(JSON.stringify({ v: 1, acts: { buyFail: 3 } })).fails).length, 'an old ledger reads back with empty tallies')
  let many = freshUsage()
  for (let n = 0; n < 200; n++) many = withBuyFail(many, 'phase.heal', 'refused/' + 'abcdefghij'[n % 10] + 'abcdefghij'[Math.floor(n / 10) % 10] + 'abcdefghij'[Math.floor(n / 100)])
  ok(Object.keys(many.fails).length === 40 && many.acts.buyFail === 200, 'the tally is capped, the total is not')

  // THE REPORT THAT ASKED FOR THIS: a real 19 hour career, three failures
  const real = freshUsage()
  Object.assign(real.screens, { player: 269, squad: 152, matchday: 148, press: 110, offers: 55, transfers: 54, finances: 46, tactics: 40, inbox: 38, training: 37, medical: 32, jobs: 29, club: 26, dreamteam: 14, tables: 12, fixtures: 11, results: 11, agency: 6, academy: 5, draw: 4, legacy: 4, newgame: 4, report: 3, infra: 2, scouting: 2, handbook: 1, profile: 1, saves: 1, settings: 1, supporter: 12 })
  Object.assign(real.acts, { tactics: 30, playbook: 16, training: 73, bid: 132, loan: 14, renew: 52, press: 236, talk: 116, watched: 113, sub: 32, liveTactics: 68, advert: 2, chat: 13, physio: 11, buyTap: 5, buyCancel: 2, buyFail: 3 })
  Object.assign(real.time, { matchday: 34140, player: 8700, squad: 8460, press: 2760, tactics: 2280 })
  real.weeks = 165; real.seasons = 4; real.finished = 3; real.matches = 96; real.secs = 68400; real.sessions = 15
  real.buys = { supporter: 2, pinnacle: 2, 'inject.m': 1 }
  real.fails = { 'supporter refused/fastAbort/playClosed': 2, 'pinnacle refused/NotSupportedError': 1 }
  const career = { w: 31, d: 1, l: 15, fin: [{ pos: 2, tier: 1 }], trophies: 1, clubs: 1, board: 100, fans: 95, debt: false, squad: 41, pro: false }
  const rr = report(real, { version: 'v1.9.16 · 2026-11-21 17:58 UTC', lang: 'en', career, prefs: { haptics: true, sound: true, night: true, text: 1 } })
  ok(rr.includes('tapped: pinnacle 2, supporter 2, inject.m 1\nfailed: supporter refused/fastAbort/playClosed 2, pinnacle refused/NotSupportedError 1\n'), 'that report would have said which products and why')
  ok(rr.length <= MAILTO_LIMIT, `and still fits a mail body whole (${rr.length} of ${MAILTO_LIMIT})`)

  // the heaviest report there can be: the new lines give way, nothing else does
  const heavy = freshUsage()
  for (const sc of [...MAIN_SCREENS, 'supporter', 'player', 'matchday', 'results', 'day', 'wire', 'country', 'seasonreview', 'annual', 'draw']) { heavy.screens[sc] = 12345; heavy.time[sc] = 999_999 }
  for (const a of ACTIONS) heavy.acts[a] = 9999
  heavy.matches = 9999; heavy.seasons = 99; heavy.finished = 99; heavy.secs = 9_999_999; heavy.sessions = 9999
  const big = { w: 999, d: 999, l: 999, fin: Array.from({ length: 5 }, () => ({ pos: 12, tier: 3 })), trophies: 99, clubs: 12, board: 100, fans: 100, debt: true, squad: 60, pro: true }
  const over = { career: big, prefs: { haptics: true, sound: true, night: true, text: 1.3 } }
  const before = report(heavy, over)
  for (const id of ['supporter', 'supporter.intro', 'pinnacle', 'inject.xl', 'estate']) { heavy.buys[id] = 9999; heavy.fails[`${id} refused/unreachable/stall`] = 9999 }
  const after = report(heavy, over)
  ok(after.length <= MAILTO_LIMIT, `the heaviest report still fits with every tally full (${after.length} of ${MAILTO_LIMIT})`)
  ok(after.replace(/^(tapped|failed): .*\n/gm, '') === before, 'and nothing else in it was cut to make the room')
}

console.log('--- the two purchase doors say which product and why')
{
  const w = globalThis as unknown as { rmBilling?: BillingBridge }
  let next: () => Promise<PurchaseOutcome> = async () => 'owned'
  const fake = { owned: async () => [], ownedState: async () => ({ ok: true, skus: [] }), details: async () => null, buy: () => next(), consume: async () => ({ ok: true }), restore: async () => [] } as unknown as BillingBridge
  const had = w.rmBilling
  mem.clear()
  // no store attached
  delete w.rmBilling
  if (!bridge()) {
    await buyOwnable(SUPPORTER_SKU)
    ok(readUsage().fails['supporter unavailable/noStore'] === 1, 'no store attached: unavailable/noStore, against the product')
  } else ok(true, 'a store is attached in this run: the no-store ending is not reachable')
  w.rmBilling = fake
  if (bridge() === fake) {
    mem.clear()
    next = async () => { setBillingCode('fastAbort/playClosed'); return 'refused' }
    await buyOwnable(SUPPORTER_SKU)
    next = async () => { setBillingCause('unreachable'); setBillingCode('stall'); return 'refused' }
    await buyConsumable(HEAL_SKU)
    next = async () => { throw new Error('private words from a store') }
    await buyOwnable(CHARTER_SKU)
    next = async () => 'cancelled'
    await buyOwnable(SUPPORTER_SKU)
    next = async () => 'pending'
    await buyConsumable(HEAL_SKU)
    next = async () => { setBillingCode('a sentence, not a code'); return 'refused' }
    await buyConsumable(HEAL_SKU)
    await buyOwnable('phase.nothing')
    const u = readUsage()
    ok(u.fails['supporter refused/fastAbort/playClosed'] === 1, 'a sheet Play closed at once: refused/fastAbort/playClosed')
    ok(u.fails['heal refused/unreachable/stall'] === 1, "a sheet that never opened: the shell's cause and the code together")
    ok(u.fails['uncapped error/threw'] === 1 && !JSON.stringify(u).includes('private'), "a bridge that threw: error/threw, and not a word of the store's message")
    ok(u.fails['heal refused'] === 1, 'a code that is not fixed words is dropped; the outcome still stands')
    ok(u.fails['nothing unavailable/notOurs'] === 1, 'a product the door does not sell: unavailable/notOurs')
    ok(u.acts.buyTap === 7 && u.acts.buyFail === 5 && u.acts.buyCancel === 1, `cancelled and pending are not failures (${u.acts.buyTap} taps, ${u.acts.buyFail} failed, ${u.acts.buyCancel} cancelled)`)
    ok(u.buys.supporter === 2 && u.buys.heal === 3 && u.buys.uncapped === 1, 'every tap is against its product, however it ended')
    next = async () => 'refused'
    await buyOwnable(SUPPORTER_SKU)
    ok(readUsage().fails['supporter refused'] === 1, "one tap's cause and code do not carry over to the next")
  } else ok(false, 'the probe could not attach a store bridge')
  if (had) w.rmBilling = had; else delete w.rmBilling
}

done('FEEDBACK PROBE', '', { exit: true, blank: false })
