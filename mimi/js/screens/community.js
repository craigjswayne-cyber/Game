/*
 * COMMUNITY: wins, encouragement and streak milestones.
 *
 * Posts are held on the device in this prototype. A real build swaps the three
 * functions at the bottom for calls to the same shaped endpoint, and nothing
 * above them changes. The rules copy is not decoration: a positive feed is a
 * moderated feed, and saying so up front is most of the moderation.
 */
import { esc, icon, uid } from '../util.js'
import { get, update, workoutStreak } from '../state.js'
import { sectionHead, toast } from '../ui.js'
import { render as rerenderRoute } from '../router.js'

const ago = (ts) => {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function body() {
  const s = get()
  const fives = new Set(s.community.fives)
  const streak = workoutStreak()
  const name = s.profile.name || 'You'

  return `<div class="stack">
    ${streak >= 3 ? `
      <section class="card card--brand">
        <p class="eyebrow">Worth sharing</p>
        <h3 style="margin:var(--s2) 0">${streak} day streak</h3>
        <button class="btn btn--soft btn--sm" data-share-streak>Post it</button>
      </section>` : ''}

    <form class="card stack-sm" data-post-form>
      <div class="row" style="align-items:flex-start">
        <span class="avatar">${esc(name.slice(0, 1).toUpperCase())}</span>
        <textarea class="grow" data-post-input maxlength="280" placeholder="What went well this week?"></textarea>
      </div>
      <div class="row row--between">
        <span class="lede">Kind, or not at all.</span>
        <button class="btn btn--primary btn--sm" type="submit">Post</button>
      </div>
    </form>

    <section class="stack-sm">
      ${sectionHead(`${s.community.posts.length} posts`)}
      <div class="card">
        ${s.community.posts.map((p) => `
          <article class="post">
            <div class="row" style="align-items:flex-start">
              <span class="avatar">${esc(p.author.slice(0, 1).toUpperCase())}</span>
              <div class="grow">
                <div class="row row--between">
                  <strong style="font-weight:500">${esc(p.author)}</strong>
                  <span class="lede">${esc(ago(p.at))}</span>
                </div>
                <p style="margin:var(--s2) 0">${esc(p.body)}</p>
                <div class="row">
                  <button class="likebtn ${fives.has(p.id) ? 'is-on' : ''}" data-five="${esc(p.id)}"
                    aria-pressed="${fives.has(p.id)}" aria-label="High five this post">
                    ${icon.hand()} ${esc(p.likes + (fives.has(p.id) ? 1 : 0))} high five${p.likes + (fives.has(p.id) ? 1 : 0) === 1 ? '' : 's'}
                  </button>
                  ${p.sample ? '<span class="tag tag--quiet">Sample post</span>' : ''}
                  ${p.mine ? `<button class="likebtn" data-del="${esc(p.id)}" style="margin-left:auto">Delete</button>` : ''}
                </div>
              </div>
            </div>
          </article>`).join('')}
      </div>
    </section>

    <section class="card card--flat">
      <p class="eyebrow">House rules</p>
      <ul class="stack-sm" style="margin:var(--s3) 0 0; padding-left:1.1rem">
        <li>Celebrate the effort, not the weight.</li>
        <li>No before and after shaming, yours or anybody else's.</li>
        <li>No diet advice for someone who did not ask for it.</li>
      </ul>
      <p class="lede" style="margin-top:var(--s3)">Posts stay on this device in the prototype. Nothing here is sent anywhere.</p>
    </section>
  </div>`
}

export function mount(root) {
  root.querySelector('[data-post-form]')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = root.querySelector('[data-post-input]')
    const body = input.value.trim()
    if (!body) return
    addPost(body)
    input.value = ''
    toast('Posted.')
    rerenderRoute()
  })

  root.querySelector('[data-share-streak]')?.addEventListener('click', () => {
    addPost(`${workoutStreak()} days in a row. Turning up is the whole trick.`)
    toast('Shared with the community.')
    rerenderRoute()
  })

  root.querySelectorAll('[data-five]').forEach((b) => b.addEventListener('click', () => {
    toggleFive(b.dataset.five)
    rerenderRoute()
  }))

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    update((s) => { s.community.posts = s.community.posts.filter((p) => p.id !== b.dataset.del); return s })
    rerenderRoute()
  }))
}

/* ---- the three calls a backend would replace ---- */
function addPost(body) {
  const author = get().profile.name || 'You'
  update((s) => {
    s.community.posts = [{ id: uid(), author, body, at: Date.now(), likes: 0, mine: true }, ...s.community.posts]
    return s
  })
}

function toggleFive(id) {
  update((s) => {
    s.community.fives = s.community.fives.includes(id)
      ? s.community.fives.filter((x) => x !== id)
      : [...s.community.fives, id]
    return s
  })
}
