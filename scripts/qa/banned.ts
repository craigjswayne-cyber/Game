// Can a suspended / Test-duty / injured man on the user's bench get on the pitch?
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { beginMatch, stepTick, resolveDecision, simMatch, lineupFor, makeSubstitution, frontRowCover } from '../../src/game/matchEngine'
import type { GameState } from '../../src/game/model'

const g0 = newGame('bath', 'QA', 7)
for (let i = 0; i < 4; i++) processWeekAndAdvance(g0)
let fx = userFixtureThisWeek(g0)
while (!fx || fx.compId === 'fr') { processWeekAndAdvance(g0); fx = userFixtureThisWeek(g0) }
const clone = () => JSON.parse(JSON.stringify(g0)) as GameState

function tryIt(label: string, mark: (g: GameState, benchId: number) => void, mode: 'ai' | 'user') {
  let got = 0, tries = 0
  for (let v = 0; v < 40 && got === 0; v++) {
    const g = clone()
    const club = g.clubs[g.userClubId]
    club.tactic.userPicked = true
    const lu = lineupFor(g, g.userClubId)
    // put the marked man in bench seat 22 (shirt 23) and make sure he is a natural for a back shirt
    const benchId = lu[22]!
    mark(g, benchId)
    const cfx = g.fixtures.find(f => f.id === fx!.id)!
    const rng = weekRng(g); for (let i = 0; i < v; i++) rng()
    const before = g.players[benchId].stats.apps
    if (mode === 'ai') {
      const ctx = beginMatch(g, cfx, rng, true, null) // the assistant's/AI path: isUser false, aiAutoSubs runs
      let guard = 0; while (ctx.seg < 3 && guard++ < 60) { if (stepTick(g, ctx) === 'FT') break }
      tries++
      if (g.players[benchId].stats.apps > before || ctx.home.ratings.has(benchId) || ctx.away.ratings.has(benchId)) got++
    } else {
      const ctx = beginMatch(g, cfx, rng, true, g.userClubId)
      const mine = ctx.userSideId === cfx.homeId ? ctx.home : ctx.away
      let msg = ''
      let guard = 0; while (ctx.seg < 3 && guard++ < 60) { if (ctx.decision) resolveDecision(g, ctx, 'posts'); const r = stepTick(g, ctx); if (ctx.decision) resolveDecision(g, ctx, 'posts')
        if (r === 'HT') msg = makeSubstitution(g, ctx, mine.lineup[14]!, benchId)
        if (r === 'FT') break }
      tries++
      if (mine.ratings.has(benchId)) { got++; console.log(`   ${label}: makeSubstitution said "${msg}"; lineup bench slot holds him: ${lineupFor(g, g.userClubId).includes(benchId)}`) }
    }
  }
  console.log(`${label} [${mode}]: got on in ${got} of ${tries} runs`)
}
tryIt('suspended (bans=2) on bench', (g, id) => { g.players[id].bans = 2 }, 'ai')
tryIt('suspended (bans=2) on bench', (g, id) => { g.players[id].bans = 2 }, 'user')
tryIt('on Test duty (natSquad) on bench', (g, id) => { g.players[id].natSquad = true }, 'ai')
tryIt('on Test duty (natSquad) on bench', (g, id) => { g.players[id].natSquad = true }, 'user')
tryIt('injured on bench', (g, id) => { g.players[id].injury = { desc: 'x', dk: 'injury.ribs', until: g.week + 2, weeks: 2 } }, 'ai')
tryIt('injured on bench', (g, id) => { g.players[id].injury = { desc: 'x', dk: 'injury.ribs', until: g.week + 2, weeks: 2 } }, 'user')
// does lineupFor keep a suspended man on the bench at all?
{ const g = clone(); g.clubs[g.userClubId].tactic.userPicked = true; const lu = lineupFor(g, g.userClubId); const id = lu[22]!; g.players[id].bans = 3
  const lu2 = lineupFor(g, g.userClubId); console.log(`lineupFor keeps a suspended bench man in the 23: ${lu2.includes(id)}  (XV slot check only: ${lu2.slice(0, 15).includes(id)})`)
  const dup = lu.slice(); dup[20] = dup[3]; g.clubs[g.userClubId].tactic.lineup = dup; g.players[id].bans = 0
  const lu3 = lineupFor(g, g.userClubId); const seen = new Set<number>(); let dups = 0; for (const x of lu3) { if (x == null) continue; if (seen.has(x)) dups++; seen.add(x) }
  console.log(`lineupFor with the same man at 4 and 21: duplicates surviving into the match sheet = ${dups}; frontRowCover counts him twice: ${JSON.stringify(frontRowCover(g, lu3))}`)
}
