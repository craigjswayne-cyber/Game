/**
 * ---- THE LEAGUE IS FULL OF PEOPLE WHO WANT THINGS ----
 *
 * Playbook wave 4. The transfer market this sits on is already good: deadline
 * days, bidding wars, transfer requests, panic premiums. What it has never had
 * is INTENT. aiTransfers picks a club at random, finds its thinnest position and
 * signs the best body available, which means a hundred clubs behave like one
 * club with a hundred names. Nobody is rebuilding, nobody is going for it, and
 * nobody in particular wants YOUR player - the bid that arrives for your best
 * man is a dice roll that happened to come up, and it arrives with no warning
 * and no history.
 *
 * Two halves, and the second is the one that hurts.
 *
 *   CLUB INTENT. Every club takes a stance each season - rebuilding,
 *   consolidating, going all in, or being broken up - derived from where it
 *   finished, what it owes, and how old its squad is. It biases what the club
 *   does in the market and it is legible to the manager, so the league reads as
 *   a hundred boardrooms with plans rather than one random-number generator.
 *
 *   THE HUNT. One rival identifies your talisman and pursues him across a
 *   season in stages: a paragraph in a paper, a public admission, a formal
 *   approach, and finally a bid you cannot ignore. You can see it coming from
 *   week one, which is the entire point. A player leaving should be the end of
 *   a story you watched happen, not an alert.
 *
 * DETERMINISM, and it matters more here than anywhere. Everything in this file
 * gates on mulberry32 over a hash of the season, the club id and the player id.
 * It never touches the shared match rng, so a hunt cannot move a single result,
 * and the fingerprint is untouched. Same rule as dialweight and the Dream.
 */
import { fmtMoney, poss } from './model'
import type { Club, GameState, Player } from './model'
import { hashString, mulberry32 } from './rng'

export type Intent = 'rebuild' | 'consolidate' | 'allin' | 'breakup'

const INTENT_BLURB: Record<Intent, string> = {
  rebuild: 'rebuilding: young signings, patient board, no interest in a 32-year-old',
  consolidate: 'consolidating: steady as she goes, and nobody is being sold cheap',
  allin: 'going for it: the board has opened the cheque book and wants it spent',
  breakup: 'being broken up: the money has run out and everybody has a price',
}

export const intentBlurb = (i: Intent): string => INTENT_BLURB[i]

/**
 * What this club is trying to do this season. A PURE LENS: same club, same
 * season, same answer, every time anybody asks, with nothing written down.
 */
export function clubIntent(state: GameState, club: Club): Intent {
  // the money talks first, in both directions
  const wages = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  if (club.admin || (wages > 0 && club.balance < -10 * wages)) return 'breakup'

  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.acad)
  const meanAge = squad.length ? squad.reduce((s, p) => s + p.age, 0) / squad.length : 27
  const rich = wages > 0 && club.balance > 30 * wages

  // last season's finish against what a club of this stature expects
  const last = state.history?.filter(h => h.champion === club.id).length ?? 0
  const r = mulberry32((hashString(club.id) ^ (state.season * 2654435761)) >>> 0)()

  if (rich && (club.rep >= 78 || last > 0) && r < 0.62) return 'allin'
  // 26.6, measured rather than guessed. Senior squads here run 24.2 to 28.9
  // with a median of 26.2, so the first cut at 28.6 fired for ONE club in a
  // hundred and the stance may as well not have existed. This sits just above
  // the median, which is what "an ageing squad" actually means in this world.
  if (meanAge >= 26.6 && r < 0.7) return 'rebuild'
  if (club.rep >= 72 && r < 0.34) return 'allin'
  return 'consolidate'
}

/** The one man this club would be smaller without. Pure. */
export function talismanOf(state: GameState, clubId: string): Player | null {
  const club = state.clubs[clubId]
  if (!club) return null
  const squad = club.players
    .map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad && !p.loanFrom && !p.retiring)
  if (!squad.length) return null
  // ability first, with a nod to what the market would pay: the talisman is the
  // man the rest of the league wants, not merely the highest rating
  return squad.reduce((best, p) =>
    (p.ca * 1000 + p.value / 1000) > (best.ca * 1000 + best.value / 1000) ? p : best, squad[0])
}

