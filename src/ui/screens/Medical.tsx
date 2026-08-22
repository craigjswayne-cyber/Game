import { useEffect, useState } from 'react'
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
  // KEYED TO THE MAN, not to the page. A specialist consult on the eighth name
  // in a long treatment room used to answer in a banner at the top of the
  // screen - the same class of bug the coach market had, where the reply to
  // your tap renders somewhere you are not looking and the button reads as
  // dead. The line now lands in his own row.
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const club = game.clubs[game.userClubId]
  const q = query.trim().toLowerCase()
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.pos.toLowerCase() === q)

  const injured = squad.filter(p => p.injury).sort((a, b) => (a.injury!.until) - (b.injury!.until))
  const rusty = squad.filter(p => !p.injury && (p.rust ?? 0) > 0)
  const banned = squad.filter(p => p.bans > 0)
  const tired = squad.filter(p => !p.injury && p.cond < 62).sort((a, b) => a.cond - b.cond)
  const loaded = squad.filter(p => !p.injury && inRedZone(p)).sort((a, b) => b.stats.mins - a.stats.mins)
  const away = squad.filter(p => p.natSquad || p.onLoan)

  // Standing on this page IS reading the notification (13E), so the rail badge
  // clears here rather than counting injured men forever. Not filtered by the
  // search box: the badge is about the treatment room, not about whatever is
  // currently typed into it.
  // Runs once per visit, not once per render. Written without a dependency array
  // first, which self-terminated only because the second pass found nothing fresh
  // to mark - the next person to add a condition inside it would have got an
  // infinite render loop for free. Flagged in the studio audit as my own trap.
  useEffect(() => {
    let fresh = 0
    for (const id of club.players) {
      const inj = game.players[id]?.injury
      if (inj && !inj.seen) { inj.seen = true; fresh++ }
    }
    if (fresh) touch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                <td className="name">
                  {p.name}
                  {msg?.id === p.id && (
                    <div className="meta" style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'normal' }}>
                      {msg.text}
                    </div>
                  )}
                </td>
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

      <div style={{ padding: '6px 14px 0' }}>
        <input className="inline-input" placeholder="Find a player…" value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ margin: 0, maxWidth: 240, padding: '4px 8px', fontSize: 12 }} />
      </div>

      {allClear && (
        <div className="card center" style={{ borderLeft: '4px solid var(--text-positive)' }}>
          <h3 style={{ fontSize: 15 }}>{q ? 'Nothing on him' : '✅ A quiet treatment room'}</h3>
          <div className="meta">{q
            ? 'No player matching that search is injured, suspended, rusty or short of a gallop.'
            : 'Nobody injured, suspended, rusty or running on empty. Enjoy it - it never lasts.'}</div>
        </div>
      )}

      {section('Treatment Room', `ruled out - a specialist consult (${fmtMoney(SPECIALIST_FEE)}) can shorten a long lay-off`, injured, p => (
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12 }}>
          {p.injury!.desc} · {Math.max(1, p.injury!.until - game.week)}w
          {!p.specialist && p.injury!.until - game.week >= 3 && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg({ id: p.id, text: specialistConsult(game, p.id) }); touch() }}>
              🩺 Specialist
            </button>
          )}
        </span>
      ))}

      {section('Red Zone - season load', '1,300+ minutes: they break easier and tire faster. Rest them.', loaded, p => (
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12 }}>🔋 {p.stats.mins}′ this season</span>
      ))}

      {section('Returning from Injury', 'playable, but a rushed return risks a breakdown · one man a week can be wrapped in cotton wool', rusty, p => (
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>
          ⚠ RUSTY {p.rust}w
          {game.cottonWk !== game.season * 100 + game.week && (
            <button className="btn ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setMsg({ id: p.id, text: cottonWool(game, p.id) }); touch() }}>
              🛌 Cotton wool
            </button>
          )}
        </span>
      ))}

      {section('Suspended', 'serving bans', banned, p => (
        <span style={{ color: 'var(--text-negative)', fontWeight: 700, fontSize: 12 }}>{p.bans} match{p.bans > 1 ? 'es' : ''}</span>
      ))}

      {section('Running on Fumes', 'condition under 62% - consider resting', tired, p => (
        <span style={{ fontWeight: 700, fontSize: 12 }}>{Math.round(p.cond)}%</span>
      ))}

      {section('Away from the Club', 'international duty & loans', away, p => (
        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>{p.onLoan ? 'ON LOAN' : 'INTL DUTY'}</span>
      ))}
      <div className="spacer" />
    </>
  )
}
