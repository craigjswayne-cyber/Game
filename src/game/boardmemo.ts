/**
 * ---- THE MONTHLY MEMO FROM THE BOARD ----
 *
 * Requested: "a monthly email from the board with feedback on performance based
 * off results, mood in camp, finances etc."
 *
 * The game already had board voices, but all of them were EVENTS: a sack warning,
 * a half-term report card once a season, a cap breach, a takeover, an objective
 * set in July. Between those there was silence, and silence from the people who
 * can sack you is the wrong kind of quiet. This is the standing item - it arrives
 * whether the news is good or bad, and it is the same four headings every time so
 * a manager learns to read it at a glance.
 *
 * ---- why it does not land on the same week as the awards ----
 *
 * The monthly awards bulletin fires on the six-week boundary (awards.ts,
 * AWARD_EVERY). Putting the board memo there too would deliver two "here is your
 * month" items in one inbox, which is exactly the pressure scripts/newspeak and
 * the news-pressure audits exist to keep down. So this fires three weeks off that
 * beat: one board memo and one awards bulletin per six weeks, spaced.
 *
 * ---- it reports, it does not decide ----
 *
 * Deliberately no side effects on confidence, mood or money. The board's opinion
 * is formed elsewhere (results, the table, objectives); this is the letter that
 * tells you what it currently is. A memo that also moved the numbers it describes
 * would double-count every result.
 */
import { AWARD_EVERY, monthRun } from './awards'
import { billOf, capPosition } from './cap'
import { fmtMoney, squadTrust, type GameState } from './model'
import { leaguePos } from './schedule'

/** Three weeks off the awards beat, so the two never share an inbox. */
export const MEMO_OFFSET = 3

/** Is this the week the board writes? */
export function memoDue(state: GameState): boolean {
  return state.week > MEMO_OFFSET
    && state.week % AWARD_EVERY === MEMO_OFFSET
    && !state.unemployed
}

/**
 * A deterministic pick from a list.
 *
 * NOT the match rng, and not Math.random: the same save must produce the same
 * memo, and drawing from the shared stream here would shift every match played
 * afterwards. Keyed on season and week so consecutive memos read differently.
 */
function pick<T>(list: T[], season: number, week: number, salt: number): T {
  // ROTATION, NOT A HASH, and it took two goes to get here.
  //
  // First attempt: `(season * 131 + week * 17 + salt * 7919) % len`. That repeated
  // every single time - memos are six weeks apart, 17 * 6 = 102, and 102 is
  // divisible by 3, so within one confidence band two consecutive memos always
  // landed on the same index. A modulus over a straight sum is a stride, not a
  // shuffle. Measured: weeks 9 and 15 both read "Verdict: solid".
  //
  // Second attempt was a proper avalanche hash, and it still repeated - 2 or 3
  // back-to-back out of 6 or 7 a season, which is exactly what you would expect
  // from picking randomly out of a list of three. Hashing harder cannot fix a
  // sample size.
  //
  // So the memo INDEX drives it: consecutive memos have consecutive indices, so
  // within a band the line always moves on. The salt turns the wheel to a
  // different starting point per save, so the sequence is not identical between
  // them.
  //
  // AND THE SALT MUST NOT MOVE BETWEEN CONSECUTIVE MEMOS, which is the third thing
  // this got wrong. The caller passed board confidence as the salt, and confidence
  // changes every memo, so the offset moved by an arbitrary amount at the same time
  // as memoIndex moved by one - and the two cancelled. Measured on seed 11: three
  // memos in a row, confidence 78, 71 then 67, all printed "Verdict: broadly happy"
  // word for word. 78%3=0 with index 1, 71%3=2 with index 2, 67%3=1 with index 3:
  // every one lands on 1. The rotation was real and the salt was undoing it.
  //
  // The salt is now folded in per season only, so within a season consecutive memos
  // always step to the next line, and two saves do not open on the same one.
  //
  // FOURTH LESSON, same shape as the third: the caller passed confidence and
  // this folded in floor(conf / 100) - which is 0 for any confidence up to 99
  // and 1 at exactly 100. A delighted board crossing 100 between memos moved
  // the offset by one at the same moment memoIndex moved by one, and the two
  // cancelled: seed 19 printed "the boardroom is delighted" twice running.
  // The salt has to be something that CANNOT move during a save. It is the
  // save's seed now, and nothing else may ever be passed here.
  const memoIndex = Math.floor(week / AWARD_EVERY)
  const offset = (season * 5 + Math.floor(salt / 100)) % list.length
  return list[(memoIndex + offset) % list.length]
}

