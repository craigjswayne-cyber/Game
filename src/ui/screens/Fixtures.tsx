import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { weekDate, type Fixture } from '../../game/model'
import { SectionTitle, TeamDot } from '../components'
import { stageName } from './Home'

export default function Fixtures() {
  const game = useStore(s => s.game)!
  const me = game.userClubId
  const fx = game.fixtures
    .filter(f => f.homeId === me || f.awayId === me)
    .sort((a, b) => a.week - b.week)

  const res = (f: Fixture) => {
    if (!f.played) return <span className="muted">{f.homeId === me ? 'H' : 'A'}</span>
    const us = f.homeId === me ? f.homeScore : f.awayScore
    const them = f.homeId === me ? f.awayScore : f.homeScore
    const cls = us > them ? 'result-w' : us < them ? 'result-l' : 'result-d'
    return <span className={cls}>{us > them ? 'W' : us < them ? 'L' : 'D'} {f.homeScore}-{f.awayScore}</span>
  }

  return (
    <>
      <SectionTitle sub={`${fx.filter(f => f.played).length}/${fx.length} played`}>Season Fixtures</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Date</th><th>Opponent</th><th>Comp</th><th>Result</th></tr></thead>
        <tbody>
          {fx.map(f => {
            const opp = f.homeId === me ? f.awayId : f.homeId
            const isNext = !f.played && f.week === game.week
            return (
              <tr key={f.id} style={isNext ? { background: '#efe7cf' } : undefined}>
                <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
                <td className="name">{f.homeId === me ? 'v ' : '@ '}<TeamDot g={game} teamId={opp} />{teamShort(game, opp)}</td>
                <td className="muted">{game.comps[f.compId]?.short ?? f.compId}{f.stage ? ` ${stageName(f.stage)}` : ''}</td>
                <td>{res(f)}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
