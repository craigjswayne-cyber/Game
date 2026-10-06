/**
 * ---- THE TWO TRANSFER WINDOWS, FOR EVERY CLUB ----
 *
 * Owner: "There should be more warning when transfer window is open/closed - a
 * warning 3 days, 2 days, final 24 hours with a clear message it is closed.
 * There should be 2 transfer windows (end of season til beginning of Oct) and
 * (January) in a season aside from medical jokers. This should apply to all
 * teams - a team signed my player outside the window."
 *
 * What this holds:
 *
 *   1. THE WEEKS ARE THE CALENDAR'S. The summer window runs from the close
 *      season to the week holding the start of October, January is the weeks
 *      whose every day is in January, and windowOpen says exactly that.
 *   2. NOBODY MOVES A MAN BETWEEN CLUBS OUTSIDE A WINDOW. Two seasons of the
 *      world, every club, the manager accepting every bid he is allowed to:
 *      a player who changes clubs (not a loan, not a joker) does it in a
 *      window week, and no bid for the manager's men sits on his desk in a
 *      shut week.
 *   3. THE COUNTDOWN IS POSTED ONCE EACH, IN ORDER: open, 3 days, 2 days, final
 *      24 hours, closed, through a save and reload, whether the week is walked
 *      a day at a time or settled in one go.
 *
 * Run: npx vite-node scripts/windowprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { seasonStart, SEASON_WEEKS, type GameState, type NewsItem } from '../src/game/model'
import { respondToOffer, windowOpen } from '../src/game/ai'
import { migrate } from '../src/game/save'
import { dayHasSomething, dayOfStory } from '../src/game/days'
import {
  JANUARY_OPEN, JANUARY_SHUT, SUMMER_OPEN, SUMMER_SHUT, postWindowNotes, windowNoteOn,
} from '../src/game/window'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- 1. the weeks ----
{
  const day = (season: number, week: number, d: number) =>
    new Date(seasonStart(season) + ((week - 1) * 7 + (d - 5)) * 86400000)
  let jan = true, oct = true
  const inMonth = (s: number, w: number, m: number) => [0, 1, 2, 3, 4, 5].filter(d => day(s, w, d).getUTCMonth() === m).length
  for (let s = 0; s < 30; s++) {
    // a window week is a January week: most of its days are in January, none
    // in February, and the week before it is mostly December
    for (let w = JANUARY_OPEN; w <= JANUARY_SHUT; w++) if (inMonth(s, w, 0) < 4 || inMonth(s, w, 1) > 0) jan = false
    if (inMonth(s, JANUARY_OPEN - 1, 0) > 3) jan = false
    // the summer window's last Saturday is the turn of September into October
    const sat = day(s, SUMMER_SHUT, 5)
    const md = sat.getUTCMonth() * 100 + sat.getUTCDate()
    if (md < 827 || md > 905) oct = false
  }
  ok(jan, `weeks ${JANUARY_OPEN} to ${JANUARY_SHUT} are the January weeks, thirty seasons running`)
  ok(oct, `the summer window shuts between 28 Sep and 5 Oct (week ${SUMMER_SHUT}), thirty seasons running`)
  const expect = (w: number) => w >= SUMMER_OPEN || w <= SUMMER_SHUT || (w >= JANUARY_OPEN && w <= JANUARY_SHUT)
  const weeks = Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1)
  ok(weeks.every(w => windowOpen(w) === expect(w)),
    `windowOpen is weeks ${SUMMER_OPEN}-${SEASON_WEEKS}, 1-${SUMMER_SHUT} and ${JANUARY_OPEN}-${JANUARY_SHUT} (${weeks.filter(windowOpen).join(',')})`)
  ok(SUMMER_OPEN === 46 && !windowOpen(45) && !windowOpen(9) && !windowOpen(21) && !windowOpen(26),
    'and shut either side of each')
}

// ---- 2 + 3. two seasons of the world ----
const NOTE = /^news\.window(OpenSummer|OpenJanuary|Left3|Left2|Left1|ShutJanuary|ShutSummer)$/
for (const [club, seed, walk] of [['leicester', 7101, false], ['bath', 7102, true]] as const) {
  console.log(`--- ${club}, ${walk ? 'walked a day at a time' : 'settled a week at a time'}`)
  let g: GameState = newGame(club, 'Window', seed)
  const illegal: string[] = []
  const deskShut: string[] = []
  let moves = 0, sold = 0, refused = 0
  // every notice as it is filed (the shelf is trimmed later), and the week the
  // manager stopped having an inbox for them, if he was sacked
  const seen = new Set<number>()
  const notes: NewsItem[] = []
  const collect = () => {
    for (const n of g.news) if (NOTE.test(n.k ?? '') && !seen.has(n.id)) { seen.add(n.id); notes.push(n) }
  }
  let sackedAt = Infinity
  for (let i = 0; i < SEASON_WEEKS * 2; i++) {
    const week = g.week
    if (g.unemployed && sackedAt === Infinity) sackedAt = g.season * 100 + g.week
    // the manager takes the bids he is allowed to, two a season, so he keeps
    // a side (and a job) to be warned in
    for (const o of g.offers.filter(x => x.status === 'pending' && x.forUser)) {
      const before = g.players[o.playerId]?.clubId
      if (sold >= 2 * (g.season + 1)) { respondToOffer(g, o.id, false); continue }
      respondToOffer(g, o.id, true)
      if (g.players[o.playerId]?.clubId !== before) sold++
    }
    if (walk) {
      // the store's walk: each day as Continue reaches it (store.ts)
      for (let d = 0; d <= 5; d++) {
        if (d > 0 && windowNoteOn(g.week, d) && !g.unemployed) {
          ok(dayHasSomething(g, d as 0), `week ${g.week}: Continue stops on day ${d} for the countdown`)
        }
        g.day = d
        postWindowNotes(g)
        collect()
        // and a second visit to the same day posts nothing
        const n = g.news.length
        postWindowNotes(g)
        if (g.news.length !== n) ok(false, `week ${g.week} day ${d}: posted twice`)
      }
    }
    const was = new Map(Object.values(g.players).map(p => [p.id, { club: p.clubId, loanFrom: p.loanFrom }]))
    const from = g.nextId
    processWeekAndAdvance(g)
    g.day = 0
    collect()
    for (const p of Object.values(g.players)) {
      const b = was.get(p.id)
      if (!b || !b.club || !p.clubId || b.club === p.clubId) continue
      // a loan going out or coming home is not a transfer, and a joker is the exception
      if (p.loanFrom || b.loanFrom === p.clubId || p.joker) continue
      // released and signed as a free agent in the same settle: no registration moved
      const story = g.news.filter(n => n.id >= from && n.playerId === p.id && n.k?.startsWith('news.transferDone')).pop()
      if (story?.k === 'news.transferDoneFree') continue
      moves++
      if (!windowOpen(week)) illegal.push(`${p.name} ${b.club}->${p.clubId} wk${week} ${story?.k ?? ''}`)
    }
    if (!windowOpen(g.week) && !g.unemployed) {
      const n = g.offers.filter(o => o.status === 'pending' && o.forUser).length
      if (n) deskShut.push(`wk${g.week}: ${n}`)
      // and a stale one cannot be accepted
      const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad)
      const other = Object.values(g.clubs).find(c => c.id !== g.userClubId)
      if (p && other && g.week === 12) {
        const id = g.nextId++
        g.offers.push({ id, playerId: p.id, fromClubId: other.id, toClubId: g.userClubId, fee: 1_000_000, week: g.week, forUser: true, status: 'pending' })
        respondToOffer(g, id, true)
        if (p.clubId === g.userClubId) refused++
        g.offers = g.offers.filter(o => o.id !== id)
      }
    }
    // a save and reload half way through each season
    if (g.week === 24 || g.week === 4) g = migrate(JSON.parse(JSON.stringify(g)))
  }
  console.log(`  ${moves} moves between clubs, ${sold} of them the manager's sales${sackedAt < Infinity ? `, sacked at ${sackedAt}` : ''}`)
  ok(moves > 10, 'the market still moves')
  ok(illegal.length === 0, `no permanent move between clubs outside a window${illegal.length ? ': ' + illegal.slice(0, 5).join('; ') : ''}`)
  ok(deskShut.length === 0, `no bid for the manager's men sits on his desk in a shut week${deskShut.length ? ': ' + deskShut.join(', ') : ''}`)
  ok(refused >= 1, `and a stale bid in a shut week cannot be accepted (${refused})`)

  const seq = notes.map(n => `${n.season}:${n.week}:${n.day}:${(n.k ?? '').slice(11)}`)
  const want: string[] = []
  for (let s = 0; s < 2; s++) {
    want.push(`${s}:${SUMMER_SHUT}:2:Left3`, `${s}:${SUMMER_SHUT}:3:Left2`, `${s}:${SUMMER_SHUT}:4:Left1`, `${s}:${SUMMER_SHUT + 1}:0:ShutJanuary`)
    want.push(`${s}:${JANUARY_OPEN}:0:OpenJanuary`)
    want.push(`${s}:${JANUARY_SHUT}:2:Left3`, `${s}:${JANUARY_SHUT}:3:Left2`, `${s}:${JANUARY_SHUT}:4:Left1`, `${s}:${JANUARY_SHUT + 1}:0:ShutSummer`)
    want.push(`${s}:${SUMMER_OPEN}:0:OpenSummer`)
  }
  // a sacked manager has no inbox to warn: the record stops where his job did
  const due = want.filter(x => { const [s, w] = x.split(':').map(Number); return s * 100 + w < sackedAt })
  ok(due.length >= 5 && JSON.stringify(seq) === JSON.stringify(due),
    `the countdown is posted once each, in order (${seq.length} of ${due.length})${JSON.stringify(seq) === JSON.stringify(due) ? '' : `\n    got  ${seq.join(' ')}\n    want ${due.join(' ')}`}`)
  ok(notes.every(n => dayOfStory(n) === n.day), 'and each is read on its own day')
  ok(notes.every(n => !!n.subject && !!n.body && !n.body.includes('{')), 'with its date filled in')
}

// ---- the stamp survives a damaged save ----
{
  const g = newGame('leicester', 'Window', 7103)
  ;(g as unknown as Record<string, unknown>).windowNote = 'junk'
  g.news.push({ id: g.nextId++, week: 1, season: 0, type: 'transfer', read: false, subject: 'x', body: 'x', day: 9 })
  const m = migrate(JSON.parse(JSON.stringify(g)))
  ok(m.windowNote === undefined && m.news[m.news.length - 1].day === undefined, 'a junk stamp or day is dropped on load')
}

console.log(fails ? `WINDOW PROBE FAILED (${fails})` : 'WINDOW PROBE PASSED: two windows, every club, a countdown posted once')
process.exit(fails ? 1 : 0)
