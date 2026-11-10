import { useState } from 'react'
import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { fxDate, kickRecord, type KickLine } from '../../game/model'

/** Kicks at goal a man needs this season before he is ranked on his rate. */
const MIN_KICKS = 10
import { ClubLink, CrestT, SectionTitle } from '../components'
import LeagueTable from '../LeagueTable'
import { stageName } from './Home'
import { t, compLabel } from '../../game/i18n'
import { rowNavTr } from '../rowNav'

export default function Tables({ initial }: { initial?: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const comps = ['prem', 'champ', 'natl1', 'top14', 'prod2', 'urc', 'srp', 'jl1', 'mrc', 'cc', 'chc'].filter(id => game.comps[id])
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
            {compLabel(game.comps[id].short)}
          </button>
        ))}
        <button onClick={() => go('nations')}>{t('tables.internationals')}</button>
        <button onClick={() => go('history')}>{t('tables.honours')}</button>
        {/* Manager and Jobs are gone from this row (owner, round 4): Legacy
            is on the manager's own menu and Jobs has its own World item */}
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
                <td className="name"><CrestT g={game} teamId={f.homeId} size={15} /><ClubLink g={game} clubId={f.homeId}>{teamShort(game, f.homeId)}</ClubLink> {t('common.v')} <CrestT g={game} teamId={f.awayId} size={15} /><ClubLink g={game} clubId={f.awayId}>{teamShort(game, f.awayId)}</ClubLink></td>
                <td className="num">{f.played ? `${f.homeScore}-${f.awayScore}` : fxDate(game.season, f)}</td>
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
  // THE LEAGUE'S TACKLERS AND KICKERS (1.9.12, player report: "il n'y a pas
  // de statistiques individuelles pour les championnats ... plaqueurs, tireurs
  // de coups de pied"). Kickers by success rate, with a floor of attempts so
  // one conversion from one is not the best boot in the league.
  const tacklers = pool.filter(p => (p.stats.tkl ?? 0) > 0)
    .sort((a, b) => (b.stats.tkl ?? 0) - (a.stats.tkl ?? 0)).slice(0, 5)
  const kickers = pool.map(p => ({ p, k: kickRecord(p.stats).all }))
    .filter((r): r is { p: typeof r.p; k: KickLine } => !!r.k && r.k.att >= MIN_KICKS)
    .sort((a, b) => b.k.pct - a.k.pct || b.k.made - a.k.made)
    .slice(0, 5)
  const kickOf = new Map(kickers.map(r => [r.p.id, r.k]))
  const rated = pool.filter(p => p.stats.apps >= 4)
    .sort((a, b) => b.stats.ratingSum / b.stats.apps - a.stats.ratingSum / a.stats.apps).slice(0, 5)
  const block = (title: string, rows: typeof tries, val: (p: (typeof tries)[0]) => string, sub = t('tables.allCompsThisSeason')) => (
    <>
      <SectionTitle sub={sub}>{title}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {rows.map((p, i) => (
          <tr key={p.id} {...rowNavTr(() => go('player', p.id))}>
            <td className="num muted">{i + 1}</td>
            <td className="name">{p.name}</td>
            <td className="muted">{p.clubId ? <ClubLink g={game} clubId={p.clubId} /> : ''}</td>
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
      {tacklers.length > 0 && block(t('tables.topTacklers'), tacklers, p => String(p.stats.tkl ?? 0))}
      {kickers.length > 0 && block(t('tables.topKickers'), kickers.map(r => r.p), p => {
        const k = kickOf.get(p.id)!
        return t('player.kickLine', { ...k })
      }, t('tables.topKickersSub', { n: MIN_KICKS }))}
      {rated.length > 0 && block(t('tables.formPlayers'), rated, p => (p.stats.ratingSum / p.stats.apps).toFixed(2))}
    </>
  )
}
