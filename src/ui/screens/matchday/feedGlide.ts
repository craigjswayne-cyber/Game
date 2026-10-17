// The phone's commentary feed: how many lines it keeps and how a new one glides in.

import { useLayoutEffect, useRef } from 'react'

/** How many lines the phone's commentary feed keeps in the DOM: the current
 *  one and enough older ones to fill the fixed box under its top fade. */
export const FEED_ROWS = 5
/** The glide: about a third of the Normal beat (640ms), so a line has landed
 *  and been read for most of its beat before the next one moves it. */
const GLIDE_MS = 220

/** Motion is on for people (main.tsx sets data-motion) and off when the OS
 *  asks for less of it. */
function glideOn(): boolean {
  try {
    return document.documentElement.dataset.motion === 'on'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch { return false }
}

/** The list's vertical offset from its transform, mid-glide included. */
function liveTy(el: HTMLElement): number {
  const m = getComputedStyle(el).transform
  if (!m || m === 'none') return 0
  const v = m.match(/matrix(3d)?\(([^)]+)\)/)
  if (!v) return 0
  const n = v[2].split(',').map(Number)
  return (v[1] ? n[13] : n[5]) || 0
}

/**
 * THE GLIDE (round 5). A FLIP on the commentary list: when lines are added,
 * every row that was already there is drawn where it WAS and then eased to
 * where it now is, so the stack slides by the new line's height instead of
 * jumping. Transform only (motionprobe's rule), one property on one element,
 * and it starts from wherever a glide still in flight has got to, so lines
 * arriving faster than the glide (Fast, a highlight's build-up) never snap.
 *
 * Rows carry data-k, the event's index in the match: stable for the life of
 * the line, so React keeps the same node and its colour can transition as it
 * goes from current to old.
 */
export function useFeedGlide(listRef: React.RefObject<HTMLDivElement | null>, count: number) {
  const where = useRef<Map<string, number> | null>(null)
  useLayoutEffect(() => {
    const list = listRef.current
    const feed = list?.parentElement
    if (!list || !feed) { where.current = null; return }
    // every row's resting place in the feed box: where it is drawn, less
    // whatever a glide still in flight is adding
    const ty = liveTy(list)
    const top = feed.getBoundingClientRect().top
    const now = new Map<string, number>()
    for (const el of Array.from(list.children) as HTMLElement[]) {
      const k = el.dataset.k
      if (k != null) now.set(k, el.getBoundingClientRect().top - top - ty)
    }
    const before = where.current
    where.current = now
    if (!before || !glideOn()) return
    let dy: number | null = null
    for (const [k, y] of now) {
      const was = before.get(k)
      if (was != null) { dy = was - y; break }
    }
    // a burst bigger than the box (Key Moments, a skip) is not a glide: the
    // rows are new, and they simply arrive
    if (dy == null || Math.abs(dy + ty) > feed.clientHeight * 1.5) {
      list.style.transition = 'none'
      list.style.transform = ''
      return
    }
    if (Math.abs(dy) < 0.5) return
    list.style.transition = 'none'
    list.style.transform = `translateY(${dy + ty}px)`
    void list.offsetHeight
    list.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(.25, .1, .25, 1)`
    list.style.transform = ''
  }, [count])
}
