// Save growth over 10 seasons, and what grows.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
const g = newGame('leicester', 'Growth', 777)
const mb = (n: number) => (n / 1048576).toFixed(2)
const sizes = (label: string) => {
  const tot = JSON.stringify(g).length
  const top = Object.entries(g).map(([k, v]) => [k, JSON.stringify(v)?.length ?? 0] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`${label}: ${mb(tot)} MB  top: ${top.map(([k, n]) => `${k}=${mb(n)}`).join(' ')}`)
}
sizes('s0 w1')
for (let s = 0; s < 10; s++) {
  while (g.season === s) {
    const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    if (g.week === 48) sizes(`s${s} w48 (pre-rollover)`)
    processWeekAndAdvance(g)
  }
  sizes(`after season ${s + 1}`)
}
// per-player ledgers
const ps = Object.values(g.players)
const maxLen = (f: (p: any) => any[] | undefined) => Math.max(...ps.map(p => (f(p) ?? []).length))
const sum = (f: (p: any) => any) => ps.reduce((t, p) => t + (JSON.stringify(f(p))?.length ?? 0), 0)
console.log(`players ${ps.length}; max hist ${maxLen(p => p.hist)} career ${maxLen(p => p.career)} ratings ${maxLen(p => p.ratings)} injLog ${maxLen(p => p.injLog)} caps ${maxLen(p => Array.isArray(p.caps) ? p.caps : [])}`)
console.log(`bytes: hist ${mb(sum(p => p.hist))} career ${mb(sum(p => p.career))} stats ${mb(sum(p => p.stats))} a ${mb(sum(p => p.a))} injLog ${mb(sum(p => p.injLog))} ratings ${mb(sum(p => p.ratings))}`)
console.log(`news ${g.news.length} fixtures ${g.fixtures.length} (events on ${g.fixtures.filter(f => f.events).length}) history ${g.history.length} annals ${g.annals?.length} hof ${g.hof?.length} decisions ${g.decisions?.length} finHist ${g.finHist?.length} officeMemo ${(g as any).officeMemo?.length} records ${JSON.stringify(g.records).length} vsBook ${JSON.stringify(g.vsBook).length} derbyBook ${JSON.stringify(g.derbyBook).length} potyRoll ${g.potyRoll?.length} academy ${JSON.stringify(g.academy).length} natSquads ${JSON.stringify(g.natSquads).length}`)
const retiredInFile = ps.filter(p => !p.clubId).length
console.log(`players with no club (free agents/retired kept?): ${retiredInFile}; ages>=36: ${ps.filter(p => p.age >= 36).length}`)
