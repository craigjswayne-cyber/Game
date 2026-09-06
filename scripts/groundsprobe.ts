/**
 * ---- AROUND THE GROUNDS: FUNNY, AND NOTHING ELSE ----
 *
 * The owner asked for the daft stories and drew the line in the same sentence:
 * "lets include these as silly things that happened at other games BUT DO NOT
 * DO THIS IN ANY MANAGEMENt games. its just for the funny ness."
 *
 * A feature that is only inert until somebody adds "and morale drops by two" is
 * not inert. This is the probe that keeps it a joke:
 *
 *   1. it fires at all, and gets through its whole set before repeating
 *   2. it never names the user's club - it is somebody else's afternoon
 *   3. no player is ever named or attached, because the clubs are inventions
 *      and the players are real people
 *   4. it changes NOTHING: not morale, not money, not fitness, not the table
 *   5. it draws no rng, so a career already under way is untouched
 */
import { newGame } from '../src/game/newgame'
import { aroundTheGrounds } from '../src/game/gossip'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEASONS = 6
const g = newGame('bath', 'Test', 31337)
const userClub = g.clubs[g.userClubId]

const seen = new Map<string, number>()
let namedAPlayer = 0
let namedUs = 0

for (let s = 0; s < SEASONS; s++) {
  for (let i = 0; i < SEASON_WEEKS; i++) {
    processWeekAndAdvance(g)
    for (const n of g.news) {
      if (!n.k || !n.k.startsWith('news.grounds')) continue
      if (!seen.has(n.k)) seen.set(n.k, 0)
      seen.set(n.k, seen.get(n.k)! + 1)
      if (n.playerId != null) namedAPlayer++
      const txt = `${n.subject} ${n.body}`
      if (txt.includes(userClub.short) || txt.includes(userClub.name)) namedUs++
      // a real player's name must never appear in one of these
      for (const p of Object.values(g.players)) {
        if (p.name.length > 6 && txt.includes(p.name)) { namedAPlayer++; break }
      }
    }
    g.news = g.news.filter(n => !n.k?.startsWith('news.grounds'))
  }
}

console.log(`\n${SEASONS} seasons: ${seen.size} of the 11 stories ran`)
ok(seen.size > 0, 'the stories reach the feed at all')
ok(seen.size >= 8, `and it works through the set rather than repeating one (${seen.size}/11)`)
ok(namedUs === 0, `never your club - it is somebody else's ground${namedUs ? ` (${namedUs} slips)` : ''}`)
ok(namedAPlayer === 0, `and no player is ever named or attached${namedAPlayer ? ` (${namedAPlayer} slips)` : ''}`)

// ---- it changes nothing -----------------------------------------------------
// THE SIGNATURE IS THE FIRST HALF OF THE PROOF. aroundTheGrounds(state) takes
// no Rng, so it cannot draw on the shared world stream even by accident - the
// compiler enforces that, and scripts/fingerprint.ts holds the wider promise
// that a career already under way runs as it did.
//
// This is the second half: run the beat on a live world and show that the ONLY
// things it touched were the news feed and its own cooldown stamp. Everything
// else - money, morale, fitness, the tables, the squads - has to come back
// byte for byte, because a story you read must not be a story you pay for.
const w = newGame('bath', 'Test', 5150)
for (let i = 0; i < 20; i++) processWeekAndAdvance(w)

// nextId is excluded with the other two because FILING a news item spends an
// id, and that is what filing a news item is. Everything outside these three
// is the world, and the world must not move.
const everythingElse = (s: typeof w) => {
  const { news, groundsAt, nextId, ...rest } = s
  void news; void groundsAt; void nextId
  return JSON.stringify(rest)
}

let ran = 0
let untouched = true
for (let wk = 0; wk < SEASON_WEEKS; wk++) {
  w.week = wk
  const before = everythingElse(w)
  const newsBefore = w.news.length
  w.groundsAt = undefined          // re-arm, so every week gets a fair go
  aroundTheGrounds(w)
  if (w.news.length > newsBefore) ran++
  if (everythingElse(w) !== before) untouched = false
}

ok(ran > 0, `the beat fired on a live world (${ran} weeks of ${SEASON_WEEKS})`)
ok(untouched, 'and it changed nothing but the feed: no money, no morale, no fitness, no table')

console.log('')
if (fails === 0) console.log('GROUNDS PROBE PASSED: funny, about somebody else, and it changes nothing')
else console.log(`GROUNDS PROBE FAILED (${fails})`)
process.exit(fails)
