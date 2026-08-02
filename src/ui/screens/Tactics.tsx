import { useState } from 'react'
import { useStore } from '../../store'
import { BENCH_SLOTS, XV_SLOTS, type Player, type Pos } from '../../game/model'
import { autoSelect, availablePlayers } from '../../game/matchEngine'
import { effAt } from '../../game/attributes'
import { AvailTag, FormPill, PosBadge, SectionTitle, Stars } from '../components'
import { assistantAdvice } from '../../game/analysis'

export default function Tactics() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [pickSlot, setPickSlot] = useState<number | null>(null)

  const club = game.clubs[game.userClubId]
  const t = club.tactic

  const setSlot = (slot: number, pid: number | null) => {
    // remove pid from any other slot first
    if (pid != null) {
      const other = t.lineup.indexOf(pid)
      if (other >= 0) t.lineup[other] = t.lineup[slot]
    }
    t.lineup[slot] = pid
    setPickSlot(null)
    touch()
  }

  const slotPos = (slot: number): Pos => slot < 15 ? XV_SLOTS[slot].pos : BENCH_SLOTS[slot - 15].pos[0]

  const renderSlot = (slot: number) => {
    const shirt = slot < 15 ? XV_SLOTS[slot].shirt : BENCH_SLOTS[slot - 15].shirt
    const pos = slotPos(slot)
    const pid = t.lineup[slot]
    const p = pid != null ? game.players[pid] : null
    const problem = p && (p.injury || p.bans > 0 || p.natSquad || p.clubId !== club.id)
    return (
      <tr key={slot} onClick={() => setPickSlot(slot)} className={problem ? 'prob-row' : undefined}>
        <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{shirt}</td>
        <td><PosBadge pos={pos} /></td>
        <td className="name">{p ? p.name : <span className="muted">— tap to select —</span>}
          {p && <> <AvailTag p={p} g={game} /></>}</td>
        <td>{p && <Stars ca={effAt(p, pos)} />}</td>
        <td>{p && <FormPill v={p.form} />}</td>
        <td className="num">{p ? `${Math.round(p.cond)}%` : ''}</td>
      </tr>
    )
  }

  const picker = () => {
    if (pickSlot == null) return null
    const pos = slotPos(pickSlot)
    const pool = availablePlayers(game, club.players)
      .sort((a, b) => effAt(b, pos) - effAt(a, pos))
    return (
      <div className="modal-veil" onClick={() => setPickSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <SectionTitle sub={`slot ${pickSlot < 15 ? XV_SLOTS[pickSlot].shirt : BENCH_SLOTS[pickSlot - 15].shirt}`}>
            Pick a {pos}
          </SectionTitle>
          <table className="dtable">
            <tbody>
              {pool.map(p => (
                <tr key={p.id} onClick={() => setSlot(pickSlot, p.id)}
                  style={t.lineup.includes(p.id) ? { opacity: .55 } : undefined}>
                  <td><PosBadge pos={p.pos} /></td>
                  <td className="name">{p.name}{t.lineup.includes(p.id) ? ' (selected)' : ''}</td>
                  <td><Stars ca={effAt(p, pos)} /></td>
                  <td><FormPill v={p.form} /></td>
                  <td className="num">{Math.round(p.cond)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn ghost block" onClick={() => setSlot(pickSlot, null)}>Clear Slot</button>
        </div>
      </div>
    )
  }

  const slider = (label: string, lo: string, hi: string, key: 'style' | 'tempo' | 'kicking' | 'aggression') => (
    <div className="slider-row">
      <div className="lbls"><span>{lo}</span><b style={{ color: 'var(--accent-ink)' }}>{label}</b><span>{hi}</span></div>
      <input type="range" min={0} max={100} value={t[key]}
        onChange={e => { t[key] = Number(e.target.value); touch() }} />
    </div>
  )

  return (
    <>
      <div className="btn-row">
        <button className="btn gold" onClick={() => {
          const pool = availablePlayers(game, club.players)
          club.tactic.lineup = autoSelect(game, pool)
          touch()
        }}>Auto-Pick Best XV</button>
      </div>
      <div className="card" style={{ marginTop: 4, borderLeft: '4px solid var(--gold)' }}>
        <div className="meta" style={{ fontStyle: 'italic' }}>{assistantAdvice(game)}</div>
      </div>
      <SectionTitle>Starting XV</SectionTitle>
      <table className="dtable"><tbody>{XV_SLOTS.map((_, i) => renderSlot(i))}</tbody></table>
      <SectionTitle>Replacements</SectionTitle>
      <table className="dtable"><tbody>{BENCH_SLOTS.map((_, i) => renderSlot(15 + i))}</tbody></table>
      <SectionTitle>Game Plan</SectionTitle>
      {slider('Style', 'Forwards / pick-and-go', 'Expansive / wide', 'style')}
      {slider('Tempo', 'Slow & structured', 'High tempo', 'tempo')}
      {slider('Kicking', 'Ball in hand', 'Kick for territory', 'kicking')}
      {slider('Physicality', 'Stay clean', 'Push the limits', 'aggression')}
      {picker()}
      <div className="spacer" />
    </>
  )
}
