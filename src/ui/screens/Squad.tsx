import { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { POS_ORDER, fmtMoney, type Player } from '../../game/model'
import { starPlayerIds } from '../../game/analysis'
import { AvailTag, Nat, PosBadge, SectionTitle, Stars } from '../components'

// FM Mobile squad layout: Pkd chip, fitness ring, starred names,
// morale arrows, Av R and Value — with a View switcher.

type View = 'selection' | 'general' | 'stats'
type SortKey = 'pos' | 'name' | 'age' | 'ca' | 'form' | 'cond' | 'value' | 'apps' | 'tries' | 'points' | 'avr' | 'pkd'

function FitRing({ v }: { v: number }) {
  const c = v >= 85 ? '#2f7d4f' : v >= 68 ? '#c9a227' : '#a12f2f'
  return (
    <span title={`${Math.round(v)}% fit`} style={{
      display: 'inline-block', width: 11, height: 11, borderRadius: '50%',
      border: `2.5px solid ${c}`, verticalAlign: -1,
    }} />
  )
}

function MoraleArrow({ v }: { v: number }) {
  if (v >= 7) return <span style={{ color: '#2f7d4f', fontSize: 14 }}>▲</span>
  if (v >= 4.5) return <span style={{ color: '#c9a227', fontSize: 14 }}>►</span>
  return <span style={{ color: '#a12f2f', fontSize: 14 }}>▼</span>
}

export default function Squad() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [view, setView] = useState<View>('selection')
  const [sort, setSort] = useState<SortKey>('pkd')
  const [desc, setDesc] = useState(false)

  const club = game.clubs[game.userClubId]
  const stars = useMemo(() => starPlayerIds(game, club.id), [game, club.id, game.week])
  const pkdOf = (p: Player) => {
    const i = club.tactic.lineup.indexOf(p.id)
    return i < 0 ? 99 : i
  }

  const players = useMemo(() => {
    const ps = club.players.map(id => game.players[id]).filter(Boolean)
    const dir = desc ? -1 : 1
    const posIdx = (p: Player) => POS_ORDER.indexOf(p.pos)
    const avr = (p: Player) => (p.stats.apps ? p.stats.ratingSum / p.stats.apps : 0)
    ps.sort((a, b) => {
      switch (sort) {
        case 'pkd': return (pkdOf(a) - pkdOf(b) || posIdx(a) - posIdx(b)) * dir
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
        case 'avr': return (avr(b) - avr(a)) * dir
      }
    })
    return ps
  }, [club.players, game.players, sort, desc, game.week, club.tactic.lineup])

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`th-sort${sort === k ? ' active' : ''}${right ? ' num' : ''}`}
      onClick={() => (sort === k ? setDesc(!desc) : (setSort(k), setDesc(false)))}>
      {children}{sort === k ? (desc ? ' ▴' : ' ▾') : ''}
    </th>
  )

  const Pkd = ({ p }: { p: Player }) => {
    const i = club.tactic.lineup.indexOf(p.id)
    if (i < 0) return <td />
    const xv = i < 15
    return (
      <td>
        <span style={{
          display: 'inline-block', minWidth: 26, textAlign: 'center',
          fontFamily: 'var(--cond)', fontWeight: 700, fontSize: 12.5,
          borderRadius: 4, padding: '1.5px 4px',
          background: xv ? 'var(--club1)' : 'color-mix(in srgb, var(--club1) 30%, var(--paper))',
          color: xv ? '#fff' : 'var(--ink)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15)',
        }}>{xv ? i + 1 : `S${i - 14}`}</span>
      </td>
    )
  }

  const NameCell = ({ p }: { p: Player }) => (
    <td className="name">
      <FitRing v={p.cond} />{' '}
      {p.name}{stars.has(p.id) ? ' ⭐' : ''} <AvailTag p={p} g={game} />
    </td>
  )

  const wageBill = club.players.reduce((s, id) => s + (game.players[id]?.wage ?? 0), 0)

  return (
    <>
      <div className="tab-bar">
        {(['selection', 'general', 'stats'] as View[]).map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {v === 'selection' ? 'Selection' : v === 'general' ? 'General Info' : 'Stats'}
          </button>
        ))}
      </div>
      <SectionTitle sub={`${players.length} players · ${fmtMoney(wageBill)}/wk`}>Club Squad</SectionTitle>
      <div className="tblwrap"><table className="dtable zebra">
        <thead>
          {view === 'selection' && (
            <tr>
              <Th k="pkd">Pkd</Th>
              <Th k="name">Name</Th>
              <Th k="pos">Pos</Th>
              <Th k="ca">Ability</Th>
              <Th k="form" right>Form</Th>
              <Th k="cond" right>Fit</Th>
            </tr>
          )}
          {view === 'general' && (
            <tr>
              <Th k="pkd">Pkd</Th>
              <Th k="name">Name</Th>
              <Th k="pos">Pos</Th>
              <Th k="age" right>Age</Th>
              <th>Nat</th>
              <th>Mor</th>
              <Th k="avr" right>Av R</Th>
              <Th k="value" right>Value</Th>
            </tr>
          )}
          {view === 'stats' && (
            <tr>
              <Th k="name">Name</Th>
              <Th k="apps" right>Ap</Th>
              <Th k="tries" right>T</Th>
              <Th k="points" right>Pts</Th>
              <th className="num">YC</th>
              <th className="num">RC</th>
              <th className="num">MotM</th>
            </tr>
          )}
        </thead>
        <tbody>
          {players.map(p => {
            const avr = p.stats.apps ? (p.stats.ratingSum / p.stats.apps) : 0
            return (
              <tr key={p.id} onClick={() => go('player', p.id)}>
                {view !== 'stats' && <Pkd p={p} />}
                <NameCell p={p} />
                {view === 'selection' && (<>
                  <td><PosBadge pos={p.pos} /></td>
                  <td><Stars ca={p.ca} /></td>
                  <td className="num" style={{ fontWeight: 700, color: p.form >= 7 ? '#2f7d4f' : p.form < 4.5 ? '#a12f2f' : undefined }}>{p.form.toFixed(1)}</td>
                  <td className="num" style={{ color: p.cond < 70 ? '#a12f2f' : undefined }}>{Math.round(p.cond)}%</td>
                </>)}
                {view === 'general' && (<>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="num">{p.age}</td>
                  <td><Nat code={p.nat} /></td>
                  <td><MoraleArrow v={p.morale} /></td>
                  <td className="num">{avr ? avr.toFixed(2) : '—'}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmtMoney(p.value)}</td>
                </>)}
                {view === 'stats' && (<>
                  <td className="num">{p.stats.apps}</td>
                  <td className="num">{p.stats.tries}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{p.stats.points}</td>
                  <td className="num">{p.stats.yc}</td>
                  <td className="num">{p.stats.rc}</td>
                  <td className="num">{p.stats.motm}</td>
                </>)}
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="spacer" />
    </>
  )
}
