import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { seasonLabel } from '../../game/model'
import { SectionTitle } from '../components'

export default function History() {
  const game = useStore(s => s.game)!
  const rows = [...game.history].reverse()
  return (
    <>
      <SectionTitle sub="champions of your era">Roll of Honour</SectionTitle>
      {rows.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>
          No trophies decided yet. History is written in May.
        </div>
      )}
      <div className="tblwrap"><table className="dtable">
        <thead><tr><th>Season</th><th>Competition</th><th>Champions</th></tr></thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={i}>
              <td>{seasonLabel(h.season)}</td>
              <td>{game.comps[h.compId]?.name ?? h.compId}</td>
              <td className="name">🏆 {teamShort(game, h.champion)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
