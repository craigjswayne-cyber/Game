// ---- THE NEGOTIATING TABLE (1.8.0) ----
//
// Owner: "Commercial deals should be gambles and risky ... Deals should be
// negotiation with a challenge for the manager. Make it a fun challenge as
// part of the game to land a big commercial deal."
//
// Until now a sponsorship was three numbers and a Sign button. The numbers were
// fair, which is exactly why there was no game in it. Now each offer on the
// Commercial tab is the sponsor's OPENING position, and signing it is a
// conversation of a few moves:
//
//   - ACCEPT what is on the table
//   - ASK for more (a tenth) or DEMAND a lot more (a quarter): the sponsor may
//     give it all, meet you halfway, or get up and leave
//   - CHANGE THE STRUCTURE: a safe flat fee, a smaller fee plus bonuses, or a
//     small fee with big bonuses. The bonuses are real targets for the season -
//     a league finish, the top of the table, a final, the try count - and they
//     are paid at the season's end from what actually happened
//   - or BREAK OFF
//
// The odds are never printed. What the manager sees is the sponsor's mood, in
// four words, read off the same number that decides whether they walk. That
// is the gamble: he knows the weather, not the dice.
//
// What moves the dice: how far over the club's worth he is pushing, how often
// he has pushed already, and the club's LEVERAGE - form and where it sits in
// the table against where its stature says it should. A side on a run can ask
// for the moon; a side in a slump that pushes hard is shown the door.
//
// ---- BALANCE ----
//
// Every roll is a hash of (seed, season, slot, sponsor, move), not a shared rng:
// reopening the screen changes nothing, and reloading a save to try the same
// push again meets the same answer. The expected money is measured, not hoped
// for: scripts/talksprobe.ts plays thousands of negotiations and a few real
// seasons, and holds a sensible manager close to the market rate the economy
// was calibrated on (econprobe) while the bold spread wide both ways.
import { LEDGER_WEEKS, fmtMoney, logDecision, type GameState } from './model'
import { t, tIn, type Vars } from './i18n'
import {
  CLAUSES, SLOT_BY_ID, applyStadiumName, dropSlotQuestion, hash, marketRate, offersFor,
  type ClauseId, type Deal, type SlotId,
} from './commercial'
import { book } from './books'

export type Structure = 'flat' | 'mixed' | 'bold'

/** The share of the agreed fee that is guaranteed every week. The rest is
 *  sold back to the sponsor as bonuses. There is no premium on top for the
 *  risk: talksprobe measured one at 6% and the bold structure out-earned a
 *  sensible flat fee by a tenth on average, which is a reward for luck rather
 *  than judgement. The premium field stays so a later tune is one number. */
export const STRUCTURES: Record<Structure, { guaranteed: number; premium: number; label: string; desc: string }> = {
  flat: { guaranteed: 1, premium: 1, label: 'finances.structFlat', desc: 'finances.structFlatD' },
  mixed: { guaranteed: 0.7, premium: 1, label: 'finances.structMixed', desc: 'finances.structMixedD' },
  bold: { guaranteed: 0.4, premium: 1, label: 'finances.structBold', desc: 'finances.structBoldD' },
}

/**
 * The bonus lines, as multiples of the season's shortfall (the money given up
 * by not taking the flat fee). Calibrated by talksprobe on real simulated
 * seasons across every league in the world, against stretchTarget: a club
 * meets its league target a little under half the time, out-scores it on tries
 * about as often, tops the table about one season in eight and reaches a final
 * about one in six. At these weights the average season pays back the
 * shortfall, a poor one pays nothing and a great one pays it two or three times
 * over. The title and the final are weighted lightly because they fall mostly
 * to the big clubs; the league and try targets are stature-relative, so they
 * are the lines a small club can win.
 */
export const BONUS_WEIGHTS = { league: 0.95, title: 0.55, final: 0.45, tries: 0.9 } as const
export type BonusLine = keyof typeof BONUS_WEIGHTS

export interface PerfTerms {
  structure: Structure
  /** finish at or above this league position */
  target: number
  /** pounds paid for each line met, per season */
  league: number
  title: number
  final: number
  tries: number
  /** the week the deal was signed in its first season: that season's bonuses
   *  are paid pro rata, or a bold deal signed in April while top of the table
   *  would be a cheque for a season somebody else paid the fee on */
  firstWeek: number
}

