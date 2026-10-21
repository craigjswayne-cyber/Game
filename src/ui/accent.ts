import type { CSSProperties } from 'react'

/**
 * A CARD THAT MATTERS, WITHOUT THE STRIPE (1.9.2, owner: the coloured bar down
 * the left edge of a card is the most recognisable template look there is).
 * Ninety-odd cards wore a 4px left border in gold, green or red to say "read
 * this one". The owner chose header bands from three styles: a card that opens
 * on a title (an h3 or a .fact-label) wears that title as a band in a wash of
 * the colour, and a card with no title takes the wash itself (04-cards.css,
 * the --band rules). The meaning survives (gold for advice, red for trouble,
 * green for good news) and the stripe goes. The stripes kept on purpose are
 * the opponent's colour on the next match and the commentary lines.
 */
export function acc(colour: string): CSSProperties {
  return { '--band': colour } as CSSProperties
}

/** The same wash for a one-line note under a control (was a 3px stripe). */
export function accLine(colour: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${colour} 10%, transparent)`,
    borderRadius: 6,
    padding: '6px 8px',
  }
}
