import { useStore } from '../../store'
import { fmtMoney, seasonLabel } from '../../game/model'
import { Crest, SectionTitle } from '../components'
import { CHALLENGES } from '../../game/newgame'

const ord = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

export default function Legacy() {
  const game = useStore(s => s.game)!
  const club = game.clubs[game.userClubId]
  const m = game.mgr
  const winPct = m.m ? Math.round((m.w / m.m) * 100) : 0
  const challenge = game.challenge ? CHALLENGES.find(c => c.id === game.challenge) : null

  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Crest club={club} size={44} mr={0} /></div>
        <h3 style={{ fontSize: 21, marginTop: 6 }}>{game.managerName}</h3>
        <div className="meta">Director of Rugby, {club.name}</div>
        {challenge && <div className="meta" style={{ color: '#a8841a', fontWeight: 700, marginTop: 3 }}>Challenge: {challenge.title}</div>}
      </div>

      <SectionTitle>Career Record</SectionTitle>
      <div className="chips">
        <span className="chip">Matches <b>{m.m}</b></span>
        <span className="chip">Won <b style={{ color: '#2f7d4f' }}>{m.w}</b></span>
        <span className="chip">Drawn <b>{m.d}</b></span>
        <span className="chip">Lost <b style={{ color: '#a12f2f' }}>{m.l}</b></span>
        <span className="chip">Win rate <b>{winPct}%</b></span>
        <span className="chip">Signings <b>{m.signings}</b></span>
        <span className="chip">Spent <b>{fmtMoney(m.spent)}</b></span>
      </div>

      <SectionTitle sub={m.trophies.length ? undefined : 'the cabinet awaits'}>Trophy Cabinet</SectionTitle>
      {m.trophies.length === 0 ? (
        <div className="muted" style={{ padding: '4px 16px 12px', fontStyle: 'italic' }}>
          Empty shelves and big dreams. Win something.
        </div>
      ) : (
        <div className="chips">
          {m.trophies.map((t, i) => (
            <span key={i} className="chip" style={{ borderColor: '#c9a227' }}>
              🏆 <b>{game.comps[t.compId]?.name ?? t.compId}</b> {seasonLabel(t.season)}
            </span>
          ))}
        </div>
      )}

      {m.finishes.length > 0 && (
        <>
          <SectionTitle>Season By Season</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>Season</th><th>League</th><th className="num">Finish</th></tr></thead>
            <tbody>
              {[...m.finishes].reverse().map((f, i) => (
                <tr key={i}>
                  <td>{seasonLabel(f.season)}</td>
                  <td>{game.comps[f.leagueId]?.name ?? f.leagueId}</td>
                  <td className="num" style={{ fontWeight: 700, color: f.pos === 1 ? '#a8841a' : undefined }}>
                    {f.pos === 1 ? '🏆 1st' : ord(f.pos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      <div className="spacer" />
    </>
  )
}
