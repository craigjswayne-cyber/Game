import { useStore } from '../store'
import { t } from '../game/i18n'

/**
 * THE BACK PAGE (v1.2.2). One tabloid back page after every match the
 * manager's side played: a headline written from the match's defining event
 * rather than its score, one line underneath in the loser's voice, and a
 * button into the full report. It is the thing you would screenshot for a
 * mate, and it means a match ends on a sentence rather than a table.
 *
 * IT BLOCKS NOTHING, AND IT IS IN THE FLOW. The first build drew this as a
 * modal over a dimmed screen, like the sack; the deep test found it covering
 * Continue and the Annual door after EVERY match (annualprobe: "covered:
 * DIV.backpage-veil"). The second build pinned it under the header with no
 * backdrop - and the soak's watchdog photographed it sitting squarely over an
 * open press question, which is the one thing the week was waiting on. A
 * treat that covers anything is a gate with a nicer font. So it is an
 * ordinary card now, first in the Home screen's flow, rendered by Home and
 * nowhere else: nothing is ever underneath it. It folds on its own button and
 * advancing the week clears it (season.processWeekAndAdvance). The keys
 * travel with values, so it reads in the manager's own language.
 */
export function BackPage() {
  const game = useStore(s => s.game)
  const go = useStore(s => s.go)
  useStore(s => s.tick)
  if (!game?.backPage || game.sacked) return null
  const bp = game.backPage
  const fold = () => { game.backPage = null; useStore.getState().touch() }
  return (
    <div className="card backpage">
        <div className="backpage-strap">{t('bp.strap')}</div>
        <h1 className="backpage-head">{t(bp.hk, bp.hv)}</h1>
        <div className="backpage-sub">{t(bp.sk, bp.sv)}</div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={fold}>{t('bp.close')}</button>
          <button className="btn gold" style={{ flex: 1.3 }} onClick={() => { fold(); go('results', `${bp.compId}:${bp.week}`) }}>
            {t('bp.read')}
          </button>
        </div>
    </div>
  )
}

