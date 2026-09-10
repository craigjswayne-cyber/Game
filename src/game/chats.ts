// Call a player in (audit 20D). The office was one-directional - players
// knocked on the manager's door, never the reverse. These are the two
// conversations every real gaffer has weekly: praise the man in form, and a
// quiet word for the man who is not.
//
// Every outcome is DETERMINISTIC from personality and form - no rng, so the
// shared weekly stream never moves and the same conversation with the same
// man lands the same way, which is how a manager learns his squad. The costs
// are real: praising a struggling Temperamental reads as sarcasm, warning a
// man in form insults him, and the budget is two chats a week so the words
// keep their value.

import type { GameState, Player } from './model'
import {absWeek, SEASON_WEEKS, logDecision } from './model'
import { t, tIn } from './i18n'

const CAP_PER_WEEK = 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Conversations left this week. */
export function chatBudget(state: GameState): number {
  if (state.chatWk !== absWeek(state.season, state.week)) return CAP_PER_WEEK
  return Math.max(0, CAP_PER_WEEK - (state.chatsUsed ?? 0))
}

/** Can the manager call this man in at all? */
export function canChat(state: GameState, p: Player): boolean {
  return p.clubId === state.userClubId && !p.acad &&
    chatBudget(state) > 0 && p.lastChatWk !== absWeek(state.season, state.week)
}

function spend(state: GameState, p: Player) {
  const now = absWeek(state.season, state.week)
  if (state.chatWk !== now) { state.chatWk = now; state.chatsUsed = 0 }
  state.chatsUsed = (state.chatsUsed ?? 0) + 1
  p.lastChatWk = now
}

const trust = (state: GameState, d: number) => {
  state.mgrTrust = clamp((state.mgrTrust ?? 30) + d, 0, 100)
}

/** Praise his form. Returns the line he gives you back. */
export function praisePlayer(state: GameState, p: Player): string {
  spend(state, p)
  // praising a struggling hothead reads as sarcasm, and he says so
  if (p.pers === 'Temperamental' && p.form < 6.8) {
    p.morale = clamp(p.morale - 0.4, 1, 10)
    trust(state, -1)
    logDecision(state, 'dec.praisedOutOfForm', { player: p.name }, false)
    return t('reply.chatPraiseSarcasm')
  }
  p.morale = clamp(p.morale + (p.pers === 'Ambitious' ? 0.7 : 0.5), 1, 10)
  if (p.form >= 7.5) trust(state, 1)
  logDecision(state, 'dec.praised', { player: p.name }, true)
  switch (p.pers) {
    case 'Loyal': return t('reply.chatPraiseLoyal')
    case 'Professional': return t('reply.chatPraiseProfessional')
    case 'Ambitious': return t('reply.chatPraiseAmbitious')
    case 'Mercenary': return t('reply.chatPraiseMercenary')
    case 'Leader': return t('reply.chatPraiseLeader')
    default: return t('reply.chatPraiseDefault')
  }
}

/** A quiet word about his form. Returns the line he gives you back. */
export function warnPlayer(state: GameState, p: Player): string {
  spend(state, p)
  // warning a man doing his job insults him, and the room hears about it
  if (p.form >= 6.8) {
    p.morale = clamp(p.morale - 0.6, 1, 10)
    trust(state, -2)
    logDecision(state, 'dec.warnedInForm', { player: p.name }, false)
    return t('reply.chatWarnInsulted')
  }
  logDecision(state, 'dec.quietWord', { player: p.name }, true)
  switch (p.pers) {
    case 'Professional':
    case 'Loyal':
    case 'Leader':
      p.morale = clamp(p.morale - 0.1, 1, 10)
      p.form = clamp(p.form + 0.3, 1, 10)
      trust(state, 1)
      return t('reply.chatWarnTakesIt')
    case 'Ambitious':
      p.morale = clamp(p.morale - 0.2, 1, 10)
      p.form = clamp(p.form + 0.2, 1, 10)
      return t('reply.chatWarnStung')
    case 'Mercenary':
      p.morale = clamp(p.morale - 0.5, 1, 10)
      return t('reply.chatWarnShrug')
    default:
      p.morale = clamp(p.morale - 0.7, 1, 10)
      trust(state, -1)
      return t('reply.chatWarnSlams')
  }
}

