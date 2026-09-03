/**
 * DIALOGS THAT ANNOUNCE THEMSELVES (v1.2.7).
 *
 * Every sheet in the game is a `.modal-veil` with a `.modal` inside it, closed
 * by tapping the veil. None of them told a screen reader they were dialogs,
 * none took focus when they opened, and none closed on Escape - so a keyboard
 * or switch user could open the team-talk sheet and never find it.
 *
 * One observer fixes all of them without touching the six call sites: when a
 * `.modal` appears it is marked role="dialog" aria-modal="true", the first
 * focusable thing inside it takes focus, and Escape taps the veil - the same
 * gesture a thumb makes to close it. Focus returns to whatever had it before.
 */
export function installDialogA11y(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  let before: Element | null = null
  const dress = (m: Element) => {
    if (m.getAttribute('role')) return
    m.setAttribute('role', 'dialog')
    m.setAttribute('aria-modal', 'true')
    before = document.activeElement
    const first = m.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (first) first.focus({ preventScroll: true })
    else { m.setAttribute('tabindex', '-1'); (m as HTMLElement).focus({ preventScroll: true }) }
  }
  const obs = new MutationObserver(records => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (!(n instanceof Element)) continue
        if (n.matches('.modal')) dress(n)
        n.querySelectorAll?.('.modal').forEach(dress)
      }
      for (const n of r.removedNodes) {
        if (n instanceof Element && (n.matches('.modal-veil') || n.querySelector?.('.modal-veil'))) {
          if (before instanceof HTMLElement && document.contains(before)) before.focus({ preventScroll: true })
          before = null
        }
      }
    }
  })
  obs.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    const veils = document.querySelectorAll<HTMLElement>('.modal-veil')
    const top = veils[veils.length - 1]
    if (top) { e.preventDefault(); top.click() }
  })
}