export interface Talk {
  slot: SlotId
  sponsor: string
  years: number
  /** the opening offer's clause, which stands only on a flat fee */
  clause: ClauseId
  /** the flat weekly the sponsor opened on */
  opening: number
  /** the flat-equivalent weekly on the table now */
  fee: number
  structure: Structure
  pushes: number
  /** every action spends one; at MAX_MOVES the offer on the table is final */
  moves: number
  /** accumulated irritation, which the mood reads */
  heat: number
  /** the sponsor's last words, rendered in the reader's language */
  last?: { k: string; v?: Vars }
}

export interface TalksState {
  season: number
  open: Partial<Record<SlotId, Talk>>
  /** sponsors who walked out, or were walked out on, this season */
  gone: Partial<Record<SlotId, string[]>>
  /** the last word of a talk that ended without a deal, so the reply to the
   *  tap that ended it still shows on the card it belonged to */
  ended?: Partial<Record<SlotId, { k: string; v?: Vars }>>
}

export const MAX_MOVES = 4
export const ASK = 0.10
export const DEMAND = 0.25
/** each walk-out is heard in the market: the other sponsors open lower */
export const WALK_PENALTY = 0.05

function roll(state: GameState, key: string): number {
  return hash(state.seed, key) / 10000
}

export function talksOf(state: GameState): TalksState {
  if (!state.talks || state.talks.season !== state.season) {
    state.talks = { season: state.season, open: {}, gone: {} }
  }
  return state.talks
}

/** The target a sponsor sets: where the club's stature says it should finish,
 *  or where it already stands if that is higher - nobody pays a bonus for a
 *  finish the table already shows. */
export function leagueTarget(state: GameState): { target: number; size: number } {
  const club = state.clubs[state.userClubId]
  const comp = club ? state.comps[club.leagueId] : undefined
  if (!club || !comp) return { target: 1, size: 1 }
  const ids = comp.teamIds.filter(id => state.clubs[id])
  const size = Math.max(1, ids.length)
  const byRep = [...ids].sort((a, b) => (state.clubs[b]?.rep ?? 0) - (state.clubs[a]?.rep ?? 0))
  let target = stretchTarget(Math.max(1, byRep.indexOf(club.id) + 1))
  const pos = tablePos(state, club.leagueId, club.id)
  if (pos && (comp.table.find(r => r.teamId === club.id)?.p ?? 0) >= 3) target = Math.min(target, pos)
  return { target: Math.max(1, Math.min(target, size)), size }
}

/**
 * A sponsor's target is a STRETCH on where stature ranks the club, not the
 * rank itself: measured over simulated seasons (talksprobe), a mid-table or
 * lower club finishes at or above its stature rank far more often than not
 * (the bottom club always does), so the bonus paid for turning up. One place
 * better from fourth down brings every band near an even bet; two from tenth
 * down was tried and left the small clubs a poor bet (talksprobe, 0.80).
 */
export function stretchTarget(rank: number): number {
  return rank <= 3 ? rank : rank - 1
}

/** Position in a league table on the same keys as schedule.sortTable (which
 *  cannot be imported here without a cycle), or 0 if absent. */
function tablePos(state: GameState, compId: string, clubId: string, by: 'pts' | 'tf' = 'pts'): number {
  const table = state.comps[compId]?.table ?? []
  const rows = [...table].sort(by === 'tf'
    ? (a, b) => (b.tf ?? 0) - (a.tf ?? 0) || (b.pf ?? 0) - (a.pf ?? 0)
    : (a, b) => b.pts - a.pts || b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa) || b.tf - a.tf || b.pf - a.pf)
  const i = rows.findIndex(r => r.teamId === clubId)
  return i < 0 ? 0 : i + 1
}

/**
 * THE CLUB'S LEVERAGE: how far over the going rate a sponsor will stretch
 * before the next push starts to feel like greed. Around 1.08 for a club in
 * ordinary form; a winning run and a table position above the club's stature
 * push it up, a slump pulls it down.
 */
