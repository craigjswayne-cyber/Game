// What an AI club would buy this week. Moved out of ai.ts so that recruit and
// rivalbids, which ai.ts imports, can ask the same question without importing
// ai back; ai.ts re-exports it.
import type { Club, GameState, Player } from './model'
import { clubIntent } from './living'
import { askingPrice, promisedElsewhere } from './transferRules'

/**
 * What this AI club would buy this week if the market let it: its thinnest
 * position, and the best man there its stance and money allow. A PURE LENS on
 * the choosing half of aiTransfers, which draws the rng around it (whether the
 * club shops at all, and whether the deal goes through) and calls this for the
 * rest. Pulled out (1.8.2) so the scouting report can say "they are genuinely
 * keen" and mean exactly the club that would do it: real interest is real
 * because it is the same call. Returns null when the club is not shopping.
 */
export function aiShoppingTarget(state: GameState, buyer: Club): { intent: ReturnType<typeof clubIntent>; need: string; target: Player | undefined } | null {
  // find thinnest position by count of quality bodies
  const byPos: Record<string, number> = {}
  for (const id of buyer.players) {
    const p = state.players[id]
    if (p && p.ca >= 68) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
  }
  const NEED_MIN: Record<string, number> = { LP: 2, HK: 2, TP: 2, LK: 3, FL: 3, N8: 2, SH: 2, FH: 2, CE: 3, WG: 3, FB: 2 }
  const need = Object.entries(NEED_MIN).find(([pos, min]) => (byPos[pos] ?? 0) < min)?.[0]
  if (!need) return null
  // WHAT THIS CLUB IS ACTUALLY TRYING TO DO (living.ts). Without it a hundred
  // clubs behave like one club with a hundred names: thinnest position, best
  // body available, every time. A rebuilding side will not buy a thirty-year-
  // old and a side going for it will not settle for a squad man.
  const intent = clubIntent(state, buyer)
  if (intent === 'breakup') return null // they are selling, not shopping
  const targets = Object.values(state.players).filter(p =>
    p.clubId && p.clubId !== buyer.id && p.clubId !== state.userClubId &&
    p.pos === need && p.ca >= (intent === 'allin' ? 76 : 70) && !p.onLoan && !p.loanFrom &&
    // (1.8.14) nobody pays a fee for a man whose deal runs out this season and
    // who has already agreed to join somebody else - once surplus was priced
    // as surplus, AI clubs began buying exactly those men and voiding the
    // manager's pre-contracts in the last week of the season
    !promisedElsewhere(state, p.id) &&
    (intent === 'rebuild' ? p.age <= 25 : true) &&
    (state.clubs[p.clubId]?.rep ?? 99) <= buyer.rep + 6 &&
    askingPrice(state, p) <= buyer.budget)
    // a rebuilding club buys for the future, everybody else buys the best now
    .sort((a, b) => intent === 'rebuild' ? (b.pa - a.pa) || (b.ca - a.ca) : b.ca - a.ca)
  return { intent, need, target: targets[0] }
}
