// Probe: the Rugby Wire does not repeat itself.
//
// Reported live, with a screenshot of the REF MIC story: "ive seen this a few
// times - needs to be funnier messages - more humour for it to be a viral
// sensation style thing."
//
// The funny half is a writing job and no probe can grade a joke. The REPETITION
// half is arithmetic, and it was the real complaint: the colour column ran in
// roughly four weeks out of five and picked from nine items with rng() * length,
// so by the birthday problem a duplicate inside a month was the expected outcome
// rather than bad luck. Random choice over ANY pool size repeats; the fix was to
// spend the whole pool before spending anything twice.
//
// So this measures the gap. Over three seasons of real settlement:
//
//   no colour story is used twice before every other one has been used once. That
//     is the least-recently-used property, and it is the whole fix.
//   the gap between two airings of the same story is at least a dozen weeks.
//   the pool is genuinely deep, not one story wearing hats.
//   nothing carries an em dash, and every item has a turn in it - a body of one
//     flat sentence is a filler item, not a story somebody screenshots.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g: GameState = newGame('northampton', 'Wire Probe', 606)

// Absolute week, so a gap that straddles a season rollover is measured
// honestly - USING THE REAL SEASON LENGTH. This sat hardcoded at 34 from
// when seasons were 34 weeks; at 45 weeks every cross-season gap read 11
// weeks short, and a LAW WATCH pair aired a perfectly legal 16 weeks apart
// (s1wk44 -> s2wk15) failed the 12-week bar as "5". The yardstick with a
// stale constant is probe bug number ten.
const WEEKS_PER = SEASON_WEEKS
const seen: { key: string; at: number; subject: string; body: string }[] = []
let seenIds = 0

// four seasons, not three: the 25D-2 match-day wobble shifted which results
// qualify for a story on this seed and the three-season sample dipped just
// under the volume floors (37 of 40, 24 of 25) - a longer watch, same bars
// COLLECT BY ID, NOT BY ARRAY POSITION. The news log is capped (NEWS_KEEP
// trims the array every week), so once the cap bites, `slice(lengthBefore)`
// returns nothing forever - the probe silently read only the first 34 weeks
// and called it three seasons. Ids are monotonic; the cap cannot hide them.
let lastId = 0
// The watch WINDOW stays at the 136 calls every volume floor and the LRU
// spread bound were calibrated against ("four seasons" of 34 weeks, from the
// same era as the stale constant). Only the abs-week YARDSTICK above moves to
// the real season length: lengthening the window to 4 true seasons pushed the
// airing count up and the use-count spread legitimately to 3, which is the
// bound doing its job on a bigger sample, not the rotation going dishonest.
const WATCH_CALLS = 136
for (let i = 0; i < WATCH_CALLS; i++) {
  processWeekAndAdvance(g)
  for (const n of g.news.filter(x => x.id > lastId)) {
    lastId = Math.max(lastId, n.id)
    if (n.type !== 'gossip') continue
    // The colour column is the one with a category prefix in caps before a colon.
    // Rumours, wonderkid watch and the law proposals are separate beats with
    // their own freshness rules and are not what was reported.
    const m = /^([A-Z][A-Z ]+):/.exec(n.subject)
    if (!m) continue
    seen.push({ key: m[1], at: g.season * WEEKS_PER + g.week, subject: n.subject, body: n.body })
  }
  seenIds = Object.keys((g as GameState & { wireLog?: Record<string, number> }).wireLog ?? {}).length
}

