import { useState } from 'react'
import { useStore } from '../../store'
import { sortTable } from '../../game/schedule'
import { teamShort } from '../../game/matchEngine'
import { ordinal } from '../../game/gossip'
import { CrestT, SectionTitle } from '../components'

/** The full-time round-up: everyone else's scores and the table as it
 *  stands, shown straight after your own final whistle. */
export default function WeekResults({ param }: { param: string }) {
  const game = useStore(s => s.game)!
  const { back, go } = useStore.getState()
  const [compId, wkStr] = param.split(':')
  const week = Number(wkStr)
  const comp = game.comps[compId]
  const results = game.fixtures
    .filter(f => f.compId === compId && f.week === week && f.played)
    .sort((a, b) => (a.homeId === game.userClubId || a.awayId === game.userClubId ? -1 : 0) - (b.homeId === game.userClubId || b.awayId === game.userClubId ? -1 : 0))
  const rows = comp && comp.type === 'league' ? sortTable(comp.table) : []
  const myPos = rows.findIndex(r => r.teamId === game.userClubId) + 1
  const [tab, setTab] = useState<'results' | 'table'>('results')

  return (
    <>
      <div className="tab-bar">
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Results</button>
        {rows.length > 0 && (
          <button className={tab === 'table' ? 'active' : ''} onClick={() => setTab('table')}>
            Table{myPos > 0 ? ` (${ordinal(myPos)})` : ''}
          </button>
        )}
      </div>
      {tab === 'results' && (<>
      <SectionTitle sub={comp?.name ?? (compId === 'fr' ? 'Pre-season friendlies' : undefined)}>This Week's Results</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {results.map(f => {
          const mine = f.homeId === game.userClubId || f.awayId === game.userClubId
          return (
            <tr key={f.id} className={mine ? 'me' : ''}>
              <td className="name" style={{ textAlign: 'right' }}>
                {teamShort(game, f.homeId)} <CrestT g={game} teamId={f.homeId} size={15} />
              </td>
              <td className="num" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{f.homeScore} – {f.awayScore}</td>
              <td className="name">
                <CrestT g={game} teamId={f.awayId} size={15} /> {teamShort(game, f.awayId)}
              </td>
            </tr>
          )
        })}
        {results.length === 0 && <tr><td className="muted" style={{ padding: 14 }}>No other results this round.</td></tr>}
      </tbody></table></div>

      </>)}
      {tab === 'table' && rows.length > 0 && (
        <>
          <SectionTitle sub={myPos > 0 ? `you are ${ordinal(myPos)}` : undefined}>How The Table Stands</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead>
              <tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th>
                <th className="num">+/-</th><th className="num">Pts</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className={r.teamId === game.userClubId ? 'me' : ''}>
                  <td className="num muted">{i + 1}</td>
                  <td className="name"><CrestT g={game} teamId={r.teamId} size={16} />{teamShort(game, r.teamId)}</td>
                  <td className="num">{r.p}</td>
                  <td className="num">{r.w}</td>
                  <td className="num">{r.pf - r.pa}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      {comp && comp.type !== 'league' && (
        <button className="btn ghost block" onClick={() => go('tables', compId)}>View full competition ▸</button>
      )}
      <button className="btn gold block" style={{ margin: '12px 14px' }} onClick={back}>Back to the Dressing Room ▸</button>
      <div className="spacer" />
    </>
  )
}
