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
import { proBlocksSigning } from './prochallenge'
import { fmtWage, type GameState, type Player } from './model'
import { capBill, capBreak, embargoed, executeTransfer, renewalDemand, squadFull, squadFullMsg } from './ai'
import { SQUAD_LIMIT, seniorsOf } from './transferRules'
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
    && !jokerFor(state, p.id) && !state.unemployed && !proBlocksSigning(state)
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
    return { ok: false, msg: squadFullMsg(state, user) }
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
    subject: `Medical joker: ${p.name}`,
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
    subject: `${p.name}'s cover ends`,
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

/**
 * ---- KEEPING THE JOKER (1.9.17) ----
 *
 * A player's report (French, 22 Nov 2026): a medical joker "disparait de
 * l'effectif des que le blesse sort de l'infirmerie, sans message
 * d'information du depart et sans proposition de prolongation". The message
 * was sent, as one more line in the inbox the week he had already gone; the
 * offer never existed.
 *
 * So the manager is warned the week BEFORE the cover ends, and from the day
 * the joker arrives his page offers the other ending: a full contract. That
 * is an ordinary signing in everything but the door: his wage is the full
 * one, it goes on the cap (a joker's does not), and he needs a place in the
 * squad, since the limit only bent for him while he was cover.
 */
export function keepJokerTerms(state: GameState, p: Player): { wage: number; until: number } {
  return { wage: renewalDemand(p), until: state.season + 1 }
}

export function keepJoker(state: GameState, jokerId: number): { ok: boolean; msg: string } {
  const p = state.players[jokerId]
  const user = state.clubs[state.userClubId]
  if (!p || !user || p.joker == null || p.clubId !== user.id || state.unemployed) return { ok: false, msg: t('reply.notYourPlayer') }
  if (seniorsOf(state, user) > SQUAD_LIMIT) return { ok: false, msg: squadFullMsg(state, user) }
  const { wage, until } = keepJokerTerms(state, p)
  const capMsg = capBreak(state, user.id, wage)
  if (capMsg) return { ok: false, msg: capMsg }
  if (capBill(state, user) + wage > userWageBudget(state, user)) {
    return { ok: false, msg: t('reply.wageDemandsExceed', { wage: fmtWage(wage) }) }
  }
  const hurt = state.players[p.joker]
  p.joker = undefined
  p.jokerWarned = undefined
  p.wage = wage
  p.contractEnds = until
  p.morale = Math.max(1, Math.min(10, p.morale + 1))
  const v = { name: p.name, hurt: hurt?.name ?? '', wage: fmtWage(wage), year: 2026 + until }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: `${p.name} stays on a full contract`,
    body: `${p.name} came in as cover for ${v.hurt} and has done enough to stay: a full contract at ${v.wage}/week until the summer of ${v.year}. His wage now counts under the cap.`,
    k: 'news.jokerKept', v, playerId: p.id,
  })
  return { ok: true, msg: t('reply.jokerKept', v) }
}

/** Every week: a joker whose man is fit, or gone, is let go. */
export function settleJokers(state: GameState) {
  for (const p of Object.values(state.players)) {
    if (p.joker == null) continue
    if (p.clubId !== state.userClubId) { p.joker = undefined; continue }
    const hurt = state.players[p.joker]
    if (!hurt || hurt.clubId !== state.userClubId) releaseJoker(state, p, 'gone')
    else if (!hurt.injury) releaseJoker(state, p, 'fit')
    // one week's notice, while there is still time to offer him a contract
    else if (weeksOut(state, hurt) <= 1 && p.jokerWarned !== hurt.id) {
      p.jokerWarned = hurt.id
      const v = { name: p.name, hurt: hurt.name }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `${p.name}'s cover ends next week`,
        body: `${hurt.name} is close to fit, and ${p.name}'s deal as a medical joker ends when he is. If you want to keep ${p.name}, offer him a full contract from his page before then.`,
        k: 'news.jokerEndsSoon', v, playerId: p.id,
      })
    }
  }
}

/** At the end of the season every joker's deal is over, whatever the man he
 *  covers is doing: they do not roll into next season's squad by accident. */
export function endSeasonJokers(state: GameState) {
  for (const p of Object.values(state.players)) {
    if (p.joker != null && p.clubId) releaseJoker(state, p, 'season')
  }
}
