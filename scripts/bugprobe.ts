// Probe: the bug report says enough to act on, and never more than it promised.
//
// A report is only worth having if a developer can act on it without a
// conversation, so this asserts the three things that make one actionable -
// which build, which career, what broke - and the one thing that makes it
// safe to send: that it carries nothing the screen did not say it would.
//
// The screen tells the player: "Your squad, your saves and your name are not
// [attached]." That is a promise in the product, so it is a test here.
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { BUG_CHANNEL_URL, COMMUNITY_URL } from '../src/game/community'
import {
  CONTACT_MAILTO, DEV_CONTACT, MAILTO_LIMIT, buildReport, crashCount, mailtoUrl, noteScreen, recordCrash, reportFilename,
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
  // the About page's plain contact link opens with the game's name (1.8.1),
  // and the report and idea subjects still start with it
  ok(CONTACT_MAILTO === `mailto:${DEV_CONTACT}?subject=PHASE%3A%20Rugby%20Manager`, `the contact link carries the subject (${CONTACT_MAILTO})`)
  ok(decodeURIComponent(mailtoUrl(short).split('subject=')[1].split('&')[0]).startsWith('PHASE: Rugby Manager - '), 'and the bug report subject starts with the game\'s name')

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

// ---- where "Post on Discord" goes (1.8.2) ----------------------------------
// Owner: the bug report's Discord button opens the bug-reports channel; the
// menu's "Join us on Discord" (and Home, About, the ideas box) keep the
// server's own invite.
{
  const src = (f: string) => readFileSync(f, 'utf8')
  const bug = src('src/ui/screens/BugReport.tsx')
  ok(/^https:\/\/discord\.gg\/\w+$/.test(BUG_CHANNEL_URL), `the bug channel is a Discord invite (${BUG_CHANNEL_URL})`)
  ok(BUG_CHANNEL_URL !== COMMUNITY_URL, 'and not the server\'s front door')
  const bugPost = bug.match(/href=\{(\w+)\}[^\n]*\n[^\n]*legacy\.bgDiscordDone/)
  ok(bugPost?.[1] === 'BUG_CHANNEL_URL', `the bug report's Post on Discord opens it (${bugPost?.[1]})`)
  const app = src('src/ui/App.tsx'), home = src('src/ui/screens/Home.tsx')
  ok(/label: t\('menu\.community'\)[^\n]*href: COMMUNITY_URL/.test(app), 'the manager menu\'s Join us on Discord keeps the community invite')
  ok(/href=\{COMMUNITY_URL\}/.test(home) && !/BUG_CHANNEL_URL/.test(app + home), 'and so does Home, with the bug channel nowhere near either')
  // round 4: a title, the fields and the buttons, and no second scroll box
  ok(!/<(div|main) className="content/.test(bug.replace(/\/\*[\s\S]*?\*\//g, '')), 'the page is not nested in a second .content box (it would not scroll by touch)')
  ok(!/DEV_CONTACT|bgSendIt|bgAttached|bgShowFull/.test(bug), 'and the explainers are gone: no address line, attachment note or preview toggle')
}

console.log(fails ? `BUG PROBE FAILED (${fails})` : 'BUG PROBE PASSED: the report is actionable, and no wider than it says')
process.exit(fails ? 1 : 0)
