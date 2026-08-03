// Loan-in arc: borrow a wonderkid, play a season, he goes home grown.
import { newGame } from '../src/game/newgame'
import { loanIn, loanTargets } from '../src/game/loans'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'

const g = newGame('newcastle', 'Loans', 1357)
const targets = loanTargets(g)
console.log(`loan targets available: ${targets.length} (e.g. ${targets.slice(0, 3).map(t => `${t.name}<-${g.clubs[t.clubId!]?.short}`).join(', ')})`)
if (!targets.length) { console.error('BUG: no loan targets for a small club'); process.exit(1) }
const kid = targets[0]
const parentId = kid.clubId!
console.log(loanIn(g, kid.id))
if (kid.clubId !== 'newcastle' || kid.loanFrom !== parentId) console.error('BUG: loan state wrong')

let guard = 0
while (g.season < 1 && guard++ < SEASON_WEEKS + 5) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  processWeekAndAdvance(g)
}
const after = g.players[kid.id]
console.log(`after rollover: club=${after.clubId} loanFrom=${after.loanFrom} apps last season logged=${after.career.length > 0}`)
if (after.clubId !== parentId || after.loanFrom) console.error('BUG: loanee did not return home')
if (g.clubs['newcastle'].players.includes(kid.id)) console.error('BUG: still in borrower squad')
const objNews = g.news.filter(n => n.subject.includes('Board') || n.subject.includes('verdict'))
console.log('objectives verdict present:', g.news.some(n => n.body.includes('Blood the academy')))
console.log('LOAN TEST DONE')
