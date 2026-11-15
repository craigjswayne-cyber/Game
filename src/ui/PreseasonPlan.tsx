import { useState } from 'react'
import { useStore } from '../store'
import { t } from '../game/i18n'
import { ATK_STYLES, DEF_STYLES, atkName, defName } from '../game/styles'
import { ROUTINES, routineEffect } from '../game/playbook'
import type { TrainingFocus } from '../game/model'
import { planDraft, planThisSeason, planWeeks, setPreseasonPlan } from '../game/preseasonplan'
import { acc } from './accent'

const FOCI: TrainingFocus[] = ['balanced', 'scrum', 'lineout', 'attack', 'defence', 'fitness', 'kicking']
const FOCUS_KEY: Record<TrainingFocus, string> = {
  balanced: 'training.focusBalanced', scrum: 'training.focusScrum', lineout: 'training.focusLineout',
  attack: 'training.focusAttack', defence: 'training.focusDefence', fitness: 'training.focusFitness', kicking: 'training.focusKicking',
}

/**
 * THE SEASON PLAN (1.9.14, preseasonplan.ts): one card on Home in the
 * pre-season weeks. How we play (the attack and defence styles), the set plays
 * the pack drills (the lineout and scrum calls), and the training focus for the
 * opening weeks, with Set-Piece Work if the calls are to be drilled hard. Set,
 * it folds to one line with a Change button; every part stays on its own
 * screen too.
 */
export function PreseasonPlan() {
  const game = useStore(s => s.game)
  const touch = useStore(s => s.touch)
  useStore(s => s.tick)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => (game ? planDraft(game) : null))
  if (!game || !draft || !planWeeks(game)) return null
  const club = game.clubs[game.userClubId]
  const set = planThisSeason(game)

  if (set && !editing) {
    const lo = ROUTINES.find(r => r.id === set.lineout), sc = ROUTINES.find(r => r.id === set.scrum)
    return (
      <div className="card preplan done" data-preplan="set" style={{ ...acc('var(--primary)') }}>
        <h3>{t('preplan.title')}</h3>
        <div className="meta" data-preplan-summary>
          {[t(atkName(set.atk)), t(defName(set.def)), lo && t(lo.name), sc && t(sc.name), t(FOCUS_KEY[set.focus])].filter(Boolean).join(' · ')}
        </div>
        <button type="button" className="btn ghost tiny" onClick={() => { setDraft(planDraft(game)); setEditing(true) }}>
          {t('preplan.change')}
        </button>
      </div>
    )
  }

  const pick = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft({ ...draft, [k]: v })
  const opt = (on: boolean, label: string, onClick: () => void, key: string, sub?: string) => (
    <button key={key} type="button" className={`pp-opt${on ? ' sel' : ''}`} role="radio" aria-checked={on} data-opt={key} onClick={onClick}>
      <span>{label}</span>{sub && <small>{sub}</small>}
    </button>
  )
  const drilled = (id: string) => {
    const q = club ? routineEffect(club, id).q : 0
    return t(q >= 0 ? 'preplan.drilled' : 'preplan.notDrilled')
  }

  return (
    <div className="card preplan" data-preplan="open" style={{ ...acc('var(--primary)') }}>
      <h3>{t('preplan.title')}</h3>
      <div className="meta">{t('preplan.sub')}</div>

      <div className="pp-q">{t('preplan.how')}</div>
      <div className="pp-label">{t('preplan.attack')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.attack')} data-group="atk">
        {ATK_STYLES.map(id => opt(draft.atk === id, t(atkName(id)), () => pick('atk', id), id))}
      </div>
      <div className="pp-label">{t('preplan.defence')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.defence')} data-group="def">
        {DEF_STYLES.map(id => opt(draft.def === id, t(defName(id)), () => pick('def', id), id))}
      </div>

      <div className="pp-q">{t('preplan.drill')}</div>
      <div className="pp-label">{t('preplan.drillNote')}</div>
      <div className="pp-label">{t('preplan.lineout')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.lineout')} data-group="lineout">
        {ROUTINES.filter(r => r.kind === 'lineout').map(r => opt(draft.lineout === r.id, t(r.name), () => pick('lineout', r.id), r.id, drilled(r.id)))}
      </div>
      <div className="pp-label">{t('preplan.scrum')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.scrum')} data-group="scrum">
        {ROUTINES.filter(r => r.kind === 'scrum').map(r => opt(draft.scrum === r.id, t(r.name), () => pick('scrum', r.id), r.id, drilled(r.id)))}
      </div>
      <label className="pp-check">
        <input type="checkbox" checked={draft.setpiece} onChange={e => pick('setpiece', e.target.checked)} />
        <span>{t('preplan.setpiece')}</span>
      </label>

      <div className="pp-q">{t('preplan.focus')}</div>
      <div className="pp-opts" role="radiogroup" aria-label={t('preplan.focus')} data-group="focus">
        {FOCI.map(f => opt(draft.focus === f, t(FOCUS_KEY[f]), () => pick('focus', f), f))}
      </div>

      <div className="pp-foot">
        <div className="meta">{t('preplan.note')}</div>
        <button type="button" className="btn gold" data-preplan-set onClick={() => { setPreseasonPlan(game, draft); setEditing(false); touch() }}>
          {t('preplan.set')}
        </button>
      </div>
    </div>
  )
}
