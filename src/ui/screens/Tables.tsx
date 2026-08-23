import { useState } from 'react'
import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { weekDate } from '../../game/model'
import { CrestT, SectionTitle } from '../components'
import LeagueTable from '../LeagueTable'
import { stageName } from './Home'
import { t } from '../../game/i18n'

export default function Tables({ initial }: { initial?: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const comps = ['prem', 'champ', 'natl1', 'top14', 'prod2', 'urc', 'srp', 'jl1', 'cc', 'chc'].filter(id => game.comps[id])
  const userLeague = game.clubs[game.userClubId].leagueId
  const [compId, setCompId] = useState(initial ?? userLeague)
  const comp = game.comps[compId]
  if (!comp) return null

  const ko = game.fixtures.filter(f => f.compId === compId && f.stage).sort((a, b) => a.week - b.week)

  return (
    <>
      <div className="tab-bar">
        {comps.map(id => (
          <button key={id} className={id === compId ? 'active' : ''} onClick={() => setCompId(id)}>
            {game.comps[id].short}
          </button>
        ))}
        <button onClick={() => go('nations')}>{t('tables.internationals')}</button>
        <button onClick={() => go('history')}>{t('tables.honours')}</button>
        <button onClick={() => go('legacy')}>{t('tables.manager')}</button>
        <button onClick={() => go('jobs')}>{t('tables.jobs')}</button>
      </div>
      <SectionTitle sub={comp.champion ? t('fixtures.champions', { club: teamShort(game, comp.champion) }) : undefined}>{comp.name}</SectionTitle>
      {/* the table itself lives in ../LeagueTable so that the copy on Fixtures &
          Results is the same table rather than a second one */}
      <LeagueTable compId={compId} />
      <Leaders compId={compId} />
      {ko.length > 0 && (
        <>
          <SectionTitle>{t('tables.knockoutStages')}</SectionTitle>
          <div className="tblwrap"><table className="dtable"><tbody>
            {ko.map(f => (
              <tr key={f.id}>
                <td className="muted">{stageName(f.stage!)}</td>
                <td className="name"><CrestT g={game} teamId={f.homeId} size={15} />{teamShort(game, f.homeId)} {t('common.v')} <CrestT g={game} teamId={f.awayId} size={15} />{teamShort(game, f.awayId)}</td>
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
      <SectionTitle sub={t('tables.allCompsThisSeason')}>{title}</SectionTitle>
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
      {block(t('tables.topTryScorers'), tries, p => String(p.stats.tries))}
      {block(t('tables.topPointsScorers'), points, p => String(p.stats.points))}
      {rated.length > 0 && block(t('tables.formPlayers'), rated, p => (p.stats.ratingSum / p.stats.apps).toFixed(2))}
    </>
  )
}
