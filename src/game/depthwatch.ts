import type { GameState, Player, Pos } from './model'
import { POS_ORDER } from './model'
import { tIn } from './i18n'
import { clubMatchesPlayed } from './gametime'

/**
 * THE ASSISTANT WATCHES THE DEPTH CHART (owner, round 4).
 *
 * The depth chart used to flag a thin position on screen: a red count, a
 * coloured row and a line of warning under it. The owner wanted the chart to
 * be a chart and the warning to be a word from the assistant instead: one
 * short inbox message naming the position, and only once for each spell of
 * thinness. A position that stays thin for six weeks is one message, not six;
 * when it recovers and goes thin again, that is a new spell and a new message.
 *
 * Thin is counted the way the chart counts its own column: the men whose OWN
 * position it is, first team only, who could play this week (not injured, not
 * banned, not away with their country, not out on loan). Cover from another
 * position does not count, at the owner's request. The front row wants three
 * of each because the laws want a specialist replacement for every one of
 * them; everywhere else two.
 *
 * Deterministic and off the shared rng: it reads the squad and nothing else.
 */
export const depthNeed = (pos: Pos): number => (pos === 'LP' || pos === 'HK' || pos === 'TP' ? 3 : 2)

export const outThisWeek = (p: Player): boolean => !!p.injury || p.bans > 0 || !!p.natSquad || !!p.onLoan

/** Fit specialists at a position for the manager's club. */
export function fitAt(state: GameState, pos: Pos): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  let n = 0
  for (const id of club.players) {
    const p = state.players[id]
    if (p && !p.acad && p.pos === pos && !outThisWeek(p)) n++
  }
  return n
}

/**
 * Once a week. `skip` is the positions a louder alert (the injury-crisis story)
 * has already spoken for this week: they are marked as reported, so the
 * assistant does not say the same thing twice in one inbox.
 */
export function depthWatch(state: GameState, skip: ReadonlySet<Pos> = new Set()): void {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  // a new club is a new squad: what was reported at the last one is not news here
  if (!state.depthShort || state.depthShort.club !== club.id) state.depthShort = { club: club.id, pos: [] }
  // nothing before the first match (owner, round 7): a squad in pre-season is
  // still being put together, and week 1 opened with two of these
  if (clubMatchesPlayed(state, club.id) === 0) return
  const told = new Set(state.depthShort.pos)
  for (const pos of POS_ORDER) {
    // the back row is one unit (owner, round 7): flankers and number 8s cover
    // each other, so they are counted together under FL and N8 says nothing
    if (pos === 'N8') { told.delete(pos); continue }
    const backRow = pos === 'FL'
    const n = backRow ? fitAt(state, 'FL') + fitAt(state, 'N8') : fitAt(state, pos)
    if (n >= (backRow ? 3 : depthNeed(pos))) { told.delete(pos); continue }
    if (told.has(pos)) continue
    told.add(pos)
    if (skip.has(pos) || (backRow && skip.has('N8'))) continue
    const k = n === 0 ? 'news.depthShortNone' : 'news.depthShort'
    const v = { n, pos_k: backRow ? 'pos.backRow' : `pos.${pos}` }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
      subject: tIn('en', `${k}Subj`, v),
      body: tIn('en', k, v),
      k, v,
    })
  }
  state.depthShort.pos = POS_ORDER.filter(p => told.has(p))
}
