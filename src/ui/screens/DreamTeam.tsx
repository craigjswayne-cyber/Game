import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { XV_SLOTS, type Player } from '../../game/model'
import { teamShort } from '../../game/matchEngine'
import { ClubLink, Jersey, SectionTitle } from '../components'
import { t } from '../../game/i18n'

/** Magazine-style Dream Team of the round + season leaderboards -
 *  straight off the rugby magazine's socials. */
export default function DreamTeam() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const leagues = Object.values(game.comps).filter(c => c.type === 'league')
  const [leagueId, setLeagueId] = useState(game.clubs[game.userClubId]?.leagueId ?? leagues[0]?.id)
  const comp = game.comps[leagueId]

  // the most recent week this league actually played
  const lastWeek = useMemo(() => {
    const played = game.fixtures.filter(f => f.compId === leagueId && f.played)
    return played.length ? Math.max(...played.map(f => f.week)) : 0
  }, [game, leagueId])

  const xv = useMemo(() => {
    const pool = Object.values(game.players).filter(p =>
      p.clubId && game.clubs[p.clubId]?.leagueId === leagueId &&
      p.lastWk === lastWeek && p.lastR != null)
    const used = new Set<number>()
    return XV_SLOTS.map(slot => {
      const best = pool
        .filter(p => !used.has(p.id) && (p.pos === slot.pos || p.alt.includes(slot.pos)))
        .sort((a, b) => (b.lastR ?? 0) - (a.lastR ?? 0))[0]
      if (best) used.add(best.id)
      return { slot, p: best ?? null }
    })
  }, [game, leagueId, lastWeek])

  // season leaderboards
  const seasonPool = Object.values(game.players).filter(p =>
    p.clubId && game.clubs[p.clubId]?.leagueId === leagueId && p.stats.apps >= 3)
  const byRating = [...seasonPool].sort((a, b) =>
    b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps)).slice(0, 8)
  const byTries = [...seasonPool].sort((a, b) => b.stats.tries - a.stats.tries).slice(0, 5)
  const byPoints = [...seasonPool].sort((a, b) => b.stats.points - a.stats.points).slice(0, 5)

  // rows arranged like the magazine graphic: 1-2-3 / 4-5 / 6-8-7 / 9-10 / 11-12-13-14 / 15
  const ROWS = [[0, 1, 2], [3, 4], [5, 7, 6], [8, 9], [10, 11, 12, 13], [14]]

  const tile = (i: number) => {
    const { slot, p } = xv[i]
    const club = p?.clubId ? game.clubs[p.clubId] : null
    return (
      <div key={i} className="dt-tile" onClick={() => p && go('player', p.id)}>
        {club ? <Jersey club={club} size={46} /> : <div style={{ width: 46, height: 33, opacity: .2 }}>-</div>}
        <span className="dt-name">{slot.shirt}. {p ? p.name.split(' ').slice(-1)[0].toUpperCase() : '-'}</span>
        <span className="dt-score">{p?.lastR?.toFixed(1) ?? ''}</span>
      </div>
    )
  }

  const lb = (title: string, rows: Player[], val: (p: Player) => string) => (
    <>
      <SectionTitle>{title}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {rows.map((p, i) => (
          <tr key={p.id} onClick={() => go('player', p.id)}>
            <td className="num" style={{ fontWeight: 700 }}>{i + 1}</td>
            <td className="name">{p.name} <span className="muted">({p.clubId ? <ClubLink g={game} clubId={p.clubId}>{teamShort(game, p.clubId)}</ClubLink> : '-'})</span></td>
            <td className="num" style={{ fontWeight: 700 }}>{val(p)}</td>
          </tr>
        ))}
      </tbody></table></div>
    </>
  )

  return (
    <>
      <div className="tab-bar">
        {leagues.map(l => (
          <button key={l.id} className={l.id === leagueId ? 'active' : ''} onClick={() => setLeagueId(l.id)}>{l.short}</button>
        ))}
      </div>
      <div className="dt-board">
        <div className="dt-head">
          <span className="dt-league">{comp?.name?.toUpperCase()}</span>
          <span className="dt-title">{t('world.dtTitle')}</span>
          <span className="dt-sub">{lastWeek ? t('world.dtGameweek', { n: lastWeek }) : t('world.dtNoRugby')}</span>
        </div>
        {lastWeek > 0 && (
          <div className="dt-pitch">
            {ROWS.map((row, r) => (
              <div key={r} className="dt-row">{row.map(tile)}</div>
            ))}
          </div>
        )}
      </div>
      {lb(t('world.dtRatings'), byRating, p => (p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2))}
      {lb(t('tables.topTryScorers'), byTries, p => `${p.stats.tries}`)}
      {lb(t('tables.topPointsScorers'), byPoints, p => `${p.stats.points}`)}
      <OnesToWatch leagueId={leagueId} />
      <div className="spacer" />
    </>
  )
}

/** The scouts' wonderkid list: U21 ceilings worth tracking (and signing). */
function OnesToWatch({ leagueId }: { leagueId: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const kids = Object.values(game.players)
    .filter(p => p.age <= 21 && (p.clubId == null || game.clubs[p.clubId]?.leagueId === leagueId))
    .sort((a, b) => b.pa - a.pa)
    .slice(0, 8)
  if (!kids.length) return null
  return (
    <>
      <SectionTitle sub={t('world.dtOnesSub')}>{t('world.dtOnesToWatch')}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {kids.map(p => (
          <tr key={p.id} onClick={() => go('player', p.id)}>
            <td className="num">{p.age}</td>
            <td className="name">🌟 {p.name}
              <span className="muted"> ({p.pos} · {p.clubId ? <ClubLink g={game} clubId={p.clubId}>{teamShort(game, p.clubId)}</ClubLink> : t('world.dtFreeAgent')})</span>
            </td>
            <td className="num muted">{p.nat}</td>
          </tr>
        ))}
      </tbody></table></div>
    </>
  )
}
