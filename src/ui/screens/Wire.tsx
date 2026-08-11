import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { PeopleChips } from './Inbox'
import { paragraphs } from '../components'
import { weekDate } from '../../game/model'
import { markRead } from '../../game/days'

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💼', injury: '🏥', intl: '🌍', board: '🏛',
  award: '🏅', contract: '✍️', general: '📰', youth: '🌱', gossip: '🎙',
}

/** This week's stories, full screen, one page at a time - the breath between
 *  matches (8H feedback).
 *
 *  This is a reading FLOW, not a destination: it is entered from Continue with a
 *  queue of ids and it ends on "On to the Week". The browsable news list is the
 *  News screen, which is now the only one - the separate Rugby Wire screen was a
 *  second browser over the same array and has been merged in (user: "merge the
 *  rugby wire and news, its the same thing"). So this no longer bills itself as
 *  The Rugby Wire either; there is one name for news in the game. */
export default function Wire() {
  const game = useStore(s => s.game)!
  const queue = useStore(s => s.wireQueue)
  const home = useStore.getState().home
  const go = useStore(s => s.go)
  const [idx, setIdx] = useState(0)

  const items = queue.map(id => game.news.find(n => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n)
  const n = items[Math.min(idx, Math.max(0, items.length - 1))]

  // markRead stamps WHEN, so the inbox's five-day shelf starts from the reading
  useEffect(() => { if (n) { markRead(game, n) } }, [n])

  if (!n) {
    return (
      <div className="card center" style={{ margin: '20vh 16px' }}>
        <div className="meta">A quiet week. It never lasts.</div>
        <button className="btn gold block" style={{ marginTop: 10 }} onClick={home}>Continue ▸</button>
      </div>
    )
  }

  const last = idx >= items.length - 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '6px 14px 12px' }}>
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: 0 }}>
        <div className="wire-date" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{weekDate(n.season, n.week)} · News</span>
          <span>{idx + 1} / {items.length}</span>
        </div>
        <h2 style={{ fontSize: 19, lineHeight: 1.3, margin: '8px 0 10px' }}>
          {TYPE_ICON[n.type] ?? '📰'} {n.subject}
        </h2>
        {/* PARAGRAPHS, not a wall (user: "news graphics seem so messy, tidy them
            up. use paragraphs"). pre-line honours the newlines the engine writes
            but gives them no space, so a three-part story read as one block with
            odd gaps in it. Real paragraphs get real air between them, and a blank
            line in the source no longer produces an empty one on screen. */}
        <div className="wire-body" style={{ flex: 1, overflowY: 'auto' }}>
          {paragraphs(n.body).map((para, i) => <p key={i}>{para}</p>)}
        </div>
        {/* the same chip row the inbox reader uses, so a name looks tappable in
            the same way wherever the story is being read (10F) */}
        <PeopleChips n={n} />
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        {!last && (
          <button className="btn ghost" onClick={() => { for (const it of items) markRead(game, it); home() }}>
            Skip the rest
          </button>
        )}
        <button className="btn gold" style={{ flex: 2, fontSize: 15 }}
          onClick={() => { if (last) home(); else setIdx(idx + 1) }}>
          {last ? '▸ On to the Week' : `Next Story ▸`}
        </button>
      </div>
    </div>
  )
}
