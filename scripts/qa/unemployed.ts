// Sacked -> unemployed through a rollover -> apply -> accept, driven through the store.
import { newGame } from '../../src/game/newgame'
import { useStore } from '../../src/store'
import { sackManager } from '../../src/game/jobs'
import { respondToOffer } from '../../src/game/ai'
import { SEASON_WEEKS } from '../../src/game/model'
let fails = 0
const ok = (c: boolean, w: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${w}`); if (!c) fails++ }
const st = useStore
const top = () => st.getState().nav[st.getState().nav.length - 1]?.screen
const G = () => st.getState().game!
function tap() {
  const g = G(); const scr = top()
  if (scr === 'press') { for (const pi of g.press.filter(p => !p.answered)) st.getState().answerPressOption(pi.id, 0); st.getState().back(); return }
  if (scr === 'offers') { for (const o of g.offers.filter(o => o.status === 'pending' && o.forUser)) respondToOffer(g, o.id, false); st.getState().back(); return }
  if (scr === 'annual') { g.annual = undefined; st.getState().back(); return }
  if (scr === 'country') { st.getState().back(); return }
  if (scr === 'matchday') { st.getState().instantResult('calm'); return }
  st.setState({ lastAdvanceAt: 0 }); st.getState().continueWeek()
}
const g0 = newGame('bristol', 'Out Of Work', 99)
st.setState({ game: g0, nav: [{ screen: 'home' }], lastAdvanceAt: 0, liveMatch: null, saveSlot: 'probe' })
for (let i = 0; i < 40; i++) tap()
console.log('at', G().season, G().week, 'day', G().day, top())
sackManager(G(), 'news.sacked')
G().sacked = null as any // the breaking card answered
ok(G().unemployed === true, 'sacked -> unemployed')
const sackedAt = G().season * SEASON_WEEKS + G().week
// walk unemployed across the rollover
let guard = 0, weeksWalked = 0, offersSeen = 0, vacanciesMax = 0, sawDup = false
let last = ''
while (G().season < 2 && guard++ < 4000) {
  const before = `${G().season}-${G().week}-${G().day}-${top()}`
  tap()
  vacanciesMax = Math.max(vacanciesMax, G().vacancies.length)
  const ids = G().vacancies.map(v => v.clubId)
  if (new Set(ids).size !== ids.length) sawDup = true
  const after = `${G().season}-${G().week}-${G().day}-${top()}`
  if (G().week !== Number(before.split('-')[1])) weeksWalked++
  if (before === after) { if (last === before) { console.log('STUCK at', before, 'press', G().press.filter(p => !p.answered).length, 'offers', G().offers.length); break } last = before } else last = ''
}
ok(G().season === 2, `walked to season 2 while unemployed (weeks walked ${weeksWalked}, taps ${guard})`)
ok(G().unemployed, 'still unemployed')
ok(!G().annual, 'no annual gate for an unemployed manager (or it cleared)')
console.log('vacancies now', G().vacancies.map(v => `${v.clubId}@w${v.week}`).join(' '), 'max seen', vacanciesMax, 'duplicate club in list', sawDup)
const stale = G().vacancies.filter(v => v.week > G().week + 5)
ok(stale.length === 0, `no vacancy carried over from last season by a week stamp higher than now (${stale.map(v => `${v.clubId}@w${v.week}`).join(',')})`)
// apply to every vacancy until one offers
let got = false
for (let i = 0; i < 60 && !got; i++) {
  for (const v of G().vacancies) { const m = st.getState().applyJob(v.clubId); if (G().jobOffer) { console.log('offer from', G().jobOffer.clubId, '-', m); got = true; break } }
  if (!got) tap()
}
ok(got, 'an application eventually produced an offer')
if (got) {
  const msg = st.getState().answerJobOffer(true)
  console.log('  ', msg)
  ok(!G().unemployed && G().userClubId === G().clubs[G().userClubId]?.id, 'accepted: employed at ' + G().userClubId)
  const c = G().clubs[G().userClubId]
  ok(c.tactic.lineup.filter(x => x != null).length >= 15, 'new club has a lineup')
  // play on a season
  const target = G().season + 1; guard = 0
  while (G().season < target && guard++ < 3000) tap()
  ok(G().season === target, 'played a full season at the new club')
}
console.log(fails ? `UNEMPLOYED PROBE FAILED (${fails})` : 'UNEMPLOYED PROBE PASSED')
