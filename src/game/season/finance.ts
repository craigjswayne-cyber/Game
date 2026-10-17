// The weekly ledger. Split out of season.ts.
import type { GameState } from '../model'
import { commercialWeekly } from '../commercial'
import { book } from '../books'
import { facLevel, fmtMoney, LEDGER_WEEKS, operatingCost, weeklyCentral } from '../model'
import { staffWageBill } from '../staff'
import { clamp, type Rng } from '../rng'

// ------------------------------------------------------------------
// Finances & board
// ------------------------------------------------------------------

export function weeklyFinance(state: GameState, _rng: Rng) {
  const club = state.clubs[state.userClubId]
  // The last three weeks of a 48-week season are the tour, and the close season
  // for everybody else. The books do not run - see LEDGER_WEEKS for what
  // happened to the world economy when they did.
  if (state.week > LEDGER_WEEKS) return
  // A LOAN COSTS WHAT THE LETTER SAID IT COSTS (audit 16D). The signing news
  // has always promised the parent club "will cover half his wage", and this
  // line charged the full amount anyway. Half for a borrowed man, as promised.
  const wages = club.players.reduce((s, id) => {
    const p = state.players[id]
    if (!p) return s
    // the share struck at the table (v1.2.8); half for every loan before it
    return s + (p.loanFrom ? Math.round(p.wage * (p.loanShare ?? 0.5)) : p.wage)
  }, 0)
  club.balance -= wages
  book(state, 'wages', -wages)
  // backroom staff wages - real salaries where a real man holds the job
  const staffBill = staffWageBill(state)
  club.balance -= staffBill
  book(state, 'staff', -staffBill)
  // sponsorship, broadcast and the central-distribution top-up for a club whose
  // ground is smaller than its name (weeklyCentral documents why that top-up
  // exists and why it is shaped as a gap rather than a flat rise for everyone)
  const central = weeklyCentral(club)
  club.balance += central
  book(state, 'central', central)
  // and the commercial department: whatever the three deals are worth this week,
  // clauses included. An empty slot pays nothing, which is the point of it (F30).
  const deals = commercialWeekly(state)
  club.balance += deals
  book(state, 'deals', deals)
  // Gate receipts from this week's home fixture - A COMPETITIVE ONE.
  //
  // This line paid out on friendlies for as long as friendlies have existed,
  // and nobody noticed because nobody measured it: a home run-out was worth a
  // full £30 a head, which on the owner's new midweek fixture came to £187,740
  // in a single bye week. Two of this file's other aggregates - the average-gate
  // figure above and the record-gate check below - had ALREADY been taught to
  // skip compId 'fr'. This one was simply missed, so the club's books have been
  // treating a Wednesday development match as a sell-out league Saturday.
  //
  // The owner's brief for the midweek game says it plainly ("financially they
  // dont benefit the club"), and it is the right rule for the idle-week friendly
  // and the testimonial too: nobody pays league prices to watch the academy, and
  // a testimonial's takings belong to the player rather than the club.
  //
  // Nor a final at a neutral ground (1.8.1). The user is its nominal home side
  // and was paid £30 a head on the whole showpiece crowd, 80,000 people through
  // somebody else's turnstiles - the reason the gate record already skips it.
  const home = state.fixtures.find(f =>
    f.week === state.week && f.played && f.homeId === club.id && f.att && f.compId !== 'fr' && !f.venue)
  // F31: boxes and lounges mean the same crowd is worth more. 4% a level, so a
  // maxed block lifts a £30 head to £36. operatingCost documents why this one
  // facility carries an extra weekly bill.
  const hosp = 1 + facLevel(state, 'hospitality') * 0.04
  if (home?.att) {
    const gate = Math.round(home.att * 30 * hosp)
    club.balance += gate
    book(state, 'gate', gate)
  }
  // the club shop: replica shirts shift faster when the terraces are happy
  const shop = facLevel(state, 'shop')
  if (shop > 0) {
    const takings = Math.round(shop * 9_000 * (0.6 + (state.fanMood ?? 60) / 100))
    club.balance += takings
    book(state, 'shop', takings)
  }
  // running the place. A ground has to be heated, mown, stewarded and
  // insured 52 weeks a year, and every facility level is a building with
  // staff in it. This is what stops the estate being a free ratchet: going
  // from a good gym to a great one is a bill that never stops arriving.
  const running = operatingCost(state)
  club.balance -= running
  book(state, 'upkeep', -running)
  // weekly balance snapshot for the season chart
  ;(state.finHist ??= []).push({ w: state.week, b: club.balance })
  if (state.finHist.length > 50) state.finHist = state.finHist.slice(-50)
  if (club.balance < -2_000_000 && state.week % 6 === 0) {
    // A flat -5 said the same thing about a 2M overdraft and a 20M one, so a
    // winning side could run a hole of any depth with the board on 100. The
    // hit now scales with the hole: near the threshold it is what it always
    // was, and it grows from there.
    const debtM = Math.abs(club.balance) / 1_000_000
    club.boardConfidence = clamp(club.boardConfidence - clamp(3 + debtM, 3, 14), 0, 100)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: debtM >= 8 ? 'Board demands the books are balanced' : 'Board concerned by finances',
      body: `The club is ${fmtMoney(Math.abs(club.balance))} in the red. The board urges you to balance the books - consider player sales.`,
      k: debtM >= 8 ? 'news.debtDemand' : 'news.debtConcern',
      v: { debt: fmtMoney(Math.abs(club.balance)) },
    })
  }
}
