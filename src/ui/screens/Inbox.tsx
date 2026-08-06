import { useState } from 'react'
import { useStore } from '../../store'
import { weekDate } from '../../game/model'

/** The inbox, on its own screen (user: "inbox and summary should be
 *  separated").
 *
 *  It used to live at the bottom of Home, under the fixture, the objectives, the
 *  hub widgets and the dashboard panels. That made Home two unrelated jobs in one
 *  scroll: a glance at where the club stands, and a queue of messages to work
 *  through. The rail now has a button for each, which is also why Home stopped
 *  being the longest screen in the game. */

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💰', injury: '🩹', intl: '🌍', board: '🏛️',
  award: '🏅', contract: '✍️', general: '📰', youth: '🎓', gossip: '🗞️',
}

/** The message list. Shared so Home's unemployed state can still show it inline:
 *  with no club there is no summary to separate it from. */
export function InboxList({ compact }: { compact?: boolean }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  // FM-style: arriving at the inbox opens your oldest unread message
  const [openId, setOpenId] = useState<number | null>(() => {
    const unread = game.news.filter(n => !n.read && n.type !== 'gossip')
    const first = unread.length ? unread[0] : null
    if (first) first.read = true
    return first?.id ?? null
  })

  /** Mark the open message read and jump to the next unread one. */
  const nextUnread = () => {
    const unread = game.news.filter(n => !n.read && n.type !== 'gossip')
    const next = unread.length ? unread[0] : null
    if (next) next.read = true
    setOpenId(next?.id ?? null)
    touch()
  }

  const news = [...game.news].filter(n => n.type !== 'gossip').sort((a, b) => b.id - a.id)

  if (news.length === 0) {
    return <div className="muted" style={{ padding: 14 }}>Nothing yet. Press Continue to get the season moving.</div>
  }

  return (
    <>
      {news.slice(0, 60).map(n => {
        const remaining = game.news.filter(x => !x.read && x.type !== 'gossip' && x.id !== n.id).length
        return (
          <button key={n.id}
            className={`news-item${n.read ? '' : ' unread'}${openId === n.id ? ' open' : ''}`}
            onClick={() => {
              n.read = true
              setOpenId(openId === n.id ? null : n.id)
              touch()
              if (n.playerId && openId === n.id) go('player', n.playerId)
            }}>
            <div className="when">{TYPE_ICON[n.type] ?? '📰'} {weekDate(n.season, n.week)}</div>
            <div className="subj">{n.subject}</div>
            <div className="body">{n.body}</div>
            {!compact && openId === n.id && remaining > 0 && (
              <span className="next-unread" role="button"
                onClick={e => { e.stopPropagation(); nextUnread() }}>
                Next unread ({remaining}) ▸
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

export default function Inbox() {
  const game = useStore(s => s.game)!
  const club = game.clubs[game.userClubId]
  const unread = game.news.filter(n => !n.read && n.type !== 'gossip').length
  return (
    <>
      <div className="filter-note" style={{ padding: '8px 16px 2px' }}>
        {unread === 0 ? 'All caught up.' : `${unread} unread`}
        {club ? ` · board confidence ${Math.round(club.boardConfidence)}%` : ''}
      </div>
      <InboxList />
      <div className="spacer" />
    </>
  )
}
