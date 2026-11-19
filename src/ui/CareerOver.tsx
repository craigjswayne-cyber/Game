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
/** The screens outside a career: the end card stands over the career, not
 *  over the title, a new career's wizard or the saves list it sends you to.
 *  Its two buttons used to change screen with the card still drawn on top of
 *  the new one (QA, 1.9.14), so neither did anything you could see. */
const OUTSIDE: ReadonlySet<string> = new Set(['menu', 'newgame', 'saves', 'about', 'supporter', 'settings', 'handbook', 'bug'])

export function CareerOver() {
  const game = useStore(s => s.game)
  const screen = useStore(s => s.nav[s.nav.length - 1]?.screen)
  const { toTitle, go } = useStore.getState()
  useStore(s => s.tick)
  const over = game?.careerOver
  if (!game || !over || (screen && OUTSIDE.has(screen))) return null
  return (
    <div className="career-over" role="dialog" aria-modal="true" aria-label={t('over.title')} data-career-over>
      <div className="card co-box" style={{ ...acc('var(--text-negative)') }}>
        <div className="fact-label">{t('over.kicker')}</div>
        <h1>{t('over.title')}</h1>
        <p>{t(over.k, over.v)}</p>
        <div className="meta">{t('over.record', { w: game.mgr.w, d: game.mgr.d, l: game.mgr.l })}</div>
        <button type="button" className="btn gold block" data-co-new style={{ marginTop: 14 }}
          onClick={() => { toTitle(); setTimeout(() => go('newgame'), 0) }}>{t('over.newCareer')}</button>
        <button type="button" className="btn ghost block" data-co-menu style={{ marginTop: 8 }} onClick={() => toTitle()}>{t('over.menu')}</button>
      </div>
    </div>
  )
}
