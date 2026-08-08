import { useState } from 'react'
import { useStore } from '../../store'
import { boardObjective, facLevel, fmtMoney, operatingCost, weeklyCentral } from '../../game/model'
import { staffWageBill } from '../../game/staff'
import { OBJECTIVE_DEFS } from '../../game/objectives'
import { MARQUEE_SLOTS, capPosition, capWord, rosterGrid, rosterWarnings } from '../../game/cap'
import { SectionTitle } from '../components'

export default function Finances() {
  // two pages rather than one long scroll
  const [ftab, setFtab] = useState<'money' | 'cap' | 'board'>('money')
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [askMsg, setAskMsg] = useState<string | null>(null)
  const club = game.clubs[game.userClubId]
  const askedKey = `asked-${game.season}`
  const asked = (game as unknown as Record<string, unknown>)[askedKey] === true

  const requestFunds = () => {
    if (asked) return
    ;(game as unknown as Record<string, boolean>)[askedKey] = true
    const tenure = game.mgr.finishes.filter(x => x.leagueId === club.leagueId).length
    // boards say yes when they owe you (objectives delivered), when they
    // adore you, or when you've built something over the long haul
    const approved = game.boardOwed || club.boardConfidence >= 82 || (tenure >= 3 && club.boardConfidence >= 68)
    if (approved) {
      const extra = Math.round((club.budget * 0.25 + 400_000) / 50_000) * 50_000
      club.budget += extra
      setAskMsg(game.boardOwed
        ? `The chairman remembers what you delivered. ${fmtMoney(extra)} added - the favour is spent.`
        : `The board backs you: ${fmtMoney(extra)} added to the transfer budget.`)
      game.boardOwed = false
    } else {
      club.boardConfidence = Math.max(0, club.boardConfidence - 3)
      setAskMsg(club.boardConfidence >= 60
        ? 'The board politely declines: "Deliver our objectives first, then we\'ll talk." Meet season objectives to earn a favour.'
        : 'The board politely declines. Earn their confidence first.')
    }
    touch()
  }
  const wages = club.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)
  const gate = game.fixtures.filter(f => f.played && f.homeId === club.id && f.att)
  const avgAtt = gate.length ? Math.round(gate.reduce((s, f) => s + (f.att ?? 0), 0) / gate.length) : 0
  const topEarners = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => b.wage - a.wage).slice(0, 10)

  return (
    <>
      <div className="tab-bar">
        <button className={ftab === 'money' ? 'active' : ''} onClick={() => setFtab('money')}>Finances</button>
        <button className={ftab === 'cap' ? 'active' : ''} onClick={() => setFtab('cap')}>Cap & Squad</button>
        <button className={ftab === 'board' ? 'active' : ''} onClick={() => setFtab('board')}>The Board</button>
      </div>
      {/* the ledger and the graph sit side by side in landscape: two chip
          blocks under a full-width chart was a screenful before the table.
          The chips label themselves, so the Matchday heading was only height. */}
      <div className="fin-head">
        <div className="chips">
          <span className="chip">Balance <b style={{ color: club.balance < 0 ? '#9b2c2c' : '#2f7d4f' }}>{fmtMoney(club.balance)}</b></span>
          <span className="chip">Transfer budget <b>{fmtMoney(club.budget)}</b></span>
          <span className="chip">Wage bill <b>{fmtMoney(wages)}/wk</b></span>
          <span className="chip">Wage budget <b>{fmtMoney(club.wageBudget)}/wk</b></span>
          {ftab === 'money' && <>
            <span className="chip">{club.stadium} <b>{club.capacity.toLocaleString()}</b></span>
            <span className="chip">Avg attendance <b>{avgAtt ? avgAtt.toLocaleString() : '-'}</b></span>
            <span className="chip">Est. gate/game <b>{avgAtt ? fmtMoney(avgAtt * 30) : '-'}</b></span>
            <span className="chip">Weekly commercial <b>{fmtMoney(weeklyCentral(club))}</b></span>
            {/* the ground and the estate cost money every week of the year, and
                a cost the manager cannot see reads to him as a bug */}
            <span className="chip">Ground + estate upkeep <b>{fmtMoney(operatingCost(game))}/wk</b></span>
          </>}
        </div>
        {(game.finHist?.length ?? 0) >= 2 && <div className="fin-chart"><BalanceChart hist={game.finHist!} /></div>}
      </div>
      {ftab === 'money' && <>
      {/* ---- where the money actually goes ----
          The chips above are a set of true numbers that never added up to
          anything (user: "make it more clear what the balance etc is being spent
          on"). Every line below is read from the same functions the weekly
          settlement uses - see weeklyFinance in season.ts - so the bottom line
          here is the number that will hit the balance on Continue, not an
          estimate of it. */}
      <SectionTitle sub="what lands in the account every week">The Weekly Ledger</SectionTitle>
      <div className="card">
        {(() => {
          const staff = staffWageBill(game)
          const upkeep = operatingCost(game)
          const commercial = weeklyCentral(club)
          const shopLvl = facLevel(game, 'shop')
          const shop = shopLvl > 0 ? Math.round(shopLvl * 9_000 * (0.6 + (game.fanMood ?? 60) / 100)) : 0
          // a home gate arrives every third week or so, so it is shown as one
          // and labelled as one rather than smeared across the average
          const homeGate = avgAtt ? Math.round(avgAtt * 30) : 0
          const net = commercial + shop - wages - staff - upkeep
          const line = (label: string, amount: number, note?: string) => (
            <div className="ledger-row" key={label}>
              <span className="lg-what">{label}{note ? <span className="muted"> {note}</span> : null}</span>
              <span className="lg-amt" style={{ color: amount >= 0 ? 'var(--ink-good)' : 'var(--ink-bad)' }}>
                {amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(amount))}
              </span>
            </div>
          )
          return (
            <>
              {line('Sponsorship, broadcast and central funds', commercial)}
              {shop > 0 && line('Club shop', shop, `level ${shopLvl}`)}
              {line('Player wages', -wages, `${club.players.length} men`)}
              {line('Backroom staff', -staff)}
              {line('Ground and estate upkeep', -upkeep)}
              <div className="ledger-row total">
                <span className="lg-what">Every week, before gate receipts</span>
                <span className="lg-amt" style={{ color: net >= 0 ? 'var(--ink-good)' : 'var(--ink-bad)' }}>
                  {net >= 0 ? '+' : '−'}{fmtMoney(Math.abs(net))}
                </span>
              </div>
              <div className="meta" style={{ marginTop: 6 }}>
                {homeGate > 0
                  ? `A home match adds about ${fmtMoney(homeGate)} on the gate, and you have one roughly every third week.`
                  : 'Gate receipts land on the weeks you play at home, at £30 a head.'}
                {' '}{net >= 0
                  ? 'The club pays its way as things stand.'
                  : 'The club loses money on a blank week, so the gate and player sales have to cover the gap.'}
              </div>
            </>
          )
        })()}
      </div>
      <SectionTitle>Top Earners</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Name</th><th className="num">Wage</th><th className="num">Until</th><th className="num">Value</th></tr></thead>
        <tbody>
          {topEarners.map(p => (
            <tr key={p.id}>
              <td className="name">{p.name}</td>
              <td className="num">{fmtMoney(p.wage)}/wk</td>
              <td className="num">{2026 + p.contractEnds}</td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {askMsg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>{askMsg}</div>}
      <button className="btn ghost block" disabled={asked} onClick={requestFunds}>
        {asked ? 'Budget request made this season' : '💰 Ask the board for transfer funds'}
      </button>
      </>}
      {ftab === 'cap' && (() => {
        const pos = capPosition(game, club.id)
        const grid = rosterGrid(game, club.id)
        const warn = rosterWarnings(game, club.id)
        const marquee = pos.marquee.map(id => game.players[id]).filter(Boolean)
        return (
          <>
            <SectionTitle sub="Your division's ceiling, and the room left">
              Salary Cap
            </SectionTitle>
            <div className="card">
              {pos.cap == null ? (
                <div className="meta">This division does not run a salary cap. Your wage budget is the only ceiling.</div>
              ) : (
                <>
                  <div className="cap-line">
                    <b>{fmtMoney(pos.bill)}/wk</b>
                    <span className="meta"> of {fmtMoney(pos.cap)}/wk</span>
                  </div>
                  <div className="cap-bar">
                    <div className={`cap-fill${pos.over ? ' over' : pos.used > 0.9 ? ' tight' : ''}`}
                      style={{ width: `${Math.min(100, Math.round(pos.used * 100))}%` }} />
                    <div className="cap-mark" />
                  </div>
                  <div className="meta" style={{ marginTop: 6 }}>{capWord(pos)}</div>
                  {pos.embargo > 0 && (
                    <div className="meta" style={{ marginTop: 6, color: '#a12f2f', fontWeight: 700 }}>
                      No signings until the embargo is served.
                    </div>
                  )}
                </>
              )}
            </div>
            <SectionTitle sub={`${MARQUEE_SLOTS} men can sit outside the cap. Academy players never count`}>
              Marquee Players
            </SectionTitle>
            <div className="card">
              {marquee.length === 0
                ? <div className="meta">No marquee players named. Open a player and use the marquee button to take his wage out of the calculation.</div>
                : marquee.map(p => (
                  <div key={p.id} className="ledger-row">
                    <span>{p.name}</span>
                    <span className="num">{fmtMoney(p.wage)}/wk</span>
                  </div>
                ))}
            </div>
            <SectionTitle sub="Under contract, by unit, four seasons out">
              Squad Cover
            </SectionTitle>
            <div className="tblwrap fitwrap"><table className="dtable fit">
              <colgroup><col style={{ width: '34%' }} />{grid.seasons.map(sn => <col key={sn} />)}</colgroup>
              <thead><tr><th>Unit</th>{grid.seasons.map(sn => <th key={sn} className="num">{2026 + sn}</th>)}</tr></thead>
              <tbody>
                {grid.rows.map(row => (
                  <tr key={row.label}>
                    <td className="name">{row.label}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="num" style={{
                        fontWeight: cell.count < cell.need ? 700 : 400,
                        color: cell.count < cell.need ? '#a12f2f' : cell.count === cell.need ? '#a8841a' : undefined,
                      }}>{cell.count}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="card">
              {warn.length === 0
                ? <div className="meta">Every unit is covered for the next three summers.</div>
                : <>
                  <div className="meta" style={{ fontWeight: 700, marginBottom: 4 }}>Holes to fill</div>
                  {warn.map(w => <div key={w} className="meta">{w}</div>)}
                </>}
            </div>
          </>
        )
      })()}
      {ftab === 'board' && <>
      <SectionTitle>Season Objectives</SectionTitle>
      <div className="card" style={{ marginTop: 6 }}>
        <h3 style={{ fontSize: 15 }}>The board expects you to {boardObjective(club.rep).text}.</h3>
        <div className="meta">Fall short and confidence will suffer. Deliver, and you'll be backed.</div>
        {(game.objectives ?? []).map(id => {
          const def = OBJECTIVE_DEFS.find(o => o.id === id)
          if (!def || !def.applies(game)) return null
          const ok = def.met(game)
          return (
            <div key={id} style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12.5, alignItems: 'flex-start' }}>
              <span>{ok ? '✅' : '⬜'}</span>
              <span style={{ color: ok ? 'var(--win)' : 'var(--ink-soft)' }}>
                {def.text(game)} <b style={{ color: 'var(--ink-faint)' }}>· +£250k & board favour if met</b>
              </span>
            </div>
          )
        })}
      </div>
      <SectionTitle sub={`${Math.round(club.boardConfidence)}%`}>Board Confidence</SectionTitle>
      <div style={{ margin: '8px 14px', height: 10, background: 'var(--cream-3)', borderRadius: 5 }}>
        <div style={{
          width: `${club.boardConfidence}%`, height: '100%', borderRadius: 5,
          background: club.boardConfidence > 60 ? '#2f7d4f' : club.boardConfidence > 30 ? '#c9a227' : '#9b2c2c',
        }} />
      </div>
      <div className="muted" style={{ padding: '4px 14px 14px' }}>
        {club.boardConfidence > 75 ? 'The board is delighted with your work.'
          : club.boardConfidence > 50 ? 'The board is broadly satisfied.'
          : club.boardConfidence > 30 ? 'The board expects results to improve.'
          : 'The board is losing patience. Win, and quickly.'}
      </div>
      </>}
    </>
  )
}

/** Season balance, week by week. Blue above zero, red below - one glance
 *  tells you which way the club is heading. */
function BalanceChart({ hist }: { hist: { w: number; b: number }[] }) {
  const max = Math.max(...hist.map(h => Math.abs(h.b)), 1)
  const first = hist[0], latest = hist[hist.length - 1]
  const trend = latest.b - first.b
  return (
    <>
      <SectionTitle sub={`${trend >= 0 ? '+' : '−'}${fmtMoney(Math.abs(trend))} since week ${first.w}`}>Season Balance</SectionTitle>
      <div className="card">
        <div style={{ position: 'relative', display: 'flex', gap: 2, height: 72 }}>
          <span style={{ position: 'absolute', left: 0, right: 0, top: 35, height: 1, background: 'var(--hairline)' }} />
          {hist.map(h => {
            const bar = Math.max(2, Math.round((Math.abs(h.b) / max) * 34))
            return (
              <span key={h.w} title={`Week ${h.w}: ${fmtMoney(h.b)}`}
                style={{ flex: 1, minWidth: 2, position: 'relative' }}>
                <i style={{
                  position: 'absolute', left: 0, right: 0,
                  ...(h.b >= 0 ? { bottom: 36, height: bar } : { top: 36, height: bar }),
                  background: h.b >= 0 ? 'var(--brand-800)' : 'var(--red)',
                  borderRadius: 2.5,
                }} />
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="meta">wk {first.w}: {fmtMoney(first.b)}</span>
          <span className="meta" style={{ fontWeight: 700 }}>now: {fmtMoney(latest.b)}</span>
        </div>
      </div>
    </>
  )
}
