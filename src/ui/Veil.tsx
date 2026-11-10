import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * TAP OUTSIDE TO CLOSE.
 *
 * Every sheet in the game is a veil over the screen with a box inside it: a
 * tap on the veil closes the sheet, and the box swallows its own taps so a
 * tap inside it (or a drag to scroll it) never reaches the veil. That pair of
 * divs was written out by hand at every sheet, each with the same two lint
 * waivers; this is the one copy.
 *
 * The classes are the ones the sheets always had (`.modal-veil` round a
 * `.modal` unless a caller names others), because the CSS, the harnesses and
 * a11y.ts all find the sheets by them. a11y.ts is what makes this usable
 * without a pointer: it marks a `.modal` as a dialog and moves focus into it,
 * and Escape clicks the top veil, which is the same tap a thumb makes.
 */
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the veil is a tap-outside-to-close backdrop and Escape closes it (a11y.ts); the box only swallows taps inside the sheet so it stays open. Neither is a control: the sheet has its own buttons. */
export function Veil({ onClose, className = 'modal-veil', boxClassName = 'modal', role, label, portal, children }: {
  /** what a tap on the veil (or Escape, via a11y.ts) does */
  onClose: () => void
  /** the veil's class: `modal-veil`, or the hub menu's and the tutorial's own */
  className?: string
  /** the box's class: `modal` plus the sheet's own, or another box entirely */
  boxClassName?: string
  /** a box that names itself as a dialog up front, rather than waiting for a11y.ts */
  role?: 'dialog'
  /** the box's aria-label */
  label?: string
  /** Drawn at the app root instead of where it is written (1.9.12). A sheet
   *  opened from inside a scrolling panel - the half-time touchline is one -
   *  otherwise sits inside that scroller in the DOM. Its veil is position:
   *  fixed and should not care, but mobile Safari has a long record of
   *  placing and clipping fixed boxes inside scrolled ones, and an iPhone at
   *  half-time could not scroll the squad sheet up to shirt 1 ("I don't seem
   *  to be able to scroll up to change out my 1"). At the root nothing
   *  scrolls around it. The root is `.app`, not <body>, so the skin, the
   *  night palette and the club colours still reach it. */
  portal?: boolean
  children: ReactNode
}) {
  const veil = (
    <div className={className} onClick={onClose}>
      <div className={boxClassName} role={role} aria-label={label} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
  if (!portal || typeof document === 'undefined') return veil
  const root = document.querySelector('.app') ?? document.body
  return createPortal(veil, root)
}
