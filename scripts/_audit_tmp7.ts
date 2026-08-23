import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, weekRng, userFixtureThisWeek } from '../src/game/season'
import { simMatch, autoSelect } from '../src/game/matchEngine'
import { migrate } from '../src/game/save'

// A: an OPPONENT club with zero players
{
  const g: any = newGame('leicester', 'T', 5)
  const opp = Object.values<any>(g.clubs).find((c:any)=>c.id!=='leicester' && c.leagueId==='prem')!
  for (const id of opp.players) delete g.players[id]
  opp.players = []
  opp.tactic.lineup = new Array(23).fill(null)
  let threw = ''
  try { for (let i=0;i<12;i++) processWeekAndAdvance(g) } catch(e){ threw = String(e).split('\n')[0] }
  const fx = g.fixtures.filter((f:any)=>f.played && (f.homeId===opp.id||f.awayId===opp.id))
  console.log(`A empty opponent squad: threw=${threw||'no'} played=${fx.length} sample=${fx.slice(0,3).map((f:any)=>`${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId}`).join(' | ')}`)
}
// B: EVERY player in the world retires (age them to 45)
{
  const g: any = newGame('leicester', 'T', 5)
  for (const p of Object.values<any>(g.players)) p.age = 44
  let threw = ''
  try { for (let i=0;i<50;i++) processWeekAndAdvance(g) } catch(e){ threw = String(e).split('\n')[0].slice(0,140) }
  console.log(`B world-wide retirement: threw=${threw||'no'} season=${g.season} players=${Object.keys(g.players).length} minRoster=${Math.min(...Object.values<any>(g.clubs).map((c:any)=>c.players.length))}`)
}
// C: user club squad wiped mid-season
{
  const g: any = newGame('leicester', 'T', 5)
  for (let i=0;i<6;i++) processWeekAndAdvance(g)
  const uc = g.clubs[g.userClubId]
  for (const id of uc.players) delete g.players[id]
  uc.players = []
  uc.tactic.lineup = new Array(23).fill(null)
  let threw = ''
  try { for (let i=0;i<10;i++) processWeekAndAdvance(g) } catch(e){ threw = String(e).split('\n')[0].slice(0,140) }
  console.log(`C user squad wiped: threw=${threw||'no'} roster=${uc.players.length}`)
}
// D: null venue on a played final
{
  const g: any = newGame('leicester', 'T', 5)
  for (let i=0;i<44;i++) { for (const f of g.fixtures) if (f.stage==='F') f.venue = null; processWeekAndAdvance(g) }
  console.log(`D null final venue: season=${g.season} ok`)
}