export function leverage(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 1
  const played = state.fixtures
    .filter(f => f.played && f.compId !== 'fr' && (f.homeId === club.id || f.awayId === club.id))
    .slice(-6)
  let form = 0
  if (played.length) {
    const net = played.reduce((s, f) => {
      const us = f.homeId === club.id ? f.homeScore : f.awayScore
      const them = f.homeId === club.id ? f.awayScore : f.homeScore
      return s + (us > them ? 1 : us < them ? -1 : 0)
    }, 0)
    form = net / played.length
  }
  let standing = 0
  const comp = state.comps[club.leagueId]
  if (comp && (comp.table.find(r => r.teamId === club.id)?.p ?? 0) >= 3) {
    const ids = comp.teamIds.filter(id => state.clubs[id])
    const byRep = [...ids].sort((a, b) => (state.clubs[b]?.rep ?? 0) - (state.clubs[a]?.rep ?? 0))
    const expected = byRep.indexOf(club.id) + 1
    const pos = tablePos(state, club.leagueId, club.id)
    if (expected > 0 && pos > 0) standing = (expected - pos) / Math.max(1, ids.length)
  }
  const lev = 1.08 + 0.10 * form + 0.25 * standing
  return Math.max(0.95, Math.min(1.35, lev))
}

/**
 * The chance the sponsor walks if pushed. Pure, so the probe can drive it with
 * its own dice. A bonus-heavy structure makes a sponsor more relaxed about the
 * headline number, because it only pays the top of it if you deliver.
 */
export function walkChance(talk: Pick<Talk, 'fee' | 'pushes' | 'heat' | 'structure'>, size: 'ask' | 'demand', market: number, lev: number): number {
  const ask = talk.fee * (1 + (size === 'ask' ? ASK : DEMAND))
  const ratio = market > 0 ? ask / market : 1
  const soften = talk.structure === 'bold' ? 0.45 : talk.structure === 'mixed' ? 0.7 : 1
  const excess = Math.max(0, ratio - lev) * 2.6 * soften
  const p = 0.05 + 0.06 * talk.pushes + (size === 'demand' ? 0.10 : 0) + excess + talk.heat
  return Math.max(0.03, Math.min(0.95, p))
}

/** The four words the manager gets instead of the number. */
export type Mood = 'keen' | 'interested' | 'wary' | 'impatient'
export function moodOf(p: number): Mood {
  return p < 0.14 ? 'keen' : p < 0.26 ? 'interested' : p < 0.42 ? 'wary' : 'impatient'
}

/**
 * One push, resolved on two dice. Pure: returns what happened, changes nothing.
 * The sponsor either walks, gives the whole ask, or meets the manager halfway -
 * more likely the whole ask while the club is within its worth.
 */
export function respond(
  talk: Talk, size: 'ask' | 'demand', market: number, lev: number, r1: number, r2: number,
): { walked: boolean; fee: number; full: boolean } {
  const p = walkChance(talk, size, market, lev)
  if (r1 < p) return { walked: true, fee: talk.fee, full: false }
  const step = size === 'ask' ? ASK : DEMAND
  const ratio = market > 0 ? talk.fee * (1 + step) / market : 1
  const full = r2 < (ratio <= lev ? 0.65 : 0.35)
  return { walked: false, fee: Math.round(talk.fee * (1 + (full ? step : step / 2))), full }
}

/** What a structure pays, in pounds, for a flat-equivalent weekly fee. */
export function perfTerms(state: GameState, fee: number, structure: Structure): { weekly: number; perf?: PerfTerms } {
  const s = STRUCTURES[structure]
  if (structure === 'flat') return { weekly: Math.round(fee) }
  const shortfall = (1 - s.guaranteed) * fee * LEDGER_WEEKS * s.premium
  const { target } = leagueTarget(state)
  const amt = (w: number) => Math.round(shortfall * w / 1000) * 1000
  return {
    weekly: Math.round(fee * s.guaranteed),
    perf: {
      structure, target,
      league: amt(BONUS_WEIGHTS.league), title: amt(BONUS_WEIGHTS.title),
      final: amt(BONUS_WEIGHTS.final), tries: amt(BONUS_WEIGHTS.tries),
      firstWeek: Math.min(LEDGER_WEEKS, Math.max(1, state.week)),
    },
  }
}

/** A slot the manager can negotiate: nothing in term, or only a stopgap. */
export function slotOpen(state: GameState, slot: SlotId): boolean {
  const live = state.deals?.[slot]
  return !live || live.until < state.season || !!live.auto
}

