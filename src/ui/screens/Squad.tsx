import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { POS_ORDER, fmtMoney, type Player } from '../../game/model'
import { AvailTag, FormPill, Nat, PosBadge, SectionTitle, Stars } from '../components'

type SortKey = 'pos' | 'name' | 'age' | 'ca' | 'form' | 'cond' | 'value' | 'apps' | 'tries' | 'points'

export default function Squad() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [sort, setSort] = useState<SortKey>('pos')
  const [desc, setDesc] = useState(false)

  const club = game.clubs[game.userClubId]
  const players = useMemo(() => {
    const ps = club.players.map(id => game.players[id]).filter(Boolean)
    const dir = desc ? -1 : 1
    const posIdx = (p: Player) => POS_ORDER.indexOf(p.pos)
    ps.sort((a, b) => {
      switch (sort) {
        case 'pos': return (posIdx(a) - posIdx(b) || b.ca - a.ca) * dir
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'age': return (a.age - b.age) * dir
        case 'ca': return (b.ca - a.ca) * dir
        case 'form': return (b.form - a.form) * dir
        case 'cond': return (b.cond - a.cond) * dir
        case 'value': return (b.value - a.value) * dir
        case 'apps': return (b.stats.apps - a.stats.apps) * dir
        case 'tries': return (b.stats.tries - a.stats.tries) * dir
        case 'points': return (b.stats.points - a.stats.points) * dir
      }
    })
    return ps
  }, [club.players, game.players, sort, desc, game.week])

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className={`th-sort${sort === k ? ' active' : ''}`}
      onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(false)))}>
      {children}{sort === k ? (desc ? ' ▴' : ' ▾') : ''}
    </th>
  )

  const wageBill = club.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)

  return (
    <>
      <SectionTitle sub={`${players.length} players · ${fmtMoney(wageBill)}/wk`}>First Team Squad</SectionTitle>
      <div className="tblwrap"><table className="dtable">
        <thead>
          <tr>
            <Th k="pos">Pos</Th>
            <Th k="name">Name</Th>
            <Th k="age">Age</Th>
            <th>Nat</th>
            <Th k="ca">Ability</Th>
            <Th k="form">Form</Th>
            <Th k="cond">Fit</Th>
            <Th k="apps">Ap</Th>
            <Th k="tries">T</Th>
            <Th k="points">Pts</Th>
            <Th k="value">Value</Th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} onClick={() => go('player', p.id)}>
              <td><PosBadge pos={p.pos} /></td>
              <td className="name">{p.name} <AvailTag p={p} g={game} /></td>
              <td className="num">{p.age}</td>
              <td><Nat code={p.nat} /></td>
              <td><Stars ca={p.ca} /></td>
              <td><FormPill v={p.form} /></td>
              <td className="num" style={{ color: p.cond < 70 ? '#9b2c2c' : undefined }}>{Math.round(p.cond)}%</td>
              <td className="num">{p.stats.apps}</td>
              <td className="num">{p.stats.tries}</td>
              <td className="num">{p.stats.points}</td>
              <td className="num">{fmtMoney(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
