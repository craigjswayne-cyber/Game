import { useState } from 'react'
import { useStore } from '../../store'
import { BENCH_SLOTS, XV_SLOTS, type Player, type Pos } from '../../game/model'
import { autoSelect, availablePlayers } from '../../game/matchEngine'
import { effAt } from '../../game/attributes'
import { PRESETS, SLIDER_INFO, sliderReadout } from '../../game/tactics'
import { ROLE_BY_ID, rolesForSlot } from '../../game/roles'
import { AvailTag, FormPill, PosBadge, SectionTitle, Stars } from '../components'
import { analystForm, analystRead, PREP_LABEL, UNIT_LABEL } from '../../game/analyst'
import { assistantAdvice } from '../../game/analysis'
import { userFixtureThisWeek } from '../../game/season'

/** The tactics area, split into proper pages (8C feedback): Selection,
 *  In-Form XV, Tactics (formation & roles), Match Prep and Game Plan. */
export default function Tactics() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [ttab, setTtab] = useState<'xv' | 'form' | 'tactics' | 'prep' | 'plan'>('xv')
  const [roleSlot, setRoleSlot] = useState<number | null>(null)

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
        <td className="name">{p ? p.name : <span className="muted">- tap to select -</span>}
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
          <div style={{ padding: '0 12px 10px' }}>
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

  const SPOTS: [number, number][] = [
    [30, 10], [50, 8], [70, 10],
    [40, 21], [60, 21],
    [24, 32], [76, 32], [50, 34],
    [50, 47], [37, 57],
    [12, 76], [52, 64], [66, 71], [88, 76], [50, 87],
  ]
  const go = useStore.getState().go
  const roleSheet = () => {
    if (roleSlot == null) return null
    const pid = t.lineup[roleSlot]
    const p = pid != null ? game.players[pid] : null
    const roles = rolesForSlot(roleSlot)
    const current = t.roles?.[roleSlot] ?? null
    return (
      <div className="modal-veil" onClick={() => setRoleSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="grab" />
          <div style={{ padding: '0 14px 10px' }}>
            <SectionTitle sub={`No. ${XV_SLOTS[roleSlot].shirt} · how should he play the position? · ${roles.length + 1} options`}>
              {p ? p.name : 'Empty slot'}
            </SectionTitle>
            <button className="club-pick" onClick={() => { (t.roles ??= [])[roleSlot] = null; setRoleSlot(null); touch() }}>
              <span style={{ fontSize: 16 }}>{current == null ? '●' : '○'}</span>
              <span className="cname">Natural</span>
              <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>No special instruction.</span>
            </button>
            {roles.map(r => (
              <button key={r.id} className="club-pick" onClick={() => { (t.roles ??= [])[roleSlot] = r.id; setRoleSlot(null); touch() }}>
                <span style={{ fontSize: 16 }}>{current === r.id ? '●' : '○'}</span>
                <span className="cname">{r.name}</span>
                <span className="muted" style={{ maxWidth: '55%', textAlign: 'right' }}>{r.desc}</span>
              </button>
            ))}
            {p && (
              <button className="btn ghost block" style={{ marginTop: 8 }}
                onClick={() => { setRoleSlot(null); go('player', p.id) }}>
                Open {p.name.split(' ').slice(-1)[0]}'s profile ›
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // the in-form XV: natural fits ranked by form first, class second
  const formXV = (): (number | null)[] => {
    const pool = availablePlayers(game, club.players)
    const taken = new Set<number>()
    const lineup: (number | null)[] = new Array(15).fill(null)
    for (let i = 0; i < 15; i++) {
      const pos = XV_SLOTS[i].pos
      const best = pool
        .filter(p => !taken.has(p.id) && (p.pos === pos || p.alt.includes(pos)))
        .sort((a, b) => (b.form * 8 + effAt(b, pos)) - (a.form * 8 + effAt(a, pos)))[0]
        ?? pool.filter(p => !taken.has(p.id)).sort((a, b) => b.form - a.form)[0]
      if (best) { lineup[i] = best.id; taken.add(best.id) }
    }
    return lineup
  }

  return (
    <>
      <div className="tab-bar">
        <button className={ttab === 'xv' ? 'active' : ''} onClick={() => setTtab('xv')}>Selection</button>
        <button className={ttab === 'form' ? 'active' : ''} onClick={() => setTtab('form')}>In-Form XV</button>
        <button className={ttab === 'tactics' ? 'active' : ''} onClick={() => setTtab('tactics')}>Tactics</button>
        <button className={ttab === 'prep' ? 'active' : ''} onClick={() => setTtab('prep')}>Prep</button>
        <button className={ttab === 'plan' ? 'active' : ''} onClick={() => setTtab('plan')}>Game Plan</button>
      </div>

      {ttab === 'xv' && <>
        <div className="btn-row">
          <button className="btn gold" onClick={() => {
            const pool = availablePlayers(game, club.players)
            club.tactic.lineup = autoSelect(game, pool)
            touch()
          }}>Auto-Pick Best XV</button>
        </div>
        <SectionTitle sub={sel != null ? `moving ${game.players[t.lineup[sel] ?? -1]?.name ?? 'empty slot'} - tap his new position` : 'tap a player, tap another to swap · tap twice for the squad list'}>Starting XV</SectionTitle>
        {/* forwards left, backs right in landscape: 23 rows in one column was
            four swipes deep. Two tbody tables stack identically in portrait. */}
        <div className="xv-split">
          <table className="dtable"><tbody>{XV_SLOTS.slice(0, 8).map((_, i) => renderSlot(i))}</tbody></table>
          <table className="dtable"><tbody>{XV_SLOTS.slice(8).map((_, i) => renderSlot(8 + i))}</tbody></table>
        </div>
        <SectionTitle>Replacements</SectionTitle>
        <div className="xv-split">
          <table className="dtable"><tbody>{BENCH_SLOTS.slice(0, 4).map((_, i) => renderSlot(15 + i))}</tbody></table>
          <table className="dtable"><tbody>{BENCH_SLOTS.slice(4).map((_, i) => renderSlot(19 + i))}</tbody></table>
        </div>
        <div className="card-grid">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>©</span>
          <div style={{ flex: 1 }}>
            <div className="fact-label">Club Captain</div>
            <div className="meta">A strong leader lifts attack & defence and calms tempers.</div>
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
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>VC</span>
          <div style={{ flex: 1 }}>
            <div className="fact-label">Vice-Captain</div>
            <div className="meta">Steps up at half the effect when the skipper is absent.</div>
          </div>
          <select className="inline-input" style={{ margin: 0, maxWidth: 210 }}
            value={club.vice ?? ''}
            onChange={e => { club.vice = e.target.value ? Number(e.target.value) : null; touch() }}>
            {club.players.map(id => game.players[id]).filter(p => p && p.id !== club.captain)
              .sort((a, b) => b.a.lea - a.a.lea)
              .map(p => (
                <option key={p.id} value={p.id}>{p.name} (Ldr {p.a.lea})</option>
              ))}
          </select>
        </div>
        </div>
      </>}

      {ttab === 'form' && (() => {
        const xv = formXV()
        const formRow = (pid: number | null, i: number) => {
          const p = pid != null ? game.players[pid] : null
          const pos = XV_SLOTS[i].pos
          const incumbent = t.lineup[i]
          return (
            <tr key={i}>
              <td className="num" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{XV_SLOTS[i].shirt}</td>
              <td><PosBadge pos={pos} /></td>
              <td className="name">{p ? p.name : '-'}
                {p && incumbent !== p.id && <span style={{ color: '#2f7d4f', fontSize: 10, fontWeight: 800 }}> IN</span>}
              </td>
              <td>{p && <FormPill v={p.form} />}</td>
              <td>{p && <Stars ca={effAt(p, pos)} />}</td>
            </tr>
          )
        }
        return (
          <>
            <SectionTitle sub="natural fits ranked on current form - who has earned the shirt">The In-Form XV</SectionTitle>
            <div className="xv-split">
              <table className="dtable"><tbody>{xv.slice(0, 8).map(formRow)}</tbody></table>
              <table className="dtable"><tbody>{xv.slice(8).map((pid, i) => formRow(pid, 8 + i))}</tbody></table>
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn gold" onClick={() => {
                const xv2 = formXV()
                for (let i = 0; i < 15; i++) {
                  const pid = xv2[i]
                  if (pid == null) continue
                  const other = t.lineup.indexOf(pid)
                  if (other >= 0 && other !== i) t.lineup[other] = t.lineup[i]
                  t.lineup[i] = pid
                }
                setTtab('xv')
                touch()
              }}>▸ Pick this XV</button>
            </div>
            <div className="meta" style={{ padding: '4px 16px' }}>
              Form first, class second: hot streaks earn starts here. Players marked IN would come into your current side.
            </div>
          </>
        )
      })()}

      {ttab === 'tactics' && <>
        <div className="form-pitch">
          {SPOTS.map(([x, y], i) => {
            const pid = t.lineup[i]
            const p = pid != null ? game.players[pid] : null
            const role = t.roles?.[i] != null ? ROLE_BY_ID[t.roles![i]!] : null
            return (
              <button key={i} className="form-chip" style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => setRoleSlot(i)}>
                <span className="fc-role">{role ? role.short : XV_SLOTS[i].pos}</span>
                <span className="fc-name">{p ? p.name.split(' ').slice(-1)[0] : '-'}</span>
                <span className="fc-num">{XV_SLOTS[i].shirt}</span>
              </button>
            )
          })}
        </div>
        <div className="meta" style={{ padding: '4px 16px' }}>
          Tap a shirt to set his role or open his profile. Roles are small, honest edges - the scrummager props up the set piece, the playmaker opens the game.
        </div>
      </>}

      {ttab === 'prep' && <>
        <AnalystCard />
        <SectionTitle sub="a focused edge for the next match - always with a trade-off">Match Preparation</SectionTitle>
        <div className="preset-row" style={{ padding: '0 14px', flexWrap: 'wrap', gap: 8 }}>
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
        <div className="card" style={{ marginTop: 10 }}>
          <div className="meta">
            {game.matchPrep ? {
              attack: 'The week is spent on strike moves and width. Attack +3.5%, defence −1%.',
              defence: 'Wall-building: line speed, spacing, scramble. Defence +3.5%, attack −1%.',
              setpiece: 'Live scrummaging and lineout reps. Scrum & lineout +4%, attack −1%.',
              fitness: 'Lung-busters. Your players tire ~8% slower in the next match.',
              recovery: 'Feet up, pool sessions, massage. Everyone recovers extra condition this week.',
            }[game.matchPrep] : 'No focus set this week - training runs on autopilot. Pick one above; every choice trades something away.'}
          </div>
        </div>
      </>}

      {ttab === 'plan' && <>
        <div className="card" style={{ marginTop: 4, borderLeft: '4px solid var(--gold)' }}>
          <div className="meta">{assistantAdvice(game)}</div>
        </div>
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
      </>}

      {picker()}
      {roleSheet()}
      <div className="spacer" />
    </>
  )
}

/**
 * The analyst's read on the next opponent (8-batch feedback). He names a soft
 * spot and the week's work to exploit it. Follow him and a sound read is worth
 * a few percent on the day; he is right most of the time, not every time, and
 * his record is on the card so you can judge him yourself.
 */
function AnalystCard() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const fx = userFixtureThisWeek(game)
  if (!fx) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <div className="fact-label">The Analyst</div>
        <div className="meta">No match this week, so nothing to study. He will have a read on the next opponent as soon as one is in the diary.</div>
      </div>
    )
  }
  const oppId = fx.homeId === game.userClubId ? fx.awayId : fx.homeId
  const opp = game.clubs[oppId]
  const read = analystRead(game, oppId)
  if (!read || !opp) return null
  const followed = game.matchPrep === read.prep
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="fact-label">The Analyst on {opp.short}</div>
        <div className="meta" style={{ fontSize: 11 }}>{analystForm(game)}</div>
      </div>
      <div className="meta" style={{ marginTop: 2 }}>
        <b style={{ color: '#a8841a' }}>{UNIT_LABEL[read.unit]}.</b> {read.claim}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
        <button className="btn gold" style={{ padding: '5px 10px', fontSize: 11.5 }}
          disabled={followed}
          onClick={() => { game.matchPrep = read.prep; touch() }}>
          {followed ? `✓ Preparing ${PREP_LABEL[read.prep]}` : `Work on it: ${PREP_LABEL[read.prep]}`}
        </button>
        <span className="meta" style={{ fontSize: 11 }}>
          {followed
            ? 'The week is his. If he has read them right you will feel it in that area on Saturday.'
            : 'Ignore him and prepare as you see fit - he is wrong often enough to argue with.'}
        </span>
      </div>
    </div>
  )
}
