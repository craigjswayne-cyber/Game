import type { CSSProperties } from 'react'

/**
 * A CARD THAT MATTERS, WITHOUT THE STRIPE (1.9.2, owner: the coloured bar down
 * the left edge of a card is the most recognisable template look there is).
 * Ninety-odd cards wore a 4px left border in gold, green or red to say "read
 * this one". They now take a faint wash of the same colour and a border to
 * match, so the meaning (gold for advice, red for trouble, green for good
 * news) survives and the stripe goes. The one stripe kept on purpose is the
 * opponent's colour on the next match.
 */
export function acc(colour: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${colour} 10%, var(--surface-1))`,
    borderColor: `color-mix(in srgb, ${colour} 38%, var(--border))`,
  }
}

/** The same wash for a one-line note under a control (was a 3px stripe). */
export function accLine(colour: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${colour} 10%, transparent)`,
    borderRadius: 6,
    padding: '6px 8px',
  }
}
