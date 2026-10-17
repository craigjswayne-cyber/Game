// The season's numbers wiped and the summer review of every young man's
// ceiling (devproject.ts): the staff's estimate before the summer and after.
import { markSights, seasonReview, TL } from '../devproject'
import { tIn } from '../i18n'
import { loanOutSummerGain } from '../loans'
import { archiveSeason, emptyStats, type GameState } from '../model'
import { clamp } from '../rng'
import { paRange, scoutPa } from '../scout'
import { activePlan } from '../season/training'

const bandText = (r: [number, number] | null) => (r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`) : '')

/** Close every player's season: the development review, the career row, the
 *  stats wipe, the summer's rest, and a loan come home. Returns the staff's
 *  estimates of the manager's young men as they stood before the summer. */
export function closeSeasonStats(state: GameState): { sightsBefore: Map<number, number>; bandBefore: Map<number, string> } {
  const sightsBefore = new Map<number, number>()
  const bandBefore = new Map<number, string>()
  for (const p of Object.values(state.players)) {
    if (p.clubId === state.userClubId && p.age <= 23) {
      sightsBefore.set(p.id, scoutPa(state, p))
      bandBefore.set(p.id, bandText(paRange(state, p)))
    }
    seasonReview(state, p, p.clubId === state.userClubId && !!activePlan(state, p.id))
    if (p.stats.apps > 0 && p.clubId) {
      archiveSeason(p, { season: state.season, clubId: p.clubId, apps: p.stats.apps, tries: p.stats.tries, points: p.stats.points })
    }
    // remembered across the wipe so devFactor can ask how much rugby the
    // season actually held (25D: minutes-gated growth)
    p.lastStarts = p.stats.starts
    p.stats = emptyStats()
    // the last week he played belongs to the season being wiped with these
    // stats. Kept, a man who played in week 40 read as having "played last
    // week" until week 41 of the next season: the weekly morale drift never
    // saw him as frozen out, and the press never asked why he was benched.
    p.lastWk = undefined
    p.avail = 0
    p.form = 6
    // The summer lifts a man one notch - a break does that - but it no longer
    // resets every grievance to Good (was clamp(morale, 5, 10), which quietly
    // amnestied a season of mismanagement every July). A truly soured player
    // reports back still short of settled, and the manager still owes him a
    // conversation (v1.1.4, "manager choices must matter").
    p.morale = clamp(p.morale + 1, 4, 10)
    p.cond = 100
    p.sharp = 60
    p.injury = null
    // a summer heals a knock too, and its week numbers were last season's
    p.knock = undefined
    p.specialist = false
    p.bans = 0
    p.rust = 0
    p.natSquad = false
    if (p.onLoan) {
      // back from a season of first-team rugby elsewhere
      p.onLoan = false
      p.loanClub = undefined
      if (p.ca < p.pa) p.ca = clamp(p.ca + loanOutSummerGain(state, p), 1, p.pa)
      p.loanSince = undefined
      if (p.clubId === state.userClubId) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `${p.name} returns from loan`,
          body: `A season of regular rugby has done ${p.name} the world of good. He reports back noticeably sharper.`,
          k: 'news.loanBack', v: { player: p.name },
          playerId: p.id,
        })
      }
    }
    p.ca0 = p.ca
  }
  return { sightsBefore, bandBefore }
}

/** After the summer's growth: mark each young man whose projected band moved,
 *  and send the staff's review in one letter when they changed their minds. */
export function reviewSights(state: GameState, sightsBefore: Map<number, number>, bandBefore: Map<number, string>) {
  const moved: { k: string; name: string; from: string; to: string }[] = []
  for (const [id, before] of sightsBefore) {
    const p = state.players[id]
    if (!p || p.clubId !== state.userClubId) continue
    markSights(p, Math.round(before), Math.round(scoutPa(state, p)))
    const f = p.tl?.[p.tl.length - 1]?.[2] ?? 0
    // PROJECTION REVISED: the band as it read before the summer and after it,
    // both through the fog (scout.ts paRange), never the number behind them
    const from = bandBefore.get(id) ?? '', to = bandText(paRange(state, p))
    if (!from || !to || from === to) continue
    if (f & TL.up) moved.push({ k: 'dev.reviewUp', name: p.name, from, to })
    else if (f & TL.down) moved.push({ k: 'dev.reviewDown', name: p.name, from, to })
  }
  // the staff's summer review in one letter, only when they changed their minds
  if (moved.length && !state.unemployed) {
    const v = { rows_ll: JSON.stringify(moved.slice(0, 8)) }
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: tIn('en', 'news.devReviewSubj', v),
      body: tIn('en', 'news.devReview', v),
      k: 'news.devReview', v,
    })
  }
}
