/*
 * RECIPE DETAIL: macros per serving against the day's targets, then the actual
 * cooking. The percentage is the number people want and no recipe app shows.
 */
import { esc, icon } from '../util.js'
import { get, update } from '../state.js'
import { pageHead, toast } from '../ui.js'
import { recipeById } from '../data/recipes.js'
import { addRecipe, removeRecipe, hasRecipe } from '../shopping.js'
import { targetsFor } from './nutrition.js'
import { render as rerenderRoute } from '../router.js'

export function render({ id }) {
  const r = recipeById(id)
  if (!r) return `<main class="page">${pageHead('Not found', '', { to: '/nutrition', label: 'Nutrition' })}</main>`
  const t = targetsFor(get())
  const fav = get().favourites.recipes.includes(id)
  const share = Math.round((r.kcal / t.kcal) * 100)

  return `<main class="page stack">
    ${pageHead(r.title, `${r.minutes} minutes · serves ${r.serves}`, { to: '/nutrition', label: 'Recipe vault' })}

    <div class="chips">${r.tags.map((tg) => `<span class="tag tag--quiet">${esc(tg)}</span>`).join('')}</div>

    <section class="card">
      <p class="eyebrow">Per serving</p>
      <div class="grid2" style="margin-top:var(--s3)">
        <div class="stat"><span class="num">${esc(r.kcal)}</span><span class="eyebrow">kcal</span></div>
        <div class="stat"><span class="num">${esc(r.protein)}g</span><span class="eyebrow">Protein</span></div>
        <div class="stat"><span class="num">${esc(r.carbs)}g</span><span class="eyebrow">Carbs</span></div>
        <div class="stat"><span class="num">${esc(r.fat)}g</span><span class="eyebrow">Fat</span></div>
      </div>
      <p class="lede center" style="margin-top:var(--s3)">About ${esc(share)} percent of your daily energy and ${esc(Math.round((r.protein / t.protein) * 100))} percent of your protein.</p>
    </section>

    <section class="card stack-sm">
      <h3>Ingredients</h3>
      <ul class="stack-sm" style="margin:0; padding-left:1.1rem">
        ${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}
      </ul>
    </section>

    <section class="card stack-sm">
      <h3>Method</h3>
      <ol class="stack-sm" style="margin:0; padding-left:1.1rem">
        ${r.steps.map((st) => `<li>${esc(st)}</li>`).join('')}
      </ol>
    </section>

    <button class="btn btn--primary btn--block" data-shop>
      ${icon.list()} ${hasRecipe(id) ? 'On your shopping list' : 'Add ingredients to shopping list'}
    </button>
    <button class="btn ${fav ? 'btn--soft' : 'btn--ghost'} btn--block" data-fav>
      ${icon.heart()} ${fav ? 'Saved to your vault' : 'Save to your vault'}
    </button>
  </main>`
}

export function mount(root, { id }) {
  root.querySelector('[data-shop]')?.addEventListener('click', () => {
    const r = recipeById(id)
    if (!r) return
    if (hasRecipe(id)) { removeRecipe(r); toast('Taken off the list.') }
    else { addRecipe(r); toast(`${r.ingredients.length} ingredients added.`) }
    rerenderRoute()
  })

  root.querySelector('[data-fav]')?.addEventListener('click', () => {
    update((s) => {
      const list = s.favourites.recipes
      s.favourites.recipes = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      return s
    })
    toast(get().favourites.recipes.includes(id) ? 'Saved.' : 'Removed.')
    rerenderRoute()
  })
}
