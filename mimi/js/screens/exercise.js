/*
 * EXERCISE DETAIL: the demo, the cues, and where it appears in the library.
 *
 * There is no video file in this repository, so the player renders its poster
 * state and says what would stream there. That is a deliberate placeholder, not
 * a broken element: a grey box with a spinner would read as a bug.
 */
import { esc, icon } from '../util.js'
import { get, update } from '../state.js'
import { pageHead, toast } from '../ui.js'
import { byId } from '../data/exercises.js'
import { PROGRAMS } from '../data/programs.js'
import { render as rerenderRoute } from '../router.js'

export function render({ id }) {
  const ex = byId[id]
  if (!ex) return `<main class="page">${pageHead('Not found', '', { to: '/workouts', label: 'Workouts' })}</main>`

  const fav = get().favourites.exercises.includes(id)
  const appearsIn = PROGRAMS.filter((p) => p.days.some((d) => d.work.some((w) => w.ex === id)))

  return `<main class="page stack">
    ${pageHead(ex.name, `${ex.group} · ${ex.kit === 'both' ? 'home or gym' : ex.kit}`, { to: '/workouts', label: 'Library' })}

    <div class="video">
      <span class="playmark">${icon.play()}</span>
      <span class="sr-only">Demo video placeholder</span>
    </div>
    <p class="lede center">Mimi's demo (${esc(ex.video)}) streams here in the shipping app.</p>

    <section class="card stack-sm">
      <h3>Coaching cues</h3>
      <ol class="stack-sm" style="margin:0; padding-left:1.1rem">
        ${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}
      </ol>
    </section>

    ${appearsIn.length ? `
      <section class="stack-sm">
        <h3>Used in</h3>
        <ul class="list card">
          ${appearsIn.map((p) => `
            <li><button class="listrow" data-nav="/program/${esc(p.id)}">
              <span class="grow">${esc(p.title)}</span>
              <span class="chev">${icon.chevron()}</span>
            </button></li>`).join('')}
        </ul>
      </section>` : ''}

    <button class="btn ${fav ? 'btn--soft' : 'btn--ghost'} btn--block" data-fav>
      ${icon.heart()} ${fav ? 'Saved' : 'Save to favourites'}
    </button>
  </main>`
}

export function mount(root, { id }) {
  root.querySelector('[data-fav]')?.addEventListener('click', () => {
    update((s) => {
      const list = s.favourites.exercises
      s.favourites.exercises = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      return s
    })
    toast(get().favourites.exercises.includes(id) ? 'Saved.' : 'Removed.')
    rerenderRoute()
  })
}
