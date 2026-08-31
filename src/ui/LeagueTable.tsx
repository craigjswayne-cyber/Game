// The league table, in one place.
//
// It lived inside the Competitions screen, which meant that putting the table on
// Fixtures & Results (user: "fixtures and results should also have the table for
// the league in there as an additional page") had two possible answers: a second
// copy of forty lines of table markup that would drift from the first the moment
// either changed, or this. The playoff line, the relegation shading and the
// predicted-finish chip are rules about how this league is read, and they should
// read the same wherever the table appears.
import { useStore } from '../store'
import { sortTable } from '../game/schedule'
import { teamShort } from '../game/matchEngine'
import { ClubLink, CrestT } from './components'
import { ord, t } from '../game/i18n'

import { RELEGATES } from '../game/model'

export default function LeagueTable({ compId, compact }: { compId: string; compact?: boolean }) {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const comp = game.comps[compId]
  if (!comp) return null

  const rows = sortTable(comp.table)
  const playoffLine = comp.playoffTeams
  const relegates = RELEGATES.includes(compId)

  return (
    <>
      {/* FIXED LAYOUT, LIKE THE SQUAD TABLES (user: "cant see the points in
          the table"). The narrow-screen padding trim was not enough: with
          nowrap cells, auto table layout sizes columns from content minimums,
          so a +/- of 111 and a "pred 2nd" chip riding in the name cell pushed
          POINTS - the one number a league table exists to show - off the
          right edge, and the sideways scroll it fell into is a scroll nothing
          else on the phone has. A colgroup plus .fit makes the table exactly
          as wide as the screen, the name column ellipsises, and the pred chip
          moves to the legend line below where it costs no width. */}
      <div className="tblwrap fitwrap"><table className="dtable ltable fit">
        <colgroup><col width="26" /><col /><col width="24" /><col width="24" /><col width="24" /><col width="24" /><col width="42" /><col width="26" /><col width="34" /></colgroup>
        <thead>
          <tr><th>{t('tables.colRank')}</th><th>{t('tables.colTeam')}</th><th className="num">{t('tables.colP')}</th><th className="num">{t('common.w')}</th>
            <th className="num">{t('common.d')}</th><th className="num">{t('common.l')}</th><th className="num">{t('tables.colDiff')}</th>
            <th className="num">{t('tables.colBP')}</th><th className="num">{t('squad.colPts')}</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const inPlayoffs = !!playoffLine && i < playoffLine
            const goesDown = relegates && i === rows.length - 1
            return (
              <tr key={r.teamId}
                className={r.teamId === game.userClubId ? 'me' : ''}
                onClick={() => game.clubs[r.teamId] && go('club', r.teamId)}
                style={{
                  ...(inPlayoffs ? { background: 'color-mix(in srgb, var(--gold) 12%, transparent)' } : undefined),
                  ...(goesDown ? { background: 'color-mix(in srgb, var(--text-negative) 10%, transparent)' } : undefined),
                  ...(playoffLine && i === playoffLine - 1 ? { borderBottom: '2px solid var(--gold)' } : undefined),
                }}>
                <td className="num muted">{i + 1}</td>
                <td className="name">
                  <CrestT g={game} teamId={r.teamId} size={17} /><ClubLink g={game} clubId={r.teamId}>{teamShort(game, r.teamId)}</ClubLink>
                </td>
                <td className="num">{r.p}</td>
                <td className="num">{r.w}</td>
                <td className="num">{r.d}</td>
                <td className="num">{r.l}</td>
                <td className="num">{r.pf - r.pa}</td>
                <td className="num">{r.bp}</td>
                <td className="num" style={{ fontWeight: 700 }}>{r.pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      {!compact && (playoffLine || relegates || game.preds?.[game.userClubId] != null) && (
        <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
          {playoffLine ? t('tables.playoffLine', { n: playoffLine }) : ''}
          {playoffLine && relegates ? ' · ' : ''}
          {relegates ? t('tables.relegationLine') : ''}
          {comp.teamIds.includes(game.userClubId) && game.preds?.[game.userClubId] != null
            ? `${playoffLine || relegates ? ' · ' : ''}${t('tables.punditsPredicted', { place: ord(game.preds[game.userClubId]) })}`
            : ''}
        </div>
      )}
    </>
  )
}
