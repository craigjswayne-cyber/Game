import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { weekDate } from '../../game/model'

const TYPE_ICON: Record<string, string> = {
  result: '🏉', transfer: '💼', injury: '🏥', intl: '🌍', board: '🏛',
  award: '🏅', contract: '✍️', general: '📰', youth: '🌱', gossip: '🎙',
}

/** The Wire, full screen: this week's stories one page at a time - the
 *  breath between matches (8H feedback). */
export default function Wire() {
  const game = useStore(s => s.game)!
  const queue = useStore(s => s.wireQueue)
  const home = useStore.getState().home
  const go = useStore(s => s.go)
  const [idx, setIdx] = useState(0)

  const items = queue.map(id => game.news.find(n => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n)
  const n = items[Math.min(idx, Math.max(0, items.length - 1))]

  useEffect(() => { if (n) { n.read = true } }, [n])

  if (!n) {
    return (
      <div className="card center" style={{ margin: '20vh 16px' }}>
        <div className="meta">A quiet week on the wire.</div>
        <button className="btn gold block" style={{ marginTop: 10 }} onClick={home}>Continue ▸</button>
      </div>
    )
  }

  const last = idx >= items.length - 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '6px 14px 12px' }}>
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: 0 }}>
        <div className="wire-date" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{weekDate(n.season, n.week)} · The Rugby Wire</span>
          <span>{idx + 1} / {items.length}</span>
        </div>
        <h2 style={{ fontSize: 19, lineHeight: 1.3, margin: '8px 0 10px' }}>
          {TYPE_ICON[n.type] ?? '📰'} {n.subject}
        </h2>
        <div className="meta" style={{ whiteSpace: 'pre-line', fontSize: 14, lineHeight: 1.65, flex: 1, overflowY: 'auto' }}>
          {n.body}
        </div>
        {(n.playerId != null || (n.playerIds ?? []).length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {[...(n.playerId != null ? [n.playerId] : []), ...(n.playerIds ?? [])]
              .filter((id, i, a) => game.players[id] && a.indexOf(id) === i)
              .map(id => (
                <button key={id} className="btn ghost" style={{ fontSize: 12 }} onClick={() => go('player', id)}>
                  {game.players[id].name} ▸
                </button>
              ))}
          </div>
        )}
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        {!last && (
          <button className="btn ghost" onClick={() => { for (const it of items) it.read = true; home() }}>
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
