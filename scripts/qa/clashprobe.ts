import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS } from '../../src/game/model'
for (const gender of ['w', 'm'] as const) {
  const g = newGame(gender === 'w' ? 'w:bristol' : 'bath', 'x', 7, undefined, 'coach', gender, gender)
  // which weeks each league uses
  for (const c of Object.values(g.comps)) if (c.type === 'league') console.log(gender, c.id, 'rounds', c.rounds, 'weeks', c.weeksByRound.join(','))
  for (const c of Object.values(g.comps)) if (c.type !== 'league') console.log(gender, c.id, 'weeks', c.weeksByRound.join(','), 'ko', c.koWeeks.join(','))
  let guard = 0
  while (g.season === 0 && guard++ < SEASON_WEEKS + 2) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    if (g.week === SEASON_WEEKS) {
      const byWeek = new Map<string, Map<string, string[]>>()
      for (const f of g.fixtures) {
        const k = `${f.week}${f.midweek ? 'w' : ''}`
        const m = byWeek.get(k) ?? new Map()
        for (const id of [f.homeId, f.awayId]) m.set(id, [...(m.get(id) ?? []), `${f.compId}${f.stage ? ':' + f.stage : ''}`])
        byWeek.set(k, m)
      }
      let n = 0
      for (const [wk, m] of byWeek) for (const [id, comps] of m) if (comps.length > 1 && id !== 'LIO' && !(g.comps['lions'] || g.comps['w:lions'])?.teamIds.includes(id)) {
        n++
        if (n <= 25) console.log(`${gender} DOUBLE-BOOKED week ${wk}: ${id} -> ${comps.join(' + ')}`)
      }
      console.log(`${gender}: ${n} double-bookings in season 0`)
      const unplayed = g.fixtures.filter(f => !f.played)
      console.log(`${gender}: unplayed at week 48: ${unplayed.length}`)
    }
    processWeekAndAdvance(g)
  }
}
