import type { GameState, NewsItem } from './model'
import { fixtureDayOff, weekDate } from './model'
import { userMatchThisWeek } from './season'

/**
 * ---- THE WEEK, DAY BY DAY ----
 *
 * Continue used to jump a whole week at a time, and everything that happened in
 * it arrived in one lump: a stack of Wire stories, a press conference waiting,
 * three injury notes and a team-news item, all on the same tap. The manager's
 * week had no shape (user: "it should be a continue button and it goes day by
 * day. so when you click it you get daily updates ... so it feels a bit slower
 * between games").
 *
 * The engine still settles a whole week at once, which is deliberate: the
 * simulation, the rng stream and every ledger in the game are weekly, and
 * cutting them into sevenths to make the button feel different would be a
 * rewrite of the parts that work. What changes is the REVEAL. The week's output
 * is dealt out across the days that lead up to the next match, each day showing
 * the part of it that belongs to that day, so Continue walks Monday to Saturday
 * instead of teleporting.
 *
 * Two rules keep it from becoming a chore:
 *
 *   - a day with nothing on it is skipped, so a quiet week is two taps and a
 *     loud one is five. Continue never shows an empty page.
 *   - the last day is the match. On a blank week it is the round-up of everyone
 *     else's results, which is where the week used to end anyway.
 */

/** Monday to Saturday. Sunday belongs to the previous week's match. */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5
export const MATCH_DAY: DayIndex = 5

/** What the day is FOR - the heading on the bulletin, and the reason a story
 *  lands on it. A coach's week has this shape whether the game models it or not:
 *  the fallout on Monday, the cameras on Tuesday, business midweek, the squad on
 *  Thursday, the opposition on Friday. */
export const DAY_NAMES: Record<DayIndex, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
}

export const DAY_THEME: Record<DayIndex, string> = {
  0: 'The Review',
  1: 'Facing The Cameras',
  2: 'Club Business',
  3: 'The Squad',
  4: 'Eve Of The Match',
  5: 'Matchday',
}

export const DAY_SUB: Record<DayIndex, string> = {
  0: 'the weekend picked over, and what it cost you',
  1: 'the press want answers and the board has an opinion',
  2: 'the market, the money and the paperwork',
  3: 'who is fit, who is training, who needs a word',
  4: 'the last look at them before you play them',
  5: 'kick off',
}

/** Which day a story belongs to.
 *
 *  A pure function of the story's own type, so it never touches the match rng
 *  and the same story lands on the same day every time it is read. */
export function dayOfStory(n: NewsItem): DayIndex {
  switch (n.type) {
    // the weekend, picked over
    case 'result': return 0
    case 'injury': return 0
    // the cameras and the boardroom
    case 'board': return 1
    case 'award': return 1
    // business
    case 'transfer': return 2
    case 'contract': return 2
    // the squad and the academy
    case 'youth': return 3
    case 'intl': return 3
    // Friday's paper: whatever the mill has been turning over
    case 'gossip': return 4
    default: return 4
  }
}

/** The current day, defaulting for saves written before days existed. */
export function today(state: GameState): DayIndex {
  const d = state.day
  return (d != null && d >= 0 && d <= 5 ? d : 0) as DayIndex
}

/** 'Mon 11 Aug' for a day of the current week.
 *
 *  Week N's date IS its Saturday (weekDate documents the anchor), so Monday is
 *  five days back from it. */
