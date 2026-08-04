// Build a deep showcase save (12 seasons) for late-game visual QA.
// Writes an IndexedDB-shaped record to scripts/deepsave.json.
import { writeFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'

// a challenge career: the deep world now exercises the Sapiac boot swap,
// the live/conquered challenge cards on the profile, and the French leagues
const g = newGame('montauban', 'Deep Gaffer', 121212, 'sapiac')
for (let season = 0; season < 12; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    // keep the showcase manager in a job for the full stretch
    g.clubs[g.userClubId].boardConfidence = Math.max(g.clubs[g.userClubId].boardConfidence, 55)
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
  }
}
// land at week 2 of the new season so the Annual card is live on Home
processWeekAndAdvance(g)
console.log(`deep save: season ${g.season} week ${g.week} · annals ${(g.annals ?? []).length} · potyRoll ${(g.potyRoll ?? []).length} · hof ${(g.hof ?? []).length}`)
console.log(`challenge: live=${g.challenge ?? 'none'} · done=${JSON.stringify(g.challengesDone ?? [])} · league=${g.clubs[g.userClubId].leagueId}`)
const record = {
  meta: {
    slot: 'deep', club: g.clubs[g.userClubId]?.name ?? '?', season: g.season,
    week: g.week, savedAt: 1754300000000, managerName: g.managerName,
  },
  state: g,
}
writeFileSync('scripts/deepsave.json', JSON.stringify(record))
console.log('written scripts/deepsave.json')
