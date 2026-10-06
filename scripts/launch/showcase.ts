// Launch showcase: the SAME deterministic career as scripts/deepsave.ts, with
// snapshots written at the weeks its real stories land, so store art and the
// trailer can show a moment as it happened instead of editing a save.
// SNAPS="11:27,11:29,11:30" (season:week, checked after each week advances)
// OUT=dir (default storeart/saves, gitignored). MGR=name for the manager.
import { writeFileSync, mkdirSync } from 'node:fs'
const SNAPS = (process.env.SNAPS ?? '11:27,11:29,11:30').split(',').map(x => x.split(':').map(Number))
const OUT = process.env.OUT ?? 'storeart/saves'
mkdirSync(OUT, { recursive: true })
const snap = (g: any, tag: string) => {
  const record = { meta: { slot: 'deep', club: g.clubs[g.userClubId]?.name ?? '?', season: g.season, week: g.week, savedAt: 1754300000000, managerName: g.managerName }, state: g }
  writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(record))
  // and the bare state, which is what Saves > Import reads on a phone
  writeFileSync(`${OUT}/${tag}.import.json`, JSON.stringify(g)); console.log('snapshot', tag)
}
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS, type FacilityId } from '../../src/game/model'
import { requestExpansion, requestFacility } from '../../src/game/season'
import { appointStaff, sendToCourse, staffCandidates, staffInterest, type StaffRole } from '../../src/game/staff'
import { commissionScout } from '../../src/game/commission'
import { analystRead } from '../../src/game/analyst'

// a challenge career: the deep world now exercises the Sapiac boot swap,
// the live/conquered challenge cards on the profile, and the French leagues
const g = newGame('montauban', process.env.MGR ?? 'Sam Ashworth', 121212, 'sapiac')
for (let season = 0; season < 12; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    // keep the showcase manager in a job for the full stretch
    g.clubs[g.userClubId].boardConfidence = Math.max(g.clubs[g.userClubId].boardConfidence, 55)
    // use the manager's levers so the showcase save has a real estate, a
    // badged backroom, a scout's report and an analyst record
    // and not through a door the board has just closed: coming back after a
    // denial is a strike, the second is the sack (boardAsks, v1.1.4), and this
    // builder asked every seven weeks regardless, so the showcase save opened
    // on a sacking modal and e2edeep could not get past it (1.6.5)
    const capitalOpen = !(g.boardAsks?.capital?.strikes) && !(g.boardAsks?.capital?.warned)
    if (!g.unemployed) {
      if (g.week % 7 === 0 && capitalOpen) {
        const fids: FacilityId[] = ['pitch', 'gym', 'recovery', 'paddock', 'kicking', 'briefing', 'academy', 'shop']
        requestFacility(g, fids[Math.floor(g.week / 7) % fids.length])
      }
      if (g.week % 11 === 0 && capitalOpen) requestExpansion(g)
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
    for (const [ss, ww] of SNAPS) if (g.season === ss && g.week === ww) snap(g, `s${ss}w${ww}`)
  }
}
processWeekAndAdvance(g)
snap(g, 'final')
