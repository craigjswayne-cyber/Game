import { useState } from 'react'
import { useStore } from '../../store'
import { ATTR_NAMES, POS_NAMES, fmtMoney, type Attrs } from '../../game/model'
import { askingPrice, offerRenewal, renewalDemand, userBid } from '../../game/ai'
import { attrBarColor, attrClass, FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { flagOf, nationByCode } from '../../game/nations'

export default function PlayerScreen({ playerId }: { playerId: number }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [msg, setMsg] = useState<string | null>(null)
  const [bidding, setBidding] = useState(false)
  const [bid, setBid] = useState(0)

  const p = game.players[playerId]
  if (!p) return <div className="muted" style={{ padding: 14 }}>Player no longer in the game world (retired or released).</div>

  const club = p.clubId ? game.clubs[p.clubId] : null
  const mine = p.clubId === game.userClubId
  const avg = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
  const ask = club && !mine ? askingPrice(game, p) : 0

  const groups: [string, (keyof Attrs)[]][] = [
    ['Set Piece & Contact', ['scr', 'lin', 'ruc', 'tac', 'str', 'agg']],
    ['Skills', ['han', 'pas', 'kic', 'goa', 'vis', 'dec']],
    ['Physical & Mental', ['pac', 'agi', 'sta', 'pos', 'wor', 'lea']],
  ]

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 20 }}>{p.name}</h3>
            <div className="meta">
              <PosBadge pos={p.pos} /> {POS_NAMES[p.pos]}
              {p.alt.length > 0 && <span className="muted"> (also {p.alt.join(', ')})</span>}
            </div>
            <div className="meta" style={{ marginTop: 3 }}>
              {flagOf(p.nat)} {nationByCode(p.nat)?.name ?? p.nat} · {p.age} yrs
              {p.intl ? ' · International' : ''}{p.youth ? ' · Academy graduate' : ''}
            </div>
            {club && (
              <button className="meta" style={{ color: '#0b3d2e', fontWeight: 600, marginTop: 2 }}
                onClick={() => go('club', club.id)}>
                {club.name} ›
              </button>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <Stars ca={p.ca} />
            <div style={{ marginTop: 4 }}><FormPill v={p.form} /></div>
          </div>
        </div>
      </div>

      <div className="chips">
        <span className="chip">Value <b>{fmtMoney(p.value)}</b></span>
        <span className="chip">Wage <b>{fmtMoney(p.wage)}/wk</b></span>
        <span className="chip">Contract to <b>{2026 + p.contractEnds}</b></span>
        <span className="chip">Morale <b>{moraleWord(p.morale)}</b></span>
        <span className="chip">Fitness <b>{Math.round(p.cond)}%</b></span>
        <span className="chip">Sharpness <b>{Math.round(p.sharp)}%</b></span>
        {p.injury && <span className="chip" style={{ borderColor: '#9b2c2c', color: '#9b2c2c' }}>
          Injured: {p.injury.desc} (~{Math.max(0, p.injury.until - game.week)}w)</span>}
        {p.bans > 0 && <span className="chip" style={{ color: '#9b2c2c' }}>Suspended {p.bans} match{p.bans > 1 ? 'es' : ''}</span>}
        {p.natSquad && <span className="chip">On international duty</span>}
        {p.transferListed && <span className="chip" style={{ color: '#a8841a' }}>Transfer listed</span>}
      </div>

      {groups.map(([title, keys]) => (
        <div key={title}>
          <SectionTitle>{title}</SectionTitle>
          <div className="attr-grid">
            {keys.map(k => (
              <div className="attr" key={k}>
                <span>{ATTR_NAMES[k]}</span>
                <span className="bar"><i style={{ width: `${p.a[k] * 5}%`, background: attrBarColor(p.a[k]) }} /></span>
                <span className={`v ${attrClass(p.a[k])}`}>{p.a[k]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <SectionTitle sub={`avg rating ${avg ? avg.toFixed(2) : '—'}`}>This Season</SectionTitle>
      <div className="chips">
        <span className="chip">Apps <b>{p.stats.apps}</b> ({p.stats.starts} starts)</span>
        <span className="chip">Tries <b>{p.stats.tries}</b></span>
        <span className="chip">Points <b>{p.stats.points}</b></span>
        <span className="chip">Cons <b>{p.stats.cons}</b></span>
        <span className="chip">Pens <b>{p.stats.pens}</b></span>
        <span className="chip">Cards <b>{p.stats.yc}Y {p.stats.rc}R</b></span>
      </div>

      {p.career.length > 0 && (
        <>
          <SectionTitle>Career</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Season</th><th>Club</th><th className="num">Apps</th><th className="num">Tries</th><th className="num">Pts</th></tr></thead>
            <tbody>
              {[...p.career].reverse().map((c, i) => (
                <tr key={i}>
                  <td>{2025 + c.season}-{String((2026 + c.season) % 100).padStart(2, '0')}</td>
                  <td>{game.clubs[c.clubId]?.short ?? c.clubId}</td>
                  <td className="num">{c.apps}</td>
                  <td className="num">{c.tries}</td>
                  <td className="num">{c.points}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>{msg}</div>}

      {mine ? (
        <div className="btn-row">
          <button className="btn" onClick={() => {
            const r = offerRenewal(game, p.id)
            setMsg(r.msg); touch()
          }}>Offer New Deal ({fmtMoney(renewalDemand(p))}/wk)</button>
          <button className={`btn ${p.transferListed ? 'ghost' : 'danger'}`} onClick={() => {
            p.transferListed = !p.transferListed
            setMsg(p.transferListed ? `${p.name} placed on the transfer list.` : `${p.name} removed from the list.`)
            touch()
          }}>{p.transferListed ? 'Unlist' : 'Transfer List'}</button>
        </div>
      ) : club ? (
        <>
          {!bidding
            ? <button className="btn gold block" onClick={() => { setBidding(true); setBid(ask) }}>
                Bid for {p.name.split(' ').slice(-1)[0]} (ask ~{fmtMoney(ask)})
              </button>
            : (
              <div className="card">
                <h3>Your offer to {club.short}</h3>
                <input className="inline-input" type="number" value={bid} step={50000} min={0}
                  onChange={e => setBid(Number(e.target.value))} />
                <div className="muted">Budget: {fmtMoney(game.clubs[game.userClubId].budget)}</div>
                <div className="btn-row" style={{ margin: '10px 0 0' }}>
                  <button className="btn gold" onClick={() => {
                    const r = userBid(game, p.id, bid)
                    setMsg(r.msg); setBidding(false); touch()
                  }}>Submit Bid</button>
                  <button className="btn ghost" onClick={() => setBidding(false)}>Cancel</button>
                </div>
              </div>
            )}
        </>
      ) : (
        <button className="btn gold block" onClick={() => {
          const user = game.clubs[game.userClubId]
          const wage = renewalDemand(p)
          const squadWages = user.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)
          if (squadWages + wage > user.wageBudget) { setMsg('His wage demands would exceed your wage budget.'); return }
          p.clubId = user.id
          user.players.push(p.id)
          p.wage = wage
          p.contractEnds = game.season + 2
          setMsg(`${p.name} signs on a free transfer (${fmtMoney(wage)}/wk).`)
          touch()
        }}>Sign Free Agent</button>
      )}
      <div className="spacer" />
    </>
  )
}

function moraleWord(m: number): string {
  return m >= 8.5 ? 'Superb' : m >= 7 ? 'Good' : m >= 5.5 ? 'Okay' : m >= 4 ? 'Low' : 'Very poor'
}
