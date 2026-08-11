import { SectionTitle, paragraphs } from '../components'
import { useEffect } from 'react'
import { useStore } from '../../store'
import { weekDate, type NewsItem } from '../../game/model'
import { RECALL_DAYS, daysLeft, inInbox, markRead } from '../../game/days'

/** The inbox: one message at a time, with a recall window.
 *
 *  It was a scrolling list of sixty collapsed stories, which is a filing cabinet
 *  rather than an inbox: the thing you had just been sent was one of sixty
 *  identical grey bars and you had to hunt for it. The user asked for the shape
 *  every mail client has: "tap the mail symbol it should open the unread message,
 *  tap again and it opens the next unread ... you should be able to recall the
 *  last 20 with a back symbol or to go forward".
 *
 *  So the rail's mail icon is the queue: each tap serves the oldest thing you have
 *  not read, front to back, and the message fills the screen. When the queue is
 *  empty the arrows walk back through the last twenty, and Clear files the lot.
 *  Nothing is deleted - the Wire, the season review and the club history all read
 *  the same list - stories are only marked filed.
 *
 *  The recall window is five days (user: "when you've read them they should be
 *  viewable to look back but only for 5 days maximum"). An unread story never
 *  ages out; days.inInbox is the one predicate that decides, and the store's
 *  queue and step arrows read the same one. */

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💰', injury: '🩹', intl: '🌍', board: '🏛️',
  award: '🏅', contract: '✍️', general: '📰', youth: '🎓', gossip: '🗞️',
}

/** Everyone this story is about, as tappable chips.
 *
 *  User: "any people like players/coaches who are mentioned in news should have a
 *  clickable box so you can see their profile." A story already knows who it is
 *  about - playerId for one man, playerIds for a list - it just never offered
 *  them. Coaches are named in the prose rather than linked, so the chip row
 *  covers the players and the coach's own club screen carries him. */
export function PeopleChips({ n }: { n: NewsItem }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const ids = [...new Set([...(n.playerIds ?? []), ...(n.playerId != null ? [n.playerId] : [])])]
    .filter(id => game.players[id])
  if (!ids.length) return null
  return (
    <div className="who-row">
      {ids.slice(0, 8).map(id => {
        const p = game.players[id]
        const club = p.clubId ? game.clubs[p.clubId] : null
        return (
          <button key={id} className="who-chip" onClick={e => { e.stopPropagation(); go('player', id) }}>
            <b>{p.name}</b>
            <span>{p.pos}{club ? ` · ${club.short}` : ' · free agent'} ▸</span>
          </button>
        )
      })}
    </div>
  )
}

/** The list form, kept for the unemployed Home state: with no club there is no
 *  summary to separate the messages from, so they sit inline. */
export function InboxList({ compact }: { compact?: boolean }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const news = [...game.news].filter(n => inInbox(game, n)).sort((a, b) => b.id - a.id)
  if (news.length === 0) {
    return <div className="muted" style={{ padding: 14 }}>Nothing yet. Press Continue to get the season moving.</div>
  }
  return (
    <>
      {news.slice(0, compact ? 12 : 30).map(n => (
        <button key={n.id} className={`news-item${n.read ? '' : ' unread'}`}
          onClick={() => { markRead(game, n); touch() }}>
          <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}</div>
          <div className="subj">{n.subject}</div>
          <div className="body">{n.body}</div>
        </button>
      ))}
    </>
  )
}

export default function Inbox() {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const inboxId = useStore(s => s.inboxId)
  const { openInbox, openStory, inboxStep, clearRead } = useStore.getState()

  const live = [...game.news].filter(n => inInbox(game, n)).sort((a, b) => b.id - a.id)
  const window20 = live.slice(0, 20)
  const unread = live.filter(n => !n.read).length

  // Arriving on the screen by any route - the rail, a Back, a deep link - should
  // open something. A reader with nothing in it is a bug, not a state.
  useEffect(() => {
    if (inboxId == null || !live.some(n => n.id === inboxId)) openInbox()
  }, [inboxId, live.length])

  const i = window20.findIndex(n => n.id === inboxId)
  const n = i >= 0 ? window20[i] : window20[0]

  if (!n) {
    return (
      <div className="muted" style={{ padding: 14 }}>
        Nothing in the inbox. Read mail stays here for {RECALL_DAYS} days and then moves on,
        so an empty screen means you are up to date. Press Continue to get the season moving.
      </div>
    )
  }

  // How long this one has left, so the window is visible rather than a surprise.
  // Only ever shown on something already read: an unread story does not expire,
  // and the countdown runs from when it was READ (see days.inInbox).
  const left = daysLeft(game, n)
  const shelf = !n.read ? '' : left <= 0 ? ' · last day in the inbox'
    : left === 1 ? ' · one more day' : ` · ${left} days left`

  return (
    <>
      <div className="reader-bar">
        {/* older is BACK in time, which is further down a newest-first list */}
        <button className="btn ghost tiny" disabled={i >= window20.length - 1}
          title="Older message" aria-label="Older message"
          onClick={() => inboxStep(-1)}>◀</button>
        <span className="reader-pos">
          {i + 1} of {window20.length}
          {unread > 0 ? ` · ${unread} unread` : ' · all read'}
        </span>
        <button className="btn ghost tiny" disabled={i <= 0}
          title="Newer message" aria-label="Newer message"
          onClick={() => inboxStep(1)}>▶</button>
        {unread > 0
          ? <button className="btn gold tiny" onClick={() => openInbox()}>Next unread ({unread}) ▸</button>
          : <button className="btn ghost tiny" onClick={() => clearRead()}>Clear read</button>}
      </div>

      <article className="reader">
        <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}{shelf}</div>
        <h2>{n.subject}</h2>
        {/* Real paragraphs, no spacer divs. A blank line in the source used to
            render an empty 6px div, so the spacing between paragraphs depended on
            how the engine happened to punctuate the story: some had 6px, some had
            12, and the result read as a wall with random gaps in it (user: "news
            graphics seem so messy, tidy them up. use paragraphs"). */}
        {paragraphs(n.body).map((para, k) => <p key={k}>{para}</p>)}
        <PeopleChips n={n} />
      </article>

      {/* The table of contents. One message at a time was the ask in 10D, but
          on a heavy morning it turned the other eight messages invisible: the
          cue said nine, the reader showed one, and stepping blind through the
          rest is not reading, it is archaeology (user: "it often says 9
          messages in inbox, click on it and nothing shows up ... list below
          where there is a lot of info to share"). So the open message keeps
          the screen and the rest of the window sits under it as a tappable
          list - the same rows the unemployed Home uses, unread dot and all. */}
      {window20.length > 1 && (
        <>
          <SectionTitle sub="tap a story to read it now">Also In The Inbox</SectionTitle>
          {window20.filter(m => m.id !== n.id).map(m => (
            <button key={m.id} className={`news-item${m.read ? '' : ' unread'}`}
              onClick={() => openStory(m.id)}>
              <div className="when">{TYPE_ICON[m.type] ?? '📰'} {weekDate(m.season, m.week)}</div>
              <div className="subj">{m.subject}</div>
              <div className="body">{m.body}</div>
            </button>
          ))}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