/** How far the circling has got. 0 = nobody is looking. */
export type HuntStage = 0 | 1 | 2 | 3

export interface Hunt {
  clubId: string
  playerId: number
  stage: HuntStage
  /** season this hunt belongs to - a new season starts a new story */
  season: number
}

const STAGE_WEEK: Record<Exclude<HuntStage, 0>, number> = { 1: 6, 2: 16, 3: 28 }

/**
 * Open a hunt for this season if one is due, then move it along.
 *
 * Called once a week from the season loop. Writes only to state.hunt and the
 * news feed; draws nothing from the shared rng.
 */
export function advanceHunt(state: GameState): void {
  if (state.retired) return
  const user = state.clubs[state.userClubId]
  if (!user) return

  // a new season retires the old story
  if (state.hunt && state.hunt.season !== state.season) state.hunt = undefined

  if (!state.hunt) {
    // one hunt a season, and only if somebody worth hunting is here
    const star = talismanOf(state, state.userClubId)
    if (!star || star.ca < 78) return
    const gate = mulberry32((hashString(state.userClubId) ^ (state.season * 40503) ^ (star.id * 613)) >>> 0)
    if (gate() > 0.55) return
    // who wants him: a club at least his level, going for it if possible
    const suitors = Object.values(state.clubs).filter(c =>
      c.id !== state.userClubId && c.rep >= user.rep - 4 && !c.admin)
    if (!suitors.length) return
    const keen = suitors.filter(c => clubIntent(state, c) === 'allin')
    const pool = keen.length ? keen : suitors
    const pick = pool[Math.floor(gate() * pool.length) % pool.length]
    state.hunt = { clubId: pick.id, playerId: star.id, stage: 0, season: state.season }
  }

  const h = state.hunt
  const p = state.players[h.playerId]
  const club = state.clubs[h.clubId]
  // he left, or they went under: the story simply stops
  if (!p || !club || p.clubId !== state.userClubId) { state.hunt = undefined; return }

  const nextStage = (h.stage + 1) as Exclude<HuntStage, 0>
  if (nextStage > 3 || state.week < STAGE_WEEK[nextStage]) return
  h.stage = nextStage

  if (nextStage === 1) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: `Paper talk: ${club.short} admire ${p.name}`,
      body: `A paragraph at the bottom of a transfer column, nothing more: ${club.name} "hold a long-standing admiration" for ${p.name}. That is how these always start, and most of them come to nothing.`,
      playerId: p.id,
    })
  } else if (nextStage === 2) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: `${poss(club.short)} coach is asked about ${p.name}, and does not deny it`,
      body: `Put to him directly in a press conference, ${club.name}'s head coach called ${p.name} "a wonderful player at a club he is happy at" and moved on to the next question. Nobody in the room believed the second half of that sentence.\n\nHe is under contract. That has never been the same thing as being unavailable.`,
      playerId: p.id,
    })
  } else {
    const fee = Math.round(p.value * 1.45 / 10_000) * 10_000
    state.offers.push({
      id: state.nextId++, playerId: p.id, fromClubId: club.id, toClubId: state.userClubId,
      fee, week: state.week, forUser: true, status: 'pending',
    })
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: `🚨 ${club.short} bid ${fmtMoney(fee)} for ${p.name}`,
      body: `So it was not paper talk. ${club.name} have made ${p.name} a formal offer of ${fmtMoney(fee)}, comfortably above his valuation, and they have been building to this since the autumn.\n\nYou have known it was coming for months. Now you answer it.`,
      playerId: p.id,
    })
  }
}

/** What the Home screen should say about the circling, if anything. */
export function huntLine(state: GameState): string | null {
  const h = state.hunt
  if (!h || h.season !== state.season || h.stage === 0) return null
  const p = state.players[h.playerId]
  const club = state.clubs[h.clubId]
  if (!p || !club || p.clubId !== state.userClubId) return null
  return h.stage === 1 ? `${club.short} are said to admire ${p.name}.`
    : h.stage === 2 ? `${club.short} will not deny their interest in ${p.name}. This is getting louder.`
    : `${club.short} have bid for ${p.name}, and they mean it.`
}