/** Sit down with one of the sponsors on the table. */
export function openTalk(state: GameState, slot: SlotId, offerIdx: number): string {
  const talks = talksOf(state)
  if (!slotOpen(state, slot)) return t('finances.talkSlotSold')
  if (talks.open[slot]) return t('finances.talkAlready')
  const offer = offersFor(state, slot)[offerIdx]
  if (!offer) return t('finances.talkNoOffer')
  if (talks.gone[slot]?.includes(offer.sponsor)) return t('finances.talkGone', { sponsor: offer.sponsor })
  const walks = talks.gone[slot]?.length ?? 0
  const opening = Math.round(offer.weekly * Math.max(0.7, 1 - WALK_PENALTY * walks))
  talks.open[slot] = {
    slot, sponsor: offer.sponsor, years: offer.years, clause: offer.clause,
    opening, fee: opening, structure: 'flat', pushes: 0, moves: 0, heat: 0,
    last: { k: walks ? 'finances.talkOpenWary' : 'finances.talkOpen', v: { sponsor: offer.sponsor } },
  }
  if (talks.ended) delete talks.ended[slot]
  return t('finances.talkOpen', { sponsor: offer.sponsor })
}

function walkOut(state: GameState, slot: SlotId, talk: Talk, k: string) {
  const talks = talksOf(state)
  delete talks.open[slot]
  ;(talks.gone[slot] ??= []).push(talk.sponsor)
  ;(talks.ended ??= {})[slot] = { k, v: { sponsor: talk.sponsor } }
}

/** Push for more. The reply is stored on the talk and returned. */
export function pushTalk(state: GameState, slot: SlotId, size: 'ask' | 'demand'): string {
  const talk = talksOf(state).open[slot]
  const club = state.clubs[state.userClubId]
  if (!talk || !club) return t('finances.talkNone')
  if (talk.moves >= MAX_MOVES) return t('finances.talkFinal', { sponsor: talk.sponsor })
  const market = marketRate(club.rep, slot)
  const key = `talk|${slot}|${state.season}|${talk.sponsor}|${talk.moves}`
  const r = respond(talk, size, market, leverage(state), roll(state, key), roll(state, key + '|give'))
  talk.moves++
  talk.pushes++
  if (r.walked) {
    walkOut(state, slot, talk, 'finances.talkWalked')
    logDecision(state, 'dec.sponsorWalked', { sponsor: talk.sponsor, slot_k: SLOT_BY_ID[slot].name }, false)
    return t('finances.talkWalked', { sponsor: talk.sponsor })
  }
  talk.fee = r.fee
  talk.heat += size === 'ask' ? 0.03 : 0.07
  const k = talk.moves >= MAX_MOVES ? 'finances.talkLast'
    : r.full ? 'finances.talkGave' : 'finances.talkHalf'
  talk.last = { k, v: { sponsor: talk.sponsor, weekly: fmtMoney(perfTerms(state, talk.fee, talk.structure).weekly) } }
  return t(k, talk.last.v)
}

/** Ask for a different shape of deal. Costs a move, never the sponsor. */
export function restructure(state: GameState, slot: SlotId, structure: Structure): string {
  const talk = talksOf(state).open[slot]
  if (!talk) return t('finances.talkNone')
  if (talk.structure === structure) return t(talk.last?.k ?? 'finances.talkOpen', talk.last?.v)
  if (talk.moves >= MAX_MOVES) return t('finances.talkFinal', { sponsor: talk.sponsor })
  talk.moves++
  talk.heat += 0.01
  talk.structure = structure
  const k = talk.moves >= MAX_MOVES ? 'finances.talkLast' : `finances.talkStruct_${structure}`
  talk.last = { k, v: { sponsor: talk.sponsor, weekly: fmtMoney(perfTerms(state, talk.fee, structure).weekly) } }
  return t(k, talk.last.v)
}

/** Leave the table. The sponsor does not come back this season. */
export function breakOff(state: GameState, slot: SlotId): string {
  const talk = talksOf(state).open[slot]
  if (!talk) return t('finances.talkNone')
  walkOut(state, slot, talk, 'finances.talkBroken')
  return t('finances.talkBroken', { sponsor: talk.sponsor })
}

