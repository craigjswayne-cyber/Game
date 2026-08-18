// Probe: contract talks always reach a conclusion.
//
// Live report: "I tried to negotiate with Marcus, he said he wanted 15k a week
// (madness) but there was no conclusion to the negotiations when I met him at
// his ask."
//
// The engine was concluding it correctly. The player signed. What went wrong was
// where the game said so: the outcome sentence was rendered in a card near the
// TOP of the player page, and the contract controls are at the BOTTOM. He tapped
// Offer, the panel closed, and nothing within a screenful of his thumb changed.
// A conclusion the manager cannot see is not a conclusion.
//
// The UI fix puts the outcome inside the talks card. This probe holds the engine
// to the half it owns, which is the half that makes the UI fix meaningful:
//
//   meeting or beating the asking wage NEVER produces a silent nothing.
//
// Every call comes back either signed - with the wage on the player and the
// contract extended - or refused with a reason a person could read out loud. It
// walks whole squads so that the personalities, the moods, the marquee men and
// the cap cases are all covered rather than one convenient example.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { offerRenewalAt, renewalDemand } from '../src/game/ai'
import { fmtWage } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

let met = 0, signed = 0, refusedWithReason = 0
const reasons: Record<string, number> = {}
let overpaid = 0

for (const [club, seed] of [['harlequins', 12345], ['northampton', 777], ['bath', 4242]] as const) {
  // a few weeks in, so morale and form have moved off their opening values
  const g = newGame(club, 'Renew Probe', seed)
  for (let w = 0; w < 6; w++) { try { processWeekAndAdvance(g) } catch { break } }

  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean)
  for (const p of squad) {
    if (p.loanFrom || p.retiring) continue
    const ask = renewalDemand(p)
    const wasWage = p.wage
    const wasEnds = p.contractEnds
    const r = offerRenewalAt(g, p.id, ask)
    met++
    // EACH ATTEMPT HAS TO BE INDEPENDENT. The first cut renewed all sixty-five men
    // one after another without putting anything back, so the squad's wage bill
    // climbed with every signature and the salary cap refused the second half of
    // the squad. It reported a 46% signature rate and blamed the game for an
    // arithmetic certainty of its own making.
    const restore = () => { p.wage = wasWage; p.contractEnds = wasEnds }
    if (r.ok) {
      signed++
      if (p.wage !== Math.min(ask, Math.round(ask * 1.3))) {
        bad(`${p.name} signed but his wage is ${fmtWage(p.wage)} after an offer of ${fmtWage(ask)}`)
      }
      // a renewal may land on the same end year as the deal he was already on -
      // a three-year offer to a man with three years left is not a bug - but it
      // must never make his contract shorter
      if (p.contractEnds < wasEnds) {
        bad(`${p.name} signed but his deal got shorter: ${wasEnds} became ${p.contractEnds}`)
      }
      if (p.wage < wasWage) {
        bad(`${p.name} met his own asking wage and took a pay cut: ${fmtWage(wasWage)} became ${fmtWage(p.wage)}`)
      }
      restore()
    } else {
      // a refusal has to say something, and it has to leave him untouched
      const why = (r.msg ?? '').trim()
      if (why.length < 12) bad(`${p.name} was refused with no explanation: "${why}"`)
      else refusedWithReason++
      const key = /wage budget/.test(why) ? 'wage budget'
        : /salary cap|cap/.test(why) ? 'salary cap'
        : /ambitious/.test(why) ? 'ambition'
        : /isn't interested/.test(why) ? 'not interested'
        : /pre-contract/.test(why) ? 'pre-contract signed'
        : /retire/.test(why) ? 'retiring'
        : /loan/.test(why) ? 'on loan'
        : 'other'
      reasons[key] = (reasons[key] ?? 0) + 1
      if (p.wage !== wasWage) bad(`${p.name} was refused but his wage changed from ${fmtWage(wasWage)} to ${fmtWage(p.wage)}`)
      if (p.contractEnds !== wasEnds) bad(`${p.name} was refused but his contract length changed`)
    }
  }

  // and paying over the odds must also conclude, not stall
  const star = squad.filter(p => !p.loanFrom && !p.retiring).sort((a, b) => b.ca - a.ca)[0]
  if (star) {
    const r = offerRenewalAt(g, star.id, Math.round(renewalDemand(star) * 1.5))
    if (!r.ok && !(r.msg ?? '').length) bad('a 50% overpayment produced no answer at all')
    if (r.ok) {
      overpaid++
      // the engine caps accidental silly money at 1.3x, and it must say a real number
      if (star.wage > Math.round(renewalDemand(star) * 1.3)) {
        bad(`${star.name} was paid ${fmtWage(star.wage)}, over the 1.3x guard`)
      }
    }
  }
}

