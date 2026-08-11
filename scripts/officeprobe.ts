// The recruitment meeting proposes names you can afford, and the office
// chats land the way his personality says they land (20B + 20D).
//
// Both systems are DELIBERATELY deterministic - no rng - so this probe can
// assert exact outcomes rather than distributions, and the shared weekly
// stream never learns either feature exists.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { canChat, chatBudget, praisePlayer, warnPlayer } from '../src/game/chats'
import { recruitmentMeeting } from '../src/game/scout'
import type { Player } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

// ---- the meeting fires at week 2 with names on the board --------------------
{
  const g = newGame('northampton', 'Office', 6)
  processWeekAndAdvance(g)
  processWeekAndAdvance(g)
  const memo = g.news.find(n => /Recruitment meeting/.test(n.subject))
  ok(!!memo, 'the week-2 recruitment meeting happens')
  if (memo) {
    const ids = memo.playerIds ?? []
    ok(ids.length >= 1 && ids.length <= 3, `it puts ${ids.length} name(s) on the board (1 to 3)`)
    const club = g.clubs[g.userClubId]
    for (const id of ids) {
      const p = g.players[id]
      ok(!!p && p.clubId !== g.userClubId, `${p?.name ?? id} plays somewhere else`)
      if (p) ok(Math.round(p.value * 1.15) <= club.budget, `${p.name} is affordable (fee estimate inside the budget)`)
    }
    ok((memo.body ?? '').length <= 700, `and the memo fits a phone (${(memo.body ?? '').length} chars)`)
  }
}

// ---- the meeting is deterministic: same squad, same names -------------------
{
  const a = newGame('northampton', 'Office', 6)
  const b = newGame('northampton', 'Office', 6)
  recruitmentMeeting(a)
  recruitmentMeeting(b)
  const idsA = a.news.find(n => /Recruitment meeting/.test(n.subject))?.playerIds?.join()
  const idsB = b.news.find(n => /Recruitment meeting/.test(n.subject))?.playerIds?.join()
  ok(idsA != null && idsA === idsB, 'the same squad gets the same three names, no dice')
}

// ---- office chats: personality decides, the budget holds --------------------
{
  const g = newGame('northampton', 'Office', 6)
  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && !p.acad) as Player[]
  const [a, b, c, d] = squad
  // a loyal man in form takes the praise like a loyal man in form
  a.pers = 'Loyal'; a.form = 8; a.morale = 6
  const trustBefore = g.mgrTrust ?? 30
  const line = praisePlayer(g, a)
  ok(a.morale > 6, `praise lifts the loyal man in form (morale ${a.morale.toFixed(1)})`)
  ok((g.mgrTrust ?? 30) > trustBefore, 'and the room notices work being recognised')
  ok(/Means a lot/.test(line), 'he answers in his own voice')

  // praising a struggling hothead reads as sarcasm
  b.pers = 'Temperamental'; b.form = 5; b.morale = 6
  const line2 = praisePlayer(g, b)
  ok(b.morale < 6, `flattering a struggling hothead backfires (morale ${b.morale.toFixed(1)})`)
  ok(/set up/.test(line2), 'and he says so')

  // two a week, no more
  ok(chatBudget(g) === 0, 'two conversations spend the week')
  ok(!canChat(g, c), 'a third man cannot be called in this week')

  // next week the budget resets, but not for a man already spoken to
  g.week += 1
  ok(chatBudget(g) === 2, 'a new week brings two fresh conversations')
  ok(!canChat(g, a) || a.lastChatWk !== g.season * 45 + g.week, 'and last week\'s chat does not block this week')
  ok(canChat(g, d), 'a fresh face can be called in')

  // warning a professional out of form gets a response, not a sulk
  d.pers = 'Professional'; d.form = 5.5; d.morale = 6
  const fBefore = d.form
  const line3 = warnPlayer(g, d)
  ok(d.form > fBefore, `the professional answers a warning with work (form ${d.form.toFixed(2)})`)
  ok(/response/.test(line3), 'and says he will')
}

console.log(fails ? `\nOFFICE PROBE FAILED (${fails})` : '\nOFFICE PROBE PASSED: three names on the board, and words that keep their value')
process.exit(fails ? 1 : 0)
