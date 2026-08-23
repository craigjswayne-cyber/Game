import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { verifiedClub } from '../src/data/verified'
import { extraPlayers } from '../src/data/additions'
import { ACADEMY_PROSPECTS } from '../src/data/prospects'

const defs = LEAGUE_DEFS()
const clubIds = new Set(defs.flatMap(d => d.clubs.map(c => c.id)))

// 1. which real (file) names would be dropped by the global seenNames dedup?
const seen = new Set<string>()
const dropped: string[] = []
const relocate = new Map<string, {name:string,pos:string,age:number}[]>()
for (const def of defs) for (const rc of def.clubs) for (const rp of rc.players) {
  const to = verifiedClub(rp.name, rc.id)
  if (!to || to === rc.id || !clubIds.has(to)) continue
  const list = relocate.get(to) ?? []
  if (!list.some(x => x.name === rp.name)) list.push(rp as any)
  relocate.set(to, list)
}
for (const def of defs) for (const rc of def.clubs) {
  const squad: any[] = [...rc.players]
  for (const rp of relocate.get(rc.id) ?? []) if (!squad.some(x => x.name === rp.name)) squad.push(rp)
  const handAdded = new Set<string>()
  for (const rp of extraPlayers(rc.id)) if (!squad.some(x => x.name === rp.name)) { squad.push(rp); handAdded.add(rp.name) }
  for (const rp of squad) {
    const to = handAdded.has(rp.name) ? null : verifiedClub(rp.name, rc.id)
    if (to && clubIds.has(to) && to !== rc.id) continue
    const key = rp.name.toLowerCase()
    if (seen.has(key)) { dropped.push(`${rp.name} (${rp.pos}, ${rp.age}) at ${rc.id}`); continue }
    seen.add(key)
  }
}
console.log(`REAL PLAYERS DROPPED BY GLOBAL NAME DEDUP: ${dropped.length}`)
for (const d of dropped.slice(0, 40)) console.log('  ', d)

// 2. does the built world contain them?
const g = newGame('leicester', 'Aud', 99)
const names = new Set(Object.values(g.players).map(p => p.name.toLowerCase()))
console.log(`world players: ${Object.keys(g.players).length}, unique names: ${names.size}`)

// 3. prospect names case bug: are planted names in the world exactly once?
const allProspects = Object.values(ACADEMY_PROSPECTS).flat()
let collide = 0
for (const pr of allProspects) {
  const n = Object.values(g.players).filter(p => p.name === pr.name).length
  if (n !== 1) { collide++; console.log(`PROSPECT ${pr.name}: ${n} players in world`) }
}
console.log(`prospect anomalies: ${collide}`)

// 4. long / apostrophe names present?
const longest = Object.values(g.players).map(p => p.name).sort((a,b)=>b.length-a.length).slice(0,8)
console.log('longest names:', longest)
const apo = Object.values(g.players).filter(p => /['’]/.test(p.name)).slice(0,6).map(p=>p.name)
console.log('apostrophes:', apo)
