import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { migrate } from '../src/game/save'
import { type GameState, type Player, type Tactic } from '../src/game/model'
import { bad, ok, finite, checkWorld, failCount } from './worldcheck'

/**
 * ---- THE TEAM SHEET, FED NONSENSE ----
 *
 * The team sheet and the tactic sliders are the two things a manager touches
 * every single week, and they are the two things a corrupted save is most likely
 * to hold garbage in. Everything here goes straight into the match engine, so a
 * bad value does not sit quietly in a field: it gets multiplied by something.
 *
 * Every sheet below is played out as a real fixture and then the week is settled,
 * because a sheet that survives kick-off and poisons the league table afterwards
 * has not survived anything.
 *
 * The bar, again, is not "it refuses". A refusal is fine and so is a shrug. What
 * is not fine is a throw, a NaN in the score, a table that stops adding up, or a
 * result the record books cannot hold.
 */

const mine = (g: GameState): Player[] =>
  (g.clubs[g.userClubId]?.players ?? []).map(id => g.players[id]).filter(Boolean)

/**
 * Put this sheet or tactic on the pitch and settle the week around it.
 *
 * Returns the number of weeks that threw, and every sheet is played twice: once
 * as written, and once after a save round trip, because a save that cannot
 * survive being written and read back is a career that dies at the next reload.
 */
function playWith(label: string, poison: (g: GameState, t: Tactic) => void): void {
  for (const pass of ['as written', 'after a save round trip'] as const) {
    let g = newGame('northampton', 'Sheet Tester', 4242)
    const c = () => g.clubs[g.userClubId]
    try {
      poison(g, c().tactic)
    } catch (e) {
      bad('SETUP', `${label} (${pass}): building the sheet threw ${String(e).split('\n')[0].slice(0, 110)}`)
      continue
    }
    if (pass === 'after a save round trip') {
      // exactly what the store does on load: JSON out, JSON in, migrate.
      // NaN and Infinity do not survive JSON - they come back as null - which is
      // its own hazard and precisely why this pass exists.
      try {
        g = migrate(JSON.parse(JSON.stringify(g)) as GameState)
      } catch (e) {
        bad('SAVE', `${label}: a round trip through the save file threw ${String(e).split('\n')[0].slice(0, 110)}`)
        continue
      }
      ok(!!g && !!g.clubs?.[g.userClubId], `${label}: the save survives a round trip`)
    }

    let thrown = 0
    let played = 0
    for (let w = 0; w < 10; w++) {
      try {
        const fx = userFixtureThisWeek(g)
        if (fx) {
          simMatch(g, fx, weekRng(g), false)
          played++
          if (!finite(fx.homeScore) || !finite(fx.awayScore)) {
            bad('SCORE', `${label} (${pass}): the match finished ${fx.homeScore}-${fx.awayScore}`)
          }
        }
        g.newsFrom = g.nextId
        processWeekAndAdvance(g)
      } catch (e) {
        thrown++
        if (thrown === 1) bad('THREW', `${label} (${pass}): week ${g.week} threw ${String(e).split('\n')[0].slice(0, 130)}`)
        if (thrown > 3) break
        g.week = Math.min(44, g.week + 1)
      }
    }
    checkWorld(g, `${label} (${pass})`, true)
    ok(thrown === 0, `${label} (${pass}): ten weeks and ${played} match(es) without an exception`)
  }
}

// ------------------------------------------------------------- the same man
// The engine already survives one man in four shirts (breakit does that every
// week). This is the whole sheet: twenty-three shirts, one player.
playWith('one man in all twenty-three shirts', (g, t) => {
  const man = mine(g)[0]!
  t.lineup = t.lineup.map(() => man.id)
})

playWith('an empty sheet', (_g, t) => {
  t.lineup = t.lineup.map(() => null)
})

playWith('a sheet of players who do not exist', (_g, t) => {
  t.lineup = t.lineup.map((_, i) => 900_000 + i)
})

