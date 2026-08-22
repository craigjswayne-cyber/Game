import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, fmtWage, POS_NAMES, POS_ORDER, weekDate, type Pos } from '../../game/model'
import { counterIncomingOffer, renewalDemand, respondToOffer } from '../../game/ai'
import { loanIn, loanTargets } from '../../game/loans'
import { fuzzedCa, knowledge } from '../../game/scout'
import { commissionScout, searchFee, type SearchMonths } from '../../game/commission'
import { BADGE } from '../../game/staff'
import { FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'

export default function Transfers() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [pos, setPos] = useState<Pos | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [maxVal, setMaxVal] = useState(0)
  const [maxAge, setMaxAge] = useState(0)
  const [league, setLeague] = useState('ALL')
  const [listedOnly, setListedOnly] = useState(false)
  const [msort, setMsort] = useState<'ca' | 'value' | 'age' | 'name' | 'form'>('ca')
  const [mdesc, setMdesc] = useState(false)
  // KEYED TO THE ROW, not to the page. Same class of bug as the coach market:
  // a banner above the tab bar answers a Sign on loan tapped eleven rows down,
  // where the manager never sees it.
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null)
  const [xtab, setXtab] = useState<'market' | 'shortlist' | 'loans' | 'deals'>('market')
  const [page, setPage] = useState(0)
  const PER_PAGE = 10

  const user = game.clubs[game.userClubId]
  const offers = game.offers.filter(o => o.status === 'pending' && o.forUser)

  const MTh = ({ k, children, right }: { k: typeof msort; children: React.ReactNode; right?: boolean }) => (
    <th className={`th-sort${msort === k ? ' active' : ''}${right ? ' num' : ''}`}
      onClick={() => (msort === k ? setMdesc(!mdesc) : (setMsort(k), setMdesc(false)))}>
      {children}{msort === k ? (mdesc ? ' ▴' : ' ▾') : ''}
    </th>
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = Object.values(game.players).filter(p => p.clubId !== game.userClubId)
    if (pos !== 'ALL') list = list.filter(p => p.pos === pos || p.alt.includes(pos))
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.clubId ? game.clubs[p.clubId]?.short.toLowerCase().includes(q) : false))
    if (maxVal > 0) list = list.filter(p => p.value <= maxVal)
    if (maxAge > 0) list = list.filter(p => p.age <= maxAge)
    if (league === 'FA') list = list.filter(p => !p.clubId)
    else if (league !== 'ALL') list = list.filter(p => p.clubId && game.clubs[p.clubId]?.leagueId === league)
    if (listedOnly) list = list.filter(p => p.transferListed)
    const dir = mdesc ? -1 : 1
    list.sort((a, b) => {
      switch (msort) {
        case 'value': return (b.value - a.value) * dir
        case 'age': return (a.age - b.age) * dir
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'form': return (b.form - a.form) * dir
        default: return (b.ca - a.ca) * dir
      }
    })
    return list.slice(0, 120)
  }, [game.players, game.clubs, pos, query, maxVal, maxAge, league, listedOnly, msort, mdesc, game.week])
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE))
  const pageSafe = Math.min(page, pages - 1)
  const pageRows = results.slice(pageSafe * PER_PAGE, (pageSafe + 1) * PER_PAGE)

  return (
    <>
      <div className="chips" style={{
        position: 'sticky', top: 0, zIndex: 5, margin: 0, padding: '10px 14px 8px',
        background: 'color-mix(in srgb, var(--canvas) 92%, transparent)', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span className="chip">💰 Budget <b>{fmtMoney(user.budget)}</b></span>
        <span className="chip">Wage room <b>{fmtMoney(Math.max(0, user.wageBudget - user.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)))}/wk</b></span>
        <span className="chip" style={{
          color: (game.week <= 7 || game.week === 26 || game.week === 27) ? 'var(--text-positive)' : 'var(--text-muted)',
          fontWeight: 700,
        }}>
          {game.week <= 7 ? `Window open · closes wk 8`
            : game.week === 26 || game.week === 27 ? `⏰ Deadline window · slams shut wk 28`
            : `Window closed · deadline wk 26`}
        </span>
      </div>

      <div className="tab-bar">
        <button className={xtab === 'market' ? 'active' : ''} onClick={() => setXtab('market')}>Market</button>
        <button className={xtab === 'shortlist' ? 'active' : ''} onClick={() => setXtab('shortlist')}>Shortlist</button>
        <button className={xtab === 'loans' ? 'active' : ''} onClick={() => setXtab('loans')}>Loans</button>
        <button className={xtab === 'deals' ? 'active' : ''} onClick={() => setXtab('deals')}>Deals</button>
      </div>

      {xtab === 'deals' && (() => {
        const committed = new Set((game.preContracts ?? []).map(pc => pc.playerId))
        const expiring = user.players
          .map(id => game.players[id])
          .filter(Boolean)
          .filter(p => p.contractEnds <= game.season || (p.wantsDeal ?? 0) > 0)
          .sort((a, b) => b.ca - a.ca)
        const incoming = (game.preContracts ?? [])
          .filter(pc => pc.toClubId === game.userClubId)
          .map(pc => game.players[pc.playerId])
          .filter(Boolean)
        return (
          <>
            <SectionTitle sub="deals running down and demands on the table">Contract Situations</SectionTitle>
            {expiring.length === 0 && (
              <div className="muted" style={{ padding: 14 }}>
                Nothing urgent. Every contract runs beyond this season and nobody is agitating for improved terms.
              </div>
            )}
            {expiring.map(p => {
              const gazumped = committed.has(p.id)
              const demand = renewalDemand(p)
              return (
                <div key={p.id} className="row-item" onClick={() => go('player', p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <PosBadge pos={p.pos} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {p.age} yrs · on {fmtWage(p.wage)}, asks {fmtWage(demand)} /wk · morale {p.morale.toFixed(0)}/10
                    </div>
                  </div>
                  {p.retiring
                    ? <span className="chip" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontWeight: 700 }}>retiring</span>
                    : gazumped
                    ? <span className="chip" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontWeight: 700 }}>signed elsewhere</span>
                    : (p.wantsDeal ?? 0) > 0
                      ? <span className="chip" style={{ borderColor: 'var(--gold)', fontWeight: 700 }}>wants a deal</span>
                      : <span className="chip" style={{ fontWeight: 700 }}>expiring</span>}
                </div>
              )
            })}
            {expiring.length > 0 && (
              <div className="muted" style={{ padding: '8px 14px', fontSize: 12 }}>
                Tap a player to renew from his page. From week 25 an unrenewed man can sign a
                pre-contract elsewhere and walk for nothing in the summer.
              </div>
            )}
            {incoming.length > 0 && (
              <>
                <SectionTitle sub="pre-contracts agreed - they arrive when the season ends">Arriving In Summer</SectionTitle>
                {incoming.map(p => (
                  <div key={p.id} className="row-item" onClick={() => go('player', p.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <PosBadge pos={p.pos} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.age} yrs · from {p.clubId ? game.clubs[p.clubId]?.short ?? '?' : 'free agency'} · on a free
                      </div>
                    </div>
                    <span className="chip" style={{ borderColor: 'var(--gold)', fontWeight: 700 }}>🖊 agreed</span>
                  </div>
                ))}
              </>
            )}
          </>
        )
      })()}

      {xtab === 'shortlist' && <>
      <ScoutCommission />
      <div className="card">
        <div className="fact-label">Scouting Assignment</div>
        <div className="meta" style={{ marginBottom: 6 }}>
          Point the network at one league - its players get watched every week
          {game.scoutFocus ? '' : ' (currently unassigned)'}. Shortlisted men are always tracked, with alerts when their situation changes.
        </div>
        <div className="chips" style={{ padding: 0 }}>
          {Object.values(game.comps).filter(c => c.type === 'league').map(c => (
            <button key={c.id} className="chip" onClick={() => { game.scoutFocus = game.scoutFocus === c.id ? null : c.id; touch() }}
              style={game.scoutFocus === c.id ? { borderColor: 'var(--gold)', color: 'var(--info)', fontWeight: 700 } : undefined}>
              {game.scoutFocus === c.id ? '🔭 ' : ''}{c.short}
            </button>
          ))}
        </div>
      </div>

      </>}

      {xtab === 'market' && offers.length > 0 && (
        <>
          <SectionTitle>Offers For Your Players</SectionTitle>
          {offers.map(o => {
            const p = game.players[o.playerId]
            const bidder = game.clubs[o.fromClubId]
            if (!p || !bidder) return null
            return (
              <div className="card" key={o.id}>
                <h3>{bidder.name} bid {fmtMoney(o.fee)} for {p.name}</h3>
                <div className="meta">
                  Value {fmtMoney(p.value)} · {p.age} yrs · morale {p.morale.toFixed(0)}/10
                  {[7, 26, 27].includes(game.week) && <b style={{ color: 'var(--danger)' }}> · 🚨 dies at the deadline</b>}
                </div>
                <div className="btn-row" style={{ margin: '10px 0 0' }}>
                  <button className="btn gold" onClick={() => { setMsg({ key: `offer:${o.id}`, text: respondToOffer(game, o.id, true) }); touch() }}>Accept</button>
                  <button className="btn" onClick={() => { setMsg({ key: `offer:${o.id}`, text: counterIncomingOffer(game, o.id) }); touch() }}>Demand More</button>
                  <button className="btn danger" onClick={() => { setMsg({ key: `offer:${o.id}`, text: respondToOffer(game, o.id, false) }); touch() }}>Reject</button>
                </div>
                {msg?.key === `offer:${o.id}` && (
                  <div className="meta" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 6 }}>{msg.text}</div>
                )}
              </div>
            )
          })}
        </>
      )}

      {xtab === 'shortlist' && game.shortlist.length > 0 && (
        <>
          <SectionTitle sub="scouts filing weekly reports">Shortlist</SectionTitle>
          <div className="tblwrap"><table className="dtable"><tbody>
            {game.shortlist.map(id => game.players[id]).filter(Boolean).map(p => (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">{p.name}</td>
                <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : 'Free agent'}</td>
                <td><Stars ca={fuzzedCa(game, p)} /></td>
                <td className="num" style={{ color: knowledge(game, p) >= 95 ? 'var(--text-positive)' : undefined }}>
                  {Math.round(knowledge(game, p))}%
                </td>
              </tr>
            ))}
          </tbody></table></div>
        </>
      )}

      {xtab === 'loans' && <>
      <SectionTitle sub="borrow a star, parent pays half the wage">Loan Market</SectionTitle>
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
                onClick={() => { setMsg({ key: `loan:${p.id}`, text: loanIn(game, p.id) }); touch() }}>
                Sign on loan
              </button>
              {msg?.key === `loan:${p.id}` && (
                <div className="meta" style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'normal' }}>{msg.text}</div>
              )}
            </td>
          </tr>
        ))}
        {loanTargets(game).length === 0 && (
          <tr><td className="muted" style={{ padding: 12 }}>No clubs above you are loaning right now.</td></tr>
        )}
      </tbody></table></div>

      </>}
      {xtab === 'market' && <>
      {/* "120 found (best 120)" said the cap twice and paid for it in width:
          the device matrix clipped "tap to bid" clean off at 360px. Once. */}
      <SectionTitle sub={`${results.length === 120 ? 'best 120' : results.length} found · tap to bid`}>Scout The Market</SectionTitle>
      {/* ---- six filters, two tidy rows, nothing bigger than it needs to be ----
          These controls were three different sizes: a flex-grow search box, a
          116px select whose label "All positions" did not fit inside it, and
          four equal-flex controls below. Different heights and a clipped label
          read as boxes overlapping each other (user: "the filters below scout
          the market are to big in box size that they overlap"). Both rows are
          .filter-line now, so every control is the same height and divides its
          row equally, and every resting label is the filter's own name - short
          enough to fit, and it reads as a placeholder, which is what an unset
          filter is. */}
      <div className="filter-line">
        <input className="inline-input" placeholder="Name or club…" value={query}
          onChange={e => { setQuery(e.target.value); setPage(0) }}
          style={{ flex: '2 1 0' }} />
        <select className="inline-input" value={pos} onChange={e => { setPos(e.target.value as Pos | 'ALL'); setPage(0) }}>
          <option value="ALL">Position</option>
          {POS_ORDER.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="filter-line">
        <select className="inline-input" value={maxVal} onChange={e => { setMaxVal(Number(e.target.value)); setPage(0) }}>
          <option value={0}>Value</option>
          <option value={250000}>to £250k</option>
          <option value={1000000}>to £1m</option>
          <option value={3000000}>to £3m</option>
          <option value={8000000}>to £8m</option>
        </select>
        <select className="inline-input" value={maxAge} onChange={e => { setMaxAge(Number(e.target.value)); setPage(0) }}>
          <option value={0}>Age</option>
          <option value={21}>21 or under</option>
          <option value={24}>24 or under</option>
          <option value={28}>28 or under</option>
          <option value={32}>32 or under</option>
        </select>
        <select className="inline-input" value={league} onChange={e => { setLeague(e.target.value); setPage(0) }}>
          <option value="ALL">League</option>
          {/* a free agent's league is nowhere, which makes this the natural
              place to find him (user: "you should be able to search for free
              agents on the transfer centre") */}
          <option value="FA">Free agents</option>
          {Object.values(game.comps).filter(c => c.type === 'league').map(c => (
            <option key={c.id} value={c.id}>{c.short}</option>
          ))}
        </select>
        <button className="preset-chip" style={listedOnly ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          onClick={() => { setListedOnly(!listedOnly); setPage(0) }}>🏷️ Listed</button>
      </div>
      <div className="tblwrap"><table className="dtable">
        <thead><tr>
          <th>Pos</th>
          <MTh k="name">Name</MTh>
          <MTh k="age" right>Age</MTh>
          <th>Nat</th>
          <th>Club</th>
          <MTh k="ca">Ability</MTh>
          <MTh k="form" right>Form</MTh>
          <MTh k="value" right>Value</MTh>
        </tr></thead>
        <tbody>
          {pageRows.length === 0 && (
            <tr><td colSpan={8} className="muted" style={{ padding: 12 }}>
              Nobody in the world matches that. Widen a filter{listedOnly ? ' - clubs list players as the window nears, so try again later' : ''}.
            </td></tr>
          )}
          {pageRows.map(p => (
            <tr key={p.id} onClick={() => go('player', p.id)}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name}{p.transferListed ? ' 🏷️' : ''}</td>
              <td className="num">{p.age}</td>
              <td><Nat code={p.nat} /></td>
              <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : 'Free agent'}</td>
              <td><Stars ca={fuzzedCa(game, p)} />{knowledge(game, p) < 95 && <span className="muted">?</span>}</td>
              <td className="num"><FormPill v={p.form} /></td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>‹ Prev</button>
          <span className="meta" style={{ fontFamily: 'var(--cond)', fontWeight: 700, letterSpacing: 1 }}>
            PAGE {pageSafe + 1}/{pages}
          </span>
          <button className="btn ghost" disabled={pageSafe >= pages - 1} onClick={() => setPage(pageSafe + 1)}>Next ›</button>
        </div>
      )}
      </>}
      <div className="spacer" />
    </>
  )
}

