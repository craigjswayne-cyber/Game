import { useStore } from '../../store'
import type { TrainingFocus } from '../../game/model'
import { SectionTitle } from '../components'

const FOCUSES: { id: TrainingFocus; name: string; desc: string }[] = [
  { id: 'balanced', name: 'Balanced', desc: 'A steady all-round programme.' },
  { id: 'scrum', name: 'Scrummaging', desc: 'Live scrums and strength work for the tight five.' },
  { id: 'lineout', name: 'Lineout', desc: 'Throwing accuracy, lifting pods, calling.' },
  { id: 'attack', name: 'Attack', desc: 'Handling, shape and support lines.' },
  { id: 'defence', name: 'Defence', desc: 'Tackle technique and line speed.' },
  { id: 'fitness', name: 'Conditioning', desc: 'Engine building — improves stamina.' },
  { id: 'kicking', name: 'Kicking', desc: 'Tactical and goal kicking practice.' },
]

export default function Training() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const club = game.clubs[game.userClubId]
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => a.cond - b.cond)

  return (
    <>
      <SectionTitle sub="small weekly gains in the focus area">Weekly Focus</SectionTitle>
      {FOCUSES.map(f => (
        <button key={f.id} className="club-pick" onClick={() => { game.training = f.id; touch() }}>
          <span style={{ fontSize: 16 }}>{game.training === f.id ? '●' : '○'}</span>
          <span className="cname">{f.name}</span>
          <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>{f.desc}</span>
        </button>
      ))}
      <SectionTitle sub="worst first">Condition Report</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Name</th><th className="num">Fitness</th><th className="num">Sharpness</th><th>Status</th></tr></thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td className="name">{p.name}</td>
              <td className="num" style={{ color: p.cond < 70 ? '#9b2c2c' : undefined }}>{Math.round(p.cond)}%</td>
              <td className="num">{Math.round(p.sharp)}%</td>
              <td className="muted">{p.injury ? `${p.injury.desc} (~${Math.max(0, p.injury.until - game.week)}w)` : p.natSquad ? 'Intl duty' : p.bans > 0 ? `Banned ${p.bans}` : 'Available'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
