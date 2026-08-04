import { useState } from 'react'
import { useStore } from '../../store'
import { weekDate } from '../../game/model'

/** THE RUGBY WIRE - gossip, rumours and the living world. */
export default function Feed() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [tab, setTab] = useState<'all' | 'rumours' | 'club'>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const club = game.clubs[game.userClubId]
  const items = [...game.news]
    .filter(n => n.type === 'gossip' || (tab !== 'club' && n.type === 'transfer'))
    .filter(n => {
      if (tab === 'rumours') return /RUMOUR|linked|WONDERKID|Agent/i.test(n.subject)
      if (tab === 'club') return n.body.includes(club.short) || n.body.includes(club.name) ||
        (n.playerId != null && game.players[n.playerId]?.clubId === game.userClubId)
      return true
    })
    .sort((a, b) => b.id - a.id)
    .slice(0, 60)

  const open = (id: number) => {
    const n = game.news.find(x => x.id === id)
    if (n && !n.read) { n.read = true; touch() }
    setOpenId(openId === id ? null : id)
  }

  return (
    <>
      <div className="wire-mast">
        <span className="wire-brand">THE RUGBY WIRE</span>
        <span className="wire-sub">rumours · fallouts · terrace talk</span>
      </div>
      <div className="tab-bar">
        {([['all', 'All Stories'], ['rumours', 'Rumour Mill'], ['club', 'Your Club']] as const).map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {items.length === 0 && (
        <div className="card"><div className="meta">A quiet week on the wire. It never lasts.</div></div>
      )}
      {items.map(n => (
        <div key={n.id} className={`card wire-card${n.read ? '' : ' unread'}`} onClick={() => open(n.id)}>
          <div className="wire-date">{weekDate(n.season, n.week)}</div>
          <h3 style={{ fontSize: 14.5, lineHeight: 1.35 }}>{n.subject}</h3>
          {openId === n.id && (
            <>
              <div className="meta" style={{ whiteSpace: 'pre-line', marginTop: 6, lineHeight: 1.55 }}>{n.body}</div>
              {n.playerId != null && game.players[n.playerId] && (
                <button className="btn ghost" style={{ marginTop: 8, fontSize: 12 }}
                  onClick={e => { e.stopPropagation(); go('player', n.playerId) }}>
                  View {game.players[n.playerId].name} ▸
                </button>
              )}
              {(n.playerIds ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(n.playerIds ?? []).filter(id => game.players[id]).map(id => (
                    <button key={id} className="btn ghost" style={{ fontSize: 12 }}
                      onClick={e => { e.stopPropagation(); go('player', id) }}>
                      {game.players[id].name} ▸
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
      <div className="spacer" />
    </>
  )
}
