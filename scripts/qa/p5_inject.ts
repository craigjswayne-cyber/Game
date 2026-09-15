// Probe: what happens to bought money that is not spent before the rollover
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { applyInjection, INJECT_TIERS } from '../../src/game/grants'
import { fmtMoney } from '../../src/game/model'
import { cashReserve } from '../../src/game/treasury'

for (const [club, buyWeek, tier] of [['northampton', 40, 'xl'], ['northampton', 47, 'xl'], ['northampton', 47, 's'], ['esher', 45, 'xl'], ['leicester', 2, 'xl']] as const) {
  const g = newGame(club, 'Inject', 4242)
  while (g.week < buyWeek) processWeekAndAdvance(g)
  const uc = g.clubs[g.userClubId]
  const b0 = uc.balance, t0 = uc.budget
  applyInjection(g, tier)
  const cash = INJECT_TIERS[tier].amount
  console.log(`\n${club} buys ${tier} (${fmtMoney(cash)}) at week ${buyWeek}: balance ${fmtMoney(b0)}->${fmtMoney(uc.balance)} budget ${fmtMoney(t0)}->${fmtMoney(uc.budget)}; reserve ${fmtMoney(cashReserve(g))}`)
  const bBefore = uc.balance, tBefore = uc.budget
  while (g.season === 0) processWeekAndAdvance(g)
  const sweep = g.news.find(n => n.k === 'news.reinvest' || n.k === 'news.reinvestBuild')
  console.log(`  after rollover: balance ${fmtMoney(uc.balance)} (delta ${fmtMoney(uc.balance - bBefore)}), budget ${fmtMoney(uc.budget)} (was ${fmtMoney(tBefore)}); board sweep: ${sweep?.v?.spend ?? 'none'}; wageBoost ${g.wageBoost}`)
  console.log(`  spendable next season (budget) as share of the ${fmtMoney(cash)} bought: ${(uc.budget / cash * 100).toFixed(0)}%`)
}
