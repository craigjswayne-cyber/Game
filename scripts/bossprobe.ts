// Probe: the man in the other dugout is somebody, and stays somebody.
//
// The audit's finding was that the rival is a CLUB. There is a season rival
// tracker, a derby ledger and a title race, and no person attached to any of it
// for longer than one press question, so the rivalry never develops.
//
// WHAT THIS PROBE IS REALLY GUARDING, though, is the first draft of boss.ts,
// which invented a whole second naming system - a pool of fictional names hashed
// off the club id - without checking that newgame already names every AI head
// coach in club.coach and that jobs.ts already sacks them. That would have had
// the club screen calling him one thing and the news calling him another, and the
// two would only ever have been seen together by a player, on a phone, weeks
// later. So the first thing asserted here is that there is exactly ONE name for
// the man, and it is the club's.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { rivalBeat, rivalBoss, rivalVerdict } from '../src/game/boss'
import { SEASON_WEEKS, type NewsItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'Boss Probe', 4242)

// ---- one man, one name -----------------------------------------------------
{
  const r = rivalBoss(g)
  ok(!!r, 'a rival manager is identified from the first week')
  ok(!!r && r.boss === r.club.coach,
    'and his name IS the club\'s head coach, not a second invented identity')
  const unnamed = Object.values(g.clubs).filter(c => c.id !== g.userClubId && !c.coach)
  ok(unnamed.length === 0, `every AI club has a named coach to be (${unnamed.length} without)`)
  console.log(`  rival: ${r?.boss} of ${r?.club.name}`)
}

// ---- he speaks, and not too often ------------------------------------------
const beats: NewsItem[] = []
const verdicts: NewsItem[] = []
const seen = new Set<number>()
for (let w = 0; w < SEASON_WEEKS * 3 + 4; w++) {
  processWeekAndAdvance(g)
  for (const n of g.news) {
    if (seen.has(n.id)) continue
    seen.add(n.id)
    // NOT just the microphone: the pundits' pre-season predictions carry the same
    // glyph and are nobody's quote, and the first version of this probe swept one
    // up and then failed its own "every one of them names a person" check on it.
    if (/🎙/.test(n.subject) && !/Pundits/.test(n.subject)) beats.push(n)
    if (/finished above|did not last the season/.test(n.subject)) verdicts.push(n)
  }
}
console.log(`\nover three seasons: ${beats.length} rival quotes, ${verdicts.length} season verdicts`)
for (const b of beats.slice(0, 6)) console.log(`  s${b.season}w${b.week}  ${b.subject}`)
for (const v of verdicts) console.log(`  s${v.season}w${v.week}  ${v.subject}`)

ok(beats.length >= 3, 'he has an opinion at least once a season')
ok(beats.length <= 30, `and is not a pen pal (${beats.length} in three seasons)`)
// the news pressure tripwire exists for a reason: no more than one a week
{
  const perWeek = new Map<string, number>()
  for (const b of beats) {
    const k = `${b.season}:${b.week}`
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1)
  }
  ok([...perWeek.values()].every(n => n === 1), 'never two of him in the same week')
}
ok(verdicts.length >= 2, 'and the season closes with an accounting of who finished above whom')

// ---- the words are usable --------------------------------------------------
{
  const all = [...beats, ...verdicts]
  ok(all.every(n => !n.subject.includes('undefined') && !n.body.includes('undefined')),
    'no undefined leaks into a headline or a body')
  ok(all.every(n => !/—/.test(n.subject + n.body)), 'no em dashes')
  ok(new Set(beats.map(b => b.subject)).size >= 2,
    `he does not say the same thing every time (${new Set(beats.map(b => b.subject)).size} distinct openers)`)
  // he is named in his own quotes: a story about "their coach" is the bug this fixes
  ok(all.every(n => /[A-Z][a-z]+ [A-Z]/.test(n.body)), 'every one of them names a person')
}

// ---- the season card has something to draw (C4) ----------------------------
//
// The card at the top of the annual is the one block in the game meant to leave
// the game, and no browser probe reaches that screen: it only exists after a
// rollover, which is forty-odd weeks of tapping. This walk has just played three
// seasons, so it is the cheapest honest place to check the CARD'S DATA CONTRACT -
// the fields it reads, present and sane. A card drawing "undefined" is the one
// failure mode that would be screenshotted and sent to somebody.
{
  const r = g.review
  ok(!!r, 'a season review exists after a rollover')
  if (r) {
    ok(typeof r.clubName === 'string' && r.clubName.length > 0, 'the card has a club name to print')
    ok(r.league.pos >= 0, `and a league position (${r.league.pos})`)
    ok(r.overall.m > 0, `and a match count to take a percentage of (${r.overall.m})`)
    ok(r.overall.w + r.overall.d + r.overall.l === r.overall.m,
      'and its W/D/L adds up to that count')
    ok(Array.isArray(r.trophies), 'trophies is a list, so the cup line can be skipped rather than undefined')
    const pct = Math.round((r.overall.w / r.overall.m) * 100)
    ok(Number.isFinite(pct) && pct >= 0 && pct <= 100, `the win percentage is printable (${pct}%)`)
    for (const s of [r.topTries, r.topPoints]) {
      ok(!s || (typeof s.name === 'string' && Number.isFinite(s.val)),
        'a named star, if there is one, has both a name and a number')
    }
    console.log(`  season card: ${r.clubName}, ${r.league.pos}, ${r.overall.w}W ${r.overall.d}D ${r.overall.l}L, ${pct}%`)
  }
}

// ---- and a club between coaches is nobody's rival --------------------------
//
// jobs.ts clears club.coach the moment a club sacks him, and a quote from a man
// who does not exist is worse than no quote at all.
{
  const r = rivalBoss(g)
  if (r) {
    r.club.coach = undefined
    ok(rivalBoss(g)?.club.id !== r.club.id || rivalBoss(g) === null,
      'a club with no coach in post is not chosen as the rival')
    const quiet = rivalBeat(g)
    ok(quiet === null || !quiet.body.includes('undefined'), 'and nothing quotes a vacancy')
  }
  // every club vacant at once: the whole feature has to fall silent, not throw
  for (const c of Object.values(g.clubs)) if (c.id !== g.userClubId) c.coach = undefined
  ok(rivalBoss(g) === null, 'a world with no coaches in post has no rival')
  ok(rivalBeat(g) === null, 'and files nothing')
  ok(rivalVerdict(g) !== undefined, 'and the season verdict still returns without throwing')
}

console.log(fails ? `\nBOSS PROBE FAILED (${fails})` : '\nBOSS PROBE PASSED: the rivalry has a face, and only one of them')
process.exit(fails ? 1 : 0)