/**
 * ---- ANSWERING A TRANSFER REQUEST ----
 *
 * Owner: "when someone makes a transfer request the user should have the
 * ability to accept or reject this - causing a morale impact on camp/the
 * player."
 *
 * The request was a notice, not a question. It landed on the desk, the news
 * item told the manager he could pick the man or lose him, and the only two
 * replies the game understood were selling him or playing him. Neither is an
 * ANSWER: a manager who has decided reaches for one of two words, and the man
 * and the dressing room both react to which one he chooses.
 *
 * Three rules the answer obeys.
 *
 *   IT COSTS SOMETHING EITHER WAY. Granting it lifts the man and unsettles the
 *     room that loses him; refusing it holds the squad together and grinds him
 *     down further. A choice with a free side is not a choice.
 *   THE ROOM'S REACTION DEPENDS ON WHO HE IS. Letting a leader go is felt.
 *     Letting a mercenary who has been sulking for two months go is a relief,
 *     and the squad list says which is which through leadership and character
 *     rather than through a flag somebody had to set.
 *   A REFUSAL IS NOT FOR EVER. It is recorded, it stops the ledger asking
 *     again next week, and it wears off - a man told no who is still watching
 *     from the stand in three months asks again, and he is entitled to.
 *
 * Selling him is unchanged and remains the third answer; this is about the
 * two the manager could not previously give.
 */

/** How long a refusal holds before the ledger may raise it again. */
export const REQUEST_ANSWER_WEEKS = 12

export function canAnswerRequest(state: GameState, p: Player): boolean {
  return p.clubId === state.userClubId && (p.wantsOut ?? 0) > 0 && !(p.reqAns ?? 0)
}

/** Everyone else in the dressing room, which is who "the camp" means. */
function teammates(state: GameState, p: Player): Player[] {
  const club = state.clubs[p.clubId ?? '']
  if (!club) return []
  return club.players.map(id => state.players[id]).filter(x => !!x && x.id !== p.id && !x.acad)
}

export function answerRequest(state: GameState, p: Player, accept: boolean): string {
  if (!canAnswerRequest(state, p)) return t('reply.requestAlreadyAnswered')
  p.reqAns = absWeek(state.season, state.week)
  const room = teammates(state, p)
  // a senior man the squad follows, rather than anyone with a high number
  const senior = p.a.lea >= 70 || p.pers === 'Leader'
  const awkward = p.pers === 'Mercenary' || p.pers === 'Temperamental'

  if (accept) {
    // he gets what he asked for, and the room finds out this afternoon
    p.transferListed = true
    p.morale = clamp(p.morale + 1.6, 1, 10)
    // losing a leader is felt; losing a man who has been poisoning the place
    // for two months is a weight off, and the squad list already says which
    const shift = senior ? -0.25 : awkward ? 0.15 : -0.05
    for (const mate of room) mate.morale = clamp(mate.morale + shift, 1, 10)
    // a manager who lets a man go rather than freezing him out is straight
    // with people, and being straight with people is what mgrTrust measures
    trust(state, senior ? -1 : 1)
    logDecision(state, 'dec.requestGranted', { player: p.name }, !senior)
    news(state, p, 'news.requestGranted', 'news.requestGrantedSubj')
    return t(senior ? 'reply.requestGrantedSenior' : 'reply.requestGranted', { player: p.name })
  }

  // told no. He stays, and he stays unhappy - more so the more he thinks he is
  // owed, which is exactly what these three characters think.
  p.morale = clamp(p.morale - (awkward || p.pers === 'Ambitious' ? 1.4 : 0.9), 1, 10)
  // the room reads it as a manager holding his squad together, unless the man
  // being held is one they look up to
  const shift = senior ? -0.2 : 0.1
  for (const mate of room) mate.morale = clamp(mate.morale + shift, 1, 10)
  trust(state, senior ? -2 : 1)
  logDecision(state, 'dec.requestRefused', { player: p.name }, !senior)
  news(state, p, 'news.requestRefused', 'news.requestRefusedSubj')
  return t(awkward ? 'reply.requestRefusedBadly' : 'reply.requestRefused', { player: p.name })
}

function news(state: GameState, p: Player, k: string, subjectK: string) {
  const v = { player: p.name, club: state.clubs[p.clubId ?? '']?.short ?? '' }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: tIn('en', subjectK, v),
    body: tIn('en', k, v),
    k, v, playerId: p.id,
  })
}
