import { useStore } from '../../store'
import { fmtMoney, POS_ORDER } from '../../game/model'
import { FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { nationByCode } from '../../game/nations'

export default function ClubScreen({ clubId }: { clubId: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[clubId]
  if (!club) return null
  const league = game.comps[club.leagueId]
  const players = club.players.map(id => game.players[id]).filter(Boolean)
    .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.ca - a.ca)
  const honours = game.history.filter(h => h.champion === clubId)

  return (
    <>
      <div className="card" style={{ borderTop: `4px solid ${club.colors[0]}` }}>
        <h3 style={{ fontSize: 20 }}>{club.name}</h3>
        <div className="meta">{club.city}, {nationByCode(club.country)?.name ?? club.country} · {league?.name}</div>
        <div className="meta">🏟️ {club.stadium} — {club.capacity.toLocaleString()} capacity</div>
        <div className="badge-row" style={{ marginTop: 6 }}>
          <span className="chip">Reputation <b>{club.rep}</b></span>
          <span className="chip">Squad <b>{players.length}</b></span>
        </div>
      </div>
      {honours.length > 0 && (
        <>
          <SectionTitle>Honours (your era)</SectionTitle>
          <div className="chips">
            {honours.map((h, i) => (
              <span key={i} className="chip">🏆 {game.comps[h.compId]?.name ?? h.compId} {2025 + h.season}-{String((2026 + h.season) % 100).padStart(2, '0')}</span>
            ))}
          </div>
        </>
      )}
      <SectionTitle sub="tap to scout">Squad</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Pos</th><th>Name</th><th>Age</th><th>Nat</th><th>Ability</th><th>Form</th><th className="num">Value</th></tr></thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} onClick={() => go('player', p.id)}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name}</td>
              <td className="num">{p.age}</td>
              <td><Nat code={p.nat} /></td>
              <td><Stars ca={p.ca} /></td>
              <td><FormPill v={p.form} /></td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
