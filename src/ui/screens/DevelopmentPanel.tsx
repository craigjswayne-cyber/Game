import { useState } from 'react'
import { useStore } from '../../store'
import type { Player, TrainingFocus } from '../../game/model'
import { planCap, activePlan, activeEntry } from '../../game/season'
import { isForward } from '../../game/bench'
import { FOCUS_MAX_AGE, FOCUS_SLOTS, focusBlock, focusIds, planBlock, planIds, setFocus, setPlan, setPlan2 } from '../../game/development'
import { monthKey } from '../../game/devproject'
import { scoutPa } from '../../game/scout'
import { SectionTitle } from '../components'
import { IcoSearch } from '../icons'
import { t } from '../../game/i18n'

/* the six programmes a man can be put on; balanced is the squad session */
const KINDS: { id: TrainingFocus; name: string }[] = [
  { id: 'scrum', name: 'training.focusScrum' },
  { id: 'lineout', name: 'training.focusLineout' },
  { id: 'attack', name: 'training.focusAttack' },
  { id: 'defence', name: 'training.focusDefence' },
  { id: 'fitness', name: 'training.focusFitness' },
  { id: 'kicking', name: 'training.focusKicking' },
]

type Unit = 'all' | 'fwd' | 'back'

/**
 * Development focus and personal plans, as two full lists (owner, 1.8.0: "they
 * need to be more so I can select any player who reaches the criteria").
 *
 * The old screen showed ten names for one and twelve for the other and
 * nothing else, so the choice was the screen's before it was the manager's.
 * Now every man in the squad is here: the ones who qualify first, each with
 * why he is worth a place, and the ones who do not behind a toggle, each with
 * why not. The rules and the places are the game's (game/development.ts),
 * stated above the list, with the count of free places in the title.
 */
