import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, POS_ORDER, type Pos } from '../../game/model'
import { counterIncomingOffer, respondToOffer } from '../../game/ai'
import { loanIn, loanTargets } from '../../game/loans'
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
      <div className="chips" style={{
        position: 'sticky', top: 0, zIndex: 5, margin: 0, padding: '10px 14px 8px',
        background: 'color-mix(in srgb, var(--cream) 92%, transparent)', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid var(--hairline)',
      }}>
        <span className="chip">💰 Budget <b>{fmtMoney(user.budget)}</b></span>
        <span className="chip">Wage room <b>{fmtMoney(Math.max(0, user.wageBudget - user.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)))}/wk</b></span>
        <span className="chip" style={{
          color: (game.week <= 7 || game.week === 26 || game.week === 27) ? 'var(--win)' : 'var(--ink-faint)',
          fontWeight: 700,
        }}>
          {game.week <= 7 ? `Window open · closes wk 8`
            : game.week === 26 || game.week === 27 ? `⏰ Deadline window · slams shut wk 28`
            : `Window closed · deadline wk 26`}
        </span>
      </div>

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>{msg}</div>}

      <div className="card">
        <div className="fact-label">Scouting Assignment</div>
        <div className="meta" style={{ marginBottom: 6 }}>
          Point the network at one league — its players get watched every week
          {game.scoutFocus ? '' : ' (currently unassigned)'}. Shortlisted men are always tracked, with alerts when their situation changes.
        </div>
        <div className="chips" style={{ padding: 0 }}>
          {Object.values(game.comps).filter(c => c.type === 'league').map(c => (
            <button key={c.id} className="chip" onClick={() => { game.scoutFocus = game.scoutFocus === c.id ? null : c.id; touch() }}
              style={game.scoutFocus === c.id ? { borderColor: 'var(--gold-bright)', color: 'var(--accent-ink)', fontWeight: 700 } : undefined}>
              {game.scoutFocus === c.id ? '🔭 ' : ''}{c.short}
            </button>
          ))}
        </div>
      </div>

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

      <SectionTitle sub="big-club benches — borrow a star of tomorrow, parent pays half">Loan Market</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {loanTargets(game).map(p => (
          <tr key={p.id}>
            <td onClick={() => go('player', p.id)}><PosBadge pos={p.pos} /></td>
            <td className="name" onClick={() => go('player', p.id)}>
              {p.name} <span className="muted">({p.age} · {p.clubId ? game.clubs[p.clubId]?.short : ''})</span>
            </td>
            <td onClick={() => go('player', p.id)}><Stars ca={fuzzedCa(game, p)} /></td>
            <td>
              <button className="btn ghost" style={{ fontSize: 11, padding: '5px 10px' }}
                onClick={() => { setMsg(loanIn(game, p.id)); touch() }}>
                Sign on loan
              </button>
            </td>
          </tr>
        ))}
        {loanTargets(game).length === 0 && (
          <tr><td className="muted" style={{ padding: 12 }}>No clubs above you are loaning right now.</td></tr>
        )}
      </tbody></table></div>

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
