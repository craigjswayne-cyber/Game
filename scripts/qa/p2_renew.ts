// Probe: repeated renewals as a morale faucet; wage-cut-with-morale-gain; stacking terms
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { offerRenewalAt, renewalDemand } from '../../src/game/ai'
import { fmtWage } from '../../src/game/model'

const g = newGame('leicester', 'Renew', 4242)
const uc = g.clubs[g.userClubId]
const squad = uc.players.map(id => g.players[id]).filter(p => !p.acad && !p.loanFrom && !p.retiring)
// pick 5 men across personalities, lower them to morale 4 to make the effect visible
const picks = squad.slice(0, 8)
for (const p of picks) p.morale = 4
console.log('week', g.week)
for (const p of picks) console.log(`  ${p.name.padEnd(24)} ${p.pers.padEnd(13)} wage ${fmtWage(p.wage)} demand ${fmtWage(renewalDemand(p))} morale ${p.morale} ends ${p.contractEnds}`)

let signed = 0, tries = 0, wageTotal0 = picks.reduce((s, p) => s + p.wage, 0)
for (let w = 0; w < 10; w++) {
  for (const p of picks) {
    const d = renewalDemand(p)
    const r = offerRenewalAt(g, p.id, d) // offer exactly what his camp asks
    tries++
    if (r.ok) signed++
  }
  processWeekAndAdvance(g)
}
console.log(`\nafter 10 weeks of re-signing at his own demand: ${signed}/${tries} accepted`)
for (const p of picks) console.log(`  ${p.name.padEnd(24)} wage ${fmtWage(p.wage)} morale ${p.morale.toFixed(2)} ends ${p.contractEnds}`)
console.log(`wage total of the eight: ${fmtWage(wageTotal0)} -> ${fmtWage(picks.reduce((s, p) => s + p.wage, 0))}`)
console.log(`contract news items filed: ${g.news.filter(n => n.k === 'news.extends').length}`)

// wage cut with morale gain: offer 97% of demand (the counter figure) repeatedly to a Loyal man
const g2 = newGame('leicester', 'Renew', 4242)
const c2 = g2.clubs[g2.userClubId]
const loyal = c2.players.map(id => g2.players[id]).find(p => p && !p.acad && p.pers === 'Loyal' && p.wage >= 4000)
if (loyal) {
  loyal.morale = 5
  const w0 = loyal.wage
  let cuts = 0
  for (let w = 0; w < 20; w++) {
    const d = renewalDemand(loyal)
    const offer = Math.round((d * 0.86) / 50) * 50
    const r = offerRenewalAt(g2, loyal.id, offer)
    if (r.ok) cuts++
    processWeekAndAdvance(g2)
  }
  console.log(`\nLoyal ${loyal.name}: 20 weekly offers at 86% of his demand -> ${cuts} signed; wage ${fmtWage(w0)} -> ${fmtWage(loyal.wage)}; morale 5 -> ${loyal.morale.toFixed(2)}; scale demand now ${fmtWage(renewalDemand(loyal))}`)
}
