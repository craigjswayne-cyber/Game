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
import { SEASON_WEEKS, logDecision } from './model'
import { t } from './i18n'

const CAP_PER_WEEK = 2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const absWk = (state: GameState) => state.season * SEASON_WEEKS + state.week

/** Conversations left this week. */
export function chatBudget(state: GameState): number {
  if (state.chatWk !== absWk(state)) return CAP_PER_WEEK
  return Math.max(0, CAP_PER_WEEK - (state.chatsUsed ?? 0))
}

/** Can the manager call this man in at all? */
export function canChat(state: GameState, p: Player): boolean {
  return p.clubId === state.userClubId && !p.acad &&
    chatBudget(state) > 0 && p.lastChatWk !== absWk(state)
}

function spend(state: GameState, p: Player) {
  const now = absWk(state)
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
