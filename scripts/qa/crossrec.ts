// A live-match record from career A offered to career B (same slot, same season/week), and the cost of putResume.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { beginMatch, stepTick } from '../../src/game/matchEngine'
import { replayMatch, resumeFits, type MatchResume } from '../../src/game/resume'
import { migrate } from '../../src/game/save'
import type { GameState } from '../../src/game/model'

const toWeek = (g: GameState, w: number) => { while (g.week < w) processWeekAndAdvance(g) }
const A = newGame('leicester', 'Alice', 111)
toWeek(A, 3)
const fxA = userFixtureThisWeek(A)!
const pre = JSON.parse(JSON.stringify(A)) as GameState
const ctx = beginMatch(A, fxA, weekRng(A), true, A.userClubId)
for (let i = 0; i < 6; i++) stepTick(A, ctx)
const rec: MatchResume = { v: 1, pre, fxId: fxA.id, userSideId: A.userClubId, preTalk: null, mode: 'full', tick: ctx.tick, cursor: 5, cmds: [], season: A.season, week: A.week, savedAt: 0 }
console.log(`career A: ${A.managerName} at ${A.userClubId}, live fixture id ${fxA.id} (${fxA.homeId} v ${fxA.awayId}) tick ${ctx.tick}`)

for (const [club, seed, name] of [['northampton', 222, 'Bob'], ['toulouse', 333, 'Carla'], ['leicester', 444, 'Dan']] as const) {
  const B = newGame(club, name, seed)
  toWeek(B, 3)
  const fxB = B.fixtures.find(f => f.id === rec.fxId)
  const fits = resumeFits(rec, B)
  console.log(`career B (${name} at ${club}, seed ${seed}) week ${B.week}: fixture id ${rec.fxId} exists=${!!fxB} (${fxB ? `${fxB.homeId} v ${fxB.awayId}, played=${fxB.played}` : '-'}) -> resumeFits=${fits}`)
  if (fits) {
    const preB = migrate(JSON.parse(JSON.stringify(rec.pre)))
    const out = replayMatch(preB, rec)
    console.log(`   replay returns ${out ? 'a match' : 'null'}; store would set game = pre -> manager ${preB.managerName} at ${preB.userClubId} (B was ${name} at ${club})`)
  }
}

// putResume cost on a realistic save: JSON round trip of the whole record per noteProgress()
{
  const G = newGame('northampton', 'Cost', 4242)
  for (let s = 0; s < 3; s++) while (G.season === s) processWeekAndAdvance(G)
  const rec2 = { ...rec, pre: G }
  const t0 = performance.now(); const n = 5
  for (let i = 0; i < n; i++) JSON.parse(JSON.stringify(rec2))
  const per = (performance.now() - t0) / n
  const t1 = performance.now(); for (let i = 0; i < n; i++) structuredClone(JSON.parse(JSON.stringify(rec2)))
  const per2 = (performance.now() - t1) / n
  console.log(`putResume cost on a 3-season save (${(JSON.stringify(rec2).length / 1048576).toFixed(2)} MB): JSON round trip ${per.toFixed(0)} ms, + structuredClone (what IDB put does) ${per2.toFixed(0)} ms per call - called once per revealed commentary line and once per tick`)
}
