import { paragraphs } from '../components'
import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { weekDate, type NewsItem } from '../../game/model'
import { RECALL_DAYS, daysLeft, inInbox, markRead } from '../../game/days'
import { t } from '../../game/i18n'

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
            <span>{p.pos}{club ? ` · ${club.short}` : t('inbox.freeAgent')} ▸</span>
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
    return <div className="muted" style={{ padding: 14 }}>{t('inbox.nothingYet')}</div>
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
  const { openInbox, inboxStep, clearRead } = useStore.getState()

  const live = [...game.news].filter(n => inInbox(game, n)).sort((a, b) => b.id - a.id)
  const window20 = live.slice(0, 20)
  const unread = live.filter(n => !n.read).length

  // Arriving on the screen by any route - the rail, a Back, a deep link - should
  // open something. A reader with nothing in it is a bug, not a state.
  //
  // THE LOOP BREAKER. This rescue once chain-reacted with the shelf bug that
  // expired a story the moment it was marked read: serve, vanish, notice the
  // open story is gone, serve the next, vanish... until React killed the page
  // with error #185 (maximum update depth) on a phone with a 9+ backlog. The
  // shelf is fixed (days.markRead / readAt), and this counter makes the whole
  // class of bug survivable: if rescuing ever stops making progress, the
  // reader settles for its empty state instead of taking the app down.
  const rescues = useRef(0)
  useEffect(() => {
    if (inboxId != null && live.some(n => n.id === inboxId)) { rescues.current = 0; return }
    if (rescues.current++ < 25) openInbox()
  }, [inboxId, live.length])

  // THE 34-UNREAD LOOP (round 25, from a screenshot reading "0 of 20 · 34
  // unread"). The unread queue serves oldest first, but with more than 20
  // stories pending the oldest sits outside the 20-story browse window - and
  // the fallback here rendered window20[0], the SAME newest story, on every
  // tap of Next unread while the count dutifully fell. The story being READ
  // comes from the full recall list; the 20-window is only for ◀ ▶ browsing.
  const i = window20.findIndex(n => n.id === inboxId)
  const n = live.find(x => x.id === inboxId) ?? window20[0]

  if (!n) {
    return (
      <div className="muted" style={{ padding: 14 }}>
        {t('inbox.emptyReader', { days: RECALL_DAYS })}
      </div>
    )
  }

  // How long this one has left, so the window is visible rather than a surprise.
  // Only ever shown on something already read: an unread story does not expire,
  // and the countdown runs from when it was READ (see days.inInbox).
  const left = daysLeft(game, n)
  const shelf = !n.read ? '' : left <= 0 ? t('inbox.shelfLastDay')
    : left === 1 ? t('inbox.shelfOneDay') : t('inbox.shelfDaysLeft', { n: left })

  return (
    <>
      <div className="reader-bar">
        {/* older is BACK in time, which is further down a newest-first list */}
        <button className="btn ghost tiny" disabled={i >= window20.length - 1}
          title={t('inbox.olderMessage')} aria-label={t('inbox.olderMessage')}
          onClick={() => inboxStep(-1)}>◀</button>
        <span className="reader-pos">
          {/* a story older than the browse window has no position in it */}
          {i >= 0 ? t('inbox.position', { i: i + 1, n: window20.length }) : t('inbox.backlog')}
          {unread > 0 ? t('inbox.someUnread', { n: unread }) : t('inbox.allRead')}
        </span>
        <button className="btn ghost tiny" disabled={i <= 0}
          title={t('inbox.newerMessage')} aria-label={t('inbox.newerMessage')}
          onClick={() => inboxStep(1)}>▶</button>
        {unread > 0
          ? <button className="btn gold tiny" onClick={() => openInbox()}>{t('inbox.nextUnread', { n: unread })}</button>
          : <button className="btn ghost tiny" onClick={() => clearRead()}>{t('inbox.clearRead')}</button>}
      </div>

      <article className="reader">
        <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}{shelf}</div>
        <h2>{n.subject}</h2>
        {/* Real paragraphs, no spacer divs. A blank line in the source used to
            render an empty 6px div, so the spacing between paragraphs depended on
            how the engine happened to punctuate the story: some had 6px, some had
            12, and the result read as a wall with random gaps in it (user: "news
            graphics seem so messy, tidy them up. use paragraphs"). */}
        {/* **name** renders bold: the loan postcards mark the player names so a
            five-man report can be scanned (round 25). Odd segments of the split
            are the marked ones; a body with no markers passes through intact. */}
        {paragraphs(n.body).map((para, k) => (
          <p key={k}>{para.split(/\*\*(.+?)\*\*/g).map((seg, j) => j % 2 === 1 ? <b key={j}>{seg}</b> : seg)}</p>
        ))}
        <PeopleChips n={n} />
      </article>

      {/* The "Also In The Inbox" table of contents lived here for one round
          (the 10D one-at-a-time reader made a heavy morning invisible), and
          was cut at the user's request in 19D: "remove also in your inbox
          too". The reader is one story and its arrows again; the cue still
          serves the unread queue in order. */}
      <div className="spacer" />
    </>
  )
}
