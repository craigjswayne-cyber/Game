// A save and reload changes nothing: the short version of
// scripts/reloaddetprobe.ts (which plays sixty weeks). Two careers from one
// seed, one of them through JSON and migrate after every week; the played
// scores, every club's balance, the id counter and the player count must agree.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { migrate } from '../src/game/save'
import { resetIds } from '../src/game/attributes'
import type { GameState } from '../src/game/model'

const WEEKS = 8

function week(g: GameState) {
  // one id counter per career, as a reload gives it (see reloaddetprobe)
  resetIds(g.pidNext ?? 1)
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}

function sig(g: GameState): string {
  const fx = g.fixtures.filter(f => f.played).map(f => `${f.id}:${f.homeScore}-${f.awayScore}`).join(',')
  const bal = Object.values(g.clubs).map(c => `${c.id}:${c.balance}`).join(',')
  return `${fx}|${bal}|${g.nextId}|${Object.keys(g.players).length}`
}

describe('determinism', () => {
  it(`a career saved and loaded every week matches one played straight through (${WEEKS} weeks)`, () => {
    const A = newGame('bath', 'Det', 777)
    let B = newGame('bath', 'Det', 777)
    B.saveName = A.saveName; B.managerName = A.managerName
    let played = 0
    for (let w = 0; w < WEEKS; w++) {
      week(A); week(B)
      expect(sig(B), `week ${w}`).toBe(sig(A))
      played = A.fixtures.filter(f => f.played).length
      B = migrate(JSON.parse(JSON.stringify(B)))
    }
    // a run that played nothing would agree trivially
    expect(played).toBeGreaterThan(50)
  }, 120_000)
})
