// Summer internationals: tours every year, Lions every fourth, finals
// contested by FULL squads (release-bug regression check).
import { newGame } from '../src/game/newgame'
import { natFixtureThisWeek, processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, playSegment, rosterOf } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'

const g = newGame('leicester', 'Summer', 2468)
g.mgr.m = 60; g.mgr.w = 46; g.mgr.trophies.push({ compId: 'prem', season: 0 })
let lionsSeen = 0, toursSeen = 0, lionsCoached = 0, emptyRosterFinals = 0
for (let season = 0; season < 5; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    if (g.natOffer && !g.natTeam && ['ENG', 'WAL', 'SCO', 'ITA'].includes(g.natOffer.nat)) {
      g.natTeam = g.natOffer.nat; g.natOffer = null
      console.log(`took the ${g.natTeam} job (season ${g.season})`)
    }
    // regression: any intl fixture this week must have a populated roster
    for (const f of g.fixtures.filter(f => f.week === g.week && !f.played && g.comps[f.compId]?.isNational)) {
      for (const t of [f.homeId, f.awayId]) {
        if (rosterOf(g, t).length === 0) { emptyRosterFinals++; console.error(`EMPTY ROSTER: ${t} week ${g.week} (${f.compId})`) }
      }
    }
    const clubFx = userFixtureThisWeek(g)
    const natFx = !clubFx ? natFixtureThisWeek(g) : undefined
    const fx = clubFx ?? natFx
    if (fx) {
      const uid = clubFx ? g.userClubId : (fx.homeId === g.natTeam || fx.awayId === g.natTeam) ? g.natTeam! : 'LIO'
      const ctx = beginMatch(g, fx, weekRng(g), true, uid)
      playSegment(g, ctx); playSegment(g, ctx); playSegment(g, ctx)
      if (uid === 'LIO') lionsCoached++
    }
    processWeekAndAdvance(g)
  }
  if (g.comps['lions']) lionsSeen++
  if (g.comps['tour']) toursSeen++
}
// count from history since comps rebuild
const lionsHist = g.history.filter(h => h.compId === 'lions').length
const tourNews = g.news.length
console.log(`seasons: 5 | lions series in history: ${lionsHist} | lions matches coached: ${lionsCoached}`)
console.log(`empty-roster internationals: ${emptyRosterFinals} ${emptyRosterFinals === 0 ? '(FIX HOLDS)' : '(BUG!)'}`)
console.log(`champions history: ${g.history.map(h => `${h.compId}:${h.champion}`).join(' ')}`)
console.log('SUMMER TEST DONE')
