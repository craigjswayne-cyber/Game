import { useStore } from '../../store'
import { fmtMoney, POS_ORDER } from '../../game/model'
import { Crest, FormPill, Jersey, Nat, PosBadge, SectionTitle, Stars } from '../components'
import { nationByCode } from '../../game/nations'
import { squadValue, starPlayerIds } from '../../game/analysis'

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
      <div className="card" style={{ position: 'relative', overflow: 'hidden', paddingTop: 18 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 6,
          background: `linear-gradient(90deg, ${club.colors[0]} 0 65%, ${club.colors[1]} 65% 100%)`,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Crest club={club} size={40} mr={10} />
          <h3 style={{ fontSize: 20, flex: 1 }}>{club.name}</h3>
          <Jersey club={club} size={52} />
        </div>
        <div className="meta">{club.city}, {nationByCode(club.country)?.name ?? club.country} · {league?.name}</div>
        <div className="meta">🏟️ {club.stadium} — {club.capacity.toLocaleString()} capacity</div>
        <div className="meta">🧢 Head coach: {club.id === game.userClubId ? game.managerName : club.coach ?? 'vacant'}</div>
        {(() => {
          const honours = game.history.filter(h => h.champion === club.id)
          if (!honours.length) return null
          const byComp: Record<string, number[]> = {}
          for (const h of honours) (byComp[h.compId] ??= []).push(2025 + h.season)
          return (
            <div style={{ marginTop: 8 }}>
              <div className="fact-label">🏆 Honours Board</div>
              {Object.entries(byComp).map(([compId, years]) => (
                <div key={compId} className="meta">
                  {game.comps[compId]?.name ?? compId} × {years.length} <span className="muted">({years.map(y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`).join(', ')})</span>
                </div>
              ))}
            </div>
          )
        })()}
        <div className="badge-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          <span className="chip">Reputation <b>{club.rep}</b></span>
          <span className="chip">Squad <b>{players.length}</b></span>
          <span className="chip">Squad value <b>{fmtMoney(squadValue(game, club.id))}</b></span>
          {players[0] && (() => {
            const stars = starPlayerIds(game, club.id)
            const star = players.find(p => stars.has(p.id))
            return star ? <span className="chip">⭐ Star <b>{star.name}</b></span> : null
          })()}
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
              <td className="name">{p.name}{starPlayerIds(game, club.id).has(p.id) ? ' ⭐' : ''}</td>
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
