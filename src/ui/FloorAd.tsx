import { useEffect, useState, type RefObject } from 'react'
import { AdSlot } from './AdSlot'

/**
 * ---- A BANNER ON EVERY PAGE OF THE CAREER (owner, 22 Nov 2026, 1.9.17) ----
 *
 * "Can you add the ad slot to all pages outside of games and setup for non
 * pro players?" Until now a page carried a banner only if somebody had put an
 * AdSlot on it, fifteen pages out of forty.
 *
 * The shell mounts this once, under whatever page is showing. It stands down
 * when the page already has a slot of its own (those keep their own advert
 * unit), so there is never a second banner under the first, and when the page
 * says no: the press room marks itself `data-no-ad` while a journalist is
 * waiting on an answer (the owner's rule since 1.8.3), and the shop that
 * sells the adverts' removal does not carry one.
 *
 * WHERE IT SITS IS NOT DECIDED HERE. The packaged shell pins the banner to
 * the bottom of the screen under the menu bar, the same on every page; the
 * slot only tells it that this page carries one. A match and the menus before
 * a career are not drawn by the shell at all, so they never reach this.
 * A Pro manager sees none: AdSlot asks adsAllowed before anything mounts.
 */
const NEVER = new Set(['supporter'])

export function FloorAd({ screen, main }: { screen: string; main: RefObject<HTMLElement | null> }) {
  // assume the page has its own until it is seen not to: a banner that mounts
  // and comes straight down again is a wasted request
  const [own, setOwn] = useState(true)
  // WATCHED, NOT READ ONCE. A page arrives late (the screens are lazy), and a
  // page changes under the same shell: the Roles tab on Tactics has a slot and
  // its other tabs do not, the press room's question is answered. Neither
  // re-renders the shell, so the page is watched for the slot coming and going.
  useEffect(() => {
    const el = main.current
    if (!el) return
    const read = () => setOwn(!!el.querySelector('.ad-slot:not([data-floor]), [data-no-ad]'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [main, screen])
  if (own || NEVER.has(screen)) return null
  return <AdSlot place="page-foot" floor />
}