export function dayDate(season: number, week: number, day: DayIndex): string {
  const start = Date.UTC(2025 + season, 7, 16)
  const d = new Date(start + ((week - 1) * 7 + (day - MATCH_DAY)) * 86400000)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

/**
 * ---- THE RECALL WINDOW ----
 *
 * User: "on inbox, when you've read them they should be viewable to look back
 * but only for 5 days maximum."
 *
 * The reader used to hold the last twenty stories regardless of age, which meant
 * a busy fortnight buried this morning's team news behind results from three
 * weeks ago. Five days is the manager's own working memory: long enough to go
 * back and check what the board actually said, short enough that the reader is
 * always about now.
 *
 * Two rules, and the second is the one that matters:
 *
 *   an UNREAD story never expires. Ageing something out before it has been seen
 *     is losing the manager's mail, not tidying it.
 *   nothing is deleted. The Wire, the season review and the club history all read
 *     state.news; a story that leaves the reader is still on the record.
 */
export const RECALL_DAYS = 5

/** Days since the start of career - a single axis for anything that ages.
 *
 *  Built on the same calendar weekDate prints, so the arithmetic agrees with the
 *  dates on screen and crossing a season boundary needs no special case. */
export function absDay(season: number, week: number, day: DayIndex = MATCH_DAY): number {
  const start = Date.UTC(2025 + season, 7, 16)
  return Math.round((start + ((week - 1) * 7 + (day - MATCH_DAY)) * 86400000) / 86400000)
}

/** How many days ago this story landed, from where the manager is standing. */
export function storyAge(state: GameState, n: NewsItem): number {
  const now = absDay(state.season, state.week, today(state))
  return Math.max(0, now - absDay(n.season, n.week, dayOfStory(n)))
}

/** Should this story still be in the news reader?
 *
 *  The single predicate behind every news filter - the screen, the queue, the
 *  step arrows and Clear read. They disagreed once already (the reader showed
 *  thirty, the arrows walked twenty) and that is the kind of bug that reads as
 *  the game losing mail.
 *
 *  GOSSIP BELONGS HERE TOO. It used to be excluded, which is what gave the game
 *  two news screens: the inbox for everything except gossip, and The Rugby Wire
 *  for gossip. Two browsers over one array, split on a field the player cannot
 *  see (user: "merge the rugby wire and news, its the same thing"). One list, one
 *  set of rules: a rumour ages out of the reader on the same five-day shelf as a
 *  board memo, and Clear read files it like anything else. Nothing is deleted -
 *  the season review and club history still read the whole of state.news. */
export function inInbox(state: GameState, n: NewsItem): boolean {
  if (n.cleared) return false
  if (!n.read) return true
  // THE SHELF COUNTS FROM THE READING, NOT THE WRITING. It used to age a read
  // story from the day it was published, which made the queue a wood chipper:
  // an unread story more than five days old expired the INSTANT openInbox
  // marked it read, so it was served straight into the void, the reader's
  // catch-up effect asked for the next one, and a tap on "9 unread messages"
  // silently devoured all nine and landed on an empty screen (user: "it often
  // says 9 messages in inbox, click on it and nothing shows up"). Read mail
  // now gets its five days on the shelf from the moment it is opened. Stories
  // read before readAt existed keep the written-day axis.
  return daysLeft(state, n) >= 0
}

/** How many more days a READ story has in the reader. Negative means gone. */
export function daysLeft(state: GameState, n: NewsItem): number {
  const now = absDay(state.season, state.week, today(state))
  const readAt = n.readAt ?? absDay(n.season, n.week, dayOfStory(n))
  return RECALL_DAYS - (now - readAt)
}

/** The one way to mark a story read: stamps when, so the shelf is honest. */
export function markRead(state: GameState, n: NewsItem): void {
  if (!n.read) {
    n.read = true
    n.readAt = absDay(state.season, state.week, today(state))
  }
}

/** The id the current week's bulletins start from.
 *
 *  Defaults to "nothing yet" rather than "everything": a save written before the
 *  day flow existed would otherwise dump its whole unread backlog onto Monday.
 *  The watermark is set on the next settlement, so it self-corrects after one
 *  Continue. */
export function newsSince(state: GameState): number {
  return state.newsFrom ?? state.nextId
}

/** The unread stories filed for a given day of this week.
 *
 *  Filed by id, not by week: the stories were written under the week that has
 *  just been settled and the counter has already moved on. Only unread ones -
 *  once you have read a story it belongs to the inbox, not to today. */
export function storiesForDay(state: GameState, day: DayIndex): NewsItem[] {
  const from = newsSince(state)
  return state.news.filter(n =>
    n.id >= from && !n.read && !n.cleared && dayOfStory(n) === day)
}

/** A press conference the manager has not answered yet. Tuesday's business, but
 *  it stays flagged every day until it is done - a question you have ignored is
 *  not less urgent on Thursday. */
export function pressWaiting(state: GameState): number {
  return state.press.filter(p => p.week === state.week && !p.answered).length
}

/** Men who picked up something over the weekend, or are back this week. */
export function medicalNews(state: GameState): { out: string[]; back: string[] } {
  const club = state.clubs[state.userClubId]
  if (!club) return { out: [], back: [] }
  const out: string[] = []
  const back: string[] = []
  for (const id of club.players) {
    const p = state.players[id]
    if (!p || p.acad) continue
    if (p.injury) {
      const weeks = p.injury.until - state.week
      if (weeks > 0) out.push(`${p.name} - ${p.injury.desc}, about ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`)
    } else if (p.sharp < 70) {
      back.push(`${p.name} is back in training and ${Math.round(p.sharp)}% sharp`)
    }
  }
  return { out: out.slice(0, 6), back: back.slice(0, 4) }
}

/** Is there anything on this day worth stopping for?
 *
 *  This is what lets Continue skip a dead Wednesday. Every item counted here has
 *  to be something the bulletin will actually render, or Continue stops on a
 *  blank page - which is exactly the tedium the day flow is meant to avoid. */
export function dayHasSomething(state: GameState, day: DayIndex): boolean {
  if (day === MATCH_DAY) return true
  if (storiesForDay(state, day).length > 0) return true
  if (day === 1 && pressWaiting(state) > 0) return true
  if (day === 0) {
    const med = medicalNews(state)
    if (med.out.length || med.back.length) return true
  }
  if (day === 3 && state.offers.some(o => o.status === 'pending' && o.forUser)) return true
  if (day === 4) {
    // Friday always has the opposition on it when there is a match to come, and
    // otherwise it has the rest of the league's fixtures. A Test week counts:
    // the manager's match is his nation's.
    if (userMatchThisWeek(state)) return true
  }
  return false
}

/** Does the user's own match fall before Saturday?
 *
 *  Fixtures kick off Friday, Saturday or Sunday. A Friday night game means
 *  Friday IS the match day, so Continue must not offer a Friday bulletin and
 *  then a Saturday match. */
export function matchDayIndex(state: GameState): DayIndex | null {
  // one decision point with the match entrances: a Test week is the
  // manager's Test week, and the assistant has the club game
  const fx = userMatchThisWeek(state)
  if (!fx) return null
  return fixtureDayOff(fx.id) === -1 ? 4 : MATCH_DAY
}

/**
 * What the Continue button does next.
 *
 *  'day'   - show this day's bulletin
 *  'match' - the day the match falls on: hand over to Matchday
 *  'week'  - the week is spent: settle it and start the next Monday
 *
 * The single decision point for the whole flow, so the button's label, the
 * bulletin and the week roll-over can never disagree about what day it is.
 */
export type NextStep =
  | { kind: 'day'; day: DayIndex }
  | { kind: 'match' }
  | { kind: 'week' }

export function stepFromDay(state: GameState, from: DayIndex): NextStep {
  const md = matchDayIndex(state)
  // the match ends the walk, whichever day it lands on
  const last: DayIndex = md ?? MATCH_DAY
  if (md != null && from >= md) return { kind: 'match' }
  for (let d = from + 1; d < last; d++) {
    if (dayHasSomething(state, d as DayIndex)) return { kind: 'day', day: d as DayIndex }
  }
  if (md != null) return { kind: 'match' }
  // no match this week: the last day is the round-up of everyone else's results,
  // which is where a blank week used to end anyway
  return { kind: 'week' }
}

/** What Continue will do from where the manager is standing right now. */
export function nextStep(state: GameState): NextStep {
  return stepFromDay(state, today(state))
}

/**
 * ---- THE DESK HAS TO BE CLEAR BEFORE THE WEEK TURNS ----
 *
 * The user asked for this twice. "when I click continue it doesnt just continue
 * through all unread message and force me to respond to press enquiries etc.
 * this should be the central home where the game communicates everything and
 * everything should be answered, read between games."
 *
 * The complaint is already recorded at season.ts ~2617, where the fix was judged
 * too large and half of it shipped instead: unanswered questions expire, old
 * stories get filed. That treated the pile GROWING and not the actual
 * complaint, which is that the game never makes you answer anything.
 *
 * WHERE THE GATE FIRES, AND WHY NOT EVERYWHERE. Continue has four jobs - walk a
 * day, jump to matchday, settle the week, open the Annual - and a gate that is
 * wrong in any of them ships a game that looks frozen. That exact bug has
 * happened here before (Round 26: the Annual's Continue was visible and dead,
 * and soakui hung on it for 60 taps).
 *
 * So the gate is deliberately NOT on every tap. It fires only where the week is
 * about to LEAVE - on the way into the match, and on the settle - which is
 * precisely what the user asked for ("read between games"). The day bulletins
 * still walk Monday to Friday untouched, so Tuesday still gets to introduce the
 * press question before anything insists on it.
 *
 * WHY THIS RETURNS A REASON. The button's label reads this too, so Continue
 * changes to "Read (3)" or "Press room" instead of silently refusing. A gate
 * you cannot see is the off-screen-reply bug in another costume, and this
 * session has already fixed that one four times.
 *
 * BOTH PILES ARE ALWAYS CLEARABLE, which is what stops it becoming a soft lock:
 * every tap of Continue on `mail` marks one story read and serves the next, so
 * n taps clear n stories, and a press question always carries options.
 */
export type DeskBlock =
  | { kind: 'mail'; n: number; label: string }
  | { kind: 'press'; n: number; label: string }

export function deskBlock(state: GameState): DeskBlock | null {
  // MAIL FIRST, because it is the cheap one: a tap each, and the manager is
  // reading rather than deciding. Making him answer the press with nine unread
  // stories behind it buries the context the questions are about.
  const unread = state.news.filter(n => !n.read && !n.cleared && inInbox(state, n)).length
  if (unread > 0) {
    return { kind: 'mail', n: unread, label: `Read (${unread})` }
  }
  // A question with no options cannot be answered, so it must not be able to
  // hold the week: that would be a locked save, not a gate.
  const open = state.press.filter(p =>
    p.week === state.week && !p.answered && (p.options?.length ?? 0) > 0).length
  if (open > 0) {
    return { kind: 'press', n: open, label: open === 1 ? 'Press room' : `Press room (${open})` }
  }
  return null
}

/** Does the desk get a say on this step? Only when the week is about to leave -
 *  see deskBlock. Day bulletins walk untouched. */
export function deskGates(step: NextStep): boolean {
  return step.kind === 'match' || step.kind === 'week'
}

/** The first thing to show after a week has been settled.
 *
 *  Monday gets first refusal, because Monday is where the weekend's results and
 *  the treatment room land. If Monday is genuinely empty the walk carries on
 *  from there rather than showing a blank page. */
export function firstStepOfWeek(state: GameState): NextStep {
  const md = matchDayIndex(state)
  if (md === 0) return { kind: 'match' }
  if (dayHasSomething(state, 0)) return { kind: 'day', day: 0 }
  return stepFromDay(state, 0)
}

/** The masthead line: 'Mon 11 Aug · Wk 3' plus the season.
 *
 *  The old line showed the week's Saturday every day of the week, which was the
 *  only date the game had. */
export function dayLine(state: GameState): string {
  return dayDate(state.season, state.week, today(state))
}

/** For anything that still wants the week's Saturday by name. */
export function weekLine(state: GameState): string {
  return weekDate(state.season, state.week)
}
