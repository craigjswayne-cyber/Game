/*
 * THE SHOPPING LIST SCREEN: a checklist you can take round a supermarket.
 *
 * Ticking is the whole interaction, so a tick never repaints the page: the row
 * updates itself and the store is written underneath. A repaint here would
 * reorder the list under somebody's thumb halfway down aisle four.
 */
import { esc, icon } from '../util.js'
import { pageHead, empty, toast } from '../ui.js'
import { listItems, addLine, toggleItem, removeItem, clearDone, clearAll } from '../shopping.js'
import { render as rerenderRoute } from '../router.js'

export function render() {
  const items = listItems()
  const left = items.filter((i) => !i.done).length
  const recipes = [...new Set(items.flatMap((i) => i.from))]

  return `<main class="page stack">
    ${pageHead('Shopping list', `${left} to get, ${items.length - left} in the trolley`, { to: '/nutrition', label: 'Nutrition' })}

    <form class="row" data-add-form>
      <input class="grow" type="text" data-add maxlength="80" placeholder="Add anything else" />
      <button class="iconbtn" type="submit" aria-label="Add">${icon.plus()}</button>
    </form>

    ${recipes.length ? `<div class="chips">${recipes.map((r) => `<span class="tag tag--quiet">${esc(r)}</span>`).join('')}</div>` : ''}

    ${items.length ? `
      <ul class="list card">
        ${items.map((i) => `
          <li class="todo">
            <input type="checkbox" id="sl-${esc(i.id)}" data-item="${esc(i.id)}" ${i.done ? 'checked' : ''} />
            <label for="sl-${esc(i.id)}">
              ${esc(i.text)}${i.count > 1 ? ` <span class="tag tag--quiet">x${esc(i.count)}</span>` : ''}
              ${i.from.length ? `<span class="lede" style="display:block; font-size:var(--t-micro)">${esc(i.from.join(', '))}</span>` : ''}
            </label>
            <button class="iconbtn" data-del="${esc(i.id)}" aria-label="Remove">&times;</button>
          </li>`).join('')}
      </ul>
      <div class="row">
        <button class="btn btn--ghost btn--sm grow" data-clear-done>Clear the ticked</button>
        <button class="btn btn--danger btn--sm grow" data-clear-all>Empty the list</button>
      </div>
    ` : empty('The list is empty', 'Open a recipe and add it, or type something in above.', { to: '/nutrition', label: 'Recipe vault' })}
  </main>`
}

export function mount(root) {
  root.querySelector('[data-add-form]')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = root.querySelector('[data-add]')
    const text = input.value.trim()
    if (!text) return
    addLine(text)
    input.value = ''
    rerenderRoute()
  })

  root.querySelectorAll('[data-item]').forEach((box) => box.addEventListener('change', () => {
    toggleItem(box.dataset.item)
  }))

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    removeItem(b.dataset.del)
    rerenderRoute()
  }))

  root.querySelector('[data-clear-done]')?.addEventListener('click', () => {
    clearDone()
    toast('Trolley cleared.')
    rerenderRoute()
  })

  root.querySelector('[data-clear-all]')?.addEventListener('click', () => {
    clearAll()
    toast('List emptied.')
    rerenderRoute()
  })
}
