import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS, isWorldCupSeason, type GameState } from '../../src/game/model'
const gender = (process.argv[2] ?? 'm') as 'm' | 'w'
const SEASONS = Number(process.argv[3] ?? 8)
const SEED = Number(process.argv[4] ?? 101)
const club = gender === 'w' ? 'w:bristol' : 'leicester'
const g: GameState = newGame(club, 'Roll', SEED, undefined, undefined, gender)
function step(g: GameState) {
  const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}
for (let s = 0; s < SEASONS; s++) {
  const target = g.season + 1; let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    if (g.week === SEASON_WEEKS) {
      const unplayed = g.fixtures.filter(f => !f.played)
      const noChamp = Object.values(g.comps).filter(c => c.type !== 'intl' ? !c.champion : (c.table.length && !c.champion && c.id !== 'aut' && c.id !== 'w:aut'))
      console.log(`s${g.season} w48 PRE: unplayed=${unplayed.length} [${unplayed.slice(0, 4).map(f => `${f.compId}/${f.stage ?? f.round}`).join(' ')}] noChampion=[${noChamp.map(c => c.id).join(' ')}] WC=${isWorldCupSeason(g.season)}`)
      // pool fixture counts and home balance per league
      for (const c of Object.values(g.comps)) {
        if (c.type === 'league') {
          const home: Record<string, number> = {}; const games: Record<string, number> = {}
          for (const f of g.fixtures.filter(f => f.compId === c.id && !f.stage)) { home[f.homeId] = (home[f.homeId] ?? 0) + 1; games[f.homeId] = (games[f.homeId] ?? 0) + 1; games[f.awayId] = (games[f.awayId] ?? 0) + 1 }
          const hs = Object.values(home), gs = Object.values(games)
          const pairs = new Map<string, number>()
          for (const f of g.fixtures.filter(f => f.compId === c.id && !f.stage)) { const k = [f.homeId, f.awayId].sort().join('|'); pairs.set(k, (pairs.get(k) ?? 0) + 1) }
          const pv = [...pairs.values()]
          console.log(`   ${c.id}: teams ${c.teamIds.length} rounds ${c.rounds} games/team ${Math.min(...gs)}..${Math.max(...gs)} home ${Math.min(...hs)}..${Math.max(...hs)} pairings ${pairs.size} meetings/pair ${Math.min(...pv)}..${Math.max(...pv)} playoff ${c.playoffTeams}`)
        }
        if (c.type === 'cup') {
          const pool = g.fixtures.filter(f => f.compId === c.id && !f.stage).length
          const ko = g.fixtures.filter(f => f.compId === c.id && f.stage).map(f => f.stage)
          console.log(`   ${c.id}: teams ${c.teamIds.length} pools ${c.pools?.length}x${c.pools?.[0]?.length} pool fixtures ${pool} ko ${ko.join(',')}`)
        }
      }
    }
    const pre = g.week === SEASON_WEEKS ? { careers: new Map(Object.values(g.players).map(p => [p.id, [p.career.length, p.stats.apps, p.clubId, p.onLoan, p.loanFrom, (p as any).maternity ? 1 : 0, p.retiring, p.acad] as const])) } : null
    step(g)
    if (pre) {
      const notReset = Object.values(g.comps).filter(c => c.table.some(r => r.p !== 0 || r.pts !== 0)).map(c => `${c.id}(p=${c.table.reduce((s, r) => s + r.p, 0)})`)
      const playedNow = g.fixtures.filter(f => f.played).length
      console.log(`-> s${g.season} w${g.week}: tables not reset: [${notReset.join(' ')}] played fixtures now ${playedNow} champions set: [${Object.values(g.comps).filter(c => c.champion).map(c => c.id).join(' ')}]`)
      let n = 0
      for (const p of Object.values(g.players)) {
        const b = pre.careers.get(p.id); if (!b) continue
        const [cl0, apps0, club0, loan0, from0, mat0, ret0, acad0] = b
        if (p.clubId && apps0 > 0 && cl0 < 20 && p.career.length !== cl0 + 1 && n++ < 4)
          console.log(`   career not appended: ${p.name} age ${p.age} club ${club0}->${p.clubId} apps ${apps0} careerLen ${cl0}->${p.career.length} onLoan ${loan0} loanFrom ${from0} maternity ${mat0} retiring ${ret0} acad ${acad0} last=${JSON.stringify(p.career.at(-1))}`)
      }
    }
  }
}
console.log('done')
