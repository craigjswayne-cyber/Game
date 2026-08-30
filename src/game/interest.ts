/**
 * ---- WOULD HE EVEN TALK TO YOU? ----
 *
 * Owner, with £100m in the bank at a small club and a market full of names he
 * could not sign: "there needs to be an interested switch on button - for
 * players who would sign for the club. I have 100m but none of the top players
 * will sign for me at the moment, so it needs to be easy to see who would sign".
 *
 * The rule that produced that wall already existed, buried in agreeFee: a happy,
 * unlisted player at a club more than twelve reputation points above yours will
 * not discuss terms at any price. It is a good rule - it is what stops a Sugar
 * Daddy save from buying the world in one window - and it was completely
 * invisible. You found it by bidding, one man at a time, and losing a week of
 * game time to each refusal.
 *
 * So the rule moves HERE, is asked by the Transfer Centre's Interested filter,
 * AND is the same call agreeFee makes. One function: what the chip promises is
 * exactly what the bid does. A filter that disagreed with the engine would be
 * worse than no filter at all.
 *
 * And the wall gets a door, because the owner named one: "a few top players are
 * mercenaries and will come for big wages". Mercenary is already a personality
 * in this game; it had no consequence at the negotiating table until now. A
 * mercenary always listens, however far below him you are - and charges for it
 * (personalTermsDemand). That is the honest shape of the fantasy: the money CAN
 * buy you somebody, it just cannot buy you everybody.
 */
import type { GameState, Player } from './model'

/** keen - his club would take the call and so would he.
 *  listening - he will discuss terms; the money has to be right.
 *  no - he will not talk to a club this far below his, at any price. */
export type Interest = 'keen' | 'listening' | 'no'

/** How far a club's reputation may sit below a player's club before he stops
 *  taking the call. Twelve points is roughly the gap between a mid-table
 *  Premiership side and a Championship one. */
export const INTEREST_GAP = 12

export function transferInterest(state: GameState, p: Player): Interest {
  const user = state.clubs[state.userClubId]
  if (!user) return 'no'
  if (!p.clubId) return 'keen'            // a free agent has nobody to refuse for him
  if (p.clubId === user.id) return 'keen' // already yours
  const seller = state.clubs[p.clubId]
  if (!seller) return 'keen'
  const gap = seller.rep - user.rep
  if (gap <= 0) return 'keen'             // you are the bigger club: he is flattered
  if (gap <= INTEREST_GAP) return 'listening'
  // Past the gap, three things still open the door - and each is a real reason
  // rather than a random roll, so the filter can be trusted from one week to
  // the next.
  if (p.transferListed) return 'listening' // his own club is pushing him out
  if (p.morale <= 5) return 'listening'    // he is unhappy where he is
  if (p.pers === 'Mercenary') return 'listening' // he will go anywhere that pays
  return 'no'
}

/** The extra a man wants for dropping down to you. A mercenary crossing a real
 *  gap is the one who names a number, because that is the whole of why he is
 *  coming; everyone else who is willing is willing for football reasons. */
export function interestPremium(state: GameState, p: Player): number {
  const user = state.clubs[state.userClubId]
  const seller = p.clubId ? state.clubs[p.clubId] : null
  if (!user || !seller) return 1
  const gap = seller.rep - user.rep
  if (gap <= INTEREST_GAP) return 1
  return p.pers === 'Mercenary' ? 1.6 : 1.25
}
