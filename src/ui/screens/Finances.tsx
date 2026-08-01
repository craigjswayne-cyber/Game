import { useStore } from '../../store'
import { boardObjective, fmtMoney } from '../../game/model'
import { SectionTitle } from '../components'

export default function Finances() {
  const game = useStore(s => s.game)!
  const club = game.clubs[game.userClubId]
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
      <SectionTitle>Season Objective</SectionTitle>
      <div className="card" style={{ marginTop: 6 }}>
        <h3 style={{ fontSize: 15 }}>The board expects you to {boardObjective(club.rep).text}.</h3>
        <div className="meta">Fall short and confidence will suffer. Deliver, and you'll be backed.</div>
      </div>
      <SectionTitle sub={`${Math.round(club.boardConfidence)}%`}>Board Confidence</SectionTitle>
      <div style={{ margin: '8px 14px', height: 10, background: '#e3d8bf', borderRadius: 5 }}>
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
