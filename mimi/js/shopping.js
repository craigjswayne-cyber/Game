/*
 * THE GROCERY LIST.
 *
 * Pick recipes, get one list. The aggregation is deliberately shallow: an
 * ingredient line is matched on its text, so "2 ripe bananas" from two recipes
 * becomes one line marked x2 rather than two lines. Parsing "300g chicken" and
 * "2 chicken breasts" into a single quantity is a units problem this prototype
 * does not pretend to have solved, and a wrong total is worse than two lines.
 */
import { get, update } from './state.js'
import { uid } from './util.js'

/* Lower case, trimmed, punctuation off the ends: enough to catch the same line
   written by the same person twice. */
const normalise = (text) => text.toLowerCase().replace(/[.,;]+$/, '').trim()

export const listItems = () => get().shopping.items

export const listCount = () => get().shopping.items.filter((i) => !i.done).length

export function addRecipe(recipe) {
  update((s) => {
    const items = [...s.shopping.items]
    for (const line of recipe.ingredients) {
      const key = normalise(line)
      const hit = items.find((i) => normalise(i.text) === key)
      if (hit) {
        hit.count += 1
        if (!hit.from.includes(recipe.title)) hit.from = [...hit.from, recipe.title]
      } else {
        items.push({ id: uid(), text: line, done: false, count: 1, from: [recipe.title] })
      }
    }
    s.shopping.items = items
    s.shopping.from = s.shopping.from.includes(recipe.id) ? s.shopping.from : [...s.shopping.from, recipe.id]
    return s
  })
}

export function removeRecipe(recipe) {
  update((s) => {
    s.shopping.items = s.shopping.items
      .map((i) => (i.from.includes(recipe.title)
        ? { ...i, count: i.count - 1, from: i.from.filter((f) => f !== recipe.title) }
        : i))
      .filter((i) => i.count > 0)
    s.shopping.from = s.shopping.from.filter((id) => id !== recipe.id)
    return s
  })
}

export const hasRecipe = (recipeId) => get().shopping.from.includes(recipeId)

export function addLine(text) {
  update((s) => {
    s.shopping.items = [...s.shopping.items, { id: uid(), text, done: false, count: 1, from: [] }]
    return s
  })
}

export function toggleItem(id) {
  update((s) => {
    s.shopping.items = s.shopping.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
    return s
  })
}

export function removeItem(id) {
  update((s) => {
    s.shopping.items = s.shopping.items.filter((i) => i.id !== id)
    return s
  })
}

export function clearDone() {
  update((s) => { s.shopping.items = s.shopping.items.filter((i) => !i.done); return s })
}

export function clearAll() {
  update((s) => { s.shopping = { items: [], from: [] }; return s })
}
