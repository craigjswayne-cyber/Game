import { useState } from 'react'
import { useStore } from '../../store'
import { ATTR_NAMES, POS_NAMES, fmtMoney, type Attrs } from '../../game/model'
import { askingPrice, offerRenewalAt, renewalDemand, talkToPlayer, userBid } from '../../game/ai'
import { attrBarColor, attrClass, FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { flagOf, nationByCode } from '../../game/nations'
import { attrRange, fuzzedCa, knowledge } from '../../game/scout'

export default function PlayerScreen({ playerId }: { playerId: number }) {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [msg, setMsg] = useState<string | null>(null)
  const [bidding, setBidding] = useState(false)
  const [bid, setBid] = useState(0)
  const [counter, setCounter] = useState<number | null>(null)
  const [negotiating, setNegotiating] = useState(false)
  const [wageOffer, setWageOffer] = useState(0)
  const [wageCounter, setWageCounter] = useState<number | null>(null)

  const p = game.players[playerId]
  if (!p) return <div className="muted" style={{ padding: 14 }}>Player no longer in the game world (retired or released).</div>

  const club = p.clubId ? game.clubs[p.clubId] : null
  const mine = p.clubId === game.userClubId
  const avg = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
  const ask = club && !mine ? askingPrice(game, p) : 0
  const know = knowledge(game, p)
  const shortlisted = game.shortlist.includes(p.id)
  const toggleShortlist = useStore(s => s.toggleShortlist)

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
              <button className="meta" style={{ color: 'var(--accent-ink)', fontWeight: 600, marginTop: 2 }}
                onClick={() => go('club', club.id)}>
                {club.name} ›
              </button>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <Stars ca={fuzzedCa(game, p)} />{know < 95 && <span className="muted" title="Estimated — scout him for certainty"> ?</span>}
            <div style={{ marginTop: 4 }}><FormPill v={p.form} /></div>
          </div>
        </div>
      </div>

      <div className="chips">
        <span className="chip">Overall <b style={{ fontSize: 13 }}>{Math.round(fuzzedCa(game, p))}</b><span className="muted">/100</span></span>
        <span className="chip">Character <b>{p.pers}</b></span>
        {!mine && <span className="chip" style={know < 55 ? { color: '#a8841a' } : undefined}>
          Scouted <b>{Math.round(know)}%</b></span>}
        <span className="chip">Value <b>{fmtMoney(p.value)}</b></span>
        <span className="chip">Wage <b>{fmtMoney(p.wage)}/wk</b></span>
        <span className="chip">Contract to <b>{2026 + p.contractEnds}</b></span>
        <span className="chip">Morale <b>{moraleWord(p.morale)}</b></span>
        <span className="chip">Fitness <b>{Math.round(p.cond)}%</b></span>
        <span className="chip">Sharpness <b>{Math.round(p.sharp)}%</b></span>
        {p.injury && <span className="chip" style={{ borderColor: '#9b2c2c', color: '#9b2c2c' }}>
          Injured: {p.injury.desc} (~{Math.max(0, p.injury.until - game.week)}w)</span>}
        {p.bans > 0 && <span className="chip" style={{ color: '#9b2c2c' }}>Suspended {p.bans} match{p.bans > 1 ? 'es' : ''}</span>}
        {p.acad && <span className="chip" style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>🎓 Academy squad</span>}
        {p.natSquad && <span className="chip">On international duty</span>}
        {p.onLoan && <span className="chip" style={{ color: '#a8841a' }}>Away on season loan</span>}
        {p.transferListed && <span className="chip" style={{ color: '#a8841a' }}>Transfer listed</span>}
      </div>

      {groups.map(([title, keys]) => (
        <div key={title}>
          <SectionTitle>{title}</SectionTitle>
          <div className="attr-grid">
            {keys.map(k => {
              const [lo, hi] = attrRange(game, p, k)
              const mid = Math.round((lo + hi) / 2)
              const exact = lo === hi
              return (
                <div className="attr" key={k}>
                  <span>{ATTR_NAMES[k]}</span>
                  <span className="bar"><i style={{
                    width: `${mid * 5}%`,
                    background: attrBarColor(mid),
                    opacity: exact ? 1 : 0.55,
                  }} /></span>
                  <span className={`v ${exact ? attrClass(lo) : ''}`} style={exact ? undefined : { width: 44, fontSize: 12.5, color: 'var(--ink-faint)' }}>
                    {exact ? lo * 5 : `${lo * 5}–${hi * 5}`}
                  </span>
                </div>
              )
            })}
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
        {p.stats.drops > 0 && <span className="chip">Drop goals <b>{p.stats.drops}</b></span>}
        <span className="chip">Cards <b>{p.stats.yc}Y {p.stats.rc}R</b></span>
        {p.stats.motm > 0 && <span className="chip">⭐ MOTM <b>{p.stats.motm}</b></span>}
        {p.lastR != null && <span className="chip">Last match <b>{Math.min(10, Math.max(1, p.lastR)).toFixed(1)}</b></span>}
        {(p.ca - (p.ca0 ?? p.ca)) !== 0 && (
          <span className="chip">Development <b style={{ color: p.ca > (p.ca0 ?? p.ca) ? '#2f7d4f' : '#9b2c2c' }}>
            {p.ca > (p.ca0 ?? p.ca) ? '▲' : '▼'} {Math.abs(p.ca - (p.ca0 ?? p.ca))}
          </b></span>
        )}
        {p.age <= 21 && p.pa >= 86 && <span className="chip" style={{ borderColor: 'var(--gold-bright)' }}>🌟 <b>Wonderkid</b></span>}
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
              <tr style={{ fontWeight: 700 }}>
                <td>TOTAL</td>
                <td className="muted">incl. this season</td>
                <td className="num">{p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.points, 0) + p.stats.points}</td>
              </tr>
            </tbody>
          </table></div>
        </>
      )}

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>
        {msg}
        {counter != null && (
          <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => {
            const r = userBid(game, p.id, counter)
            setMsg(r.msg); setCounter(r.counter ?? null); touch()
          }}>Meet their price ({fmtMoney(counter)})</button>
        )}
      </div>}

      {mine && !p.onLoan && p.age <= 23 && !game.clubs[game.userClubId].tactic.lineup.slice(0, 15).includes(p.id) && (
        <button className="btn ghost block" onClick={() => {
          p.onLoan = true
          game.news.push({
            id: game.nextId++, week: game.week, season: game.season, type: 'youth', read: true,
            subject: `${p.name} heads out on loan`,
            body: `${p.name} joins a feeder club for the rest of the season. Regular first-team rugby should accelerate his development — expect him back sharper next summer.`,
            playerId: p.id,
          })
          setMsg(`${p.name} will spend the season on loan. He returns next summer, better for it.`)
          touch()
        }}>Send on Season Loan (develops faster)</button>
      )}
      {mine && p.acad && (
        <button className="btn gold block" onClick={() => {
          p.acad = false
          p.morale = Math.min(10, p.morale + 1)
          game.news.push({
            id: game.nextId++, week: game.week, season: game.season, type: 'youth', read: true,
            subject: `${p.name} promoted to the first team`,
            body: `A big day at the training ground: ${p.name} (${p.age}) has been called up from the academy to full first-team duty. The academy coach shakes his hand at the door — his work here is done.`,
            playerId: p.id,
          })
          setMsg(`${p.name} joins first-team training. He'll never forget today.`)
          touch()
        }}>🎓 Promote to First Team</button>
      )}
      {mine && !p.onLoan && (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => { setMsg(talkToPlayer(game, p.id, 'praise')); touch() }}>
            🗣 Praise His Form
          </button>
          <button className="btn ghost" onClick={() => { setMsg(talkToPlayer(game, p.id, 'word')); touch() }}>
            ⚠️ Have a Word
          </button>
        </div>
      )}
      {mine ? (
        <>
          {negotiating && (
            <div className="card">
              <h3>Contract talks with {p.name.split(' ').slice(-1)[0]}'s agent</h3>
              <div className="meta">His camp wants {fmtMoney(renewalDemand(p))}/wk (currently {fmtMoney(p.wage)}/wk). Lowball at your peril.</div>
              <input className="inline-input" type="number" value={wageOffer} step={50} min={0}
                onChange={e => setWageOffer(Number(e.target.value))} />
              <div className="btn-row" style={{ margin: '10px 0 0' }}>
                <button className="btn gold" onClick={() => {
                  const r = offerRenewalAt(game, p.id, wageOffer)
                  setMsg(r.msg); setWageCounter(r.counter ?? null); if (r.ok) setNegotiating(false); touch()
                }}>Offer {fmtMoney(wageOffer)}/wk</button>
                <button className="btn ghost" onClick={() => { setNegotiating(false); setWageCounter(null) }}>Walk Away</button>
              </div>
              {wageCounter != null && (
                <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={() => {
                  const r = offerRenewalAt(game, p.id, wageCounter)
                  setMsg(r.msg); setWageCounter(null); if (r.ok) setNegotiating(false); touch()
                }}>Meet their number ({fmtMoney(wageCounter)}/wk)</button>
              )}
            </div>
          )}
          <div className="btn-row">
            {!negotiating && (
              <button className="btn" onClick={() => {
                setNegotiating(true); setWageOffer(Math.round(renewalDemand(p) * 0.9 / 50) * 50); setWageCounter(null)
              }}>Open Contract Talks</button>
            )}
            <button className={`btn ${p.transferListed ? 'ghost' : 'danger'}`} onClick={() => {
              p.transferListed = !p.transferListed
              setMsg(p.transferListed ? `${p.name} placed on the transfer list.` : `${p.name} removed from the list.`)
              touch()
            }}>{p.transferListed ? 'Unlist' : 'Transfer List'}</button>
          </div>
        </>
      ) : club ? (
        <>
          <button className={`btn ${shortlisted ? '' : 'ghost'} block`} onClick={() => toggleShortlist(p.id)}>
            {shortlisted ? '★ On Shortlist — scouts filing reports' : '☆ Shortlist & Scout'}
          </button>
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
                    setMsg(r.msg); setCounter(r.counter ?? null); setBidding(false); touch()
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
