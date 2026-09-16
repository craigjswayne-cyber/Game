/** Dangling player-id references after each rollover, plus nat-pool churn and free-agent pool composition. */
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS } from '../../src/game/model'
import type { GameState } from '../../src/game/model'

const SEASONS = Number(process.argv[2] ?? 6)
const g = newGame('leicester', 'Dangle', 4242)
const step = (g: GameState) => {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}
const check = (label: string) => {
  const P = g.players
  const bad: string[] = []
  for (const c of Object.values(g.clubs)) {
    if (c.captain != null && (!P[c.captain] || P[c.captain].clubId !== c.id)) bad.push(`${c.id}.captain=${c.captain}${P[c.captain] ? '(other club)' : '(missing)'}`)
    if (c.vice != null && (!P[c.vice] || P[c.vice].clubId !== c.id)) bad.push(`${c.id}.vice=${c.vice}${P[c.vice] ? '(other club)' : '(missing)'}`)
    for (const id of c.marquee ?? []) if (!P[id] || P[id].clubId !== c.id) bad.push(`${c.id}.marquee=${id}`)
    for (const id of c.tactic.lineup) if (id != null && (!P[id] || P[id].clubId !== c.id)) bad.push(`${c.id}.lineup=${id}${P[id] ? '(other club)' : '(missing)'}`)
  }
  for (const mp of g.mentors ?? []) if (!P[mp.senior] || !P[mp.kid]) bad.push(`mentor ${mp.senior}/${mp.kid}`)
  for (const id of g.shortlist) if (!P[id]) bad.push(`shortlist ${id}`)
  for (const id of g.devFocus) if (!P[id]) bad.push(`devFocus ${id}`)
  for (const [nat, ids] of Object.entries(g.natSquads)) for (const id of ids) if (!P[id]) bad.push(`natSquad ${nat} ${id}`)
  for (const [k] of Object.entries((g as any).scoutSeen ?? {})) if (!P[Number(k)]) bad.push(`scoutSeen ${k}`)
  for (const o of g.offers ?? []) if ((o as any).playerId != null && !P[(o as any).playerId]) bad.push(`offer ${(o as any).playerId}`)
  for (const pc of g.preContracts ?? []) if (!P[pc.playerId]) bad.push(`preContract ${pc.playerId}`)
  for (const l of (g as any).loanOffers ?? []) if (l.playerId != null && !P[l.playerId]) bad.push(`loanOffer ${l.playerId}`)
  // players on loan whose parent is gone etc
  for (const p of Object.values(P)) {
    if (p.loanFrom && !g.clubs[p.loanFrom]) bad.push(`loanFrom ${p.name}`)
    if (p.clubId && !g.clubs[p.clubId]) bad.push(`clubId missing club ${p.name}`)
  }
  // news playerId references (informational: count of news items pointing at deleted players)
  const ghostNews = g.news.filter(n => n.playerId != null && !P[n.playerId]).length
  const fas = Object.values(P).filter(p => !p.clubId)
  const faNat = fas.filter(p => p.natSquad || (p.caps ?? 0) > 0).length
  console.log(`${label}: dangling ${bad.length} ${bad.slice(0, 8).join(', ')} | ghost news ${ghostNews}/${g.news.length} | FA ${fas.length} (age ${Math.min(...fas.map(p => p.age))}-${Math.max(...fas.map(p => p.age))}, ca max ${Math.max(...fas.map(p => p.ca))}, capped/natSquad ${faNat})`)
}
check('s0w1')
let genNat = 0
for (let s = 0; s < SEASONS; s++) {
  const target = g.season + 1
  let guard = 0
  const idsBefore = new Set(Object.keys(g.players))
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const before = Object.keys(g.players).length
    step(g)
    const after = Object.keys(g.players).length
    if (g.week !== 1 && after > before) genNat += after - before
    if (g.week % 12 === 0) check(`s${g.season}w${g.week}`)
  }
  const arrivedInSeason = Object.values(g.players).filter(p => !idsBefore.has(String(p.id)))
  console.log(`season ${target}: players minted in-season (nat pools etc) so far ${genNat}; new ids surviving rollover ${arrivedInSeason.length}, of which clubless ${arrivedInSeason.filter(p => !p.clubId).length}`)
  check(`s${g.season}w1 (post-rollover)`)
}