playWith('a sheet of somebody else\'s players', (g, t) => {
  const theirs = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId).slice(0, 23)
  t.lineup = t.lineup.map((_, i) => theirs[i]?.id ?? null)
})

// A sheet longer and shorter than the game expects, which is what an old save
// written by a different version of the game looks like.
playWith('a sheet with fifty slots', (g, t) => {
  const squad = mine(g)
  t.lineup = Array.from({ length: 50 }, (_, i) => squad[i % squad.length]?.id ?? null)
})

playWith('a sheet with three slots', (g, t) => {
  const squad = mine(g)
  t.lineup = [squad[0]?.id ?? null, squad[1]?.id ?? null, squad[2]?.id ?? null]
})

// ---------------------------------------------------------- fifteen props
// Law 3: a side that cannot field a specialist front row plays uncontested
// scrums. Fifteen props is the other end of the same law.
playWith('fifteen props and nothing else', (g, t) => {
  const props = mine(g).filter(p => p.pos === 'LP' || p.pos === 'TP')
  if (!props.length) return
  t.lineup = t.lineup.map((_, i) => props[i % props.length].id)
})

playWith('a sheet of nothing but wingers', (g, t) => {
  const wings = mine(g).filter(p => p.pos === 'WG')
  if (!wings.length) return
  t.lineup = t.lineup.map((_, i) => wings[i % wings.length].id)
})

// --------------------------------------------------------- the dials, broken
// Every slider is a 0-100 number that gets multiplied by something. These are
// the values a corrupted save holds and a UI never sends.
const DIALS: [string, number][] = [
  ['minus one hundred', -100], ['two hundred', 200], ['NaN', NaN],
  ['Infinity', Infinity], ['minus Infinity', -Infinity], ['a trillion', 1e12],
]
for (const [word, v] of DIALS) {
  playWith(`every tactical dial set to ${word}`, (_g, t) => {
    t.style = v; t.tempo = v; t.kicking = v; t.aggression = v
  })
}

// -------------------------------------------------- the strings, all wrong
playWith('every named call set to gibberish', (_g, t) => {
  t.exit = 'not-an-exit' as never
  t.penaltyCall = 'sometimes' as never
  t.lineoutCall = 'the-one-where-we-score'
  t.scrumCall = ''
  t.bench = '9-1' as never
  t.roles = Array.from({ length: 15 }, () => 'no-such-role')
})

playWith('a kicking list of ghosts', (_g, t) => {
  t.kickers = [900_001, 900_002, null, 900_003]
})

playWith('a bench brief for every seat, all nonsense', (_g, t) => {
  t.briefs = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? null : `brief-${i}`))
})

// ------------------------------------------- the whole tactic object missing
// An old save, or a save from before a field existed. The engine has to cope
// with the absence of things it now assumes.
playWith('a tactic with its dials deleted', (_g, t) => {
  delete (t as Partial<Tactic>).style
  delete (t as Partial<Tactic>).tempo
  delete (t as Partial<Tactic>).kicking
  delete (t as Partial<Tactic>).aggression
})

playWith('a tactic with no lineup array at all', (_g, t) => {
  delete (t as Partial<Tactic>).lineup
})

// ---------------------------------------------------- and every club at once
// One club with a broken sheet is a manager being careless. Every club with a
// broken sheet is the shape of a corrupted save file, and the engine settles
// a hundred of those a week without anybody watching.
playWith('every club in the world with a broken sheet', g => {
  for (const club of Object.values(g.clubs)) {
    club.tactic.lineup = club.tactic.lineup.map(() => 900_000)
    club.tactic.style = NaN
    club.tactic.tempo = -50
  }
})

console.log(failCount()
  ? `\nSHEET FUZZ FOUND ${failCount()} PROBLEM(S)`
  : '\nSHEET FUZZ PASSED: every impossible team sheet kicked off, finished, and left the table adding up')
if (failCount()) process.exit(1)