console.log(`${met} renewals offered at exactly the asking wage`)
console.log(`  ${signed} signed, ${refusedWithReason} refused with a stated reason`)
console.log('  refusals by reason: ' + (Object.keys(reasons).length
  ? Object.entries(reasons).map(([k, n]) => `${k} ${n}`).join(', ')
  : 'none'))
console.log(`${overpaid} of 3 stars accepted a deliberate overpayment`)

// ---- the standard ----
if (met < 60) bad(`only ${met} offers made, too few to judge`)
if (signed + refusedWithReason !== met) {
  bad(`${met - signed - refusedWithReason} offers went nowhere: neither signed nor refused with a reason`)
}
// Meeting the ask should be the normal path to a signature, not a rarity. If the
// gates fire more often than they accept, "I met his ask and nothing happened"
// is a design problem rather than a UI one.
// The salary cap is a legitimate no, and a common one: measured at career start
// the big clubs sit at 84-102% of their league's cap, and Bath begins over it. So
// the rate that matters is the rate among offers the cap did not block. Judging
// the raw rate would be judging the cap, which is a separate argument.
const capBlocked = reasons['salary cap'] ?? 0
const open = met - capBlocked
const rate = signed / Math.max(1, open)
console.log(`signature rate with cap room: ${signed}/${open} = ${(rate * 100).toFixed(0)}%` +
  ` (${capBlocked} refused by the salary cap, which is the cap doing its job)`)
if (rate < 0.85) bad(`only ${(rate * 100).toFixed(0)}% of players sign when their asking wage is met and there is cap room`)

// ---- A QUOTED COUNTER IS A PROMISE, THE SAME WEEK --------------------------
//
// (user, offering MORE than the number on the card: "im offering 8.6k but he
// isnt accepting but says he'll accept 8k?"). The counter is demand * 0.97,
// but the accept roll used to run for anything under the FULL demand - and
// the roll is seeded on the week, so within one week the same refusal
// repeated forever while re-quoting a number it would never honour. Now:
// walk every squad man who counters, offer exactly the number his camp
// quoted, in the same week, and he must sign at it. And the message must
// print the wage the way the buttons do (fmtWage), not fmtMoney's rounding
// of it - "£8k" and "£8.4k" in one card were the same 8,400.
{
  const g = newGame('northampton', 'Counter', 51)
  for (let i = 0; i < 6; i++) processWeekAndAdvance(g)
  const club = g.clubs[g.userClubId]
  let countersMet = 0
  for (const id of [...club.players]) {
    const p = g.players[id]
    if (!p || p.acad || p.loanFrom || p.retiring) continue
    const demand = renewalDemand(p)
    const low = Math.round((demand * 0.9) / 50) * 50 // under demand, above the laugh line
    const r = offerRenewalAt(g, p.id, low)
    if (r.ok || r.counter == null) continue
    countersMet++
    if (!r.msg.includes(fmtWage(r.counter))) {
      bad(`${p.name}'s counter of ${r.counter} is printed as something else: "${r.msg}"`)
    }
    const honoured = offerRenewalAt(g, p.id, r.counter)
    if (!honoured.ok) bad(`${p.name}'s camp quoted ${fmtWage(r.counter)}/wk and then refused it: "${honoured.msg}"`)
  }
  console.log(`\n${countersMet} counters quoted and met on the spot`)
  if (countersMet < 3) bad(`too few counters to trust the check (${countersMet})`)
}

if (fails) { console.error(`\nRENEW PROBE: ${fails} failures`); process.exit(1) }
console.log('\nRENEW PROBE PASSED')
