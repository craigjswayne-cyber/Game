import { useState } from 'react'
import { useStore } from '../../store'
import { sortTable } from '../../game/schedule'
import { teamShort } from '../../game/matchEngine'
import { weekDate } from '../../game/model'
import { CrestT, SectionTitle } from '../components'
import { stageName } from './Home'

export default function Tables({ initial }: { initial?: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const comps = ['prem', 'top14', 'urc', 'srp', 'cc'].filter(id => game.comps[id])
  const userLeague = game.clubs[game.userClubId].leagueId
  const [compId, setCompId] = useState(initial ?? userLeague)
  const comp = game.comps[compId]
  if (!comp) return null

  const rows = sortTable(comp.table)
  const ko = game.fixtures.filter(f => f.compId === compId && f.stage).sort((a, b) => a.week - b.week)
  const playoffLine = comp.playoffTeams

  return (
    <>
      <div className="tab-bar">
        {comps.map(id => (
          <button key={id} className={id === compId ? 'active' : ''} onClick={() => setCompId(id)}>
            {game.comps[id].short}
          </button>
        ))}
        <button onClick={() => go('nations')}>Internationals</button>
        <button onClick={() => go('history')}>Honours</button>
        <button onClick={() => go('legacy')}>Manager</button>
      </div>
      <SectionTitle sub={comp.champion ? `Champions: ${teamShort(game, comp.champion)}` : undefined}>{comp.name}</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead>
          <tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th>
            <th className="num">D</th><th className="num">L</th><th className="num">+/-</th>
            <th className="num">BP</th><th className="num">Pts</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId}
              className={r.teamId === game.userClubId ? 'me' : ''}
              onClick={() => game.clubs[r.teamId] && go('club', r.teamId)}
              style={playoffLine && i === playoffLine - 1 ? { borderBottom: '2px solid #c9a227' } : undefined}>
              <td className="num muted">{i + 1}</td>
              <td className="name"><CrestT g={game} teamId={r.teamId} size={17} />{teamShort(game, r.teamId)}</td>
              <td className="num">{r.p}</td>
              <td className="num">{r.w}</td>
              <td className="num">{r.d}</td>
              <td className="num">{r.l}</td>
              <td className="num">{r.pf - r.pa}</td>
              <td className="num">{r.bp}</td>
              <td className="num" style={{ fontWeight: 700 }}>{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <Leaders compId={compId} />
      {ko.length > 0 && (
        <>
          <SectionTitle>Knockout Stages</SectionTitle>
          <div className="tblwrap"><table className="dtable"><tbody>
            {ko.map(f => (
              <tr key={f.id}>
                <td className="muted">{stageName(f.stage!)}</td>
                <td className="name"><CrestT g={game} teamId={f.homeId} size={15} />{teamShort(game, f.homeId)} v <CrestT g={game} teamId={f.awayId} size={15} />{teamShort(game, f.awayId)}</td>
                <td className="num">{f.played ? `${f.homeScore}-${f.awayScore}` : weekDate(game.season, f.week).slice(0, -5)}</td>
              </tr>
            ))}
          </tbody></table></div>
        </>
      )}
      <div className="spacer" />
    </>
  )
}

function Leaders({ compId }: { compId: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const comp = game.comps[compId]
  if (!comp || comp.type === 'intl') return null
  const teamSet = new Set(comp.teamIds)
  const pool = Object.values(game.players).filter(p => p.clubId && teamSet.has(p.clubId) && p.stats.apps > 0)
  if (!pool.length) return null
  const tries = [...pool].sort((a, b) => b.stats.tries - a.stats.tries).slice(0, 5)
  const points = [...pool].sort((a, b) => b.stats.points - a.stats.points).slice(0, 5)
  const rated = pool.filter(p => p.stats.apps >= 4)
    .sort((a, b) => b.stats.ratingSum / b.stats.apps - a.stats.ratingSum / a.stats.apps).slice(0, 5)
  const block = (title: string, rows: typeof tries, val: (p: (typeof tries)[0]) => string) => (
    <>
      <SectionTitle sub="all comps, this season">{title}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {rows.map((p, i) => (
          <tr key={p.id} onClick={() => go('player', p.id)}>
            <td className="num muted">{i + 1}</td>
            <td className="name">{p.name}</td>
            <td className="muted">{p.clubId ? game.clubs[p.clubId]?.short : ''}</td>
            <td className="num" style={{ fontWeight: 700 }}>{val(p)}</td>
          </tr>
        ))}
      </tbody></table></div>
    </>
  )
  return (
    <>
      {block('Top Try Scorers', tries, p => String(p.stats.tries))}
      {block('Top Points Scorers', points, p => String(p.stats.points))}
      {rated.length > 0 && block('Form Players', rated, p => (p.stats.ratingSum / p.stats.apps).toFixed(2))}
    </>
  )
}
