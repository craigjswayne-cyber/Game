/**
 * THE KEYBOARD MUST NOT LEAVE THE PAGE OFFSET.
 *
 * 1.8.8 in the iOS Simulator (iOS 26): "I'm clicking on the buttons in the
 * menu but it is selecting the one below", and in Tactics the kicker under the
 * one tapped flashed. Every career starts with the manager's name typed into
 * a text box. On iOS, focusing a field scrolls the WHOLE web view up to keep
 * it clear of the keyboard, and WebKit does not always scroll it back when the
 * keyboard goes: the page is painted where it belongs while the document still
 * sits a little scrolled, and touches are hit-tested against the scrolled
 * position. Every tap from then on lands a row lower than the finger.
 *
 * The app shell is exactly one viewport tall (theme.css, html/body/#root at
 * 100dvh) and does its scrolling in inner panes, so a document that cannot
 * scroll but reports an offset is that artefact and nothing else. When a field
 * loses focus, and when the visual viewport grows back after the keyboard,
 * such an offset is put back to zero. A document that genuinely scrolls is
 * left alone, and nothing happens while a field still has the focus.
 *
 * Not reproducible in Chromium, which never leaves the offset behind, so no
 * browser probe can show the bug or the cure: this is defensive, and cheap.
 * It never touches a document that can really scroll, so it cannot fight a
 * page that needs to.
 */
const EDITABLE = 'input, textarea, select, [contenteditable="true"]'

function settle(): void {
  try {
    const a = document.activeElement
    if (a && a !== document.body && a.matches?.(EDITABLE)) return
    const d = document.scrollingElement ?? document.documentElement
    if (!d) return
    // pinch-zoomed: the offset is the reader panning, not the keyboard
    const vv = window.visualViewport
    if (vv && vv.scale > 1.01) return
    // a document taller than the screen scrolls for real; leave it be
    if (d.scrollHeight > d.clientHeight + 1) return
    if (window.scrollX !== 0 || window.scrollY !== 0 || d.scrollTop !== 0) {
      window.scrollTo(0, 0)
      d.scrollTop = 0
    }
  } catch { /* no DOM */ }
}

let installed = false
export function installKeyboardScrollFix(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  // twice: at once, and again once iOS has finished animating the keyboard away
  const soon = () => { settle(); setTimeout(settle, 120); setTimeout(settle, 450) }
  document.addEventListener('focusout', soon, true)
  window.visualViewport?.addEventListener('resize', soon)
}