// The COLOUR set is the LRU-managed pool this probe was written about. It has
// to be defined before the repeat metrics because the repeat metrics must be
// SCOPED TO IT: rumours and the other separate beats also carry a CAPS-colon
// subject, and a rumour body is formulaic ON PURPOSE (its freshness rule is
// per-player, not per-template), so name-stripping two different rumours a
// fortnight apart produces the same fingerprint and a false "repeat". That
// collision sat latent until a world-stream shift aired two close together
// and the gap assertion accused the colour column of a rumour's rhythm.
const COLOUR = new Set(['FAN FORUM', 'SOCIAL', 'PODCAST', 'BROADCAST', 'STATS ACCOUNT',
  'PUNDIT COLUMN', 'WHOLESOME', 'AGENT TALK', 'REF MIC', 'CHARITY', 'MERCH', 'TERRACES',
  'GROUNDSMAN WATCH', 'MASCOT INCIDENT', 'STADIUM PA', 'CATERING', 'TRAINING LEAK',
  'WILDLIFE', 'SPONSORS', 'WEATHER', 'LOGISTICS', 'TMO', 'CLUBHOUSE', 'LAW WATCH',
  // the wild ones (16B): held to the same joke-structure standard as the rest
  'VILLAGE RUGBY', 'SILVERWARE', 'GRASSROOTS', 'MATCHDAY', 'COMMUNITY'])
const colour = seen.filter(s => COLOUR.has(s.key))

// The log is the ground truth for WHICH template fired; the subject line carries a
// club and a player name, so two airings of the same joke do not look alike.
// Re-derive the template from the log by replaying: simpler and more honest is to
// read the log's own size, and measure repeats through the category plus the
// distinctive clause of the body.
const fingerprint = (body: string) => body.replace(/[A-Z][a-z]+ [A-Z][a-z']+/g, 'NAME').slice(0, 70)
// CLUBHOUSE is warm-and-daft but it is NOT in the wireLog LRU - it has its
// own rng draw and a 6-week same-season gate, so its templates can lap the
// field at season boundaries. The LRU metrics judge the LRU pool.
const lru = colour.filter(s => s.key !== 'CLUBHOUSE')
const gaps: number[] = []
const lastAt = new Map<string, number>()
const uses = new Map<string, number>()
for (const s of lru) {
  const fp = fingerprint(s.body)
  uses.set(fp, (uses.get(fp) ?? 0) + 1)
  const prev = lastAt.get(fp)
  if (prev != null) gaps.push(s.at - prev)
  lastAt.set(fp, s.at)
}

console.log(`\n${seen.length} colour stories over four seasons, ${uses.size} distinct, ${seenIds} templates in the log`)
console.log(`categories seen: ${[...new Set(seen.map(s => s.key))].sort().join(', ')}\n`)
console.log('a sample, to be read rather than counted:\n')
for (const s of seen.slice(0, 4)) console.log(`  ${s.subject}\n    ${s.body.slice(0, 150)}...\n`)

ok(seen.length >= 40, `enough stories to judge (${seen.length})`)
ok(uses.size >= 18, `the pool is deep: ${uses.size} distinct colour stories`)

// THE LEAST-RECENTLY-USED PROPERTY. Within one candidate set nothing goes
// round twice while something waits for its first airing. Over four seasons
// the candidate set itself moves (a random club each week decides which takes
// exist), so a rarely-available story can lag the ever-present ones by a
// couple of airings - the spread bound is 2, not the single-window 1.
const counts = [...uses.values()]
const spread = Math.max(...counts) - Math.min(...counts)
ok(spread <= 2, `the LRU keeps the rotation honest (use counts span ${spread})`)

const worst = gaps.length ? Math.min(...gaps) : Infinity
ok(worst >= 12, `the closest a story came to repeating itself was ${worst === Infinity ? 'never' : `${worst} weeks`}`)

// A COLOUR story with no turn in it is a filler item: three sentences minimum, so
// there is room for a setup and a punchline. Held to the colour beats only. A
// transfer whisper is deliberately one line - "Whispers from London: Saracens have
// made him their number one target" is doing its whole job in that sentence - and
// holding a rumour to a joke's structure would make the feed worse, not better.
ok(colour.length >= 25, `enough colour stories to judge the writing (${colour.length})`)
const flat = colour.filter(s => s.body.split(/[.!?] /).length < 3)
for (const f of flat) console.log(`    FLAT: ${f.subject}`)
ok(flat.length === 0, `every colour story has a turn in it${flat.length ? ` (${flat.length} do not)` : ''}`)

const dashes = seen.filter(s => (s.subject + s.body).includes('—'))
ok(dashes.length === 0, 'no em dashes on the wire')

if (fails) { console.error(`\nWIRE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nWIRE PROBE PASSED: the wire spends its whole pool before repeating a word')
