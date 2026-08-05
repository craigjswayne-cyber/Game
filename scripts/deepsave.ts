// Build a deep showcase save (12 seasons) for late-game visual QA.
// Writes an IndexedDB-shaped record to scripts/deepsave.json.
import { writeFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS, type FacilityId } from '../src/game/model'
import { requestExpansion, requestFacility } from '../src/game/season'
import { appointStaff, sendToCourse, staffCandidates, staffInterest, type StaffRole } from '../src/game/staff'
import { commissionScout } from '../src/game/commission'
import { analystRead } from '../src/game/analyst'

// a challenge career: the deep world now exercises the Sapiac boot swap,
// the live/conquered challenge cards on the profile, and the French leagues
const g = newGame('montauban', 'Deep Gaffer', 121212, 'sapiac')
for (let season = 0; season < 12; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    // keep the showcase manager in a job for the full stretch
    g.clubs[g.userClubId].boardConfidence = Math.max(g.clubs[g.userClubId].boardConfidence, 55)
    // use the manager's levers so the showcase save has a real estate, a
    // badged backroom, a scout's report and an analyst record
    if (!g.unemployed) {
      if (g.week % 7 === 0) {
        const fids: FacilityId[] = ['pitch', 'gym', 'recovery', 'paddock', 'kicking', 'briefing', 'academy', 'shop']
        requestFacility(g, fids[Math.floor(g.week / 7) % fids.length])
      }
      if (g.week % 11 === 0) requestExpansion(g)
      const roles: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']
      const role = roles[g.week % roles.length]
      if (g.week % 5 === 0) sendToCourse(g, role)
      if (g.week % 17 === 0) {
        const cands = staffCandidates(g, role)
        const i = cands.findIndex(c => staffInterest(g, c) !== 'no')
        if (i >= 0) appointStaff(g, role, i)
      }
      if (g.week % 21 === 0) commissionScout(g, 'any', 6)
    }
    const fx = userFixtureThisWeek(g)
    if (fx) {
      const oppId = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
      const read = analystRead(g, oppId)
      if (read && g.week % 2 === 0) g.matchPrep = read.prep
      simMatch(g, fx, weekRng(g), true)
    }
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
  }
}
// land at week 2 of the new season so the Annual card is live on Home
processWeekAndAdvance(g)
console.log(`deep save: season ${g.season} week ${g.week} · annals ${(g.annals ?? []).length} · potyRoll ${(g.potyRoll ?? []).length} · hof ${(g.hof ?? []).length}`)
const uc = g.clubs[g.userClubId]
const estate = Object.values(uc.facilities ?? {}).reduce((a, b) => a + b, 0)
console.log(`estate ${estate}/40 · ground ${uc.capacity.toLocaleString()} · staff ${(Object.keys(g.staffPeople ?? {})).length} men · report ${(g.scoutFinds ?? []).length} names · analyst ${g.analystRecord?.right ?? 0}/${(g.analystRecord?.right ?? 0) + (g.analystRecord?.wrong ?? 0)}`)
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
