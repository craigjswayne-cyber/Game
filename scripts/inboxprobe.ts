// The inbox is a queue, not a filing cabinet (feedback 10D).
//
// Four properties, all of them things a mail client gets right and the old list
// did not:
//
//   The mail icon SERVES. Each tap hands over the oldest thing you have not read,
//   front to back, and marks it read on the way past.
//
//   It never lands on nothing. Whatever route you arrive by, and however empty
//   the queue is, there is a message on screen. A blank reader is a bug.
//
//   The recall window walks BOTH ways over the last twenty, and stops at each end
//   rather than falling off it.
//
//   Clearing files, it does not delete. The Wire, the season review and the club
//   history all read the same news list, so a cleared story has to still be there.
//
// The store is tested directly rather than through a browser: this is queue
// arithmetic, and a Playwright walk can only reach whatever happens to be unread
// on the day.
import { newGame } from '../src/game/newgame'
import { useStore } from '../src/store'
import { RECALL_DAYS, inInbox } from '../src/game/days'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const g = newGame('northampton', 'Inbox', 4)
// a known queue: five unread stories, oldest first by id
const subjects = ['One', 'Two', 'Three', 'Four', 'Five']
g.news = subjects.map((s, i) => ({
  id: 1000 + i, week: 1, season: 0, type: 'general' as const,
  subject: s, body: `Body ${s}`, read: false,
}))
// plus a rumour, which belongs to the Wire and must never enter the queue
g.news.push({ id: 2000, week: 1, season: 0, type: 'gossip', subject: 'Rumour', body: '...', read: false })

const st = useStore
st.setState({ game: g, nav: [{ screen: 'home' }], inboxId: null })

// ---- the icon serves the oldest unread, in order ---------------------------
{
  const seen: string[] = []
  for (let i = 0; i < 5; i++) {
    st.getState().openInbox()
    const id = st.getState().inboxId
    seen.push(g.news.find(n => n.id === id)?.subject ?? '?')
  }
  console.log(`  five taps served: ${seen.join(', ')}`)
  ok(seen.join(',') === 'One,Two,Three,Four,Five', 'each tap serves the next unread, oldest first')
  ok(g.news.filter(n => n.type !== 'gossip').every(n => n.read), 'and every one it served is marked read')
  ok(!g.news.find(n => n.id === 2000)!.read, 'a rumour is left for the Wire, not served here')
}

// ---- the first tap also opens the screen ----------------------------------
{
  st.setState({ nav: [{ screen: 'home' }], inboxId: null })
  st.getState().openInbox()
  const nav = st.getState().nav
  ok(nav[nav.length - 1].screen === 'inbox', 'the icon navigates to the inbox as well as serving')
  const before = st.getState().nav.length
  st.getState().openInbox()
  ok(st.getState().nav.length === before, 'and tapping again advances the queue rather than stacking screens')
}

// ---- with the queue empty it still shows something ------------------------
{
  st.setState({ inboxId: null })
  st.getState().openInbox()
  ok(st.getState().inboxId != null, 'an all-read inbox still opens on a story')
}

// ---- the recall window walks both ways and stops at the ends --------------
{
  // newest first, so back (-1) goes older
  st.setState({ inboxId: 1004 }) // 'Five', the newest
  st.getState().inboxStep(-1)
  ok(st.getState().inboxId === 1003, 'back goes one story older')
  st.getState().inboxStep(1)
  ok(st.getState().inboxId === 1004, 'forward comes back again')
  for (let i = 0; i < 10; i++) st.getState().inboxStep(1)
  ok(st.getState().inboxId === 1004, 'forward stops at the newest rather than running off the end')
  for (let i = 0; i < 10; i++) st.getState().inboxStep(-1)
  ok(st.getState().inboxId === 1000, 'back stops at the oldest in the window')
}

// ---- the window is twenty deep -------------------------------------------
{
  const many = newGame('northampton', 'Inbox', 5)
  many.news = Array.from({ length: 40 }, (_, i) => ({
    id: 3000 + i, week: 1, season: 0, type: 'general' as const,
    subject: `Story ${i}`, body: '...', read: true,
  }))
  st.setState({ game: many, inboxId: 3039 })
  let steps = 0
  for (let i = 0; i < 40; i++) {
    const before = st.getState().inboxId
    st.getState().inboxStep(-1)
    if (st.getState().inboxId === before) break
    steps++
  }
  console.log(`  recall reached back ${steps + 1} stories of 40`)
  ok(steps + 1 === 20, 'the recall window is exactly the last twenty')
}

// ---- clearing files rather than deletes ----------------------------------
{
  const gg = newGame('northampton', 'Inbox', 6)
  gg.news = [
    { id: 1, week: 1, season: 0, type: 'general', subject: 'Read one', body: '.', read: true },
    { id: 2, week: 1, season: 0, type: 'general', subject: 'Unread', body: '.', read: false },
    { id: 3, week: 1, season: 0, type: 'gossip', subject: 'Rumour', body: '.', read: true },
  ]
  st.setState({ game: gg, inboxId: 1 })
  const before = gg.news.length
  st.getState().clearRead()
  ok(gg.news.length === before, 'nothing is deleted: the Wire and the history read the same list')
  ok(gg.news.find(n => n.id === 1)!.cleared === true, 'a read story is filed')
  ok(!gg.news.find(n => n.id === 2)!.cleared, 'an unread story survives the clear')
  ok(!gg.news.find(n => n.id === 3)!.cleared, 'gossip is untouched - it was never in this queue')
  const shown = gg.news.filter(n => n.type !== 'gossip' && !n.cleared)
  ok(shown.length === 1 && shown[0].id === 2, 'and the reader is left holding only what is left to read')
}

// ---- the five-day recall window (13C) ------------------------------------
//
// User: "when you've read them they should be viewable to look back but only for
// 5 days maximum." Two things have to be true at once, and the second is the one
// worth guarding: read mail ages out, and UNREAD mail never does. Ageing out
// something the manager has not seen is losing his post, not tidying it.
{
  const gg = newGame('northampton', 'Inbox', 7)
  gg.season = 0
  gg.week = 20
  gg.day = 5
  const at = (week: number, read: boolean, id: number) => ({
    id, week, season: 0, type: 'general' as const,
    subject: `Week ${week} ${read ? 'read' : 'unread'}`, body: '.', read,
  })
  gg.news = [
    at(20, true, 10),   // today
    at(19, true, 11),   // seven days back: outside the window
    at(19, false, 12),  // same age, never opened: must stay
    at(12, false, 13),  // eight weeks old and never opened: must still stay
  ]
  st.setState({ game: gg, inboxId: null })
  const live = gg.news.filter(n => inInbox(gg, n))
  const has = (id: number) => live.some(n => n.id === id)
  ok(has(10), "a story read today is still in the reader")
  ok(!has(11), `a read story seven days old has moved on (window is ${RECALL_DAYS} days)`)
  ok(has(12), 'an unread story of the same age is untouched')
  ok(has(13), 'and an unread story from two months ago is still waiting')
  ok(gg.news.length === 4, 'nothing was deleted to achieve any of that')

  // and the store's queue agrees with the screen, which is the bug that would
  // actually be reported: the reader showing one count and the arrows another
  st.getState().openInbox()
  const walked = new Set<number>()
  for (let i = 0; i < 8; i++) { walked.add(st.getState().inboxId!); st.getState().inboxStep(-1) }
  ok(!walked.has(11), 'the step arrows cannot reach an expired story either')
}

console.log(fails ? `INBOX PROBE FAILED (${fails})` : 'INBOX PROBE PASSED')
process.exit(fails ? 1 : 0)
