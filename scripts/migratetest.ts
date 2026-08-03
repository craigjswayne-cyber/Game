// Simulate an old save missing natl1/jl1 and verify migrate injects them
// and restores the pid counter.
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { resetIds, nextPid } from '../src/game/attributes'
import { processWeekAndAdvance } from '../src/game/season'

const g = newGame('leicester', 'Test', 4242)
// strip natl1 + jl1 as if the save predates them
for (const c of Object.values(g.clubs)) {
  if (c.leagueId === 'natl1' || c.leagueId === 'jl1') {
    for (const id of c.players) delete g.players[id]
    delete g.clubs[c.id]
  }
}
delete g.comps['natl1']; delete g.comps['jl1']
g.fixtures = g.fixtures.filter(f => f.compId !== 'natl1' && f.compId !== 'jl1')
const before = Object.keys(g.clubs).length

// simulate a cold session: id counter back to 1 (the latent bug)
resetIds(1)
const old = JSON.parse(JSON.stringify(g))
const m = migrate(old)

const after = Object.keys(m.clubs).length
console.log(`clubs ${before} -> ${after} (expect +24)`) 
if (after - before !== 24) { console.error('BUG: injection count wrong'); process.exit(1) }
const ross = m.clubs['rosslyn']
console.log(`rosslyn squad: ${ross.players.length}, XV set: ${ross.tactic.lineup.slice(0,15).every(x => x != null)}`)
// pid counter must be above every existing id
const maxId = Object.keys(m.players).reduce((x, k) => Math.max(x, Number(k)), 0)
const fresh = nextPid()
console.log(`max pid ${maxId}, next pid ${fresh}`)
if (fresh <= maxId) { console.error('BUG: pid counter collision'); process.exit(1) }
// no player id collisions: every club's roster maps to a live player of that club
let orphans = 0
for (const c of Object.values(m.clubs)) for (const id of c.players) {
  const p = m.players[id]
  if (!p || p.clubId !== c.id) orphans++
}
console.log(`roster integrity: ${orphans} orphans`)
if (orphans) process.exit(1)
// season still simulates
for (let i = 0; i < 3; i++) processWeekAndAdvance(m)
console.log('3 weeks simulated post-migration OK')
console.log('MIGRATE TEST PASSED')
