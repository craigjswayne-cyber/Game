// The club and its relations: which club is yours, its code, its staff
// roles, and the grudges it holds with others.
import { t, tIn } from '../i18n'
import type { GameState, StaffLevels } from './types'

/** Live grudge between two clubs, if any. */
export const grudgeBetween = (state: GameState, x: string, y: string) =>
  state.grudges?.find(g => ((g.a === x && g.b === y) || (g.a === y && g.b === x)) && g.until >= state.season) ?? null

/** Why two clubs are not speaking, in the reader's language - or in the English
 *  it was recorded in, on a save written before grudges carried a key. */
export const grudgeReason = (g: { reason: string; rk?: string; rv?: Record<string, string | number> }): string =>
  (g.rk ? t(g.rk, g.rv) : g.reason)

/** Record (or refresh) bad blood between two clubs; news if the user is in it.
 *
 *  The reason arrives as a key and its values rather than as a sentence,
 *  because it is quoted in three places a reader sees - the club's rifts card,
 *  the fixture line on the home screen, and the kick-off commentary - and a
 *  sentence recorded in English is English in all three, for the two seasons
 *  the grudge lasts. */
export function addGrudge(state: GameState, a: string, b: string, rk: string, rv?: Record<string, string | number>, seasons = 2) {
  if (!state.clubs[a] || !state.clubs[b] || a === b) return
  const reason = tIn('en', rk, rv)
  state.grudges ??= []
  const ex = state.grudges.find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a))
  if (ex) { ex.reason = reason; ex.rk = rk; ex.rv = rv; ex.until = Math.max(ex.until, state.season + seasons); return }
  state.grudges.push({ a, b, reason, rk, rv, until: state.season + seasons })
  if (a === state.userClubId || b === state.userClubId) {
    const opp = a === state.userClubId ? b : a
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `Bad blood with ${state.clubs[opp].short}`,
      body: `There is genuine needle between the clubs now - ${reason}. The next meeting will be spicy: expect cards, a hostile crowd and a match where the form book means nothing.`,
      k: 'news.badBlood', v: { short: state.clubs[opp].short, reason_k: rk, ...(rv ?? {}) },
    })
  }
}
export const STAFF_INFO: Record<keyof StaffLevels, { name: string; desc: string; wage: number }> = {
  assistant: { name: 'staff.roleAssistant', desc: 'staff.roleAssistantDesc', wage: 4000 },
  physio: { name: 'staff.rolePhysio', desc: 'staff.rolePhysioDesc', wage: 3000 },
  scout: { name: 'staff.roleScout', desc: 'staff.roleScoutDesc', wage: 2500 },
  attack: { name: 'staff.roleAttack', desc: 'staff.roleAttackDesc', wage: 3500 },
  defence: { name: 'staff.roleDefence', desc: 'staff.roleDefenceDesc', wage: 3500 },
  scrumCoach: { name: 'staff.roleScrumCoach', desc: 'staff.roleScrumCoachDesc', wage: 3000 },
  kicking: { name: 'staff.roleKicking', desc: 'staff.roleKickingDesc', wage: 2500 },
  academyCoach: { name: 'staff.roleAcademyCoach', desc: 'staff.roleAcademyCoachDesc', wage: 2500 },
}

/**
 * ---- THE CLUB YOU ACTUALLY RUN ----
 *
 * state.userClubId goes on naming the last club after a sacking, and that is
 * deliberate: the annals, the era summary and the legend list all need to know
 * where the man worked. But every LIVE "my club" feature reads the same field,
 * and a sacked manager was still being sent his old side's training report,
 * their transfer bids, their match reports and their record gate - 146 stories
 * over 25 weeks out of work in the probe that found it (user, 1.7.0: "I was
 * fired by a team but still see news stories related to them appear in my news
 * feed"). Worse, the training tick went on applying his gym, his physio and
 * his staff to a squad he no longer picked.
 *
 * So: history reads state.userClubId, anything happening NOW reads this. It is
 * null when you are out of work, which makes `p.clubId === myClubId(state)`
 * false for every player in the world and costs nothing to write.
 * scripts/exileprobe.ts is the guard.
 */
export function myClubId(state: GameState): string | null {
  return state.unemployed ? null : state.userClubId
}

/**
 * "Is this the club I run?" - and the only safe way to ASK it.
 *
 * NEVER write `p.clubId === myClubId(state)`. A player's clubId is nullable and
 * so is this helper's answer, so out of work the comparison reads null === null
 * and every clubless man in the world becomes one of yours. That shipped for
 * about an hour: the international call-up story named 113 players from every
 * nation on earth and ran to 3,008 characters, which is how brevityprobe found
 * it. This form is false for an absent club id whatever the manager's
 * situation, and false for every id while he is out of work.
 */
export function isMyClub(state: GameState, clubId: string | null | undefined): boolean {
  return !!clubId && !state.unemployed && clubId === state.userClubId
}

/**
 * The three-letter club code: NOR, BAT, SAR.
 *
 * One derivation, because there were two and they disagreed. The crest stripped
 * non-letters before taking three (`short.replace(/[^A-Za-z]/g, '')`), the pitch's
 * zone labels did not (`teamShort(...).slice(0, 3)`), so a club whose short name
 * carries a space or a full stop in its first three characters got one code on its
 * badge and a different one on the touchline. A code the player is meant to
 * recognise has to be the same code everywhere it appears.
 */
export function clubCode(short: string): string {
  return short.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'RUG'
}