/**
 * Where the club sits, or null before a ball is kicked in the league.
 *
 * THIS USED TO READ THE ARRAY ORDER, not the standings. It was a local copy of a
 * function schedule.ts already had, and the copy did `table.findIndex(...) + 1` on
 * an unsorted table - so it reported the club's slot in storage as its league
 * position. Measured: a save top of the Premier Division on 19 points from 4 wins was
 * told "8th in the Premier Division", which is how the user found it ("mixed messages in
 * this board review"). Four wins from four next to 8th is not a wording problem.
 *
 * schedule.leaguePos sorts, and returns 0 rather than null before any game is
 * played, so the caller only has to check for a falsy value.
 */
function tablePos(state: GameState, clubId: string): number | null {
  const club = state.clubs[clubId]
  const comp = club ? state.comps[club.leagueId] : null
  if (!comp || comp.type !== 'league') return null
  return leaguePos(comp.table, clubId) || null
}

const ord = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

/**
 * Write the month's memo into the inbox. Call once a week; it decides for itself
 * whether this is the week.
 */
export function boardMemo(state: GameState): void {
  if (!memoDue(state)) return
  const club = state.clubs[state.userClubId]
  if (!club) return

  const from = Math.max(1, state.week - (AWARD_EVERY - 1))
  const run = monthRun(state, club.id, from, state.week)
  const conf = Math.round(club.boardConfidence)
  // ROUNDED. squadTrust returns the raw stored figure and this printed it straight
  // into the prose, so a real memo read "the dressing room is not yet convinced
  // (33.328/100)". It is not rounded at source on purpose: trustFactor multiplies
  // dressing-room effects by it and rounding there would move the engine.
  const trust = Math.round(squadTrust(state))
  const mood = Math.round(state.fanMood ?? 60)
  // stated once, at the top, so no line has to imply its own timeframe
  const weeks = state.week - from + 1
  const pos = tablePos(state, club.id)
  const cap = capPosition(state, club.id)
  const bill = billOf(state, club)

  // ---- results ----
  //
  // ONE SUBJECT PER LINE, AND EVERY NUMBER SAYS WHAT IT IS (user: "mixed messages
  // in this board review. needs to be clearer to read"). It used to read
  //
  //   Results: 4W 0D 0L from 4, 116 points to the good. Best of them 66-14 away at
  //   Bristol. 8th in the Premier Division.
  //
  // which is three different measures in one breath and two of them fight. The
  // record is the last six weeks and the table place is the whole season, so 4 wins
  // from 4 sat next to 8th and read as a contradiction; and "116 points" is scoring
  // difference, in a sport whose league table also has a points column. The window
  // is named at the top, the table gets its own line, and the difference says
  // scored-and-conceded in words.
  const results = run.matches === 0
    ? 'Form: no competitive rugby in this window - an international break, and nothing to judge you on.'
    : `Form: ${run.wins}W ${run.draws}D ${run.losses}L from ${run.matches}` +
      `${run.diff > 0 ? `, scoring ${run.diff} more than we conceded` : run.diff < 0 ? `, conceding ${-run.diff} more than we scored` : ''}.` +
      (run.bestWin
        ? ` Best of them ${run.bestWin.us}-${run.bestWin.them} ${run.bestWin.away ? 'away at' : 'against'} ${state.clubs[run.bestWin.oppId]?.short ?? 'them'}.`
        : '')
  // the season, on its own line, because it is not the same window as the form above
  const tableLine = pos
    ? `League: ${ord(pos)} in the ${state.comps[club.leagueId]?.short ?? 'league'} on the season so far.`
    : null

  // ---- the three constituencies, one line each ----
  //
  // These were one "Mood in camp" sentence joining the squad and the crowd with an
  // "and", which reads as a single verdict when they are two audiences who often
  // disagree. Fragments now, each with its own label and its own number.
  const roomWord = trust >= 75 ? 'fully behind you'
    : trust >= 55 ? 'with you'
    : trust >= 35 ? 'still making its mind up'
    : 'not yet convinced'
  const terraceWord = mood >= 78 ? 'loving it'
    : mood >= 60 ? 'content'
    : mood >= 42 ? 'patient but quiet'
    : 'audibly unhappy'
  const roomLine = `Dressing room: ${roomWord} (${trust}/100).`
  const terraceLine = `Terraces: ${terraceWord} (${mood}/100).`

  // ---- finances ----
  const capLine = cap.cap
    ? ` Wage bill ${fmtMoney(bill)}/wk against a ${fmtMoney(cap.cap)} cap${cap.over ? ' - WE ARE OVER IT' : `, ${fmtMoney(cap.headroom)} of room`}.`
    : ` Wage bill ${fmtMoney(bill)}/wk.`
  // lower case, because it follows a label like the other four lines. It read
  // "Finances: The books are healthy at ..." - a capital mid-line, and the only
  // line in the memo that started a fresh sentence after its own heading.
  const moneyWord = club.balance < 0 ? 'the account is overdrawn'
    : club.balance < bill * 4 ? 'cash is tight'
    : 'the books are healthy'
  const moneyLine = `Finances: ${moneyWord} at ${fmtMoney(club.balance)}, transfer budget ${fmtMoney(club.budget)}.${capLine}`

  // ---- the verdict, which is the part he will actually read ----
  const verdicts = conf >= 80 ? [
    // "the room upstairs" was the board, three lines under "Dressing room:", where
    // the reader has just been told which room is which. This one says boardroom.
    'Verdict: the boardroom is delighted. Keep going and this becomes your club.',
    'Verdict: nobody here wants to talk about anything except how well this is going.',
    'Verdict: you have the board\'s full backing, and you have earned it.',
  ] : conf >= 62 ? [
    'Verdict: the board is satisfied. Nothing here that a good month would not improve.',
    'Verdict: broadly happy. We would like to see this kicked on rather than held.',
    'Verdict: solid. The directors are comfortable and would like to stay that way.',
  ] : conf >= 45 ? [
    'Verdict: patience is intact but it is not infinite. We expect the graph to turn.',
    'Verdict: the mood upstairs is wait and see. Give us something to point at.',
    'Verdict: neither pleased nor panicking. The next month matters more than this one.',
  ] : conf >= 28 ? [
    'Verdict: concern, stated plainly. This has to improve and soon.',
    'Verdict: the board is worried, and some of it is being said out loud.',
    'Verdict: we are not where anybody expected to be. We need a response.',
  ] : [
    'Verdict: this is a formal warning. The board is discussing your position.',
    'Verdict: the directors have lost patience. Results now, or a decision gets made for you.',
    'Verdict: your position is under review. There is no gentler way to put it.',
  ]
  const verdict = pick(verdicts, state.season, state.week, Math.abs(state.seed))

  const kind = conf >= 62 ? '👔' : conf >= 45 ? '👔' : '⚠️'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    // the position the prose quotes, stamped so a reader arriving after the
    // table has moved on can still check the memo against what it actually saw
    ...(pos ? { quotedPos: pos } : {}),
    subject: `${kind} Board review: ${club.short} - boardroom confidence ${conf}%`,
    body: [
      // "monthly review" and a six-week window were the same mismatch in miniature:
      // the memo fires every AWARD_EVERY weeks and six weeks is not a month. It
      // names its own window now, once, and no line below has to imply a timeframe.
      `The last ${weeks} weeks, as the board sees them.`,
      '',
      results,
      ...(tableLine ? [tableLine] : []),
      roomLine,
      terraceLine,
      moneyLine,
      '',
      verdict,
    ].join('\n'),
  })
}
