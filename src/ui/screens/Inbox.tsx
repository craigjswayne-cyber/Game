import { useEffect } from 'react'
import { useStore } from '../../store'
import { weekDate, type NewsItem } from '../../game/model'

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
 *  the same list - stories are only marked filed. */

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
  const news = [...game.news].filter(n => n.type !== 'gossip' && !n.cleared).sort((a, b) => b.id - a.id)
  if (news.length === 0) {
    return <div className="muted" style={{ padding: 14 }}>Nothing yet. Press Continue to get the season moving.</div>
  }
  return (
    <>
      {news.slice(0, compact ? 12 : 30).map(n => (
        <button key={n.id} className={`news-item${n.read ? '' : ' unread'}`}
          onClick={() => { n.read = true; touch() }}>
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
  const { openInbox, inboxStep, clearRead } = useStore.getState()

  const live = [...game.news].filter(n => n.type !== 'gossip' && !n.cleared).sort((a, b) => b.id - a.id)
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
        Nothing in the inbox. Press Continue to get the season moving.
      </div>
    )
  }

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
        <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}</div>
        <h2>{n.subject}</h2>
        {n.body.split('\n').map((line, k) => (
          line.trim() === ''
            ? <div key={k} style={{ height: 6 }} />
            : <p key={k}>{line}</p>
        ))}
        <PeopleChips n={n} />
      </article>
      <div className="spacer" />
    </>
  )
}
