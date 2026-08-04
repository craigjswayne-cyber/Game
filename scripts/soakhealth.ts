// 20-season long-save health audit: ledger growth, save size, world integrity
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'

const g = newGame('leicester', 'Soak Gaffer', 20260804)

function report(label: string) {
  const size = JSON.stringify(g).length
  const players = Object.values(g.players)
  const careerRows = players.reduce((s, p) => s + p.career.length, 0)
  console.log([
    label,
    `save ${(size / 1e6).toFixed(2)}MB`,
    `players ${players.length}`,
    `news ${g.news.length}`,
    `press ${g.press.length}`,
    `offers ${g.offers.length}`,
    `chem ${Object.keys(g.chem ?? {}).length}`,
    `grudges ${(g.grudges ?? []).length}`,
    `pledges ${(g.pledges ?? []).length}`,
    `preC ${(g.preContracts ?? []).length}`,
    `agencyBest ${Object.keys(g.agency?.best ?? {}).length}`,
    `hof ${(g.hof ?? []).length}`,
    `careerRows ${careerRows}`,
    `fixtures ${g.fixtures.length}`,
  ].join(' | '))
}

report('start')
for (let season = 0; season < 20; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, Math.floor(Math.random() * 0) )
    processWeekAndAdvance(g)
  }
  if ((season + 1) % 5 === 0) report(`s${season + 1}`)
}
// integrity sweep at the end
let orphans = 0, badRefs = 0
for (const c of Object.values(g.clubs)) {
  for (const id of c.players) if (!g.players[id]) orphans++
}
for (const p of Object.values(g.players)) {
  if (p.clubId && !g.clubs[p.clubId]) badRefs++
}
console.log(`integrity: roster orphans ${orphans}, bad club refs ${badRefs}`)
