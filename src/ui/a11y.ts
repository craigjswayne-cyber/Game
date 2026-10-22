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
  // TAB STAYS IN THE DIALOG (1.9.4 audit). A sheet was marked aria-modal and
  // took focus, but Tab walked straight out of it into the screen beneath,
  // which a sighted keyboard user cannot see and a screen reader was told is
  // not there. The top dialog keeps focus: Tab from its last control goes to
  // its first, Shift+Tab from its first to its last.
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return
    const dialogs = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(d => d.getClientRects().length > 0)
    const here = document.activeElement
    // the dialog focus is in, or else the last one drawn
    const top = dialogs.find(d => here instanceof Node && d.contains(here)) ?? dialogs[dialogs.length - 1]
    if (!top) return
    const stops = [...top.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0)
    if (!stops.length) { e.preventDefault(); return }
    const first = stops[0], last = stops[stops.length - 1]
    if (!(here instanceof Node) || !top.contains(here)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return }
    if (e.shiftKey && here === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && here === last) { e.preventDefault(); first.focus() }
  })
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    // the sheets first; then the three other veils that close on a tap (the
    // hub menu, the tutorial card and the trophy celebration), so Escape is
    // the keyboard's version of tapping outside wherever a tap outside works
    const veils = document.querySelectorAll<HTMLElement>('.modal-veil')
    const top = veils[veils.length - 1] ?? document.querySelector<HTMLElement>('.submenu-veil, .tut-veil, .celebrate-veil')
    if (top) { e.preventDefault(); top.click() }
  })
}
