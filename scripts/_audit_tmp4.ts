import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
const g: any = newGame('leicester', 'T', 1234)
const stat = () => {
  const sizes = Object.values<any>(g.clubs).map(c => c.players.length)
  const fa = Object.values<any>(g.players).filter((p:any)=>!p.clubId).length
  return `season ${g.season}: players ${Object.keys(g.players).length}, clubs ${Object.keys(g.clubs).length}, roster min/med/max ${Math.min(...sizes)}/${sizes.sort((a,b)=>a-b)[Math.floor(sizes.length/2)]}/${Math.max(...sizes)}, freeAgents ${fa}, save ${(JSON.stringify(g).length/1048576).toFixed(2)}MB`
}
console.log(stat())
const t0 = Date.now()
for (let s = 0; s < 25; s++) {
  const ts = Date.now()
  for (let w = 0; w < 46; w++) processWeekAndAdvance(g)
  if (s % 5 === 4 || s < 2) console.log(stat(), `+${Date.now()-ts}ms`)
}
console.log('total', Date.now()-t0, 'ms')
console.log(stat())
console.log('news', g.news.length, 'history', g.history.length, 'hof', g.hof.length, 'annals', g.annals.length, 'mgr.trophies', g.mgr.trophies.length, 'mgrAge', g.mgrAge, 'unemployed', g.unemployed, 'retired', g.retired)
