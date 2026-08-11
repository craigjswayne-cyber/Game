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
    logDecision(state, `Praised ${p.name} out of form - he took it as a wind-up.`, false)
    return `He squints at you. "Am I being set up here?" The compliment lands like a slap.`
  }
  p.morale = clamp(p.morale + (p.pers === 'Ambitious' ? 0.7 : 0.5), 1, 10)
  if (p.form >= 7.5) trust(state, 1)
  logDecision(state, `Praised ${p.name} in the office.`, true)
  switch (p.pers) {
    case 'Loyal': return `"Means a lot, boss." He walks out an inch taller.`
    case 'Professional': return `A short nod. "Just doing the job." But he is smiling on the way out.`
    case 'Ambitious': return `"About time somebody noticed." He will want more of this.`
    case 'Mercenary': return `"Cheers, boss. Does the recognition come with a rise?" Only half joking.`
    case 'Leader': return `"Save it for the young lads - but thanks." He passes it on within the hour.`
    default: return `He beams. For once the fire in him is warming the room.`
  }
}

/** A quiet word about his form. Returns the line he gives you back. */
export function warnPlayer(state: GameState, p: Player): string {
  spend(state, p)
  // warning a man doing his job insults him, and the room hears about it
  if (p.form >= 6.8) {
    p.morale = clamp(p.morale - 0.6, 1, 10)
    trust(state, -2)
    logDecision(state, `Warned ${p.name} while he was in form - the room noticed.`, false)
    return `He stares. "Have you watched the games?" Word of this gets around the dressing room.`
  }
  logDecision(state, `A quiet word with ${p.name} about his form.`, true)
  switch (p.pers) {
    case 'Professional':
    case 'Loyal':
    case 'Leader':
      p.morale = clamp(p.morale - 0.1, 1, 10)
      p.form = clamp(p.form + 0.3, 1, 10)
      trust(state, 1)
      return `He takes it on the chin. "You'll see a response on Saturday." You believe him.`
    case 'Ambitious':
      p.morale = clamp(p.morale - 0.2, 1, 10)
      p.form = clamp(p.form + 0.2, 1, 10)
      return `Stung - but he needed to hear it, and the extras he does that evening say so.`
    case 'Mercenary':
      p.morale = clamp(p.morale - 0.5, 1, 10)
      return `A shrug. "Noted." You suspect it went in one ear and out the other.`
    default:
      p.morale = clamp(p.morale - 0.7, 1, 10)
      trust(state, -1)
      return `He slams the door on the way out. That could go either way on Saturday.`
  }
}
