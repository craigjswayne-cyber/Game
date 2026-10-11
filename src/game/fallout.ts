// ---- WHAT THE ROOM MAKES OF A BID ANSWERED (1.8.18) ----
//
// Owner: "If a player is unhappy and an offer comes in, if it's rejected it
// should really cause issues to the player and squad. If a popular player is
// sold that should also impact the squad morale."
//
// Two answers to a bid, and each now lands somewhere besides the bank:
//
//   KEPT AGAINST HIS WILL  A bid turned down for a man who wanted it (low
//               morale, or a transfer request already in) costs him about what
//               a broken promise does, and it lasts, because morale climbs back
//               at barely half the speed it falls (season.ts). If he had asked
//               to leave, turning down the bid IS the answer to that letter
//               (chats.answerRequest's refusal, recorded the same way). If he
//               had not, and nothing on the team sheet would quietly withdraw
//               it again next week, he hands one in. A man the dressing room
//               listens to takes some of the room with him.
//   SOLD        Selling the captain, a senior voice or a well-liked senior
//               costs the room a share of a defeat's worth of mood, scaled by
//               how much they followed him. Selling a man who wanted out, or one
//               nobody picked, costs next to nothing. His close friends feel it
//               on top, through the bonds ledger, as they always have.
//
// A content man whose bid is turned down hears that he is wanted, which is a
// small lift and no more.
//
// RULES IT KEEPS. User club only: an AI sale never comes here, so the world's
// balance is untouched. No draws of any kind. Stories go through heldnews so
// the id counter the fixtures seed from never moves. Every effect is said in
// words: no numbers, no labels.
import type { Club, GameState, Player, TransferOffer } from './model'
import { absWeek } from './model'
import { clamp } from './rng'
import { t, tIn, type Vars } from './i18n'
import { CLOSE, seniorVoices } from './bonds'
import { fileHeldNews } from './heldnews'
import { clubMatchesPlayed, ledgerRow, statusOf } from './gametime'
import { remember } from './memory'

/** At or below this a man reads as unsettled: half a point above the band the
 *  bid generator already treats as gettable (ai.ts, morale 4 or under). */
export const UNSETTLED = 4.5
/** What turning down a move he wanted costs him: a broken promise's worth. */
export const BLOCKED_HIT = 1.5
/** The squad's share of it when he is someone they follow (captain = 1). */
export const BLOCKED_ROOM = 0.25
/** The squad's mood when the man they follow most is sold: about one defeat. */
export const SOLD_ROOM = 0.4
/** How much of that is left when the move was one he wanted. */
const WANTED_SHARE = 0.35
/** A content man told he is wanted. */
const FLATTERED = 0.2

export function unsettled(p: Player): boolean {
  return (p.wantsOut ?? 0) > 0 || p.morale <= UNSETTLED
}

/** How much the dressing room follows him: 1 for the captain, down to 0 for
 *  a man who is simply one of the squad. Pure, and read before he leaves. */
export function standingOf(state: GameState, club: Club, p: Player): number {
  if (club.captain === p.id) return 1
  if (club.vice === p.id) return 0.75
  if (seniorVoices(state, club.id).some(v => v.id === p.id)) return 0.7
  // well liked: a senior man with two close friends in the squad (room.popular)
  const bs = state.bonds
  if (p.age < 27 || !bs || bs.club !== club.id) return 0
  const close = bs.pairs.filter(pr => (pr[0] === p.id || pr[1] === p.id) && pr[2] >= CLOSE).length
  return close >= 2 ? 0.4 : 0
}

/** Everyone else in the senior dressing room. */
function room(state: GameState, club: Club, p: Player): Player[] {
  return club.players.map(id => state.players[id])
    .filter((m): m is Player => !!m && m.id !== p.id && !m.acad && !m.onLoan)
}

