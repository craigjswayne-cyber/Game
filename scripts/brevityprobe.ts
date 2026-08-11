// Two pieces of live phone feedback, one probe.
//
// BREVITY (19A): "far too much text. simplify and clean up any messages in
// inbox." The wordiest beats measured before the pass: the contracts digest
// at 1,181 characters (a 25-man comma list), the game-time review at 819,
// the assistant's squad read at 669. The pass caps the named beats and puts
// a global ceiling on every news body, so the next long-winded generator
// trips this probe instead of the user's thumb.
//
// FRIENDLIES (19C): "change up who we play in pre seasons so its not all the
// same three... dont play anyone from your league. can play a team from a
// lower league." The old pick was the closest club by reputation - a pure
// function of the club, so every Northampton career opened against the same
// three sides. Now a hat holds ten cross-league peers plus the four best
// lower-tier sides and the career's own rng draws three.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

// ---- the opening letters, across three very different jobs -----------------
const LETTER_CAPS: [RegExp, number, string][] = [
  [/assistant's read on the squad/, 520, 'squad read'],
  [/ones to watch/, 500, 'scout circular'],
  [/terraces|faithful|support are ready/, 460, 'fan reaction'],
  [/backroom staff you have inherited/, 420, 'staff letter'],
]
for (const club of ['northampton', 'leicester', 'bath']) {
  const g = newGame(club, 'Brief', 7)
  for (const [re, cap, name] of LETTER_CAPS) {
    const n = g.news.find(x => re.test(x.subject))
    if (!n) continue // not every club fires every letter
    ok(n.body.length <= cap, `${club}: the ${name} fits a phone (${n.body.length} <= ${cap})`)
  }
}

// ---- three seasons of inbox, nothing is a wall of text ----------------------
{
  const g = newGame('northampton', 'Brief', 4242)
  let worst = { len: 0, subject: '' }
  let seenId = 0
  const beats: Record<string, number> = {}
  while (g.season < 3) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    processWeekAndAdvance(g)
    for (const n of g.news) {
      if (n.id < seenId) continue
      seenId = Math.max(seenId, n.id + 1)
      const len = (n.body ?? '').length
      if (len > worst.len) worst = { len, subject: n.subject }
      if (/contracts? expiring/.test(n.subject)) beats.contracts = Math.max(beats.contracts ?? 0, len)
      if (/Game time:/.test(n.subject)) beats.gametime = Math.max(beats.gametime ?? 0, len)
    }
  }
  console.log(`  longest body in three seasons: ${worst.len} chars ("${worst.subject}")`)
  ok(worst.len <= 800, 'no message in three seasons of inbox exceeds 800 characters')
  ok((beats.contracts ?? 0) <= 340, `the contracts digest names three and counts the rest (${beats.contracts ?? 0} <= 340)`)
  ok((beats.gametime ?? 0) <= 520, `the game-time review names three and counts the rest (${beats.gametime ?? 0} <= 520)`)
}

// ---- pre-season friendlies: drawn from a hat, never your own league ---------
const trioOf = (g: GameState) => {
  const me = g.userClubId
  return g.fixtures
    .filter(f => f.compId === 'fr' && f.week <= 3 && (f.homeId === me || f.awayId === me))
    .sort((a, b) => a.week - b.week)
    .map(f => (f.homeId === me ? f.awayId : f.homeId))
}
{
  const trios: string[] = []
  let lowerSeen = 0
  let sameLeague = 0
  for (let seed = 1; seed <= 12; seed++) {
    const g = newGame('northampton', 'Friendly', seed)
    const me = g.clubs[g.userClubId]
    const trio = trioOf(g)
    ok2(trio.length === 3, seed, `three pre-season friendlies (got ${trio.length})`)
    for (const id of trio) {
      if (g.clubs[id].leagueId === me.leagueId) sameLeague++
      if (g.clubs[id].rep <= me.rep - 12) lowerSeen++
    }
    trios.push(trio.join('+'))
  }
  const distinct = new Set(trios).size
  console.log(`  12 careers drew ${distinct} distinct opponent trios; ${lowerSeen} lower-league trips`)
  ok(sameLeague === 0, 'no career opens against a club from its own league')
  ok(distinct >= 4, `careers do not all open against the same three sides (${distinct} distinct trios)`)
  ok(lowerSeen >= 1, 'a lower-league side gets its day against the big club')
}
function ok2(cond: boolean, seed: number, what: string) {
  if (!cond) { console.log(`FAIL seed ${seed}: ${what}`); fails++ }
}

console.log(fails ? `\nBREVITY PROBE FAILED (${fails})` : '\nBREVITY PROBE PASSED: short letters, fresh friendlies')
process.exit(fails ? 1 : 0)
