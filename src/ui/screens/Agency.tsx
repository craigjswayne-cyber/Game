import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney } from '../../game/model'
import { agencyKids, agencySeniors } from '../../game/agency'
import { CrestT, Nat, PosBadge, SectionTitle } from '../components'

/** The Scouting Agency: monthly world rankings, FM-style. */
export default function Agency() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [tab, setTab] = useState<'seniors' | 'kids'>('seniors')

  const list = tab === 'seniors' ? agencySeniors(game) : agencyKids(game)
  const prev = tab === 'seniors' ? (game.agency?.seniors ?? []) : (game.agency?.kids ?? [])
  const best = game.agency?.best ?? {}

  return (
    <>
      <div className="tab-bar">
        <button className={tab === 'seniors' ? 'active' : ''} onClick={() => setTab('seniors')}>World Rankings</button>
        <button className={tab === 'kids' ? 'active' : ''} onClick={() => setTab('kids')}>Wonderkids</button>
      </div>
      <SectionTitle sub={tab === 'seniors' ? 'the twenty best players on the planet, updated monthly' : 'the ceilings scouts whisper about - 21 and under'}>
        {tab === 'seniors' ? 'Senior Rankings: World' : 'Wonderkid Watch: World'}
      </SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>#</th><th></th><th>High</th><th>Name</th><th>Pos</th><th></th><th>Club</th><th className="num">Value</th></tr></thead>
        <tbody>
          {list.map((p, i) => {
            const prevIdx = prev.indexOf(p.id)
            const move = prevIdx < 0 ? 'new' : prevIdx > i ? 'up' : prevIdx < i ? 'down' : 'flat'
            const mine = p.clubId === game.userClubId
            return (
              <tr key={p.id} onClick={() => go('player', p.id)}
                style={mine ? { background: 'color-mix(in srgb, #c9a227 14%, transparent)' } : undefined}>
                <td className="num" style={{ fontWeight: 700 }}>{i + 1}</td>
                <td style={{ width: 18, fontSize: 11 }}>
                  {move === 'up' ? <span style={{ color: '#2f7d4f' }}>▲</span>
                    : move === 'down' ? <span style={{ color: '#9b2c2c' }}>▼</span>
                    : move === 'new' ? <span style={{ color: 'var(--accent-ink)' }}>★</span>
                    : <span className="muted">·</span>}
                </td>
                <td className="num muted">{best[p.id] != null ? Math.min(best[p.id], i + 1) : i + 1}</td>
                <td className="name" style={mine ? { fontWeight: 800 } : undefined}>
                  {p.name}{tab === 'kids' ? ` (${p.age})` : ''}
                </td>
                <td><PosBadge pos={p.pos} /></td>
                <td><Nat code={p.nat} /></td>
                <td className="muted"><CrestT g={game} teamId={p.clubId!} size={15} />{game.clubs[p.clubId!]?.short}</td>
                <td className="num">{fmtMoney(p.value)}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
        ▲▼ movement since last month · High: best rank held · your players highlighted · tap a name to scout him
      </div>
      <div className="spacer" />
    </>
  )
}
