import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, POS_ORDER, type Pos } from '../../game/model'
import { counterIncomingOffer, respondToOffer } from '../../game/ai'
import { fuzzedCa, knowledge } from '../../game/scout'
import { FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'

export default function Transfers() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [pos, setPos] = useState<Pos | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [maxVal, setMaxVal] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  const user = game.clubs[game.userClubId]
  const offers = game.offers.filter(o => o.status === 'pending' && o.forUser)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = Object.values(game.players).filter(p => p.clubId !== game.userClubId)
    if (pos !== 'ALL') list = list.filter(p => p.pos === pos || p.alt.includes(pos))
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q))
    if (maxVal > 0) list = list.filter(p => p.value <= maxVal)
    return list.sort((a, b) => b.ca - a.ca).slice(0, 80)
  }, [game.players, pos, query, maxVal, game.week])

  return (
    <>
      <div className="chips">
        <span className="chip">Budget <b>{fmtMoney(user.budget)}</b></span>
        <span className="chip">Balance <b>{fmtMoney(user.balance)}</b></span>
        <span className="chip">Wage room <b>{fmtMoney(Math.max(0, user.wageBudget - user.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)))}/wk</b></span>
      </div>

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>{msg}</div>}

      {offers.length > 0 && (
        <>
          <SectionTitle>Offers For Your Players</SectionTitle>
          {offers.map(o => {
            const p = game.players[o.playerId]
            const bidder = game.clubs[o.fromClubId]
            if (!p || !bidder) return null
            return (
              <div className="card" key={o.id}>
                <h3>{bidder.name} bid {fmtMoney(o.fee)} for {p.name}</h3>
                <div className="meta">Value {fmtMoney(p.value)} · {p.age} yrs · morale {p.morale.toFixed(0)}/10</div>
                <div className="btn-row" style={{ margin: '10px 0 0' }}>
                  <button className="btn gold" onClick={() => { setMsg(respondToOffer(game, o.id, true)); touch() }}>Accept</button>
                  <button className="btn" onClick={() => { setMsg(counterIncomingOffer(game, o.id)); touch() }}>Demand More</button>
                  <button className="btn danger" onClick={() => { setMsg(respondToOffer(game, o.id, false)); touch() }}>Reject</button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {game.shortlist.length > 0 && (
        <>
          <SectionTitle sub="scouts filing weekly reports">Shortlist</SectionTitle>
          <div className="tblwrap"><table className="dtable"><tbody>
            {game.shortlist.map(id => game.players[id]).filter(Boolean).map(p => (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">{p.name}</td>
                <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : 'Free agent'}</td>
                <td><Stars ca={fuzzedCa(game, p)} /></td>
                <td className="num" style={{ color: knowledge(game, p) >= 95 ? '#2f7d4f' : undefined }}>
                  {Math.round(knowledge(game, p))}%
                </td>
              </tr>
            ))}
          </tbody></table></div>
        </>
      )}

      <SectionTitle sub="tap a player to scout & bid">Scout The Market</SectionTitle>
      <div style={{ padding: '0 14px' }}>
        <input className="inline-input" placeholder="Search player name…" value={query}
          onChange={e => setQuery(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="inline-input" value={pos} onChange={e => setPos(e.target.value as Pos | 'ALL')}>
            <option value="ALL">All positions</option>
            {POS_ORDER.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="inline-input" value={maxVal} onChange={e => setMaxVal(Number(e.target.value))}>
            <option value={0}>Any value</option>
            <option value={250000}>≤ £250k</option>
            <option value={1000000}>≤ £1m</option>
            <option value={3000000}>≤ £3m</option>
            <option value={8000000}>≤ £8m</option>
          </select>
        </div>
      </div>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Pos</th><th>Name</th><th>Age</th><th>Nat</th><th>Club</th><th>Ability</th><th className="num">Value</th></tr></thead>
        <tbody>
          {results.map(p => (
            <tr key={p.id} onClick={() => go('player', p.id)}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name}{p.transferListed ? ' 🏷️' : ''}</td>
              <td className="num">{p.age}</td>
              <td><Nat code={p.nat} /></td>
              <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : 'Free agent'}</td>
              <td><Stars ca={fuzzedCa(game, p)} />{knowledge(game, p) < 95 && <span className="muted">?</span>}</td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
