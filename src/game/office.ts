// The manager's office: its outlet name, the boardroom test and the memory
// of who came in about what. A leaf below media.ts, so that the modules that
// raise office conversations (acadcall, authority, room, talkback, bonds) do
// not import media back; media.ts re-exports all of it.
import type { GameState, OfficeTopic } from './model'
import { absWeek } from './model'

/** Not an outlet at all: player conversations behind a closed door. */
export const OFFICE_OUTLET = "The Manager's Office"
/** BOARDROOM, NOT PRESS ROOM (owner, 28 Sep 2026: "anything that is financial
 *  related like this and goal setting should be in [the board room section of
 *  finances] not the press"). The pre-season camp, the season's expectations
 *  and the sponsor slot deals are still PressItems underneath, so they answer
 *  through the same path and the same saves load, but they are asked and
 *  answered on Finances > The Board, and the press room never shows them. */
export function isBoardroom(p: { options: { camp?: unknown; stance?: unknown; deal?: unknown }[] }): boolean {
  return p.options.some(o => o.camp != null || o.stance != null || o.deal != null)
}

/**
 * How long the office remembers a conversation.
 *
 * A live report: a prospect asked to go out on loan, the manager agreed, and
 * the same lad knocked again with the same speech seven days later. The office
 * was generating from squad state alone, so any player who still matched the
 * filter could be picked again the very next week - and agreeing to something
 * never changed the filter, because agreeing did nothing.
 *
 * Fourteen weeks is a third of a season: long enough that the repeat reads as
 * a man whose patience has run out rather than a bug, and short enough that
 * he does get to come back if you left him in the stand all year.
 */
const OFFICE_COOLDOWN = 14


/** Has this player raised this subject recently enough that raising it again
 *  would read as the game forgetting the last conversation? */
export function askedRecently(state: GameState, pid: number, topic: OfficeTopic): boolean {
  const now = absWeek(state.season, state.week)
  return (state.officeMemo ?? []).some(m =>
    m.pid === pid && m.topic === topic && now - absWeek(m.season, m.week) < OFFICE_COOLDOWN)
}

/** Record that he came in about it. Written when the conversation is raised,
 *  not when it is answered: ignoring a player is also an answer, and it does
 *  not entitle him to ask again next week. */
export function rememberAsk(state: GameState, pid: number, topic: OfficeTopic) {
  ;(state.officeMemo ??= []).push({ pid, topic, season: state.season, week: state.week })
  // two seasons of memos is far more than the cooldown needs, and keeps the
  // save from carrying a list that only ever grows
  const cutoff = absWeek(state.season - 2, state.week)
  state.officeMemo = state.officeMemo.filter(m => absWeek(m.season, m.week) >= cutoff).slice(-200)
}
