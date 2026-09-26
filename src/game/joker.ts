// ---- THE MEDICAL JOKER ----
//
// Owner, 25 Sep 2026: "Medical joker signings" - a short-term signing to cover a
// long-term injury without breaking the salary cap.
//
// The rule as this game plays it (not a claim about any one league's small
// print): when one of your men is out for JOKER_MIN_WEEKS or more, you may sign
// ONE free agent to cover him. His wage sits outside the salary cap for as long
// as he is covering, because the cap is there to stop a club buying a better
// squad, not to punish it for a broken leg. The club still pays him every week -
// the money is real, only the cap is waived - and his deal is short: he is gone
// the week the man he covers is fit again, or at the end of the season, or if
// the man he covers leaves the club, whichever comes first.
//
// One joker per injured man, so a treatment room of six is not a licence to
// sign six players over the cap. And a squad at its limit can still take one,
// because the whole point is that a man who cannot play is filling a place.
import { fmtWage, type GameState, type Player } from './model'
import { capBill, embargoed, executeTransfer, renewalDemand, squadFull } from './ai'
import { userWageBudget } from './grants'
import { fuzzedCa } from './scout'
import { t } from './i18n'

/** How long a man must be out before a joker can be signed for him. */
export const JOKER_MIN_WEEKS = 6

/** A joker takes less than a full contract would pay him: it is a few weeks'
 *  work with no promise after it. */
const JOKER_WAGE_SHARE = 0.8

/** Weeks the injured man has left on the table, from now. */
export function weeksOut(state: GameState, p: Player): number {
  return p.injury ? Math.max(0, p.injury.until - state.week) : 0
}

/** The joker covering this man, if one has been signed. */
export function jokerFor(state: GameState, injuredId: number): Player | null {
  const club = state.clubs[state.userClubId]
  if (!club) return null
  for (const id of club.players) {
    const p = state.players[id]
    if (p && p.joker === injuredId) return p
  }
  return null
}

/** Can a joker be signed for this man right now? */
export function jokerOpen(state: GameState, p: Player): boolean {
  return p.clubId === state.userClubId && !p.joker && weeksOut(state, p) >= JOKER_MIN_WEEKS
    && !jokerFor(state, p.id) && !state.unemployed
}

/** What he would cost for the cover. */
export function jokerWage(p: Player): number {
  return Math.round((renewalDemand(p) * JOKER_WAGE_SHARE) / 50) * 50
}

/** Free agents who can do the injured man's job, best first - as far as the
 *  club's scouting can tell (fuzzedCa), not by the number it cannot see. */
export function jokerCandidates(state: GameState, injured: Player, n = 8): Player[] {
  return Object.values(state.players)
    .filter(p => !p.clubId && !p.retiring && p.age <= 36 && (p.pos === injured.pos || p.alt.includes(injured.pos)))
    .sort((a, b) => fuzzedCa(state, b) - fuzzedCa(state, a))
    .slice(0, n)
}

/** Sign him. Returns the line to show, in the reader's language. */
export function signMedicalJoker(state: GameState, injuredId: number, jokerId: number): { ok: boolean; msg: string } {
  const hurt = state.players[injuredId]
  const p = state.players[jokerId]
  const user = state.clubs[state.userClubId]
  if (!hurt || !p || !user || !jokerOpen(state, hurt)) return { ok: false, msg: t('medical.jokerNotOpen') }
  if (p.clubId != null) return { ok: false, msg: t('reply.notFreeAgent') }
  if (embargoed(state, user.id)) return { ok: false, msg: t('reply.embargoSign') }
  // the squad limit bends by one for him, and no further
  if (squadFull(state, user) && user.players.some(id => state.players[id]?.joker != null)) {
    return { ok: false, msg: t('reply.squadFull') }
  }
  const wage = jokerWage(p)
  // the cap is waived; the wage budget is not - the club still has to pay him
  if (capBill(state, user) + wage > userWageBudget(state, user)) {
    return { ok: false, msg: t('reply.wageDemandsExceed', { wage: fmtWage(wage) }) }
  }
  executeTransfer(state, p, user.id, 0)
  if (p.clubId !== user.id) return { ok: false, msg: t('medical.jokerNotOpen') }
  p.wage = wage
  p.contractEnds = state.season
  p.joker = hurt.id
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `🩺 Medical joker: ${p.name}`,
    body: `${p.name} (${p.pos}, ${p.age}) joins on a short-term deal to cover for ${hurt.name}. The wage of ${fmtWage(wage)} sits outside the salary cap during the cover, and the deal ends when ${hurt.name} is fit again or at the end of the season.`,
    k: 'news.jokerSigned',
    v: { name: p.name, pos: p.pos, age: p.age, hurt: hurt.name, wage: fmtWage(wage) },
    playerId: p.id,
  })
  return { ok: true, msg: t('medical.jokerSigned', { name: p.name, hurt: hurt.name, wage: fmtWage(wage) }) }
}

/** Let a joker go: back to the free-agent pool, owed nothing. */
function releaseJoker(state: GameState, p: Player, why: 'fit' | 'gone' | 'season') {
  const club = p.clubId ? state.clubs[p.clubId] : null
  const covered = p.joker != null ? state.players[p.joker] : null
  p.joker = undefined
  if (!club) return
  club.players = club.players.filter(id => id !== p.id)
  club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
  if (club.captain === p.id) club.captain = null
  if (club.vice === p.id) club.vice = null
  if (club.marquee) club.marquee = club.marquee.filter(id => id !== p.id)
  if (state.devFocus) state.devFocus = state.devFocus.filter(id => id !== p.id)
  for (const o of state.offers) if (o.playerId === p.id && o.status === 'pending') o.status = 'rejected'
  p.clubId = null
  p.transferListed = false
  if (club.id !== state.userClubId) return
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `🩺 ${p.name}'s cover ends`,
    // the stored English matches the en dictionary; readers get t(k, v)
    body: why === 'fit'
      ? `${covered?.name ?? ''} is fit again, so ${p.name}'s short-term deal as a medical joker is over. ${p.name} leaves with the club's thanks and is now a free agent.`
      : why === 'gone'
        ? `The player ${p.name} was covering has left the club, so the medical-joker deal ends. ${p.name} is now a free agent.`
        : `The season is over and so is ${p.name}'s medical-joker deal. ${p.name} is now a free agent and can be signed again on ordinary terms.`,
    k: why === 'fit' ? 'news.jokerEndsFit' : why === 'gone' ? 'news.jokerEndsGone' : 'news.jokerEndsSeason',
    v: { name: p.name, hurt: covered?.name ?? '' },
    playerId: p.id,
  })
}

/** Every week: a joker whose man is fit, or gone, is let go. */
export function settleJokers(state: GameState) {
  for (const p of Object.values(state.players)) {
    if (p.joker == null) continue
    if (p.clubId !== state.userClubId) { p.joker = undefined; continue }
    const hurt = state.players[p.joker]
    if (!hurt || hurt.clubId !== state.userClubId) releaseJoker(state, p, 'gone')
    else if (!hurt.injury) releaseJoker(state, p, 'fit')
  }
}

/** At the end of the season every joker's deal is over, whatever the man he
 *  covers is doing: they do not roll into next season's squad by accident. */
export function endSeasonJokers(state: GameState) {
  for (const p of Object.values(state.players)) {
    if (p.joker != null && p.clubId) releaseJoker(state, p, 'season')
  }
}
