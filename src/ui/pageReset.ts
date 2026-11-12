// THE PAGE, PUT BACK (1.9.12).
//
// Tester, on an iPhone: "when scouting and clicking through, the screen is
// zoomed in and you can't zoom out", with a screenshot of the Player Profile a
// third wider than the glass and its title under the clock.
//
// The viewport allows pinch-zoom on purpose (v1.2.7, 01-base.css): a game that
// blocks it fails anyone who needs it. But a zoom that arrives by accident (a
// stray pinch, or iOS zooming to a text box whose writing is under 16px) used
// to stay through every screen after it, and the shell does not scroll, so
// the way back was a gesture the player did not know he had made. And WebKit
// will scroll the DOCUMENT for scrollIntoView even where nothing is allowed to
// scroll, which slides the masthead under the status bar for good.
//
// So a zoom belongs to the screen it was made on. On every change of screen
// the page goes back to its own size and its own top. Pinch-zoom still works
// wherever it is wanted.

/** The visual viewport's zoom, 1 when the engine cannot say. */
export function pageScale(): number {
  return typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.scale : 1
}

/** Put the page back to its own size and its own top. Safe to call on every
 *  change of screen: it does nothing when nothing has moved. */
export function resetPage(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  try {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
    for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
      if (el && (el.scrollTop !== 0 || el.scrollLeft !== 0)) { el.scrollTop = 0; el.scrollLeft = 0 }
    }
    if (pageScale() <= 1.01) return
    // the one way a page can ask a browser to let go of a zoom: cap the scale
    // for a moment, then give the freedom back
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return
    const own = meta.getAttribute('data-own') ?? meta.content
    meta.setAttribute('data-own', own)
    meta.content = `${own}, maximum-scale=1`
    window.setTimeout(() => { meta.content = own }, 350)
  } catch { /* an engine without visualViewport: nothing to put back */ }
}

/** Scroll `target` to the top of the game's own scrolling column, and only
 *  that column. scrollIntoView asks every ancestor to move, and WebKit obliges
 *  with the document itself. */
export function scrollContentTo(target: HTMLElement | null): void {
  if (!target) return
  const box = target.closest<HTMLElement>('main.content')
  if (!box) return
  const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  box.scrollTop = Math.max(0, top - 8)
}
