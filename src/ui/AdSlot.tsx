import { useEffect, useRef } from 'react'
import { adBridge, adsAllowed, type AdPlace } from '../game/monetise'
import { useStore } from '../store'

/**
 * A place an advert MAY appear, which in this build is nowhere.
 *
 * The web build has no ad provider, so this renders null - no frame, no
 * placeholder, no reserved strip of grey. A box that says "advertisement" and
 * then fails to fill is worse than nothing: it is a hole in the page that the
 * player has to learn to ignore, and it costs the layout the same height
 * whether or not anybody is paying for it.
 *
 * When a packaged shell injects `globalThis.rmAds`, the provider is handed an
 * empty div and owns everything inside it. Two rules the slot keeps on the
 * game's behalf:
 *
 *   IT UNMOUNTS. A provider that is left mounted after a screen change leaks a
 *     frame, and on a phone that is a second ad quietly running under the first.
 *   A SUPPORTER NEVER SEES ONE. adsAllowed answers that before anything is
 *     mounted, so the purchase is honoured before the provider is even asked.
 */
export function AdSlot({ place }: { place: AdPlace }) {
  const host = useRef<HTMLDivElement>(null)
  // THE PURCHASE IS A DEPENDENCY (1.8.18). The effect used to re-run only when
  // `place` changed, so buying Pro from a card on the same screen left the
  // banner mounted - the slot drew nothing, but the provider still held its
  // element and redrew the advert the moment the card closed, under a line
  // that promises "the adverts go this frame". Reading `supporter` from the
  // store re-runs the effect on purchase (and on a refund taken back), and the
  // clean-up below is what actually takes the advert down.
  const supporter = useStore(s => s.supporter)

  useEffect(() => {
    const el = host.current
    if (!el || !adsAllowed(place)) return
    const ads = adBridge()
    if (!ads) return
    ads.mount(el, place)
    return () => { ads.unmount?.(el) }
  }, [place, supporter])

  if (!adsAllowed(place)) return null
  return <div className="ad-slot" ref={host} aria-hidden="true" />
}
