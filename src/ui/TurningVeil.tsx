import { useStore } from '../store'
import { t } from '../game/i18n'

/**
 * WHILE THE WEEK TURNS, NOTHING ELSE TOUCHES THE CAREER (1.9.1).
 *
 * The settle now runs in slices so the phone keeps drawing (season.weekSteps),
 * which means taps are handled between the slices. A tactic changed or a
 * player sold half way through a week would be read by some of it and not the
 * rest. This covers the screen for the length of the settle, says what is
 * happening, and takes every tap. It is up for about a second on a budget
 * phone, and not at all where the settle runs in one go.
 */
export function TurningVeil() {
  const turning = useStore(s => s.turning)
  if (!turning) return null
  return (
    <div className="turning-veil" role="status" aria-live="polite" aria-busy="true">
      <span className="turning-veil-label">{t('common.turningWeek')}</span>
    </div>
  )
}
