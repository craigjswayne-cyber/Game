import { useState } from 'react'
import { useStore } from '../../store'
import { BENCH_SLOTS, XV_SLOTS, type Player, type Pos } from '../../game/model'
import { autoSelect, availablePlayers } from '../../game/matchEngine'
import { effAt } from '../../game/attributes'
import { PRESETS, SLIDER_INFO, sliderReadout } from '../../game/tactics'
import { AvailTag, FormPill, PosBadge, SectionTitle, Stars } from '../components'
import { assistantAdvice } from '../../game/analysis'

export default function Tactics() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)

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
    setSel(null)
    touch()
  }

  // FM Mobile interaction: tap a player to pick him up, tap another slot
  // to swap the two; tap the same slot again for the full squad picker.
  const tapSlot = (slot: number) => {
    if (sel == null) { setSel(slot); return }
    if (sel === slot) { setSel(null); setPickSlot(slot); return }
    const a = t.lineup[sel]
    t.lineup[sel] = t.lineup[slot]
    t.lineup[slot] = a
    setSel(null)
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
      <tr key={slot} onClick={() => tapSlot(slot)}
        className={`${problem ? 'prob-row' : ''}${sel === slot ? ' held-row' : ''}`}>
        <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{shirt}</td>
        <td><PosBadge pos={pos} /></td>
        <td className="name">{p ? p.name : <span className="muted">— tap to select —</span>}
          {p && club.captain === p.id && <b style={{ color: '#a8841a' }}> (C)</b>}
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

  const slider = (info: typeof SLIDER_INFO[number]) => (
    <div className="slider-row" key={info.key}>
      <div className="lbls"><span>{info.lo}</span><b style={{ color: 'var(--accent-ink)' }}>{info.label}</b><span>{info.hi}</span></div>
      <input type="range" min={0} max={100} value={t[info.key]}
        onChange={e => { t[info.key] = Number(e.target.value); touch() }} />
      <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>{sliderReadout(info.key, t[info.key])}</div>
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
        <div className="meta" style={{  }}>{assistantAdvice(game)}</div>
      </div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>©</span>
        <div style={{ flex: 1 }}>
          <div className="fact-label">Club Captain</div>
          <div className="meta">A strong leader lifts attack & defence and calms tempers — leadership matters.</div>
        </div>
        <select className="inline-input" style={{ margin: 0, maxWidth: 210 }}
          value={club.captain ?? ''}
          onChange={e => { club.captain = e.target.value ? Number(e.target.value) : null; touch() }}>
          {club.players.map(id => game.players[id]).filter(Boolean)
            .sort((a, b) => b.a.lea - a.a.lea)
            .map(p => (
              <option key={p.id} value={p.id}>{p.name} (Ldr {p.a.lea})</option>
            ))}
        </select>
      </div>
      <SectionTitle sub="a focused edge for the next match — always with a trade-off">Match Preparation</SectionTitle>
      <div className="preset-row oneline" style={{ padding: '0 14px' }}>
        {([
          ['attack', '⚡ Attacking Shapes', 'Sharper attack (−1% defence)'],
          ['defence', '🛡 Defensive Drills', 'Meaner defence (−1% attack)'],
          ['setpiece', '🏗 Set-Piece Work', 'Scrum & lineout +4% (−1% attack)'],
          ['fitness', '🏃 Conditioning', 'Legs last longer on matchday'],
          ['recovery', '🧖 Recovery Week', 'Squad regains extra fitness this week'],
        ] as const).map(([k, label, desc]) => (
          <button key={k} className="preset-chip" title={desc}
            style={game.matchPrep === k ? undefined : { background: 'var(--cream-3)', color: 'var(--ink-soft)' }}
            onClick={() => { game.matchPrep = game.matchPrep === k ? undefined : k; touch() }}>
            {label}
          </button>
        ))}
      </div>
      {game.matchPrep && <div className="meta" style={{ padding: '4px 14px 0' }}>
        {{
          attack: 'The week is spent on strike moves and width. Attack +3.5%, defence −1%.',
          defence: 'Wall-building: line speed, spacing, scramble. Defence +3.5%, attack −1%.',
          setpiece: 'Live scrummaging and lineout reps. Scrum & lineout +4%, attack −1%.',
          fitness: 'Lung-busters. Your players tire ~8% slower in the next match.',
          recovery: 'Feet up, pool sessions, massage. Everyone recovers extra condition this week.',
        }[game.matchPrep]}
      </div>}
      <SectionTitle sub={sel != null ? `moving ${game.players[t.lineup[sel] ?? -1]?.name ?? 'empty slot'} — tap his new position` : 'tap a player, tap another to swap · tap twice for the squad list'}>Starting XV</SectionTitle>
      <table className="dtable"><tbody>{XV_SLOTS.map((_, i) => renderSlot(i))}</tbody></table>
      <SectionTitle>Replacements</SectionTitle>
      <table className="dtable"><tbody>{BENCH_SLOTS.map((_, i) => renderSlot(15 + i))}</tbody></table>
      <SectionTitle sub="one tap sets all four sliders">Quick Game Plans</SectionTitle>
      <div className="preset-row" style={{ padding: '0 14px' }}>
        {PRESETS.map(p => (
          <button key={p.id} className="preset-chip" title={p.desc}
            onClick={() => { Object.assign(t, p.values); touch() }}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>
      <SectionTitle>Game Plan</SectionTitle>
      {SLIDER_INFO.map(slider)}
      {picker()}
      <div className="spacer" />
    </>
  )
}
