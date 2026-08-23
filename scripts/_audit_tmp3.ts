import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'

const g: any = newGame('leicester', 'T', 1234)
g.natTeam = 'ENG'
const unresolved = new Map<string, number>()
const seasonsToRun = 10
for (let s = 0; s < seasonsToRun; s++) {
  for (let w = 0; w < 46; w++) { try { processWeekAndAdvance(g) } catch(e){ console.log('THREW', s, w, String(e).slice(0,120)); s = 99; break } }
  // after each season start, check which recorded compIds resolve
  for (const h of g.history) if (!g.comps[h.compId]) unresolved.set(h.compId, (unresolved.get(h.compId)??0)+1)
  for (const t of g.mgr.trophies) if (!g.comps[t.compId]) unresolved.set('TROPHY:'+t.compId, (unresolved.get('TROPHY:'+t.compId)??0)+1)
}
console.log('season now', g.season, 'unemployed', g.unemployed)
console.log('history compIds unresolvable in live comps:', [...unresolved.entries()])
console.log('history len', g.history.length, 'annals', g.annals?.length, 'news', g.news.length, 'players', Object.keys(g.players).length, 'fixtures', g.fixtures.length)
console.log('save size MB', (JSON.stringify(g).length/1048576).toFixed(2))
// per-key size
const sizes = Object.entries(g).map(([k,v]) => [k, JSON.stringify(v)?.length ?? 0] as [string,number]).sort((a,b)=>b[1]-a[1]).slice(0,14)
console.log('largest keys:', sizes.map(([k,n])=>`${k}=${(n/1024).toFixed(0)}k`).join(' '))
// annals cup names
console.log('annals[0] cups:', JSON.stringify(g.annals?.[0]?.cups), 'trophies:', JSON.stringify(g.annals?.[0]?.trophies))
// records / vsBook / derbyBook growth
for (const k of ['records','vsBook','derbyBook','chem','legendOf','hof','potyRoll','slAlerted','annals','natRank','crisisAt']) {
  const v: any = (g as any)[k]
  if (v == null) continue
  const n = Array.isArray(v) ? v.length : Object.keys(v).length
  console.log(`  ${k}: ${n} entries, ${(JSON.stringify(v).length/1024).toFixed(1)}k`)
}
