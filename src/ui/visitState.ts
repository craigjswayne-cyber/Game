import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { NavEntry } from '../store/types'

/** ---- a screen remembers how you left it, for that visit ----
 *
 *  Player report, 1.9.5 (France): "je vais dans Club/Centre des transferts, je
 *  clique sur filtres [...] Si je clique sur un joueur [...] et qu'ensuite je
 *  clique sur <, je ne peux revenir à la liste de joueurs". Back pops the nav
 *  stack, the screen underneath mounts again, and every useState in it starts
 *  over: the filters, the tab, the page of results. On Team it landed on the
 *  team sheet whichever tab you had been reading.
 *
 *  The state is kept against the nav entry itself. back() keeps the entries
 *  below the top as the same objects, so the screen you return to finds what
 *  it had; go() pushes a new object, so opening a screen from the menu starts
 *  clean, as it always did. A WeakMap, so a visit popped for good takes its
 *  state with it. Memory only: a reload starts every screen fresh. */
const bags = new WeakMap<NavEntry, Map<string, unknown>>()

export const VisitContext = createContext<NavEntry | null>(null)

function bagFor(entry: NavEntry | null): Map<string, unknown> | null {
  if (!entry) return null
  let bag = bags.get(entry)
  if (!bag) { bag = new Map(); bags.set(entry, bag) }
  return bag
}

/** useState that survives a trip to another screen and Back. `key` is unique
 *  within the screen.
 *
 *  A NEW VISIT TO THE SAME SCREEN STARTS CLEAN. Team opened from the menu
 *  while Team is already showing is the same component at the same place in
 *  the tree, so React keeps it and its state: the visit is checked on every
 *  render and, when it has changed, the value is the new visit's (scripts/
 *  e2e.mjs found this: Team kept General Info after a fresh go('squad')). */
export function useVisitState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const entry = useContext(VisitContext)
  const bag = bagFor(entry)
  const read = (): T => (bag?.has(key) ? bag.get(key) as T : initial)
  const [held, setHeld] = useState(() => ({ entry, v: read() }))
  let v = held.v
  if (held.entry !== entry) {
    v = read()
    setHeld({ entry, v })
  }
  const set = useCallback<Dispatch<SetStateAction<T>>>(a => setHeld(h => ({
    entry: h.entry, v: typeof a === 'function' ? (a as (x: T) => T)(h.v) : a,
  })), [])
  useEffect(() => { if (held.entry === entry) bag?.set(key, held.v) }, [bag, key, held, entry])
  return [v, set]
}

/** Where the content was scrolled to on each visit, for the same reason. */
const scrolls = new WeakMap<NavEntry, number>()
export function noteScroll(entry: NavEntry, top: number) { scrolls.set(entry, top) }
export function scrollFor(entry: NavEntry): number | undefined { return scrolls.get(entry) }
