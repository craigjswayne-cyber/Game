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
import { ordinal } from '../game/gossip'
import { CrestT } from './components'

/** Leagues where the bottom club goes down. */
const RELEGATES = ['prem', 'champ', 'top14']

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
      <div className="tblwrap"><table className="dtable ltable">
        <thead>
          <tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th>
            <th className="num">D</th><th className="num">L</th><th className="num">+/-</th>
            <th className="num">BP</th><th className="num">Pts</th></tr>
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
                  ...(inPlayoffs ? { background: 'color-mix(in srgb, #c9a227 12%, transparent)' } : undefined),
                  ...(goesDown ? { background: 'color-mix(in srgb, #9b2c2c 10%, transparent)' } : undefined),
                  ...(playoffLine && i === playoffLine - 1 ? { borderBottom: '2px solid #c9a227' } : undefined),
                }}>
                <td className="num muted">{i + 1}</td>
                <td className="name">
                  <CrestT g={game} teamId={r.teamId} size={17} />{teamShort(game, r.teamId)}
                  {r.teamId === game.userClubId && game.preds?.[r.teamId] != null && (
                    <span className="muted" style={{ fontSize: 10.5, marginLeft: 5 }}>pred {ordinal(game.preds[r.teamId])}</span>
                  )}
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
      {!compact && (playoffLine || relegates) && (
        <div className="meta" style={{ padding: '4px 16px', fontSize: 11.5 }}>
          {playoffLine ? `🟡 Top ${playoffLine}: playoff places` : ''}
          {playoffLine && relegates ? ' · ' : ''}
          {relegates ? '🔻 Bottom: relegation' : ''}
        </div>
      )}
    </>
  )
}
