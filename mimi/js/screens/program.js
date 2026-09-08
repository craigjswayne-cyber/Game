/*
 * PROGRAMME DETAIL: what the block is, what it does over its weeks, and every
 * session in it with the ones already done marked off.
 */
import { esc, icon, iso } from '../util.js'
import { get } from '../state.js'
import { pageHead, bar, toast } from '../ui.js'
import { programById } from '../data/programs.js'
import { byId } from '../data/exercises.js'
import { schedule, progressOf, enrol } from './workouts.js'
import { isDownloaded, download, removeDownload } from '../offline.js'
import { render as rerenderRoute } from '../router.js'

let openWeek = 1

export function render({ id }) {
  const p = programById(id)
  if (!p) return `<main class="page">${pageHead('Not found', 'That programme is not in the library.', { to: '/workouts', label: 'Workouts' })}</main>`

  const s = get()
  const mine = s.enrolment?.programId === p.id
  const pr = progressOf(p, s.enrolment)
  const done = new Set(mine ? s.enrolment.completed : [])
  const weeks = Array.from({ length: p.weeks }, (_, i) => i + 1)
  const all = schedule(p)
  const kit = [...new Set(p.days.flatMap((d) => d.work.map((w) => byId[w.ex]?.kit)))]

  return `<main class="page stack">
    ${pageHead(p.title, p.subtitle, { to: '/workouts', label: 'Workouts' })}

    <div class="thumb thumb--wide" aria-hidden="true">
      <span style="font-family:var(--serif); font-size:1.5rem">${esc(p.title)}</span>
    </div>

    <div class="chips">
      <span class="tag tag--quiet">${esc(p.weeks)} weeks</span>
      <span class="tag tag--quiet">${esc(p.days.length)} days a week</span>
      <span class="tag tag--quiet">${esc(p.minutes)} min a session</span>
      <span class="tag tag--quiet">${esc(p.level)}</span>
      <span class="tag tag--quiet">${esc(kit.includes('gym') ? 'Gym kit' : 'Home kit')}</span>
    </div>

    <p>${esc(p.blurb)}</p>

    <section class="card card--flat">
      <p class="eyebrow">How it progresses</p>
      <p style="margin:var(--s2) 0 0">${esc(p.progression)}</p>
    </section>

    ${mine ? `
      <section class="card stack-sm">
        <div class="row row--between"><strong>Your progress</strong><span class="lede">${pr.done} of ${pr.total}</span></div>
        ${bar(pr.done, pr.total)}
      </section>` : ''}

    <div class="row">
      <button class="btn ${mine ? 'btn--ghost' : 'btn--primary'} grow" data-enrol>
        ${mine ? 'Following this block' : 'Follow this programme'}
      </button>
      <button class="iconbtn" data-download aria-label="${isDownloaded(p.id) ? 'Remove download' : 'Download for offline'}">
        ${isDownloaded(p.id) ? icon.check() : icon.download()}
      </button>
    </div>
    ${isDownloaded(p.id) ? '<p class="lede">Saved for offline. The programme, its cues and this screen work with no signal.</p>' : ''}

    <section class="stack-sm">
      <h3>The schedule</h3>
      <div class="chips chips--scroll" role="group" aria-label="Week">
        ${weeks.map((w) => `<button class="chip" data-week="${w}" aria-pressed="${openWeek === w}">Week ${w}</button>`).join('')}
      </div>
      <ul class="list card">
        ${all.filter((x) => x.week === openWeek).map((x) => `
          <li>
            <button class="listrow" data-nav="/session/${esc(p.id)}/${x.week}/${esc(x.day.id)}">
              <span class="thumb">${done.has(x.key) ? icon.check() : icon.play()}</span>
              <span class="grow">
                <strong style="display:block; font-weight:500">${esc(x.day.title)}</strong>
                <span class="lede">${esc(x.day.focus)} · ${esc(x.day.minutes)} min · ${x.day.work.length} exercises</span>
              </span>
              ${done.has(x.key) ? '<span class="tag tag--good">Done</span>' : `<span class="chev">${icon.chevron()}</span>`}
            </button>
          </li>`).join('')}
      </ul>
    </section>
  </main>`
}

export function mount(root, { id }) {
  root.querySelectorAll('[data-week]').forEach((b) => b.addEventListener('click', () => {
    openWeek = Number(b.dataset.week)
    rerenderRoute()
  }))
  root.querySelector('[data-enrol]')?.addEventListener('click', () => {
    if (get().enrolment?.programId === id) { toast('Already following this one.'); return }
    enrol(id, iso())
    rerenderRoute()
  })
  root.querySelector('[data-download]')?.addEventListener('click', async () => {
    if (isDownloaded(id)) { removeDownload(id); toast('Download removed.') }
    else { await download(id); toast('Saved for offline.') }
    rerenderRoute()
  })
}
