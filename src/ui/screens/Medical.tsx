import { useState } from 'react'
import { useStore } from '../../store'
import { fmtMoney, inRedZone, type Player } from '../../game/model'
import { SPECIALIST_FEE, cottonWool, specialistConsult } from '../../game/medical'
import { BADGE } from '../../game/staff'
import { PosBadge, SectionTitle } from '../components'

/** The Medical Centre: who's out, who's rusty, who's running on fumes. */
export default function Medical() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const touch = useStore.getState().touch
  const [msg, setMsg] = useState('')
  const club = game.clubs[game.userClubId]
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p)

  const injured = squad.filter(p => p.injury).sort((a, b) => (a.injury!.until) - (b.injury!.until))
  const rusty = squad.filter(p => !p.injury && (p.rust ?? 0) > 0)
  const banned = squad.filter(p => p.bans > 0)
  const tired = squad.filter(p => !p.injury && p.cond < 62).sort((a, b) => a.cond - b.cond)
  const loaded = squad.filter(p => !p.injury && inRedZone(p)).sort((a, b) => b.stats.mins - a.stats.mins)
  const away = squad.filter(p => p.natSquad || p.onLoan)

  // empty sections say nothing at all - six headers of "nobody" was noise
  const section = (title: string, sub: string, rows: Player[], render: (p: Player) => React.ReactNode) =>
    rows.length === 0 ? null : (
      <>
        <SectionTitle sub={sub}>{title}</SectionTitle>
        <div className="tblwrap">
          <table className="dtable"><tbody>
            {rows.map(p => (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                <td><PosBadge pos={p.pos} /></td>
                <td className="name">{p.name}</td>
                <td>{render(p)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </>
    )
  const allClear = !injured.length && !rusty.length && !banned.length && !tired.length && !loaded.length && !away.length

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)', padding: '8px 14px' }}>
        <div className="meta">
          🏥 <b>{game.staffPeople?.physio ? `${game.staffPeople.physio.name} (${BADGE[game.staff.physio].toLowerCase()} badge)` : 'Head Physio'}</b>
          {game.staff.physio === 0
            ? ' · post vacant - injuries run their full course (Training → Backroom Staff)'
            : ` · injuries roughly ${game.staff.physio * 12}% shorter`}
        </div>
      </div>

      {msg && <div className="card" style={{ borderLeft: '4px solid #c9a227' }}>{msg}</div>}

      {allClear && (
        <div className="card center" style={{ borderLeft: '4px solid #2f7d4f' }}>
          <h3 style={{ fontSize: 15 }}>✅ A quiet treatment room</h3>
          <div className="meta">Nobody injured, suspended, rusty or running on empty. Enjoy it - it never lasts.</div>
        </div>
      )}

      {section('Treatment Room', `ruled out - a specialist consult (${fmtMoney(SPECIALIST_FEE)}) can shorten a long lay-off`, injured, p => (
        <span style={{ color: '#9b2c2c', fontWeight: 700, fontSize: 12 }}>
          {p.injury!.desc} · {Math.max(1, p.injury!.until - game.week)}w
          {!p.specialist && p.injury!.until - game.week >= 3 && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg(specialistConsult(game, p.id)); touch() }}>
              🩺 Specialist
            </button>
          )}
        </span>
      ))}

      {section('Red Zone - season load', '1,300+ minutes: they break easier and tire faster. Rest them.', loaded, p => (
        <span style={{ color: '#9b2c2c', fontWeight: 700, fontSize: 12 }}>🔋 {p.stats.mins}′ this season</span>
      ))}

      {section('Returning from Injury', 'playable, but a rushed return risks a breakdown · one man a week can be wrapped in cotton wool', rusty, p => (
        <span style={{ color: '#a8841a', fontWeight: 700, fontSize: 12 }}>
          ⚠ RUSTY {p.rust}w
          {game.cottonWk !== game.season * 100 + game.week && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg(cottonWool(game, p.id)); touch() }}>
              🛌 Cotton wool
            </button>
          )}
        </span>
      ))}

      {section('Suspended', 'serving bans', banned, p => (
        <span style={{ color: '#9b2c2c', fontWeight: 700, fontSize: 12 }}>{p.bans} match{p.bans > 1 ? 'es' : ''}</span>
      ))}

      {section('Running on Fumes', 'condition under 62% - consider resting', tired, p => (
        <span style={{ fontWeight: 700, fontSize: 12 }}>{Math.round(p.cond)}%</span>
      ))}

      {section('Away from the Club', 'international duty & loans', away, p => (
        <span style={{ color: '#a8841a', fontWeight: 700, fontSize: 12 }}>{p.onLoan ? 'ON LOAN' : 'INTL DUTY'}</span>
      ))}
      <div className="spacer" />
    </>
  )
}
