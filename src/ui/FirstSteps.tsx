import { useStore } from '../store'
import { t } from '../game/i18n'
import { firstSteps, skipFirstSteps } from '../game/firststeps'
import { acc } from './accent'

/** The first season's checklist on Home (firststeps.ts): five rows, each a
 *  button to the screen that does it, ticked as they are done, and a Skip that
 *  takes the card away for good on this career. */
export function FirstSteps() {
  const game = useStore(s => s.game)
  const go = useStore(s => s.go)
  const touch = useStore(s => s.touch)
  useStore(s => s.tick)
  if (!game) return null
  const steps = firstSteps(game)
  if (!steps) return null
  const done = steps.filter(s => s.done).length

  return (
    <div className="card first-steps" style={{ ...acc('var(--gold)') }}>
      <h3>{t('home.fsTitle')}</h3>
      <div className="meta">{t('home.fsSub', { n: done, of: steps.length })}</div>
      <ul className="fs-list">
        {steps.map(s => (
          <li key={s.id}>
            <button type="button" className={`fs-row${s.done ? ' done' : ''}`} onClick={() => go(s.screen)}>
              <span className="fs-tick" aria-hidden>{s.done ? '✓' : ''}</span>
              <span className="fs-label">{t(`home.fs_${s.id}`)}</span>
              {s.done && <span className="sr-only">{t('home.fsDone')}</span>}
              <span className="fs-go" aria-hidden>›</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="fs-foot">
        <button type="button" className="btn ghost tiny" onClick={() => { skipFirstSteps(game); touch() }}>
          {t('home.fsSkip')}
        </button>
      </div>
    </div>
  )
}
