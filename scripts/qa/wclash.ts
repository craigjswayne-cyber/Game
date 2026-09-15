// Women's world: does the user's club ever have two fixtures in one week, and which is played by the AI path?
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS } from '../../src/game/model'
for (const [club, seed] of [['w:bristol', 101], ['w:saracens', 7], ['w:toulouse', 99], ['w:blues', 3]] as const) {
  const g = newGame(club, 'Clash', seed, undefined, 'coach', 'w', 'w')
  let stolen: string[] = [], twice: string[] = []
  for (let s = 0; s < 3; s++) {
    const target = g.season + 1; let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const mine = g.fixtures.filter(f => f.week === g.week && (f.homeId === club || f.awayId === club) && !f.tourMatch)
      if (mine.length > 1) twice.push(`s${g.season}w${g.week}:${mine.map(f => `${f.compId}/${f.stage ?? 'r' + f.round}`).join('+')}`)
      const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
      for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
      const wk = g.week
      processWeekAndAdvance(g)
      for (const f of g.fixtures.filter(f => f.week === wk && f.played && !f.events && (f.homeId === club || f.awayId === club)))
        stolen.push(`s${g.season}w${wk}:${f.compId}/${f.stage ?? 'r' + f.round} ${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId}`)
    }
  }
  console.log(`${club}/${seed}: weeks with two fixtures ${twice.length} [${twice.slice(0, 6).join(' ')}]`)
  console.log(`   user matches simmed without the manager: ${stolen.length} [${stolen.slice(0, 5).join(' | ')}]`)
}
