import { useState } from 'react'
import { useStore } from '../../store'
import { boardObjective, fmtMoney } from '../../game/model'
import { OBJECTIVE_DEFS } from '../../game/objectives'
import { SectionTitle } from '../components'

export default function Finances() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [askMsg, setAskMsg] = useState<string | null>(null)
  const club = game.clubs[game.userClubId]
  const askedKey = `asked-${game.season}`
  const asked = (game as unknown as Record<string, unknown>)[askedKey] === true

  const requestFunds = () => {
    if (asked) return
    ;(game as unknown as Record<string, boolean>)[askedKey] = true
    if (club.boardConfidence >= 68) {
      const extra = Math.round((club.budget * 0.25 + 400_000) / 50_000) * 50_000
      club.budget += extra
      setAskMsg(`The board backs you: ${fmtMoney(extra)} added to the transfer budget.`)
    } else {
      club.boardConfidence = Math.max(0, club.boardConfidence - 3)
      setAskMsg('The board politely declines. Earn their confidence first.')
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
      <div className="chips">
        <span className="chip">Balance <b style={{ color: club.balance < 0 ? '#9b2c2c' : '#2f7d4f' }}>{fmtMoney(club.balance)}</b></span>
        <span className="chip">Transfer budget <b>{fmtMoney(club.budget)}</b></span>
        <span className="chip">Wage bill <b>{fmtMoney(wages)}/wk</b></span>
        <span className="chip">Wage budget <b>{fmtMoney(club.wageBudget)}/wk</b></span>
      </div>
      <SectionTitle>Matchday</SectionTitle>
      <div className="chips">
        <span className="chip">{club.stadium} <b>{club.capacity.toLocaleString()}</b></span>
        <span className="chip">Avg attendance <b>{avgAtt ? avgAtt.toLocaleString() : '—'}</b></span>
        <span className="chip">Est. gate/game <b>{avgAtt ? fmtMoney(avgAtt * 30) : '—'}</b></span>
        <span className="chip">Weekly commercial <b>{fmtMoney(Math.round(club.rep * 1800 + 40_000))}</b></span>
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
    </>
  )
}
