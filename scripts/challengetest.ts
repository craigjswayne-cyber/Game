// Scripted careers audit: every challenge runs two passive seasons without
// crashing, and completion only ever fires when its condition truly holds.
import { newGame, CHALLENGES } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'

let fails = 0
const bad = (msg: string) => { fails++; console.error(`CHALLENGE FAIL: ${msg}`) }

for (const ch of CHALLENGES) {
  const g = newGame(ch.clubId, 'Audit Gaffer', 20260804, ch.id)
  if (g.challenge !== ch.id) bad(`${ch.id} not stamped at boot`)
  for (let season = 0; season < 2; season++) {
    const target = g.season + 1
    let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), false)
      // the audit measures the world, not the sack race
      g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
      processWeekAndAdvance(g)
    }
  }
  const done = (g.challengesDone ?? []).includes(ch.id)
  if (done) {
    // completion must be backed by the real condition, not a stray flag
    const uid = g.userClubId
    const legit =
      ch.id === 'sapiac' ? uid === 'montauban' && g.clubs[uid].leagueId === 'top14'
      : ch.id === 'redbull' ? g.history.some(h => h.champion === 'newcastle' && h.compId === 'prem')
      : ch.id === 'dynasty' ? g.history.some(h => h.champion === 'munster' && h.compId === 'urc') && g.history.some(h => h.champion === 'munster' && h.compId === 'cc')
      : ch.id === 'pirates' ? g.clubs['pirates'].leagueId === 'prem'
      : false
    if (!legit) bad(`${ch.id} completed without its condition holding`)
    if (g.challenge) bad(`${ch.id} done but still live`)
    if (!g.news.some(n => n.subject.includes('CHALLENGE COMPLETE'))) bad(`${ch.id} completed silently`)
  } else if (g.challenge !== ch.id) {
    bad(`${ch.id} neither live nor done after two seasons`)
  }
  console.log(`${ch.id}: ${done ? 'COMPLETED' : 'still live'} · club now in ${g.clubs[ch.clubId].leagueId} · season ${g.season}`)
}

if (fails === 0) console.log('CHALLENGE AUDIT PASSED (4 careers, 2 seasons each)')
else { console.error(`CHALLENGE AUDIT: ${fails} failures`); process.exit(1) }
