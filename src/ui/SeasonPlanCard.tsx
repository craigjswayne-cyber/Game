import { useStore } from '../store'
import { userFixtureThisWeek } from '../game/season'
import { ROT_INTENTS, rankedComps, restList, setSeasonPlan, type RotIntent } from '../game/seasonplan'
import { compLabel, t } from '../game/i18n'
import { SectionTitle } from './components'

const ROT_KEY: Record<RotIntent, string> = {
  strongest: 'selection.rotStrongest', balanced: 'selection.rotBalanced', protect: 'selection.rotProtect',
}
// written out, not built: i18nprobe can only check keys it can read
const ROT_DESC: Record<RotIntent, string> = {
  strongest: 'selection.rotStrongestDesc', balanced: 'selection.rotBalancedDesc', protect: 'selection.rotProtectDesc',
}

/**
 * SEASON PRIORITIES (1.8.2, game/seasonplan.ts). A card on the Selection pane,
 * not a screen: the club's competitions in the manager's order, and one
 * rotation intent. Moving a competition up is the only control the order
 * needs, and any tap here sets the plan, which is what switches it on.
 */
export default function SeasonPlanCard() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const order = rankedComps(game)
  if (order.length < 2) return null
  const plan = game.seasonPlan
  const rot: RotIntent = plan?.rot ?? 'balanced'
  const moveUp = (i: number) => {
    const next = order.slice()
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    setSeasonPlan(game, next, rot)
    touch()
  }
  const fx = userFixtureThisWeek(game)
  const resting = plan && fx ? restList(game, fx) : []
  const status = !plan ? 'selection.planNone' : plan.season !== game.season ? 'selection.planCarried' : null
  return (
    <>
      <SectionTitle sub={t('selection.planSub')}>{t('selection.planTitle')}</SectionTitle>
      <div className="card">
        {order.map((id, i) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
            <b style={{ width: 18, textAlign: 'right' }}>{i + 1}</b>
            <span style={{ flex: 1 }}>{compLabel(game.comps[id]?.name ?? id)}</span>
            {i > 0 && (
              <button className="btn ghost tiny" aria-label={t('selection.planMoveUp')} title={t('selection.planMoveUp')}
                onClick={() => moveUp(i)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 15l6-6 6 6" /></svg>
              </button>
            )}
          </div>
        ))}
        <div className="preset-row">
          {ROT_INTENTS.map(r => (
            <button key={r} className="preset-chip"
              style={plan && r === rot ? undefined : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              onClick={() => { setSeasonPlan(game, order, r); touch() }}>{t(ROT_KEY[r])}</button>
          ))}
        </div>
        <div className="meta" style={{ marginTop: 6 }}>{t(ROT_DESC[rot])}</div>
        {status && <div className="meta muted" style={{ marginTop: 4 }}>{t(status)}</div>}
        {resting.length > 0 && (
          <div className="meta" style={{ marginTop: 4 }}>
            {t('selection.planResting', { names: resting.map(p => p.name).join(t('common.listSep')) })}
          </div>
        )}
      </div>
    </>
  )
}