/**
 * Commissioned scouting (8-batch feedback): send the chief scout out for 3, 6
 * or 9 months and read what he brings back. The report is deliberately mixed -
 * his verdict on each man is the point, not a list of ready-made signings.
 */
function ScoutCommission() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const go = useStore(s => s.go)
  const [pos, setPos] = useState<Pos | 'any'>('any')
  const [msg, setMsg] = useState('')
  const abs = game.season * 100 + game.week
  const man = game.staffPeople?.scout
  const tier = game.staff.scout ?? 0
  const out = game.commission
  const weeksLeft = out ? Math.max(1, out.done - abs) : 0
  const finds = game.scoutFinds ?? []
  return (
    <>
      <SectionTitle sub={man ? `${man.name} · ${BADGE[tier].toLowerCase()} badge` : 'no chief scout appointed'}>Commissioned Search</SectionTitle>
      <div className="card">
        {!man && (
          <div className="meta">
            You have nobody to send. Appoint a chief scout in Training &amp; Coaching, then brief him on a 3, 6 or 9-month search.
          </div>
        )}
        {man && out && (
          <div className="meta">
            🔭 <b>{man.name} is on the road</b> - a {out.months}-month brief
            {out.pos !== 'any' ? ` for a ${POS_NAMES[out.pos].toLowerCase()}` : ' for anyone who can play'}
            {out.leagueId ? ` in the ${game.comps[out.leagueId]?.short ?? 'focus league'}` : ''}.
            He reports back in about {weeksLeft} week{weeksLeft === 1 ? '' : 's'}.
          </div>
        )}
        {man && !out && (
          <>
            <div className="meta" style={{ marginBottom: 6 }}>
              A longer trip sees more rugby: more names, and more of them worth signing. He watches
              {game.scoutFocus ? ` the ${game.comps[game.scoutFocus]?.short ?? 'focus league'}` : ' the whole world'} - set the focus league below to narrow it.
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="inline-input" style={{ margin: 0, flex: '0 1 140px' }} value={pos}
                onChange={e => setPos(e.target.value as Pos | 'any')}>
                <option value="any">Any position</option>
                {POS_ORDER.map(p => <option key={p} value={p}>{POS_NAMES[p]}</option>)}
              </select>
              {([3, 6, 9] as SearchMonths[]).map(m => (
                <button key={m} className="btn gold" style={{ padding: '5px 10px', fontSize: 11.5, lineHeight: 1.25 }}
                  onClick={() => { setMsg(commissionScout(game, pos, m)); touch() }}>
                  {m} months<br />
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{fmtMoney(searchFee(m, Math.max(1, tier)))}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {msg && <div className="meta" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 700 }}>{msg}</div>}
      </div>

      {finds.length > 0 && (
        <>
          <SectionTitle sub="his verdict, in his words - tap a name for the full profile">The Scout's Report</SectionTitle>
          <div className="tblwrap"><table className="dtable"><tbody>
            {finds.map(f => {
              const p = game.players[f.playerId]
              if (!p) return null
              const col = f.grade >= 3 ? 'var(--text-positive)' : f.grade === 2 ? 'var(--text-secondary)' : f.grade === 1 ? 'var(--border-strong)' : 'var(--text-negative)'
              return (
                <tr key={f.playerId} onClick={() => go('player', f.playerId)}>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="name">
                    {p.name}
                    <span className="muted" style={{ fontWeight: 400 }}> {p.age} · {p.clubId ? game.clubs[p.clubId]?.short : 'free'}</span>
                    <div className="meta" style={{ fontSize: 11 }}>{f.note}</div>
                  </td>
                  <td><Stars ca={fuzzedCa(game, p)} /></td>
                  <td className="num" style={{ color: col, fontWeight: 700, fontSize: 11 }}>{'★'.repeat(f.grade + 1)}</td>
                  <td>
                    <button className="btn ghost" style={{ fontSize: 11, padding: '4px 9px' }}
                      onClick={e => { e.stopPropagation(); useStore.getState().toggleShortlist(f.playerId) }}>
                      {game.shortlist.includes(f.playerId) ? '✓ Listed' : '+ Shortlist'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody></table></div>
        </>
      )}

      <ScoutReports />
    </>
  )
}

/** Everything the department has ever written home, in one pile.
 *
 *  The postcards and reports land in the inbox and then age off its five-day
 *  shelf, which left the manager asking a fair question (user: "when you hit
 *  scout on a player ... where do those reports go? They should appear in news
 *  and a section called scout reports"). They still arrive as news; this is the
 *  filing cabinet copy, read straight off the same list by its scout tag, so
 *  nothing here can drift from what the inbox said. */
function ScoutReports() {
  const game = useStore(s => s.game)!
  const [openId, setOpenId] = useState<number | null>(null)
  const reports = [...game.news].filter(n => n.tag === 'scout').sort((a, b) => b.id - a.id).slice(0, 10)
  if (!reports.length) return null
  return (
    <>
      <SectionTitle sub="every postcard and report the department has filed - tap one to read it again">Scout Reports</SectionTitle>
      <div className="card" style={{ padding: '2px 10px' }}>
        {reports.map((n, i) => (
          <div key={n.id} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : undefined }}
            onClick={() => setOpenId(openId === n.id ? null : n.id)}>
            <div className="meta" style={{ fontSize: 10.5 }}>{weekDate(n.season, n.week)}</div>
            <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>{n.subject}</div>
            {openId === n.id && (
              <div className="meta" style={{ whiteSpace: 'pre-line', fontSize: 11.5, marginTop: 3 }}>{n.body}</div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
