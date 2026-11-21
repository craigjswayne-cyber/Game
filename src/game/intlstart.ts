/**
 * ---- START AS AN INTERNATIONAL COACH (1.9.16) ----
 *
 * Owner, 21 Nov 2026: "there should be an option on the first page - start as
 * an international coach - this should be a paid option on the main menu - the
 * other route of coaching a club should still be free." And on the price: its
 * own one-off, "same price as it currently is in the store". The store already
 * sells exactly this job, Become an International Coach (PINNACLE_SKU), to a
 * manager inside a career. So this is the same product with a second door: a
 * career that BEGINS in the national job, with no club at all.
 *
 * The world is an ordinary new world. A save has to stand on a club (every
 * system reads userClubId), so the career is hung on one from the nation's own
 * league where there is one, and the manager is put in the state the game has
 * always had for a coach who holds a Test job and no club: unemployed, with
 * the country in hand. That is the state a man reaches by taking the England
 * job and resigning from his club, so nothing here is a new kind of save.
 *
 * What is different from that road, because he never sat at the club's desk:
 * the club's welcome letters are not his and are taken out, no resignation is
 * announced, and no tenure there is opened or closed. The club gets a vacancy
 * so the game appoints it a head coach as it would any other.
 */
import type { GameState } from './model'
import type { Gender } from './gender'
import { NAT_TIERS, pickableNations } from './nations'
import { applyPinnacle } from './grants'

/** The unions with no women's Test programme in this game (nations.ts reads
 *  the same thing off a live world; tests/intlstart.test.ts holds the two
 *  together, so a competition added later fails there until this follows). */
const NOT_IN_W = new Set(['TGA', 'SAM', 'FIJ', 'ARG'])

/** The countries a career can start in charge of, biggest job first. */
export function startNations(gender: Gender): string[] {
  return NAT_TIERS.map(([n]) => n).filter(n => gender !== 'w' || !NOT_IN_W.has(n)).reverse()
}

/** The club the save stands on: one from the nation's own country when the
 *  world has one, the first club in the game when it has not. He never
 *  manages it. */
export function hostClub(defs: { clubs: { id: string; country: string }[] }[], nat: string): string {
  const all = defs.flatMap(d => d.clubs)
  return (all.find(c => c.country === nat) ?? all[0]).id
}

/** Turn a brand-new world into a career that begins in a national job.
 *  False, with the world untouched, if this world plays no Tests for `nat`. */
export function beginInternational(state: GameState, nat: string): boolean {
  if (state.natTeam || !pickableNations(state).some(([n]) => n === nat)) return false
  // the club's desk was never his: its letters go, and it needs a head coach
  state.news = []
  state.offers = []
  state.unemployed = true
  state.vacancies.push({ clubId: state.userClubId, week: state.week })
  state.intlStart = true
  if (!applyPinnacle(state, nat)) return false
  // the appointment is the first thing in the inbox and the first day's story
  state.newsFrom = state.news.reduce((m, n) => Math.min(m, n.id), state.nextId)
  return true
}
