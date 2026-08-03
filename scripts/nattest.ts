// International management arc: get the offer, take the job, coach Tests,
// win silverware — all through the real weekly loop.
import { newGame } from '../src/game/newgame'
import { natFixtureThisWeek, processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, playSegment } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'

const g = newGame('leinster', 'Intl Boss', 31337)
// fake a big reputation so the union calls
g.mgr.m = 60; g.mgr.w = 45; g.mgr.trophies.push({ compId: 'urc', season: 0 })

let testsCoached = 0
let offered = ''
for (let season = 0; season < 3; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    if (g.natOffer && !g.natTeam) {
      offered = g.natOffer.nat
      g.natTeam = g.natOffer.nat // accept
      g.natOffer = null
      console.log(`accepted ${g.natTeam} job in season ${g.season} week ${g.week}`)
    }
    const clubFx = userFixtureThisWeek(g)
    const natFx = !clubFx ? natFixtureThisWeek(g) : undefined
    const fx = clubFx ?? natFx
    if (fx) {
      const ctx = beginMatch(g, fx, weekRng(g), true, clubFx ? g.userClubId : g.natTeam!)
      playSegment(g, ctx); playSegment(g, ctx); playSegment(g, ctx)
      if (natFx) testsCoached++
    }
    processWeekAndAdvance(g)
  }
}
console.log(`offer: ${offered || 'NONE'}, tests coached on matchday: ${testsCoached}`)
console.log(`mgr record: ${g.mgr.m}m ${g.mgr.w}w | trophies: ${g.mgr.trophies.map(t => t.compId).join(',')}`)
const unapplied = g.fixtures.filter(f => f.played && !f.tableApplied && !f.stage && g.comps[f.compId]?.table.length)
console.log(unapplied.length === 0 ? 'TABLES CONSISTENT' : `BUG: ${unapplied.length} played fixtures never applied to tables`)
if (!offered) console.error('BUG: union never called a decorated manager')
if (testsCoached === 0) console.error('BUG: no Tests coached through matchday path')
console.log('NAT TEST DONE')
