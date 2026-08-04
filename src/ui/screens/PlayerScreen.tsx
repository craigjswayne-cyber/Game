import { useState } from 'react'
import { useStore } from '../../store'
import { ATTR_NAMES, POS_NAMES, TRAIT_INFO, fmtMoney, type Attrs } from '../../game/model'
import { agreeFee, agreePreContract, askingPrice, offerRenewalAt, personalTermsDemand, renewalDemand, signOnTerms, talkToPlayer } from '../../game/ai'
import { FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'
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
  // stage 2 of the 8D flow: fee agreed, personal terms on the table
  const [termsFee, setTermsFee] = useState<number | null>(null)
  const [wage, setWage] = useState(0)
  const [signOn, setSignOn] = useState(0)
  const [promiseMin, setPromiseMin] = useState(false)
  const [negotiating, setNegotiating] = useState(false)
  const [wageOffer, setWageOffer] = useState(0)
  const [wageCounter, setWageCounter] = useState<number | null>(null)
  const [compare, setCompare] = useState(false)

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

  // one-tap comparison: this man against your best in the same shirt
  const rival = !mine ? game.clubs[game.userClubId].players
    .map(id => game.players[id])
    .filter(q => q && !q.acad && (q.pos === p.pos || q.alt.includes(p.pos)))
    .sort((a, b) => b!.ca - a!.ca)[0] ?? null : null

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
            <Stars ca={fuzzedCa(game, p)} />{know < 95 && <span className="muted" title="Estimated - scout him for certainty"> ?</span>}
            <div style={{ marginTop: 4 }}><FormPill v={p.form} /></div>
          </div>
        </div>
      </div>

      <div className="chips">
        <span className="chip">Overall <b style={{ fontSize: 13 }}>{Math.round(fuzzedCa(game, p))}</b><span className="muted">/100</span></span>
        <span className="chip">Character <b>{p.pers}</b></span>
        {(p.caps ?? 0) > 0 && <span className="chip">🌍 <b>{p.caps}</b> caps</span>}
        {p.trait && <span className="chip" title={TRAIT_INFO[p.trait]} style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>✨ {p.trait}</span>}
        {!mine && <span className="chip" style={know < 55 ? { color: '#a8841a' } : undefined}>
          Scouted <b>{Math.round(know)}%</b></span>}
        <span className="chip">Value <b>{fmtMoney(p.value)}</b></span>
        <span className="chip">Wage <b>{fmtMoney(p.wage)}/wk</b></span>
        <span className="chip">Contract to <b>{2026 + p.contractEnds}</b></span>
        {(p.wantsDeal ?? 0) > 0 && <span className="chip" style={{ borderColor: '#a8841a', color: '#a8841a', fontWeight: 700 }}>
          💼 Agent wants new terms</span>}
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

      {rival && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="fact-label">Compare</div>
            <div className="meta">
              Your best {p.pos}: <b>{rival.name}</b> ({Math.round(rival.ca)} overall, {rival.age} yrs, {fmtMoney(rival.wage)}/wk)
              {compare ? ' - his numbers shown beside each bar.' : ''}
            </div>
          </div>
          <button className={`btn ${compare ? 'gold' : 'ghost'}`} onClick={() => setCompare(!compare)}>
            {compare ? '✓ Comparing' : '⚖ Compare'}
          </button>
        </div>
      )}
      <SectionTitle sub={compare && rival ? `${rival.name.split(' ').slice(-1)[0]}'s numbers beside each chip` : 'the full picture, FM style · 0-100'}>Attributes</SectionTitle>
      <div className="fm-attrs">
        {groups.map(([title, keys]) => (
          <div className="fm-col" key={title}>
            <div className="fm-col-head">{title}</div>
            {keys.map(k => {
              const [lo, hi] = attrRange(game, p, k)
              const exact = lo === hi
              const mid = Math.round((lo + hi) / 2)
              const v = mid * 5
              const rv = compare && rival ? rival.a[k] : null
              return (
                <div className="fm-attr" key={k}>
                  <span className="fm-name">{ATTR_NAMES[k]}</span>
                  {rv != null && (
                    <b className="fm-rival" style={{ color: mid > rv ? '#2f7d4f' : mid < rv ? '#9b2c2c' : 'var(--ink-faint)' }}>{rv * 5}</b>
                  )}
                  <b className={`fm-chip ${exact ? (v >= 80 ? 'hi' : v >= 55 ? 'mid' : 'lo') : 'rng'}`}>
                    {exact ? v : `${lo * 5}-${hi * 5}`}
                  </b>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <SectionTitle sub={`avg rating ${avg ? avg.toFixed(2) : '-'}`}>This Season</SectionTitle>
      <div className="chips">
        <span className="chip">Apps <b>{p.stats.apps}</b> ({p.stats.starts} starts)</span>
        <span className="chip">Tries <b>{p.stats.tries}</b></span>
        <span className="chip">Points <b>{p.stats.points}</b></span>
        <span className="chip">Cons <b>{p.stats.cons}</b></span>
        <span className="chip">Pens <b>{p.stats.pens}</b></span>
        {p.stats.drops > 0 && <span className="chip">Drop goals <b>{p.stats.drops}</b></span>}
        <span className="chip">Cards <b>{p.stats.yc}Y {p.stats.rc}R</b></span>
        {p.stats.motm > 0 && <span className="chip">⭐ MOTM <b>{p.stats.motm}</b></span>}
        {(p.lions ?? 0) > 0 && <span className="chip">🦁 Lions tourist{(p.lions ?? 0) > 1 ? <b> ×{p.lions}</b> : null}</span>}
        {(p.wcWins ?? 0) > 0 && <span className="chip">🏆 World Cup winner{(p.wcWins ?? 0) > 1 ? <b> ×{p.wcWins}</b> : null}</span>}
        {p.lastR != null && <span className="chip">Last match <b>{Math.min(10, Math.max(1, p.lastR)).toFixed(1)}</b></span>}
        {(p.ca - (p.ca0 ?? p.ca)) !== 0 && (
          <span className="chip">Development <b style={{ color: p.ca > (p.ca0 ?? p.ca) ? '#2f7d4f' : '#9b2c2c' }}>
            {p.ca > (p.ca0 ?? p.ca) ? '▲' : '▼'} {Math.abs(p.ca - (p.ca0 ?? p.ca))}
          </b></span>
        )}
        {p.age <= 21 && p.pa >= 86 && <span className="chip" style={{ borderColor: 'var(--gold-bright)' }}>🌟 <b>Wonderkid</b></span>}
        {(p.poty ?? 0) > 0 && (
          <span className="chip" style={{ borderColor: 'var(--gold-bright)' }}>
            🏅 <b>World POTY{(p.poty ?? 0) > 1 ? ` ×${p.poty}` : ''}</b>
          </span>
        )}
        {p.retiring && !p.farewell && (
          <span className="chip" style={{ borderColor: '#a12f2f' }} title="He has announced this season is his last">
            🎤 <b>Retiring in the summer</b>
          </span>
        )}
        {(game.pledges ?? []).some(pl => pl.playerId === p.id) && !(game.preContracts ?? []).some(x => x.playerId === p.id) && (
          <span className="chip" style={{ borderColor: 'var(--gold)' }} title="You made him a promise in the office - keep it or wear it">
            🤝 <b>Promise made</b>
          </span>
        )}
        {(() => {
          const pc = (game.preContracts ?? []).find(x => x.playerId === p.id)
          if (!pc) return null
          const to = game.clubs[pc.toClubId]
          const incoming = pc.toClubId === game.userClubId
          return (
            <span className="chip" style={{ borderColor: incoming ? 'var(--gold-bright)' : '#a12f2f' }}>
              🖊 <b>Pre-contract: {to?.short ?? '?'}</b>
            </span>
          )
        })()}
      </div>

      {(p.career.length > 0 || (p.hist?.apps ?? 0) > 0) && (
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
              {(p.hist?.apps ?? 0) > 0 && (
                <tr className="muted">
                  <td>pre 2025</td>
                  <td>{p.exClub && game.clubs[p.exClub] ? `incl. ${game.clubs[p.exClub].short} (${p.exApps})` : 'earlier career'}</td>
                  <td className="num">{p.hist!.apps}</td>
                  <td className="num">{p.hist!.tries}</td>
                  <td className="num">{p.hist!.points}</td>
                </tr>
              )}
              <tr style={{ fontWeight: 700 }}>
                <td>TOTAL</td>
                <td className="muted">incl. this season</td>
                <td className="num">{p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)}</td>
                <td className="num">{p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)}</td>
              </tr>
            </tbody>
          </table></div>
        </>
      )}

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>
        {msg}
        {counter != null && (
          <button className="btn gold" style={{ marginTop: 8, width: '100%' }} onClick={() => {
            const r = agreeFee(game, p.id, counter)
            setMsg(r.msg); setCounter(r.counter ?? null)
            if (r.ok) { setTermsFee(counter); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
            touch()
          }}>Meet their price ({fmtMoney(counter)})</button>
        )}
      </div>}

      {termsFee != null && (
        <div className="card" style={{ borderLeft: '4px solid var(--gold-bright)' }}>
          <h3 style={{ fontSize: 15 }}>✍️ Personal terms - fee agreed at {fmtMoney(termsFee)}</h3>
          <div className="meta" style={{ margin: '4px 0' }}>His camp opens at <b>£{personalTermsDemand(game, p).toLocaleString()}/wk</b>. A signing bonus or a first-team promise softens the wage.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span className="fact-label" style={{ width: 84 }}>Wage /wk</span>
            <button className="btn ghost" onClick={() => { setWage(Math.max(500, wage - 500)) }}>−</button>
            <b style={{ minWidth: 76, textAlign: 'center' }}>£{wage.toLocaleString()}</b>
            <button className="btn ghost" onClick={() => { setWage(wage + 500) }}>+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <span className="fact-label" style={{ width: 84 }}>Sign-on</span>
            <button className="btn ghost" onClick={() => { setSignOn(Math.max(0, signOn - 25_000)) }}>−</button>
            <b style={{ minWidth: 76, textAlign: 'center' }}>{fmtMoney(signOn)}</b>
            <button className="btn ghost" onClick={() => { setSignOn(signOn + 25_000) }}>+</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
            <input type="checkbox" checked={promiseMin} onChange={e => setPromiseMin(e.target.checked)} />
            Promise first-team rugby (a real pledge - he will hold you to it)
          </label>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => { setTermsFee(null); setMsg('You walk away from the table. The fee agreement lapses.') }}>Walk away</button>
            <button className="btn gold" style={{ flex: 1.6 }} onClick={() => {
              const r = signOnTerms(game, p.id, termsFee, wage, signOn, promiseMin)
              setMsg(r.msg)
              if (r.ok) setTermsFee(null)
              touch()
            }}>✍️ Agree terms</button>
          </div>
        </div>
      )}

      {mine && !p.onLoan && p.age <= 23 && !game.clubs[game.userClubId].tactic.lineup.slice(0, 15).includes(p.id) && (
        <button className="btn ghost block" onClick={() => {
          p.onLoan = true
          game.news.push({
            id: game.nextId++, week: game.week, season: game.season, type: 'youth', read: true,
            subject: `${p.name} heads out on loan`,
            body: `${p.name} joins a feeder club for the rest of the season. Regular first-team rugby should accelerate his development - expect him back sharper next summer.`,
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
            body: `A big day at the training ground: ${p.name} (${p.age}) has been called up from the academy to full first-team duty. The academy coach shakes his hand at the door - his work here is done.`,
            playerId: p.id,
          })
          setMsg(`${p.name} joins first-team training. He'll never forget today.`)
          touch()
        }}>🎓 Promote to First Team</button>
      )}
      {mine && !p.acad && (() => {
        const club = game.clubs[game.userClubId]
        const marquee = club.marquee ?? []
        const isMarquee = marquee.includes(p.id)
        if (!isMarquee && marquee.length >= 2) return null
        return (
          <button className={`btn ${isMarquee ? '' : 'ghost'} block`} onClick={() => {
            club.marquee = isMarquee ? marquee.filter(id => id !== p.id) : [...marquee, p.id]
            setMsg(isMarquee
              ? `${p.name} loses marquee status - his wage counts against the cap again.`
              : `${p.name} designated a marquee player: his wage now sits outside the salary cap (${2 - marquee.length - 1} slot${2 - marquee.length - 1 === 1 ? '' : 's'} left).`)
            touch()
          }}>
            {isMarquee ? '⭐ Marquee Player - tap to remove' : `⭐ Designate Marquee (${2 - marquee.length} slot${2 - marquee.length === 1 ? '' : 's'} free)`}
          </button>
        )
      })()}
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
            {shortlisted ? '★ On Shortlist - scouts filing reports' : '☆ Shortlist & Scout'}
          </button>
          {!bidding
            ? <>
              {p.contractEnds <= game.season && game.week >= 25 && !(game.preContracts ?? []).some(x => x.playerId === p.id) && (
                <button className="btn gold block" onClick={() => {
                  setMsg(agreePreContract(game, p.id).msg); touch()
                }}>
                  🖊 Agree pre-contract - free this summer
                </button>
              )}
              <button className="btn gold block" onClick={() => {
                const r = agreeFee(game, p.id, ask)
                setMsg(r.msg); setCounter(r.counter ?? null)
                if (r.ok) { setTermsFee(ask); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
                touch()
              }}>
                ⚡ Offer asking price ({fmtMoney(ask)})
              </button>
              <button className="btn ghost block" style={{ marginTop: 4 }} onClick={() => { setBidding(true); setBid(ask) }}>
                Haggle a different fee…
              </button>
            </>
            : (
              <div className="card">
                <h3 style={{ fontSize: 15 }}>Your offer to {club.short}</h3>
                <div className="meta">Asking price {fmtMoney(ask)} · your budget {fmtMoney(game.clubs[game.userClubId].budget)}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0' }}>
                  <button className="btn ghost" onClick={() => setBid(Math.max(100_000, bid - 500_000))}>−500k</button>
                  <button className="btn ghost" onClick={() => setBid(Math.max(100_000, bid - 100_000))}>−100k</button>
                  <b style={{ minWidth: 88, textAlign: 'center', fontSize: 16 }}>{fmtMoney(bid)}</b>
                  <button className="btn ghost" onClick={() => setBid(bid + 100_000)}>+100k</button>
                  <button className="btn ghost" onClick={() => setBid(bid + 500_000)}>+500k</button>
                </div>
                <div className="btn-row">
                  <button className="btn ghost" onClick={() => setBidding(false)}>Cancel</button>
                  <button className="btn gold" style={{ flex: 1.6 }} onClick={() => {
                    const r = agreeFee(game, p.id, bid)
                    setMsg(r.msg); setCounter(r.counter ?? null); setBidding(false)
                    if (r.ok) { setTermsFee(bid); setWage(personalTermsDemand(game, p)); setSignOn(0); setPromiseMin(false) }
                    touch()
                  }}>Submit Bid</button>
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
  return m >= 8.5 ? 'Superb' : m >= 7.5 ? 'Very Good' : m >= 6 ? 'Good'
    : m >= 5 ? 'Fair' : m >= 3.5 ? 'Poor' : 'Very Poor'
}
