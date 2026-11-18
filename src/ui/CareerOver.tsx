import { useStore } from '../store'
import { t } from '../game/i18n'
import { acc } from './accent'

/**
 * THE END OF A CAREER (1.9.14, prochallenge.ts). A Pro challenge whose
 * deadline passes ends the career (owner: "Career ends"). One screen, over
 * everything, with the two ways out: a new career, or the main menu. The
 * save is left as it was, so the career can still be looked back on from the
 * saves list; it cannot be played on.
 */
export function CareerOver() {
  const game = useStore(s => s.game)
  const { toTitle, go } = useStore.getState()
  useStore(s => s.tick)
  const over = game?.careerOver
  if (!game || !over) return null
  return (
    <div className="career-over" role="dialog" aria-modal="true" aria-label={t('over.title')} data-career-over>
      <div className="card co-box" style={{ ...acc('var(--text-negative)') }}>
        <div className="fact-label">{t('over.kicker')}</div>
        <h1>{t('over.title')}</h1>
        <p>{t(over.k, over.v)}</p>
        <div className="meta">{t('over.record', { w: game.mgr.w, d: game.mgr.d, l: game.mgr.l, n: game.season })}</div>
        <button type="button" className="btn gold block" data-co-new style={{ marginTop: 14 }}
          onClick={() => { toTitle(); setTimeout(() => go('newgame'), 0) }}>{t('over.newCareer')}</button>
        <button type="button" className="btn ghost block" data-co-menu style={{ marginTop: 8 }} onClick={() => toTitle()}>{t('over.menu')}</button>
      </div>
    </div>
  )
}
