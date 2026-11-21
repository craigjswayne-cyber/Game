import { useState } from 'react'
import { useStore } from '../store'
import { t } from '../game/i18n'
import { PLAN_STYLES, PLAN_WORKS, planOpen, planThisSeason, setPreseasonPlan, type PlanStyle, type PlanWork } from '../game/preseasonplan'
import { acc } from './accent'

/**
 * THE SEASON PLAN (1.9.14, preseasonplan.ts): the Season plan tab of Training
 * and Staff, open from the club's last game of a season to its first league
 * match of the next (planOpen). Two questions with three big answers each. Set, it folds
 * to one line with Change; the detail stays on Tactics and Training.
 */
export function PreseasonPlan() {
  const game = useStore(s => s.game)
  const touch = useStore(s => s.touch)
  useStore(s => s.tick)
  const [editing, setEditing] = useState(false)
  const [style, setStyle] = useState<PlanStyle | null>(null)
  const [work, setWork] = useState<PlanWork | null>(null)
  if (!game || !planOpen(game)) return null
  const set = planThisSeason(game)

  if (set && !editing) {
    return (
      <div className="card preplan done" data-preplan="set" style={{ ...acc('var(--primary)') }}>
        <h3>{t('preplan.title')}</h3>
        <div className="meta" data-preplan-summary>{t(`preplan.s_${set.style}`)} · {t(`preplan.w_${set.work}`)}</div>
        <button type="button" className="btn ghost tiny" onClick={() => { setStyle(set.style); setWork(set.work); setEditing(true) }}>
          {t('preplan.change')}
        </button>
      </div>
    )
  }

  const opt = (on: boolean, key: string, name: string, desc: string, onClick: () => void) => (
    <button key={key} type="button" className={`pp-opt${on ? ' sel' : ''}`} role="radio" aria-checked={on} data-opt={key} onClick={onClick}>
      <b>{name}</b><small>{desc}</small>
    </button>
  )

  return (
    <div className="card preplan" data-preplan="open" style={{ ...acc('var(--primary)') }}>
      <h3>{t('preplan.title')}</h3>
      <div className="meta">{t('preplan.sub')}</div>

      <div className="pp-q">{t('preplan.how')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.how')} data-group="style">
        {PLAN_STYLES.map(s => opt(style === s, s, t(`preplan.s_${s}`), t(`preplan.s_${s}Desc`), () => setStyle(s)))}
      </div>

      <div className="pp-q">{t('preplan.work')}</div>
      {/* it lasts as long as its name says (1.9.16) */}
      <div className="meta" style={{ marginTop: -2, marginBottom: 6 }} data-preplan-until>{t('preplan.workUntil')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.work')} data-group="work">
        {PLAN_WORKS.map(w => opt(work === w, w, t(`preplan.w_${w}`), t(`preplan.w_${w}Desc`), () => setWork(w)))}
      </div>

      <button type="button" className="btn gold block pp-set" data-preplan-set disabled={!style || !work}
        onClick={() => { if (!style || !work) return; setPreseasonPlan(game, style, work); setEditing(false); touch() }}>
        {t('preplan.set')}
      </button>
    </div>
  )
}
