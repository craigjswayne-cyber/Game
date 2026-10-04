// Writes a save for the 1.8.4 identity screenshots: a real season at
// Leicester played through the engine to May, with four earlier seasons of an
// academy-led career on the conduct book and one promise broken this season,
// so the Profile has a trajectory and the May letter judges the method.
// Usage: npx vite-node scripts/qa/p184_identity_save.ts <out.json>
import { writeFileSync } from 'node:fs'
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { arcOf } from '../../src/game/arcbook'
import { chairmanOf, jobProfile } from '../../src/game/chairman'
import { jobChance, jobFit } from '../../src/game/jobs'
import { remember } from '../../src/game/memory'
import { mgrTraits, trendLines } from '../../src/game/repute'

const g = newGame('leicester', 'Board Gaffer', 18404)
const a = arcOf(g)
for (let s = 0; s < 64; s++) { a.chairSalt[g.userClubId] = s; if (chairmanOf(g, g.userClubId) === 'youth') break }
a.conduct = [0, 1, 2, 3].map(i => ({
  s: g.season - 4 + i, c: g.userClubId, tier: 1, pos: 4, n: 10, m: 24, w: 14, d: 0, l: 10, pf: 25, pa: 22, lg: 24,
  deb: i < 2 ? 1 : 3, hg: i < 2 ? 18 : 40, buy: 0, wages: 5_000_000, hard: 1, kind: 2, broke: 0, mor: 6.4, pats: 1,
}))
const start = g.season
for (let i = 0; i < 80 && g.season === start; i++) {
  const c = g.clubs[g.userClubId]
  c.boardConfidence = Math.max(c.boardConfidence, 70)
  if (g.week === 30) {
    remember(g, { kind: 'promise-broken', clubId: g.userClubId, sal: 2 })
    for (let k = 0; k < 3; k++) remember(g, { kind: 'academy-debut', clubId: g.userClubId })
  }
  processWeekAndAdvance(g)
}
// an academy club and a steady one on the Job Centre, so the fit line shows on one card only
const acad = Object.values(g.clubs).find(c => c.players.length && c.id !== g.userClubId && jobProfile(g, c.id) === 'academy')
const plain = Object.values(g.clubs).find(c => c.players.length && c.id !== g.userClubId && jobProfile(g, c.id) === 'steady' && c.leagueId === g.clubs[g.userClubId].leagueId)
g.vacancies = [acad, plain].filter(c => !!c).map(c => ({ clubId: c!.id, week: g.week }))
console.log('jobs', g.vacancies.map(v => `${v.clubId} ${jobProfile(g, v.clubId)} ${jobChance(g, v.clubId).toFixed(2)} fit ${jobFit(g, v.clubId)}`))
writeFileSync(process.argv[2], JSON.stringify(g))
console.log('written', g.season, mgrTraits(g), trendLines(g), g.arc!.conduct.at(-1), g.news.filter(n => n.k === 'arc.verdict').map(n => n.v?.rows_ll))