function story(state: GameState, k: string, v: Vars, type: 'general' | 'contract', playerId: number) {
  fileHeldNews(state, [{
    week: state.week, season: state.season, type, read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v),
    k, v: v as Record<string, string | number>, playerId,
  }])
}

/** A bid for one of the manager's men has just been turned down. Returns the
 *  line for the manager when the man wanted the move, null when he did not
 *  (ai.respondToOffer then goes on as it always did). */
export function bidRefused(state: GameState, o: TransferOffer, p: Player, bidder: Club): string | null {
  const club = state.clubs[state.userClubId]
  if (!club || p.clubId !== club.id || state.unemployed || !unsettled(p)) return null
  const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
  const loyal = p.pers === 'Loyal' || p.pers === 'Professional'
  // used to run up the price and then kept anyway: that stings more
  const haggled = !!o.countered && o.fee >= p.value * 1.2
  p.morale = clamp(p.morale - BLOCKED_HIT * (sulky ? 1.3 : loyal ? 0.8 : 1) - (haggled ? 0.4 : 0), 1, 10)

  // the letter, if there is one, has just been answered; if there is not, one
  // is written - unless the team sheets would withdraw it again next week
  // (gametime.ts withdraws a request once a non-fringe man is within two
  // games of his due, and only reads the ledger from the sixth match)
  let asked = false
  if ((p.wantsOut ?? 0) > 0) {
    if (!(p.reqAns ?? 0)) {
      p.reqAns = absWeek(state.season, state.week)
      remember(state, { kind: 'request-refused', playerId: p.id, clubId: club.id, payload: { name: p.name } })
    }
  } else if (!p.transferListed && p.age <= 33) {
    const played = clubMatchesPlayed(state, club.id)
    const row = ledgerRow(state, club, p, played)
    if (played < 6 || row.status === 'fringe' || row.gap <= -3) {
      p.wantsOut = Math.max(1, state.week)
      p.reqAns = 0
      asked = true
    }
  }

  // a man the room follows takes some of it with him
  const s = standingOf(state, club, p)
  if (s > 0) for (const m of room(state, club, p)) m.morale = clamp(m.morale - BLOCKED_ROOM * s, 1, 10)

  const k = asked ? (s > 0 ? 'news.bidBlockedRequestRoom' : 'news.bidBlockedRequest')
    : s > 0 ? 'news.bidBlockedRoom' : 'news.bidBlocked'
  story(state, k, { player: p.name, club: bidder.name }, asked ? 'contract' : 'general', p.id)
  return t(asked ? 'reply.bidRejectedRequest' : 'reply.bidRejectedWanted', { player: p.name })
}

/** A content man whose bid was turned down, with nothing else to say about
 *  it: he hears he is wanted. True when he did. */
export function flattered(state: GameState, p: Player): boolean {
  if (p.clubId !== state.userClubId || state.unemployed || p.morale < 6) return false
  p.morale = clamp(p.morale + FLATTERED, 1, 10)
  return true
}

/** One of the manager's men is being sold, and is still on the books: the
 *  room's reaction, read before he goes (ai.executeTransfer). */
export function saleFelt(state: GameState, club: Club, p: Player): void {
  if (club.id !== state.userClubId || state.unemployed || p.acad || p.onLoan) return
  // a man nobody picked leaves no gap
  if (statusOf(state, club, p) === 'fringe') return
  const s = standingOf(state, club, p)
  if (s <= 0) return
  const wanted = unsettled(p) || !!p.transferListed
  const hit = SOLD_ROOM * s * (wanted ? WANTED_SHARE : 1)
  for (const m of room(state, club, p)) m.morale = clamp(m.morale - hit, 1, 10)
  const k = wanted ? 'news.saleFeltWanted'
    : club.captain === p.id ? 'news.saleFeltCaptain'
    : s >= 0.7 ? 'news.saleFeltVoice' : 'news.saleFeltFriends'
  story(state, k, { player: p.name }, 'general', p.id)
}
