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
//   Clearing files, it does not delete. The season review and the club history
//   read the same news list, so a cleared story has to still be there.
//
//   AND GOSSIP IS IN THE QUEUE. It used to be excluded, and this probe guarded
//   that: two of its assertions said a rumour must never be served here, because
//   rumours lived on a separate Rugby Wire screen. The two screens were one array
//   split on a field the player cannot see and they are now one screen (user:
//   "merge the rugby wire and news, its the same thing"), so the assertions are
//   inverted rather than deleted - a rumour is served, and cleared, like post.
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
// plus a rumour, which is part of the same queue now and is served last because
// it is the newest thing in the list
g.news.push({ id: 2000, week: 1, season: 0, type: 'gossip', subject: 'Rumour', body: '...', read: false })

const st = useStore
st.setState({ game: g, nav: [{ screen: 'home' }], inboxId: null })

// ---- the icon serves the oldest unread, in order ---------------------------
{
  const seen: string[] = []
  for (let i = 0; i < 6; i++) {
    st.getState().openInbox()
    const id = st.getState().inboxId
    seen.push(g.news.find(n => n.id === id)?.subject ?? '?')
  }
  console.log(`  six taps served: ${seen.join(', ')}`)
  ok(seen.join(',') === 'One,Two,Three,Four,Five,Rumour',
    'each tap serves the next unread, oldest first, and the rumour is one of them')
  ok(g.news.every(n => n.read), 'and every one it served is marked read')
  ok(g.news.find(n => n.id === 2000)!.read, 'a rumour is served here: the wire and the news are one list')
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
  // THE ENDS ARE DERIVED, not typed. This block used to start at 1004 with the
  // comment "'Five', the newest" and assert forward could not pass it - true only
  // while gossip was excluded. Once the rumour joined the queue, 2000 became the
  // newest and the probe failed on its own stale fixture rather than on a bug.
  const ids = [...g.news].filter(n => inInbox(g, n)).map(n => n.id).sort((a, b) => a - b)
  const oldest = ids[0], newest = ids[ids.length - 1]
  const secondNewest = ids[ids.length - 2]
  console.log(`  window runs ${oldest}..${newest} (${ids.length} stories)`)
  // newest first, so back (-1) goes older
  st.setState({ inboxId: newest })
  st.getState().inboxStep(-1)
  ok(st.getState().inboxId === secondNewest, 'back goes one story older')
  st.getState().inboxStep(1)
  ok(st.getState().inboxId === newest, 'forward comes back again')
  for (let i = 0; i < 10; i++) st.getState().inboxStep(1)
  ok(st.getState().inboxId === newest, 'forward stops at the newest rather than running off the end')
  for (let i = 0; i < 10; i++) st.getState().inboxStep(-1)
  ok(st.getState().inboxId === oldest, 'back stops at the oldest in the window')
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
  ok(gg.news.length === before, 'nothing is deleted: the review and the history read the same list')
  ok(gg.news.find(n => n.id === 1)!.cleared === true, 'a read story is filed')
  ok(!gg.news.find(n => n.id === 2)!.cleared, 'an unread story survives the clear')
  ok(gg.news.find(n => n.id === 3)!.cleared === true,
    'and a read rumour is filed with it, rather than being left behind on screen')
  const shown = gg.news.filter(n => !n.cleared)
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

// ---- the table of contents opens the story you tapped ----------------------
//
// User: "it often says 9 messages in inbox, click on it and nothing shows up ...
// this is confusing - list below where there is a lot of info to share." Two
// halves. The reader grew a list, and tapping a line has to open THAT story and
// file it - openStory is the store action behind the rows. And the Home cue has
// to SERVE the queue rather than just navigate: go('inbox') left the reader on
// whatever inboxId last pointed at, which on a nine-unread morning was a story
// already read. That is the cue tap opening onto none of the nine.
{
  const gg = newGame('northampton', 'Inbox', 8)
  gg.news = [
    { id: 50, week: 1, season: 0, type: 'general', subject: 'Old and read', body: '.', read: true },
    { id: 51, week: 1, season: 0, type: 'general', subject: 'First unread', body: '.', read: false },
    { id: 52, week: 1, season: 0, type: 'general', subject: 'Second unread', body: '.', read: false },
    { id: 53, week: 1, season: 0, type: 'general', subject: 'Third unread', body: '.', read: false },
  ]
  // the reader is parked on the read story, exactly the state the cue bug needs
  st.setState({ game: gg, nav: [{ screen: 'home' }], inboxId: 50 })

  // the cue's tap is openInbox: it must serve an unread, not re-show id 50
  st.getState().openInbox()
  const served = st.getState().inboxId
  ok(served === 51, `the cue serves the oldest unread (opened ${served}, wanted 51)`)
  ok(gg.news.find(n => n.id === 51)!.read, 'and marks it read on the way past')

  // tapping a line in the list opens that exact story
  st.getState().openStory(53)
  ok(st.getState().inboxId === 53, 'a tapped line opens that story, not the queue head')
  ok(gg.news.find(n => n.id === 53)!.read, 'and it is filed as read')
  ok(!gg.news.find(n => n.id === 52)!.read, 'without touching anything it skipped over')
  const nav = st.getState().nav
  ok(nav.filter(e => e.screen === 'inbox').length <= 1, 'and the screen never stacks on itself')

  // a dead id is a no-op, not a blank reader
  const before = st.getState().inboxId
  st.getState().openStory(9999)
  ok(st.getState().inboxId === before, 'an unknown id changes nothing')
}

// ---- serving an OLD unread story must not vaporise it ----------------------
//
// The wood chipper. The shelf used to age a read story from the day it was
// WRITTEN, so an unread story more than five days old expired the instant the
// queue marked it read: served straight into the void, never rendered, and the
// reader's catch-up effect asked for the next one, which followed it. A tap on
// "9 unread messages" devoured all nine and showed an empty screen (user: "it
// often says 9 messages in inbox, click on it and nothing shows up"). Read
// mail now gets its five days from the moment it is opened - readAt.
{
  const gg = newGame('northampton', 'Inbox', 9)
  gg.season = 0
  gg.week = 20
  gg.day = 5
  // nine unread stories from six weeks ago: the backlog of a manager who
  // pressed Continue through a busy month
  gg.news = Array.from({ length: 9 }, (_, i) => ({
    id: 700 + i, week: 14, season: 0, type: 'general' as const,
    subject: `Backlog ${i}`, body: '.', read: false,
  }))
  st.setState({ game: gg, nav: [{ screen: 'home' }], inboxId: null })

  st.getState().openInbox()
  const servedId = st.getState().inboxId!
  const served = gg.news.find(n => n.id === servedId)!
  ok(served.read, 'the oldest backlog story is served and marked read')
  ok(inInbox(gg, served), 'and it is STILL IN THE READER after being served, old as it is')
  ok(served.readAt != null, 'because reading stamped when (readAt)')
  const live = gg.news.filter(n => inInbox(gg, n))
  ok(live.length === 9, `nothing was devoured: all 9 are still on screen (${live.length})`)
}

console.log(fails ? `INBOX PROBE FAILED (${fails})` : 'INBOX PROBE PASSED')
process.exit(fails ? 1 : 0)
