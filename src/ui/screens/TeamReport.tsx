import { useStore } from '../../store'
import { fmtMoney, POS_ORDER, POS_NAMES, XV_SLOTS, type Player, type Pos } from '../../game/model'
import { effAt } from '../../game/attributes'
import { assistantAdvice, squadValue, starPlayerIds } from '../../game/analysis'
import { sortTable } from '../../game/schedule'
import { PosBadge, SectionTitle, Stars } from '../components'

/** The assistant's full report on the squad, FM Team Report style. */
export default function TeamReport() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const club = game.clubs[game.userClubId]
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p && !p.onLoan)
  const stars = starPlayerIds(game, club.id)

  // league context
  const leagueClubs = Object.values(game.clubs).filter(c => c.leagueId === club.leagueId)
  const valueRank = [...leagueClubs].sort((a, b) => squadValue(game, b.id) - squadValue(game, a.id))
    .findIndex(c => c.id === club.id) + 1
  const repRank = [...leagueClubs].sort((a, b) => b.rep - a.rep).findIndex(c => c.id === club.id) + 1
  const pos = sortTable(game.comps[club.leagueId]?.table ?? []).findIndex(r => r.teamId === club.id) + 1

  // positional depth
  const depth = POS_ORDER.map(pos => {
    const fit = squad.filter(p => (p.pos === pos || p.alt.includes(pos)) && !p.injury)
    const best = [...squad].filter(p => !p.injury).sort((a, b) => effAt(b, pos) - effAt(a, pos))[0]
    const need = pos === 'LK' || pos === 'FL' || pos === 'CE' || pos === 'WG' ? 3 : 2
    return { pos, count: fit.length, need, best: best && effAt(best, pos) >= 60 ? best : null }
  })

  // age profile
  const buckets = [
    { label: 'U21', n: squad.filter(p => p.age <= 21).length },
    { label: '22-25', n: squad.filter(p => p.age >= 22 && p.age <= 25).length },
    { label: '26-29', n: squad.filter(p => p.age >= 26 && p.age <= 29).length },
    { label: '30-32', n: squad.filter(p => p.age >= 30 && p.age <= 32).length },
    { label: '33+', n: squad.filter(p => p.age >= 33).length },
  ]
  const maxB = Math.max(...buckets.map(b => b.n), 1)
  const avgAge = squad.length ? squad.reduce((s, p) => s + p.age, 0) / squad.length : 0

  const bestXi = XV_SLOTS.map((slot, i) => {
    const p = club.tactic.lineup[i] != null ? game.players[club.tactic.lineup[i]!] : null
    return { slot, p }
  })

  return (
    <>
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <h3 style={{ fontSize: 14 }}>The Assistant's Verdict</h3>
        <div className="meta" style={{ fontStyle: 'italic' }}>{assistantAdvice(game)}</div>
      </div>

      <SectionTitle>Where We Stand</SectionTitle>
      <div className="chip-row" style={{ padding: '0 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span className="chip">League position <b>{pos > 0 ? `${pos} / ${leagueClubs.length}` : '—'}</b></span>
        <span className="chip">Squad value <b>{fmtMoney(squadValue(game, club.id))}</b> (rank {valueRank})</span>
        <span className="chip">Reputation rank <b>{repRank} / {leagueClubs.length}</b></span>
        <span className="chip">Average age <b>{avgAge.toFixed(1)}</b></span>
        <span className="chip">Squad size <b>{squad.length}</b></span>
      </div>

      <SectionTitle sub="⭐ = the men opponents fear">Star Players</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {squad.filter(p => stars.has(p.id)).map(p => (
          <tr key={p.id} onClick={() => go('player', p.id)}>
            <td><PosBadge pos={p.pos} /></td>
            <td className="name">⭐ {p.name}</td>
            <td><Stars ca={p.ca} /></td>
            <td className="num">{fmtMoney(p.value)}</td>
          </tr>
        ))}
      </tbody></table></div>

      <SectionTitle sub="cover for every shirt — red rows need recruits">Positional Depth</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Pos</th><th>Role</th><th className="num">Cover</th><th>Best option</th></tr></thead>
        <tbody>
          {depth.map(d => (
            <tr key={d.pos} className={d.count < d.need ? 'prob-row' : undefined}>
              <td><PosBadge pos={d.pos} /></td>
              <td className="name" style={{ fontSize: 12 }}>{POS_NAMES[d.pos]}</td>
              <td className="num" style={d.count < d.need ? { color: '#9b2c2c', fontWeight: 700 } : undefined}>
                {d.count}/{d.need}
              </td>
              <td style={{ fontSize: 12 }}>{d.best?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <SectionTitle sub="a healthy squad peaks in the middle">Age Profile</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90, padding: '0 24px 4px' }}>
        {buckets.map(b => (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{b.n}</span>
            <div style={{ width: '100%', height: `${(b.n / maxB) * 58}px`, background: 'var(--club1)', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
            <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{b.label}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Current Best XV</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {bestXi.map(({ slot, p }, i) => (
          <tr key={i} onClick={() => p && go('player', p.id)}>
            <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{slot.shirt}</td>
            <td><PosBadge pos={slot.pos} /></td>
            <td className="name">{p?.name ?? '—'}</td>
            <td>{p && <Stars ca={effAt(p, slot.pos)} />}</td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="spacer" />
    </>
  )
}
