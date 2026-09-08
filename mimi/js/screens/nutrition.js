/*
 * NUTRITION: the calculator, then the vault.
 *
 * The calculator reads the intake numbers and lets any of them be changed on
 * the spot, because the honest answer to "what should I eat" changes with
 * bodyweight and with how the week actually went. Changes here write back to
 * the profile, so Home and the recipe screen agree with this one.
 */
import { esc, icon, round } from '../util.js'
import { get, update } from '../state.js'
import { pageHead, sectionHead, empty, toast } from '../ui.js'
import { macrosFor, ACTIVITY, GOALS } from '../macros.js'
import { RECIPES, RECIPE_TAGS, recipeById } from '../data/recipes.js'
import { listCount, addRecipe, removeRecipe, hasRecipe } from '../shopping.js'
import { currentWeight, goalFromProfile } from './home.js'
import { render as rerenderRoute } from '../router.js'

let tag = 'All'
let tab = 'targets'

export function targetsFor(s) {
  const p = s.profile
  return macrosFor({
    weightKg: currentWeight(s), heightCm: p.heightCm, age: p.age, sex: p.sex,
    activity: p.activity, goal: goalFromProfile(p),
  })
}

const macroBar = (label, grams, kcalPer, total) => {
  const share = total ? Math.round(((grams * kcalPer) / total) * 100) : 0
  return `<div class="stack-sm">
    <div class="row row--between">
      <span>${esc(label)}</span>
      <span><strong>${esc(grams)}g</strong> <span class="lede">${share}%</span></span>
    </div>
    <div class="bar ${label === 'Protein' ? '' : 'bar--pink'}"><i style="width:${share}%"></i></div>
  </div>`
}

export function render() {
  const s = get()
  const p = s.profile
  const t = targetsFor(s)
  const goal = goalFromProfile(p)
  const list = tag === 'All' ? RECIPES : RECIPES.filter((r) => r.tags.includes(tag))

  return `<main class="page stack">
    ${pageHead('Nutrition', 'Your numbers, and what to cook with them')}

    <div class="seg" role="group" aria-label="Section">
      <button data-tab="targets" aria-pressed="${tab === 'targets'}">Targets</button>
      <button data-tab="vault" aria-pressed="${tab === 'vault'}">Recipe vault</button>
    </div>

    ${tab === 'targets' ? `
      <section class="card card--brand stack-sm">
        <p class="eyebrow">Daily target</p>
        <h1 style="margin:var(--s1) 0">${esc(t.kcal.toLocaleString())} <span style="font-size:var(--t-head)">kcal</span></h1>
        <p class="lede" style="margin:0">${esc(t.note)}</p>
      </section>

      <section class="card stack">
        ${macroBar('Protein', t.protein, 4, t.kcal)}
        ${macroBar('Carbs', t.carbs, 4, t.kcal)}
        ${macroBar('Fat', t.fat, 9, t.kcal)}
      </section>

      <section class="card stack-sm">
        ${sectionHead('How it was worked out')}
        <div class="row row--between"><span class="lede">Resting energy (Mifflin-St Jeor)</span><span>${esc(t.restKcal.toLocaleString())} kcal</span></div>
        <div class="row row--between"><span class="lede">With your activity level</span><span>${esc(t.tdee.toLocaleString())} kcal</span></div>
        <div class="row row--between"><span class="lede">After the ${esc(GOALS.find((g) => g.id === goal).label.toLowerCase())} adjustment</span><span>${esc(t.kcal.toLocaleString())} kcal</span></div>
        ${t.floored ? '<p class="lede">Held at the 1,200 kcal floor. Below that this calculator will not go without a dietitian in the room.</p>' : ''}
      </section>

      <section class="card stack">
        ${sectionHead('Adjust')}
        <div class="chips" role="group" aria-label="Goal">
          ${GOALS.map((g) => `<button class="chip" data-goal="${g.id}" aria-pressed="${goal === g.id}">${esc(g.label)}</button>`).join('')}
        </div>
        <label class="field">
          <span>Weight used in the sums</span>
          <input type="number" step="0.1" inputmode="decimal" data-weight value="${esc(currentWeight(s))}" />
        </label>
        <label class="field">
          <span>Activity outside training</span>
          <select data-activity>
            ${ACTIVITY.map((a) => `<option value="${a.id}" ${p.activity === a.id ? 'selected' : ''}>${esc(a.label)}: ${esc(a.hint)}</option>`).join('')}
          </select>
        </label>
        <p class="lede">These are a starting point. Give them a fortnight, watch the scale and the mirror, then move the calories by 100 at a time.</p>
      </section>
    ` : `
      <div class="chips chips--scroll" role="group" aria-label="Recipe filter">
        ${['All', ...RECIPE_TAGS].map((tg) => `<button class="chip" data-tag="${esc(tg)}" aria-pressed="${tag === tg}">${esc(tg)}</button>`).join('')}
      </div>

      <button class="card card--tap row" data-nav="/shopping">
        <span class="thumb">${icon.list()}</span>
        <span class="grow">
          <strong style="display:block">Shopping list</strong>
          <span class="lede">${listCount() ? `${listCount()} thing${listCount() === 1 ? '' : 's'} to get` : 'Add recipes and the ingredients gather here'}</span>
        </span>
        <span class="chev">${icon.chevron()}</span>
      </button>

      ${list.length ? `<ul class="list card">
        ${list.map((r) => `
          <li class="row">
            <button class="listrow grow" data-nav="/recipe/${esc(r.id)}">
              <span class="thumb">${icon.plate()}</span>
              <span class="grow">
                <strong style="display:block; font-weight:500">${esc(r.title)}</strong>
                <span class="lede">${esc(r.kcal)} kcal · ${esc(r.protein)}g protein · ${esc(r.minutes)} min</span>
              </span>
            </button>
            <button class="iconbtn" data-shop="${esc(r.id)}" aria-pressed="${hasRecipe(r.id)}"
              aria-label="${hasRecipe(r.id) ? `Remove ${esc(r.title)} from the shopping list` : `Add ${esc(r.title)} to the shopping list`}">
              ${hasRecipe(r.id) ? icon.check() : icon.plus()}
            </button>
          </li>`).join('')}
      </ul>` : empty('Nothing under that filter', 'Try another tag.')}
    `}
  </main>`
}

export function mount(root) {
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; rerenderRoute() }))
  root.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => { tag = b.dataset.tag; rerenderRoute() }))
  root.querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => {
    const recipe = recipeById(b.dataset.shop)
    if (!recipe) return
    if (hasRecipe(recipe.id)) { removeRecipe(recipe); toast(`${recipe.title} taken off the list.`) }
    else { addRecipe(recipe); toast(`${recipe.ingredients.length} ingredients added.`) }
    rerenderRoute()
  }))
  root.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
    update((s) => { s.profile.macroGoal = b.dataset.goal; return s })
    rerenderRoute()
  }))
  root.querySelector('[data-activity]')?.addEventListener('change', (e) => {
    update((s) => { s.profile.activity = e.target.value; return s })
    rerenderRoute()
  })
  root.querySelector('[data-weight]')?.addEventListener('change', (e) => {
    const v = round(Number(e.target.value), 1)
    if (!Number.isFinite(v) || v < 20 || v > 300) return
    update((s) => { s.profile.startWeightKg = v; return s })
    rerenderRoute()
  })
}
