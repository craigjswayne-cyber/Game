import type { KeyboardEvent, SyntheticEvent } from 'react'

/**
 * A TAPPABLE ROW A KEYBOARD CAN REACH (WCAG 2.1.1, 4.1.2).
 *
 * The squad list, the league table, the fixture list and a few dozen other
 * rows open something when tapped, and every one of them was a bare <tr> or
 * <div> with an onClick: no tab stop, no Enter, and nothing to tell a screen
 * reader it did anything. Spreading this onto the element instead of the bare
 * onClick fixes all three without changing a pixel:
 *
 *   <tr key={p.id} {...rowNav(() => go('player', p.id))}>
 *
 * role="button" tells assistive tech it acts, tabIndex puts it in the tab
 * order, and Enter or Space fire the same handler a tap does. The accessible
 * name comes from the row's own text unless a label is passed, which is what
 * an icon-only target or a row whose text would read badly should do.
 *
 * Keys only fire when the row itself has focus, so a real button inside the
 * row (a shortlist star, a sell chip) keeps its own Enter.
 */
export function rowNav<E extends SyntheticEvent>(onActivate: (e: E) => void, label?: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate as (e: SyntheticEvent) => void,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onActivate(e as unknown as E)
      }
    },
  }
}

/**
 * Put focus back on a control that a re-render replaced. The sortable headers
 * are built by a component declared inside their screen, so every sort mounts
 * a fresh header row and the button a keyboard user just pressed is gone: the
 * second Enter landed on nothing. The control carries data-focus-key and asks
 * for its successor to be focused once React has painted it.
 */
export function refocus(key: string, had: boolean) {
  if (!had) return
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus())
}

/**
 * aria-sort for a sortable column header. `flipped` is the screen's "desc"
 * toggle, which reverses whatever the column's natural order is; numbers sort
 * biggest first by default and names and ages smallest first, so the column
 * has to say which it is.
 */
export function ariaSort(active: boolean, flipped: boolean, naturallyAscending: boolean): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none'
  return naturallyAscending !== flipped ? 'ascending' : 'descending'
}
