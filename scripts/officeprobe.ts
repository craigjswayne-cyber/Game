// Probe: the office remembers the conversation it just had.
//
// Live report: "player asked to go on loan, said yes but then was asked the
// question again." The screenshots showed George Sowerby, 17, making the same
// speech on 18 October and again on 25 October, with the manager's agreement
// printed under both of them.
//
// Two faults sat behind that. The office generated its conversations from squad
// state alone, so any player who still matched a filter could be picked again
// the following week - and agreeing to a loan changed nothing about him, because
// agreeing did nothing at all. The reaction text said "list him for loan from
// the Transfers screen", which is a game asking the manager to go and implement
// the decision he had just made.
//
// So this walks real careers, records every office conversation, and holds the
// office to two standards: it does not raise the same subject with the same man
// inside the cooldown, and when the manager agrees to a loan the player is
// actually out on loan afterwards.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import { OFFICE_COOLDOWN, OFFICE_OUTLET, answerPress } from '../src/game/media'
import type { GameState, PressItem } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

const absWeek = (season: number, week: number) => season * SEASON_WEEKS + week

/** Every office conversation seen in a career, in the order it was raised. */
type Seen = { pid: number; name: string; topic: string; season: number; week: number }

let conversations = 0, loansAgreed = 0, loansOut = 0, repeats = 0
const topics: Record<string, number> = {}
const gaps: number[] = []

for (const seed of [12345, 777, 4242, 31337]) {
  const g: GameState = newGame('northampton', 'Office Probe', seed)
  const seen: Seen[] = []
  const answered = new Set<number>()

  for (let w = 0; w < SEASON_WEEKS * 3; w++) {
    // note anything new behind the office door
    for (const item of g.press) {
      if (item.outlet !== OFFICE_OUTLET || !item.topic || item.playerId == null) continue
      if (seen.some(s => s.pid === item.playerId && s.topic === item.topic &&
        s.season === item.season && s.week === item.week)) continue
      const p = g.players[item.playerId]
      seen.push({
        pid: item.playerId, name: p?.name ?? `#${item.playerId}`,
        topic: item.topic, season: item.season, week: item.week,
      })
      conversations++
      topics[item.topic] = (topics[item.topic] ?? 0) + 1
    }

    // Answer everything, the way a manager does. EVERYTHING, because press
    // generation stops at two open questions: a probe that answered only the
    // office items let two press questions sit unanswered forever and saw no
    // conversations at all for three seasons. It read as "the office never
    // fires" when what it had actually built was a manager who ignores
    // journalists and therefore never gets asked anything again.
    for (const item of g.press) {
      if (item.answered || answered.has(item.id)) continue
      answered.add(item.id)
      const idx = item.options.findIndex(o => o.loan) >= 0
        ? item.options.findIndex(o => o.loan)
        : 0
      const pid = item.playerId
      const wasLoan = item.options.some(o => o.loan)
      answerPress(g, item.id, idx)
      if (wasLoan && pid != null) {
        loansAgreed++
        const p = g.players[pid]
        if (p?.onLoan) loansOut++
        else {
          // the only acceptable refusal is one the game explains
          const why = item.reaction ?? ''
          if (!/stops there for now/.test(why)) {
            bad(`agreed to ${p?.name}'s loan and he is not out on loan, with no explanation: "${why.slice(0, 90)}"`)
          }
        }
      }
    }

    try { processWeekAndAdvance(g) } catch { break }
  }

  // ---- the standard: no man raises the same subject twice inside the cooldown
  const byKey: Record<string, Seen[]> = {}
  for (const s of seen) {
    const k = `${s.pid}:${s.topic}`
    ;(byKey[k] ??= []).push(s)
  }
  for (const [k, list] of Object.entries(byKey)) {
    list.sort((a, b) => absWeek(a.season, a.week) - absWeek(b.season, b.week))
    for (let i = 1; i < list.length; i++) {
      const gap = absWeek(list[i].season, list[i].week) - absWeek(list[i - 1].season, list[i - 1].week)
      gaps.push(gap)
      if (gap < OFFICE_COOLDOWN) {
        repeats++
        bad(`${list[i].name} raised "${list[i].topic}" again ${gap} week${gap === 1 ? '' : 's'} later ` +
          `(s${list[i - 1].season} w${list[i - 1].week} then s${list[i].season} w${list[i].week}), cooldown is ${OFFICE_COOLDOWN} [${k}]`)
      }
    }
  }
}

console.log(`${conversations} office conversations over four three-season careers`)
console.log('  by subject: ' + Object.entries(topics).map(([t, n]) => `${t} ${n}`).join(', '))
console.log(`${loansAgreed} loan requests agreed, ${loansOut} of those players actually went out on loan`)
if (gaps.length) {
  gaps.sort((a, b) => a - b)
  console.log(`repeat conversations: ${gaps.length}, closest ${gaps[0]} weeks apart, median ${gaps[gaps.length >> 1]}`)
} else {
  console.log('no player raised the same subject twice in three seasons')
}
console.log(`${repeats} repeats inside the cooldown`)

// ---- the standard ----
if (conversations < 12) bad(`only ${conversations} office conversations across four careers, too few to judge`)
if (loansAgreed < 3) bad(`only ${loansAgreed} loan requests were agreed to, too few to judge the action`)
if (loansAgreed && loansOut === 0) bad('not one agreed loan actually sent the player out')

// ---- and the reported case, built by hand, so the gate is proven rather than
// inferred from a career that happened not to hit it ----
{
  const g = newGame('northampton', 'Office Probe', 999)
  const kid = Object.values(g.players).find(p =>
    p.clubId === g.userClubId && p.acad && p.age <= 21 && !p.onLoan)
  if (!kid) {
    bad('the fabricated case could not find an academy player, so it proved nothing')
  } else {
    const item: PressItem = {
      id: g.nextId++, week: g.week, season: g.season, outlet: OFFICE_OUTLET,
      question: `${kid.name} wants a loan.`, playerId: kid.id, topic: 'loan', answered: false,
      options: [{ label: 'Agree - a loan makes sense', morale: 0.5, board: 0.2, loan: true, reaction: 'Agreed.' }],
    }
    g.press.push(item)
    // he must not be in the XV, or the loan is legitimately refused
    g.clubs[g.userClubId].tactic.lineup = g.clubs[g.userClubId].tactic.lineup.map(id => (id === kid.id ? null : id))
    answerPress(g, item.id, 0)
    console.log(`\n${kid.name}, ${kid.age}: agreed to his loan request -> onLoan ${kid.onLoan === true}`)
    if (!kid.onLoan) bad('saying yes to a loan request did not send the player on loan')
    if (!(g.decisions ?? []).some(d => /loan request/.test(d.text ?? ''))) {
      bad('agreeing to a loan left no trace in the decision log')
    }
  }
}

if (fails) { console.error(`\nOFFICE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nOFFICE PROBE PASSED')
