import type { GameState, Player } from './model'
import { formTrend } from './formtraits'
import { tIn } from './i18n'

/**
 * ---- THE DRESSING ROOM, IN THE INBOX (1.9.13) ----
 *
 * Owner, from FM27 Mobile's dynamics alerts ("surfaces morale shifts ...
 * and goal droughts"). A player's morale and form already moved every week
 * and the office could answer them (chats.ts: praise, a quiet word, and now
 * encouragement), but nothing told the manager it was time to. Three alerts,
 * each once per spell rather than every week the spell lasts, each opening
 * the player:
 *
 *   a try drought  a back who has scored this season and has now gone six
 *                  games without one
 *   low morale     a regular whose morale has dropped below 4
 *   a form slump   a regular whose last match ratings are falling,
 *                  averaging under 5.8 and well below his own season
 *
 * At most two a week, so a bad month is a couple of names rather than a
 * wall of them. Read off what the week already holds: no draw.
 */
const SCORERS = new Set(['WG', 'FB', 'CE'])
export const DROUGHT_GAMES = 6
const MAX_A_WEEK = 2

/** After each match: a player's run of games without a try (finalize.ts). */
export function noteTryRun(p: Player): void {
  const mark = p.tryMark ?? 0
  if (p.stats.tries < mark) p.tryMark = p.stats.tries   // a new season wiped the count
  if (p.stats.tries > (p.tryMark ?? 0)) { p.dry = 0 } else { p.dry = (p.dry ?? 0) + 1 }
  p.tryMark = p.stats.tries
}

function push(state: GameState, k: string, p: Player) {
  const v = { player: p.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, playerId: p.id,
  })
}

const regular = (p: Player) => p.status === 'key' || p.status === 'rotation' || p.stats.apps >= 4

/** Once a week, for the manager's own seniors. */
export function dressingRoomAlerts(state: GameState): void {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return
  let sent = 0
  const seniors = club.players.map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad && !p.onLoan)
    .sort((a, b) => b.ca - a.ca || a.id - b.id)
  for (const p of seniors) {
    // each flag clears when the spell ends, so the next spell is news again
    if (p.alerted?.low && p.morale >= 5) p.alerted = { ...p.alerted, low: false }
    const trend = formTrend(p)
    const last = (p.ratings ?? []).slice(-3)
    const avg = last.length ? last.reduce((a, b) => a + b, 0) / last.length : 7
    // a real dip, not a quiet patch: the last three under 5.8 AND well below
    // his own season (measured 15 Nov 2026: 'falling and under 6' named a
    // slump every three weeks or so; this is a handful a season)
    const season = p.stats.apps ? p.stats.ratingSum / p.stats.apps : avg
    const slumping = trend === 'down' && last.length >= 3 && avg < 5.8 && season - avg >= 0.6
    if (p.alerted?.slump && !slumping) p.alerted = { ...p.alerted, slump: false }
    if ((p.dry ?? 0) < DROUGHT_GAMES && p.alerted?.dry) p.alerted = { ...p.alerted, dry: false }
    if (sent >= MAX_A_WEEK || p.injury) continue
    if (SCORERS.has(p.pos) && p.stats.tries >= 2 && (p.dry ?? 0) >= DROUGHT_GAMES && !p.alerted?.dry) {
      push(state, 'news.tryDrought', p); p.alerted = { ...p.alerted, dry: true }; sent++; continue
    }
    if (regular(p) && p.morale < 4 && !p.alerted?.low) {
      push(state, 'news.moraleLow', p); p.alerted = { ...p.alerted, low: true }; sent++; continue
    }
    if (regular(p) && slumping && !p.alerted?.slump) {
      push(state, 'news.formSlump', p); p.alerted = { ...p.alerted, slump: true }; sent++
    }
  }
}
