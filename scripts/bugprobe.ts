// Probe: the bug report says enough to act on, and never more than it promised.
//
// A report is only worth having if a developer can act on it without a
// conversation, so this asserts the three things that make one actionable -
// which build, which career, what broke - and the one thing that makes it
// safe to send: that it carries nothing the screen did not say it would.
//
// The screen tells the player: "Your squad, your saves and your name are not
// [attached]." That is a promise in the product, so it is a test here.
import { newGame } from '../src/game/newgame'
import {
  DEV_CONTACT, MAILTO_LIMIT, buildReport, crashCount, mailtoUrl, noteScreen, recordCrash, reportFilename,
} from '../src/game/bugreport'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('northampton', 'Bug Probe', 99)
g.week = 12
g.season = 1

const NAV = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', language: 'en-GB' }
const SCREEN = { w: 390, h: 844, dpr: 3, standalone: true }
const base = { state: g, nav: NAV, screen: SCREEN, when: '2026-08-23 12:00' }

// ---- what a developer needs to act ----------------------------------------
{
  noteScreen('home')
  noteScreen('squad')
  noteScreen('player', 12345)
  recordCrash('render', "Cannot read properties of undefined (reading 'name')", 'at Squad.tsx:118\nat renderWithHooks')

  const r = buildReport({ ...base, notes: 'The squad screen went blank when I tapped a player.' })

  ok(r.includes('The squad screen went blank'), 'what the player typed is in it')
  ok(/seed\s+99/.test(r), 'the seed is in it, so the career can be rebuilt')
  ok(r.includes('northampton'), 'the club is in it')
  ok(r.includes('week 12'), 'the week is in it')
  ok(r.includes('390x844'), 'the device geometry is in it')
  ok(r.includes('home  >  squad  >  player:12345'), 'the route in is in it')
  ok(r.includes("Cannot read properties of undefined (reading 'name')"), 'the error message is in it')
  ok(r.includes('Squad.tsx:118'), 'and the stack that names the file')
  ok(crashCount() === 1, 'the crash was recorded once')

  // a render loop throws the same error every frame: the buffer must not fill
  for (let i = 0; i < 50; i++) recordCrash('render', "Cannot read properties of undefined (reading 'name')")
  ok(crashCount() === 1, 'a repeating crash is recorded once, not fifty times')
}

// ---- and nothing it did not promise ---------------------------------------
{
  const r = buildReport({ ...base, notes: 'nothing much' })
  const club = g.clubs[g.userClubId]
  const someone = g.players[club.players[0]]

  ok(!r.includes(someone.name), `no player names in it (checked ${someone.name})`)
  ok(!r.includes('Bug Probe'), 'the manager name is not in it')
  // the whole save is ~7MB of JSON; a report that carried any of it would be
  // both unsendable and a privacy problem
  ok(r.length < 4000, `the report is a message, not a save dump (${r.length} chars)`)
}

// ---- the routes out of the device -----------------------------------------
{
  const short = buildReport({ ...base, notes: 'short one' })
  ok(mailtoUrl(short).startsWith('mailto:'), 'the mail route builds a mailto: url')
  ok(mailtoUrl(short).includes('subject='), 'with a subject')
  // the address is the whole point of the mail route: a typo here sends every
  // report the game ever produces to nobody, silently
  ok(mailtoUrl(short).startsWith(`mailto:${DEV_CONTACT}?`), `addressed to ${DEV_CONTACT}`)

  const long = buildReport({ ...base, notes: 'x'.repeat(4000) })
  const trimmed = decodeURIComponent(mailtoUrl(long).split('body=')[1])
  ok(trimmed.length <= MAILTO_LIMIT + 120, `a long report is trimmed for mail (${trimmed.length} chars)`)
  ok(trimmed.includes('[trimmed for e-mail'), 'and says so, rather than stopping mid-sentence')
  ok(long.length > MAILTO_LIMIT, 'while the report itself keeps everything for copy and save')

  ok(/^phase-bug-northampton-\d{4}-\d{2}-\d{2}/.test(reportFilename(g)), 'the file is named so a developer can sort it')
}

// ---- a report from the title screen, before any career exists -------------
{
  const r = buildReport({ state: null, notes: 'it would not start', nav: NAV, screen: SCREEN, when: '2026-08-23 12:00' })
  ok(r.includes('no career loaded'), 'a report with no career still builds')
  ok(r.includes('it would not start'), 'and still carries what the player typed')
}

console.log(fails ? `BUG PROBE FAILED (${fails})` : 'BUG PROBE PASSED: the report is actionable, and no wider than it says')
process.exit(fails ? 1 : 0)
