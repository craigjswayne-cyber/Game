import { useState } from 'react'
import { useStore } from '../../store'
import { sortTable } from '../../game/schedule'
import { flagOf, nationByCode } from '../../game/nations'
import { SectionTitle } from '../components'
import { weekDate } from '../../game/model'

export default function Nations() {
  const game = useStore(s => s.game)!
  const tabs = ([
    ['wc', '🏆 World Cup'], ['sn', 'Six Nations'], ['trc', 'Rugby Championship'], ['aut', 'Autumn Tests'],
  ] as const).filter(([id]) => game.comps[id])
  const [compId, setCompId] = useState<string>(tabs[0]?.[0] ?? 'sn')
  const comp = game.comps[compId]

  return (
    <>
      <div className="tab-bar">
        {tabs.map(([id, name]) => (
          <button key={id} className={id === compId ? 'active' : ''} onClick={() => setCompId(id)}>{name}</button>
        ))}
      </div>
      {comp && comp.table.length > 0 && (
        <>
          <SectionTitle sub={comp.champion ? `Champions: ${nationByCode(comp.champion)?.name}` : undefined}>{comp.name}</SectionTitle>
          <div className="tblwrap"><table className="dtable">
            <thead><tr><th>#</th><th>Nation</th><th className="num">P</th><th className="num">W</th><th className="num">+/-</th><th className="num">Pts</th></tr></thead>
            <tbody>
              {sortTable(comp.table).map((r, i) => (
                <tr key={r.teamId}>
                  <td className="num muted">{i + 1}</td>
                  <td className="name">{flagOf(r.teamId)} {nationByCode(r.teamId)?.name ?? r.teamId}</td>
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
      <SectionTitle>Results & Fixtures</SectionTitle>
      <div className="tblwrap"><table className="dtable"><tbody>
        {game.fixtures.filter(f => f.compId === compId).sort((a, b) => a.week - b.week).map(f => (
          <tr key={f.id}>
            <td className="muted">{weekDate(game.season, f.week).slice(0, -5)}</td>
            <td className="name">{flagOf(f.homeId)} {nationByCode(f.homeId)?.name} v {nationByCode(f.awayId)?.name} {flagOf(f.awayId)}</td>
            <td className="num">{f.played ? `${f.homeScore}-${f.awayScore}` : '—'}</td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="spacer" />
    </>
  )
}
