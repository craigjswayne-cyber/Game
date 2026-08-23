// Probe: every name in the commentary is a name on the team sheet.
//
// Live report: "Commentary includes players that aren't in the match day 23."
//
// This is the kind of bug that cannot be argued with once measured, and cannot be
// found by reading: a match generates a hundred lines of prose from a dozen
// different pools, and one pool reaching past the twenty-three men who are
// actually at the ground would go unnoticed for months while quietly wrecking the
// one thing a match engine has to get right.
//
// So this simulates real fixtures, takes every line of commentary, and looks for
// the full name of ANY player in the game world inside it. A name that belongs to
// a man who is not in either match-day 23 is a failure, and the probe prints the
// line so the pool that produced it can be found.
//
// NOTE ON HOW IT PLAYS THE MATCHES. The headless season path calls simMatch with
// detail off, so no fixture it settles keeps a single line of commentary: a first
// cut of this probe walked a whole season and reported "0 matches, 0 lines",
// which is what a probe looks like when it is measuring nothing. Commentary only
// exists on the path the live screen drives, so this drives that path: beginMatch
// with detail on, then stepTick to full-time, exactly as MatchDay does.
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick } from '../src/game/matchEngine'
import { processWeekAndAdvance, weekRng } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState, LiveCtx } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

/**
 * Every player name in the world, as a WHOLE-NAME matcher.
 *
 * The first cut used text.includes(name) and reported 22 offenders, every one of
 * them a lie: "Nathan Green" inside "Nathan Greenwood", "Freddie Clark" inside
 * "Freddie Clarke", "Digby Bell" inside "Digby Bell-Hill". A probe that cannot
 * tell two men apart will happily accuse the game of a bug it does not have, and
 * a probe whose failures are noise gets switched off. So the name has to end
 * where the match ends: no trailing letter, no hyphen.
 */
function nameIndex(state: GameState) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Object.values(state.players)
    .filter(p => p.name && p.name.includes(' '))
    .map(p => ({
      id: p.id,
      name: p.name,
      re: new RegExp(`(?<![A-Za-z'-])${esc(p.name)}(?![A-Za-z'-])`),
    }))
}

let matches = 0, lines = 0, named = 0, coachClashes = 0
const offenders: { name: string; where: string; text: string }[] = []
let namesakes = 0
const byRelation: Record<string, number> = {}

for (const [club, seed] of [['harlequins', 12345], ['northampton', 777], ['bath', 4242]] as const) {
  const g: GameState = newGame(club, 'Commentary Probe', seed)
  const names = nameIndex(g)
  const seen = new Set<number>()

  for (let w = 0; w < SEASON_WEEKS; w++) {
    // play the user's own fixture the way the live screen does, so the
    // commentary this probe reads is the commentary a manager reads
    const mine = g.fixtures.find(f => f.week === g.week && !f.played &&
      (f.homeId === g.userClubId || f.awayId === g.userClubId))
    if (mine && !seen.has(mine.id)) {
      seen.add(mine.id)
      const ctx: LiveCtx = beginMatch(g, mine, weekRng(g), true, g.userClubId)
      // twenty ticks is a full match; a few extra are harmless once it is over
      for (let i = 0; i < 24; i++) stepTick(g, ctx)
      matches++

      // The twenty-three: the men the engine put on the field and the bench for
      // THIS match, read from the side contexts rather than from the club's
      // current tactic, because a later week's selection is not this week's.
      const sheet = new Set<number>()
      for (const side of [ctx.home, ctx.away]) {
        for (const id of side.lineup) if (id != null) sheet.add(id)
        for (const id of side.onPitch) sheet.add(id)
        for (const id of side.ratings.keys()) sheet.add(id)
      }
      // The commentary also names the two COACHES ("X signals to the corners:
      // game management time"), which is correct and has nothing to do with the
      // twenty-three. Coach names are generated from the same name pools as
      // players, so a coach occasionally shares a name with a player at some
      // third club, and this probe would then accuse the right line of the wrong
      // crime. Counted separately below rather than exempted silently.
      // AND THE NAME MIGHT BELONG TO TWO MEN. Twenty-four names in this world are
      // worn by two different real players - a winger of 26 and a lock of 30
      // both called Alex Hughes - because the world builder now puts both on a
      // pitch instead of deleting the second (see scripts/namedup.ts). This
      // probe tests every player's name against every line, so when the George
      // Martin who is playing gets a mention, the OTHER George Martin matches
      // the same text and was reported as a phantom. If a man of that name is
      // on this team sheet, the line is accounted for.
      const sheetNames = new Set<string>()
      for (const id of sheet) { const nm = g.players[id]?.name; if (nm) sheetNames.add(nm) }

      const coachNames = new Set<string>()
      for (const teamId of [mine.homeId, mine.awayId]) {
        const nm = g.clubs[teamId]?.coach
        if (nm) coachNames.add(nm)
      }

      for (const e of ctx.events) {
        lines++
        const text = e.text ?? ''
        if (!text) continue
        for (const { id, name, re } of names) {
          // re, not includes: see nameIndex. The first cut kept using includes
          // here after the matcher was fixed, and went on reporting the same
          // twenty phantom offenders.
          if (!re.test(text)) continue
          named++
          if (sheet.has(id)) continue
          if (sheetNames.has(name)) { namesakes++; continue }
          // a coach of one of these two clubs who happens to share a name with
          // some player elsewhere in the world: the line is right, the collision
          // is a naming coincidence
          if (coachNames.has(name)) { coachClashes++; continue }
          const p = g.players[id]
          const rel = p?.clubId === mine.homeId || p?.clubId === mine.awayId
            ? 'at one of the two clubs but not in the 23'
            : p?.clubId
              ? `at a third club (${g.clubs[p.clubId]?.short ?? p.clubId})`
              : 'at no club at all'
          byRelation[rel] = (byRelation[rel] ?? 0) + 1
          if (offenders.length < 12) {
            offenders.push({
              name,
              where: `${g.clubs[mine.homeId]?.short} v ${g.clubs[mine.awayId]?.short}, ${e.min}' ${e.type}, ${rel}`,
              text: text.slice(0, 160),
            })
          }
        }
      }
    }
    try { processWeekAndAdvance(g) } catch { break }
  }
}

console.log(`${matches} matches, ${lines} lines of commentary, ${named} player names found in them`)
console.log(`${coachClashes} of those were a coach of one of the two clubs whose name a player elsewhere also has`)
if (offenders.length) {
  console.log('\nnames that were not on the team sheet:')
  for (const o of offenders) {
    console.log(`  ${o.name} - ${o.where}`)
    console.log(`    "${o.text}"`)
  }
  console.log('\nby relation: ' + Object.entries(byRelation).map(([k, n]) => `${k}: ${n}`).join('; '))
}

const strays = Object.values(byRelation).reduce((s, n) => s + n, 0)
console.log(`\n${strays} mentions of men who were not in the match-day 23`)
console.log(`${namesakes} mentions explained by a namesake who WAS in the 23`)

if (matches < 40) bad(`only ${matches} matches simulated, too few to judge`)
if (named < 200) bad(`only ${named} names found in ${lines} lines, so this probe is not reading the commentary`)
if (strays) bad(`${strays} lines of commentary named somebody who was not in the match-day 23`)

if (fails) { console.error(`\nCOMMENTARY PROBE: ${fails} failures`); process.exit(1) }
console.log('\nCOMMENTARY PROBE PASSED')