/** Shake hands on what is on the table. */
export function acceptTalk(state: GameState, slot: SlotId): string {
  const talks = talksOf(state)
  const talk = talks.open[slot]
  const club = state.clubs[state.userClubId]
  if (!talk || !club) return t('finances.talkNone')
  if (!slotOpen(state, slot)) return t('finances.talkSlotSold')
  const terms = perfTerms(state, talk.fee, talk.structure)
  const clause = talk.structure === 'flat' ? talk.clause : 'none'
  const deal: Deal = {
    slot, sponsor: talk.sponsor, weekly: terms.weekly, clause,
    from: state.season, until: state.season + talk.years - 1, repAt: club.rep,
  }
  if (terms.perf) deal.perf = terms.perf
  ;(state.deals ??= {})[slot] = deal
  // the summer question about this slot is answered by the handshake
  dropSlotQuestion(state, slot)
  delete talks.open[slot]
  if (slot === 'naming') applyStadiumName(state, talk.sponsor)
  const info = SLOT_BY_ID[slot]
  logDecision(state, 'dec.signedSponsor', {
    sponsor: talk.sponsor, slot_k: info.name, weekly: fmtMoney(terms.weekly), n: talk.years,
  }, true)
  const k = terms.perf ? 'news.sponsorSignedPerf' : clause === 'none' ? 'news.sponsorSigned' : 'news.sponsorSignedClause'
  const v: Vars = {
    sponsor: talk.sponsor, short: club.short, slot_k: info.name,
    yrs_k: 'news.sponsorYears', n: talk.years,
    weekly: fmtMoney(terms.weekly), clause_k: CLAUSES[clause]?.text ?? 'common.nothing',
    naming_k: slot === 'naming' ? 'news.sponsorNaming' : 'common.nothing', stadium: club.stadium,
    target: terms.perf?.target ?? 0,
    top: fmtMoney(terms.perf ? terms.perf.league + terms.perf.title + terms.perf.final + terms.perf.tries : 0),
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.sponsorSignedSubj', v),
    body: tIn('en', k, v),
    k, v,
  })
  return t('finances.talkDone', {
    sponsor: talk.sponsor, weekly: fmtMoney(terms.weekly),
    years: talk.years === 1 ? t('finances.oneSeason') : t('finances.seasons', { n: talk.years }),
  })
}

/** Which bonus lines a season met, read off the finished tables. */
export function bonusHits(state: GameState, perf: PerfTerms): Record<BonusLine, boolean> {
  const club = state.clubs[state.userClubId]
  const none = { league: false, title: false, final: false, tries: false }
  if (!club) return none
  const comp = state.comps[club.leagueId]
  const played = (comp?.table.find(r => r.teamId === club.id)?.p ?? 0) > 0
  if (!comp || !played) return none
  const pos = tablePos(state, club.leagueId, club.id)
  const triesPos = tablePos(state, club.leagueId, club.id, 'tf')
  return {
    league: pos > 0 && pos <= perf.target,
    title: pos === 1 || comp.champion === club.id,
    final: state.fixtures.some(f => f.stage === 'F' && (f.homeId === club.id || f.awayId === club.id)),
    tries: triesPos > 0 && triesPos <= perf.target,
  }
}

/**
 * The season's end: pay every performance bonus the season earned, into the
 * bank, with one letter that says what was met and what it came to. Called by
 * rebuildSeason BEFORE the tables are wiped, because the targets are read off
 * them.
 */
export function settleSponsorBonuses(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club || !state.deals || state.unemployed) return 0
  let total = 0, met = 0, lines = 0
  const sponsors: string[] = []
  for (const d of Object.values(state.deals)) {
    if (!d?.perf || d.from > state.season || d.until < state.season) continue
    const hits = bonusHits(state, d.perf)
    // the first season is paid for the weeks the deal actually covered
    const share = d.from === state.season
      ? Math.max(0, LEDGER_WEEKS - d.perf.firstWeek + 1) / LEDGER_WEEKS
      : 1
    let paid = 0
    for (const line of Object.keys(BONUS_WEIGHTS) as BonusLine[]) {
      lines++
      if (!hits[line]) continue
      met++
      paid += d.perf[line]
    }
    paid = Math.round(paid * share)
    if (!Number.isFinite(paid) || paid <= 0) continue
    total += paid
    sponsors.push(d.sponsor)
  }
  if (!lines) return 0
  if (total > 0) {
    club.balance += total
    book(state, 'bonus', total)
  }
  const k = total > 0 ? 'news.sponsorBonus' : 'news.sponsorBonusNone'
  const v: Vars = { amount: fmtMoney(total), met, n: lines, sponsors: sponsors.join(', ') }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v,
  })
  return total
}
