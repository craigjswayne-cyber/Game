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
  // different starting point per season and per band, so the sequence is not
  // identical between saves.
  const memoIndex = Math.floor(week / AWARD_EVERY)
  const offset = (season * 5 + salt) % list.length
  return list[(memoIndex + offset) % list.length]
}

/** Where the club sits, or null before a ball is kicked in the league. */
function leaguePos(state: GameState, clubId: string): number | null {
  const club = state.clubs[clubId]
  const comp = club ? state.comps[club.leagueId] : null
  if (!comp || comp.type !== 'league') return null
  const played = comp.table.reduce((s, r) => s + r.p, 0)
  if (!played) return null
  const i = comp.table.findIndex(r => r.teamId === clubId)
  return i < 0 ? null : i + 1
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
  const trust = squadTrust(state)
  const mood = Math.round(state.fanMood ?? 60)
  const pos = leaguePos(state, club.id)
  const cap = capPosition(state, club.id)
  const bill = billOf(state, club)

  // ---- results ----
  const resultsLine = run.matches === 0
    ? 'Results: no competitive rugby in this window - an international break, and nothing to judge you on.'
    : `Results: ${run.wins}W ${run.draws}D ${run.losses}L from ${run.matches}` +
      `${run.diff > 0 ? `, ${run.diff} points to the good` : run.diff < 0 ? `, ${-run.diff} down on aggregate` : ''}.` +
      (run.bestWin
        ? ` Best of them ${run.bestWin.us}-${run.bestWin.them} ${run.bestWin.away ? 'away at' : 'against'} ${state.clubs[run.bestWin.oppId]?.short ?? 'them'}.`
        : '') +
      (pos ? ` ${ord(pos)} in the ${state.comps[club.leagueId]?.short ?? 'league'}.` : '')

  // ---- mood in camp ----
  const roomWord = trust >= 75 ? 'The squad is fully behind you'
    : trust >= 55 ? 'The dressing room is with you'
    : trust >= 35 ? 'The room is still making its mind up about you'
    : 'The dressing room is not yet convinced'
  const terraceWord = mood >= 78 ? 'the terraces are loving it'
    : mood >= 60 ? 'the supporters are content'
    : mood >= 42 ? 'the crowd is patient but quiet'
    : 'the supporters are audibly unhappy'
  const moodLine = `Mood in camp: ${roomWord} (${trust}/100), and ${terraceWord} (${mood}/100).`

  // ---- finances ----
  const capLine = cap.cap
    ? ` Wage bill ${fmtMoney(bill)}/wk against a ${fmtMoney(cap.cap)} cap${cap.over ? ' - WE ARE OVER IT' : `, ${fmtMoney(cap.headroom)} of room`}.`
    : ` Wage bill ${fmtMoney(bill)}/wk.`
  const moneyWord = club.balance < 0 ? 'The account is overdrawn'
    : club.balance < bill * 4 ? 'Cash is tight'
    : 'The books are healthy'
  const moneyLine = `Finances: ${moneyWord} at ${fmtMoney(club.balance)}, transfer budget ${fmtMoney(club.budget)}.${capLine}`

  // ---- the verdict, which is the part he will actually read ----
  const verdicts = conf >= 80 ? [
    'Verdict: the room upstairs is delighted. Keep going and this becomes your club.',
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
  const verdict = pick(verdicts, state.season, state.week, conf)

  const kind = conf >= 62 ? '👔' : conf >= 45 ? '👔' : '⚠️'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `${kind} Board review: ${club.short} - boardroom confidence ${conf}%`,
    body: [
      `${club.name} board, monthly review for the manager.`,
      '',
      resultsLine,
      moodLine,
      moneyLine,
      '',
      verdict,
    ].join('\n'),
  })
}