export default function DevelopmentPanel() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  // a pick is a career decision: it goes to disk, not only to the screen
  const persist = useStore(s => s.persist)
  const save = () => { touch(); void persist() }
  const [view, setView] = useState<'focus' | 'plans'>('focus')
  const [q, setQ] = useState('')
  const [unit, setUnit] = useState<Unit>('all')
  const [showAll, setShowAll] = useState(false)
  // the refusal belongs to the row that was tapped (the StaffPanel lesson)
  const [said, setSaid] = useState<number | null>(null)
  const club = game.clubs[game.userClubId]
  const squad = club.players.map(id => game.players[id]).filter((p): p is Player => !!p)

  const focusOn = focusIds(game)
  const planOn = planIds(game)
  const cap = view === 'focus' ? FOCUS_SLOTS : planCap(game)
  // places that count: a focused man who no longer qualifies holds nothing
  const used = view === 'focus' ? focusOn.filter(id => !focusBlock(game.players[id])).length : planOn.length
  const free = Math.max(0, cap - used)
  const block = (p: Player) => (view === 'focus' ? focusBlock(p) : planBlock(p))
  const isOn = (p: Player) => (view === 'focus' ? focusOn.includes(p.id) : planOn.includes(p.id))

  const needle = q.trim().toLowerCase()
  const match = (p: Player) => (!needle || p.name.toLowerCase().includes(needle))
    && (unit === 'all' || (unit === 'fwd') === isForward(p.pos))
  // the room the STAFF see (1.8.2: a young man's ceiling is their estimate,
  // scout.ts paRange), not the hidden number
  const room = (p: Player) => Math.max(0, Math.round(scoutPa(game, p)) - p.ca)
  const order = (a: Player, b: Player) => view === 'focus' ? room(b) - room(a) : b.ca - a.ca
  const chosen = squad.filter(p => isOn(p)).sort(order)
  const eligible = squad.filter(p => !isOn(p) && !block(p)).sort(order)
  const ineligible = squad.filter(p => !isOn(p) && block(p)).sort(order)
  const rows = [...chosen, ...eligible.filter(match), ...(showAll ? ineligible.filter(match) : [])]
  const hiddenIneligible = ineligible.filter(match).length

  const roomKey = (p: Player) => room(p) >= 12 ? 'training.roomLots' : room(p) >= 5 ? 'training.roomSome' : 'training.roomLittle'
  const absorbKey = (p: Player) => p.age <= 23 ? 'training.absorbFull' : p.age <= 28 ? 'training.absorbNormal' : 'training.absorbLess'

  return (
    <>
      <div className="tab-bar" style={{ marginTop: 6 }}>
        <button className={view === 'focus' ? 'active' : ''} onClick={() => { setView('focus'); setSaid(null) }}>
          {t('training.devFocus')} <b>{focusOn.filter(id => !focusBlock(game.players[id])).length}/{FOCUS_SLOTS}</b>
        </button>
        <button className={view === 'plans' ? 'active' : ''} onClick={() => { setView('plans'); setSaid(null) }}>
          {t('training.personalPlans')} <b>{planOn.length}/{planCap(game)}</b>
        </button>
      </div>
      <SectionTitle sub={free > 0 ? t('training.placesFree', { n: free, cap }) : t('training.placesNone', { cap })}>
        {t(view === 'focus' ? 'training.devFocus' : 'training.personalPlans')}
      </SectionTitle>
      <div className="card" style={{ padding: '8px 10px', borderLeft: '4px solid var(--gold)' }}>
        <div className="fact-label">{t('training.whoQualifies')}</div>
        <div className="meta" style={{ fontSize: 12 }}>
          {view === 'focus'
            ? t('training.focusRule', { age: FOCUS_MAX_AGE, cap: FOCUS_SLOTS })
            : t('training.planRule', { cap })}
        </div>
      </div>
      <div className="filter-line" style={{ marginBottom: 6 }}>
        <label className="inline-input" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '2 1 0' }}>
          <span style={{ width: 15, height: 15, display: 'inline-flex', flexShrink: 0, color: 'var(--text-muted)' }}><IcoSearch /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('training.searchName')}
            aria-label={t('training.searchName')}
            style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', outline: 'none', width: '100%', minWidth: 0, padding: 0 }} />
        </label>
        {(['all', 'fwd', 'back'] as Unit[]).map(u => (
          <button key={u} className={`inline-input filter-btn${unit === u ? ' on' : ''}`} onClick={() => setUnit(u)}>
            {t(u === 'all' ? 'training.unitAll' : u === 'fwd' ? 'training.unitFwd' : 'training.unitBack')}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: '2px 10px' }}>
        {rows.length === 0 && <div className="meta" style={{ fontSize: 12, padding: '8px 0' }}>{t('training.noMatch')}</div>}
        {rows.map((p, i) => {
          const on = isOn(p)
          const no = block(p)
          const cur = view === 'plans' ? activePlan(game, p.id) : null
          // why he is worth a place, or why he cannot have one
          const why = no ? t(no, { age: FOCUS_MAX_AGE })
            : view === 'focus' ? t(roomKey(p)) : t(absorbKey(p))
          const full = !on && free === 0
          return (
            <div key={p.id} data-dev-row={p.id} style={{ padding: '7px 0', borderTop: i ? '1px solid var(--border)' : undefined, opacity: no && !on ? 0.62 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {/* a chosen man is marked, not only by the control on his right */}
                    {on && <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: 'var(--gold)', marginRight: 6, verticalAlign: 'middle' }} />}
                    {p.name} <span className="muted" style={{ fontWeight: 600, fontSize: 12 }}>{p.pos} · {p.age}{p.acad ? ` · ${t('training.tagAcademy')}` : ''}{p.onLoan ? ` · ${t('training.tagLoan')}` : ''}</span>
                  </div>
                  <div className="meta" style={{ fontSize: 12, color: no ? 'var(--text-negative)' : undefined }}>{why}</div>
                </div>
                {view === 'focus' ? (
                  <button className={on || full ? 'btn ghost dev-act' : 'btn dev-act'} style={{ padding: '5px 12px', fontSize: 12, flexShrink: 0 }}
                    disabled={!on && !!no}
                    onClick={() => {
                      if (!on && full) { setSaid(p.id); return }
                      setFocus(game, p.id, !on); setSaid(null); save()
                    }}>
                    {t(on ? 'training.remove' : 'training.add')}
                  </button>
                ) : (
                  <select className="inline-input" style={{ margin: 0, width: 128, flexShrink: 0, fontSize: 12, padding: '6px 6px' }}
                    value={cur ?? ''} disabled={!on && !!no}
                    aria-label={t('training.planFor', { name: p.name })}
                    onChange={e => {
                      const v = (e.target.value || null) as TrainingFocus | null
                      if (v && !on && full) { setSaid(p.id); return }
                      setPlan(game, p.id, v); setSaid(null); save()
                    }}>
                    <option value="">{t('training.planNone')}</option>
                    {KINDS.map(k => <option key={k.id} value={k.id}>{t(k.name)}</option>)}
                  </select>
                )}
              </div>
              {/* THE DEVELOPMENT PLAN (1.8.2): how the month is going for a man
                  on a programme or a focus place, and a second programme that
                  splits his week (devproject.ts, season.ts rollPlan) */}
              {on && (
                <div className="meta" style={{ fontSize: 12, marginTop: 3 }}>
                  {view === 'plans' && (activeEntry(game, p.id)?.pts ?? 0) > 0 && <>{t('dev.planOne', { plan: t(KINDS.find(k => k.id === cur)?.name ?? 'training.planNone'), n: activeEntry(game, p.id)?.pts ?? 0 })} </>}
                  {t(monthKey(game, p))}
                </div>
              )}
              {on && view === 'plans' && cur && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="meta muted" style={{ flex: 1, minWidth: 0, fontSize: 11.5 }}>{t('dev.plan2Hint')}</span>
                  <select className="inline-input" style={{ margin: 0, width: 128, flexShrink: 0, fontSize: 12, padding: '6px 6px' }}
                    value={activeEntry(game, p.id)?.plan2 ?? ''}
                    aria-label={t('dev.plan2For', { name: p.name })}
                    onChange={e => {
                      setPlan2(game, p.id, (e.target.value || null) as TrainingFocus | null); save()
                    }}>
                    <option value="">{t('dev.plan2None')}</option>
                    {KINDS.filter(k => k.id !== cur).map(k => <option key={k.id} value={k.id}>{t(k.name)}</option>)}
                  </select>
                </div>
              )}
              {said === p.id && full && (
                <div className="meta" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginTop: 3 }}>
                  {t('training.bookFull', { cap })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {hiddenIneligible > 0 || showAll ? (
        <button className="btn ghost dev-act" style={{ margin: '6px 14px 0', fontSize: 12, padding: '6px 12px' }} onClick={() => setShowAll(!showAll)}>
          {showAll ? t('training.hideIneligible') : t('training.showIneligible', { n: hiddenIneligible })}
        </button>
      ) : null}
    </>
  )
}
