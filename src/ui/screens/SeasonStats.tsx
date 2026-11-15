import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { MIN_KICKS, seasonBoards, type StatRow, type TeamRow } from '../../game/leaders'
import { ClubLink, CrestT, SectionTitle } from '../components'
import { t } from '../../game/i18n'
import { rowNavTr } from '../rowNav'

/** The Fixtures screen's Stats tab (1.9.13, game/leaders.ts): the season's
 *  leaders for the clubs in one competition. A board with nobody on it is left
 *  out, so two rounds in the page is short rather than a stack of headings
 *  over nothing (the Team of the Week's rule, UI QA 1.8.0). */
export default function SeasonStats({ compId }: { compId: string }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const b = seasonBoards(game, compId)

  const players = (title: string, rows: StatRow[], val: (r: StatRow) => string, sub?: string) => rows.length === 0 ? null : (
    <>
      <SectionTitle sub={sub}>{title}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {rows.map((r, i) => (
          <tr key={r.p.id} {...rowNavTr(() => go('player', r.p.id))}>
            <td className="num muted">{i + 1}</td>
            <td className="name">{r.p.name} <span className="muted">({r.p.clubId ? <ClubLink g={game} clubId={r.p.clubId}>{teamShort(game, r.p.clubId)}</ClubLink> : '-'})</span></td>
            <td className="num" style={{ fontWeight: 700 }}>{val(r)}</td>
          </tr>
        ))}
      </tbody></table></div>
    </>
  )
  const teams = (title: string, rows: TeamRow[], sub?: string) => rows.length === 0 ? null : (
    <>
      <SectionTitle sub={sub}>{title}</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {rows.map((r, i) => (
          <tr key={r.teamId} className={r.teamId === game.userClubId ? 'me' : ''}>
            <td className="num muted">{i + 1}</td>
            <td className="name"><CrestT g={game} teamId={r.teamId} size={15} /> <ClubLink g={game} clubId={r.teamId}>{teamShort(game, r.teamId)}</ClubLink></td>
            <td className="num" style={{ fontWeight: 700 }}>{r.n}</td>
          </tr>
        ))}
      </tbody></table></div>
    </>
  )

  const all = t('tables.allCompsThisSeason')
  const empty = !b.tries.length && !b.points.length && !b.tackles.length && !b.teamTries.length
  // YOUR SEASON IN THE 22 (1.9.13, rugby's xG: finalize.ts state.in22). Your
  // own matches only: the visits are read from a match's lines, and only the
  // manager's matches keep them.
  const z = game.in22?.season === game.season && game.in22.m > 0 ? game.in22 : null
  const per = (p: number, v: number) => (v ? p / v : 0).toFixed(1)
  const in22 = z && (
    <>
      <SectionTitle sub={all}>{t('tables.in22Title')}</SectionTitle>
      <div className="tblwrap"><table className="dtable in22-table">
        <thead><tr><th /><th className="num">{t('tables.colYou')}</th><th className="num">{t('tables.colOpp')}</th></tr></thead>
        <tbody>
          <tr><td>{t('matchday.st22')}</td><td className="num">{z.v}</td><td className="num">{z.ov}</td></tr>
          <tr><td>{t('matchday.stPerVisit')}</td><td className="num" style={{ fontWeight: 700 }}>{per(z.p, z.v)}</td><td className="num">{per(z.op, z.ov)}</td></tr>
        </tbody>
      </table></div>
    </>
  )
  if (empty) return in22 || <div className="card muted">{t('tables.statsNone')}</div>
  return (
    <>
      {in22}
      {players(t('tables.topTryScorers'), b.tries, r => String(r.n), all)}
      {players(t('tables.topPointsScorers'), b.points, r => String(r.n), all)}
      {players(t('tables.topTacklers'), b.tackles, r => String(r.n), all)}
      {players(t('tables.tackleRate'), b.tackleRate, r => t('player.kickLine', { ...r.line! }), t('tables.tackleRateSub'))}
      {players(t('tables.topKickers'), b.kickers, r => t('player.kickLine', { ...r.line! }), t('tables.topKickersSub', { n: MIN_KICKS }))}
      {players(t('world.dtRatings'), b.rating, r => r.n.toFixed(2), all)}
      {players(t('tables.motmAwards'), b.motm, r => String(r.n), all)}
      {players(t('tables.dropGoals'), b.drops, r => String(r.n), all)}
      {players(t('tables.discipline'), b.cards, r => t('tables.cardLine', { y: r.y ?? 0, r: r.r ?? 0 }), t('tables.disciplineSub'))}
      {teams(t('tables.teamTries'), b.teamTries)}
      {teams(t('tables.bestDefence'), b.defence, t('tables.bestDefenceSub'))}
    </>
  )
}
