/*
 * 1-1 COACHING.
 *
 * The check-in form, the thread, and the enquiry. This is the high touch half
 * of the product, so the honesty rules are strict: nothing here invents a reply
 * from Mimi. A sent message shows as sent and waits, which is what it would do
 * against a real inbox.
 */
import { esc, icon, iso, prettyDate, clockTime, uid } from '../util.js'
import { get, update, workoutStreak, lastNDays } from '../state.js'
import { sectionHead, toast, sheet, closeSheet } from '../ui.js'
import { shrinkAll, MAX_PHOTOS } from '../photos.js'
import { render as rerenderRoute } from '../router.js'

const SCALES = [
  { key: 'sleep', label: 'Sleep', low: 'Broken', high: 'Solid' },
  { key: 'energy', label: 'Energy', low: 'Flat', high: 'Buzzing' },
  { key: 'stress', label: 'Stress', low: 'Calm', high: 'Frazzled' },
  { key: 'hunger', label: 'Hunger', low: 'Settled', high: 'Ravenous' },
]

export function body() {
  const s = get()
  const checkins = s.coaching.checkins
  const last = checkins[checkins.length - 1]
  /* Sessions this week, not sessions in the current block: a check-in is about
     the last seven days, whatever programme they were done under. */
  const sessions7 = lastNDays(7).reduce((n, d) => n + (s.days[d]?.workouts?.length || 0), 0)

  return `<div class="stack">
    <section class="card card--brand stack-sm">
      <p class="eyebrow">${s.coaching.plan ? 'Your plan' : 'Coaching'}</p>
      <h2 style="margin:var(--s1) 0">${esc(s.coaching.plan ? s.coaching.plan.name : 'Work with me directly')}</h2>
      <p class="lede" style="margin:0">${esc(s.coaching.plan
        ? `Started ${prettyDate(s.coaching.plan.since)}. Weekly check-ins, programme written around your week.`
        : 'Twelve spots, weekly written feedback, your programme adjusted every seven days.')}</p>
      ${s.coaching.plan ? '' : '<button class="btn btn--soft btn--sm" data-enquire>See what is included</button>'}
    </section>

    <section class="card stack-sm">
      ${sectionHead('This week at a glance')}
      <div class="grid3">
        <div class="stat"><span class="num">${workoutStreak()}</span><span class="eyebrow">Streak</span></div>
        <div class="stat"><span class="num">${sessions7}</span><span class="eyebrow">Sessions, 7d</span></div>
        <div class="stat"><span class="num">${checkins.length}</span><span class="eyebrow">Check-ins</span></div>
      </div>
      <p class="lede">${esc(last ? `Last check-in ${prettyDate(last.date)}.` : 'No check-in yet. The first one takes about four minutes.')}</p>
      <button class="btn btn--primary btn--block" data-checkin>${esc(last ? 'New check-in' : 'Start your first check-in')}</button>
    </section>

    ${last ? `
      <section class="card stack-sm">
        ${sectionHead('Last check-in')}
        <div class="row row--wrap" style="gap:var(--s2)">
          ${SCALES.map((sc) => `<span class="tag tag--quiet">${esc(sc.label)} ${esc(last[sc.key])}/5</span>`).join('')}
          ${last.weightKg ? `<span class="tag tag--quiet">${esc(last.weightKg)}kg</span>` : ''}
        </div>
        ${last.photos?.length ? `
          <div class="photos">
            ${last.photos.map((src, i) => `<img src="${esc(src)}" alt="Progress photo ${i + 1} from ${esc(prettyDate(last.date))}" loading="lazy" />`).join('')}
          </div>` : ''}
        ${last.wins ? `<p><strong style="font-weight:500">Went well:</strong> ${esc(last.wins)}</p>` : ''}
        ${last.blockers ? `<p><strong style="font-weight:500">Got in the way:</strong> ${esc(last.blockers)}</p>` : ''}
        ${last.feedback
          ? `<div class="card card--flat"><p class="eyebrow">Mimi's feedback</p><p style="margin:var(--s2) 0 0">${esc(last.feedback)}</p></div>`
          : '<p class="lede">Sent. Feedback usually lands within a working day.</p>'}
      </section>` : ''}

    <section class="card stack-sm">
      ${sectionHead('Messages')}
      <p class="lede">A private thread between you and Mimi. It is held on this device in the prototype.</p>
      <div class="stack-sm" style="max-height:340px; overflow-y:auto">
        ${s.coaching.messages.map((m) => `
          <div class="bubble ${m.from === 'mimi' ? 'bubble--them' : 'bubble--me'}">
            ${esc(m.body)}
            <time>${esc(clockTime(m.at))}${m.from === 'me' && !m.read ? ' · sent' : ''}</time>
          </div>`).join('')}
      </div>
      <form class="row" data-msg-form>
        <input class="grow" type="text" data-msg maxlength="500" placeholder="Message Mimi" />
        <button class="iconbtn" type="submit" aria-label="Send">${icon.message()}</button>
      </form>
      <p class="lede">Replies come from a person, so they come on weekdays.</p>
    </section>
  </div>`
}

export function mount(root) {
  root.querySelector('[data-checkin]')?.addEventListener('click', openCheckin)
  root.querySelector('[data-enquire]')?.addEventListener('click', openEnquiry)

  root.querySelector('[data-msg-form]')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = root.querySelector('[data-msg]')
    const body = input.value.trim()
    if (!body) return
    update((s) => {
      s.coaching.messages = [...s.coaching.messages, { id: uid(), from: 'me', body, at: Date.now(), read: false }]
      return s
    })
    input.value = ''
    rerenderRoute()
  })
}

function openCheckin() {
  const s = get()
  const body = `
    <form class="stack" data-form>
      <label class="field">
        <span>Weight today (optional)</span>
        <input type="number" step="0.1" inputmode="decimal" name="weightKg" placeholder="kg" />
      </label>
      ${SCALES.map((sc) => `
        <label class="field">
          <span>${esc(sc.label)}: ${esc(sc.low)} to ${esc(sc.high)}</span>
          <input type="range" min="1" max="5" value="3" name="${sc.key}" />
        </label>`).join('')}
      <label class="field">
        <span>What went well?</span>
        <textarea name="wins" maxlength="600" placeholder="Sessions, food, sleep, anything."></textarea>
      </label>
      <label class="field">
        <span>What got in the way?</span>
        <textarea name="blockers" maxlength="600" placeholder="Be honest. It is the useful half."></textarea>
      </label>
      <label class="field">
        <span>Anything you want me to change?</span>
        <textarea name="asks" maxlength="600" placeholder="Programme, macros, schedule."></textarea>
      </label>
      <div class="field">
        <span>Progress photos (up to ${MAX_PHOTOS}, optional)</span>
        <input type="file" accept="image/*" multiple data-photos />
        <div class="photos" data-preview></div>
        <p class="lede">Kept on this device with the rest of your check-in, shrunk to 720px so they fit. Nothing is uploaded.</p>
      </div>
      <button class="btn btn--primary btn--block" type="submit">Send check-in</button>
      <p class="lede center">Your streak, sessions and habit data go with it, so you do not have to type them out.</p>
    </form>`

  sheet('Weekly check-in', body, (wrap) => {
    /* Photos are shrunk as they are picked, not on submit: a person who chose
       four megabytes of camera roll should see the thumbnails before they
       commit, and the work is done by the time they press send. */
    let photos = []
    wrap.querySelector('[data-photos]')?.addEventListener('change', async (e) => {
      const preview = wrap.querySelector('[data-preview]')
      preview.innerHTML = '<p class="lede">Shrinking...</p>'
      photos = await shrinkAll(e.target.files)
      preview.innerHTML = photos.length
        ? photos.map((src, i) => `<img src="${esc(src)}" alt="Selected photo ${i + 1}" />`).join('')
        : '<p class="lede">Nothing usable in that pick.</p>'
    })

    wrap.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = new FormData(e.target)
      const entry = {
        id: uid(),
        date: iso(),
        weightKg: Number(f.get('weightKg')) || null,
        wins: String(f.get('wins') || '').trim(),
        blockers: String(f.get('blockers') || '').trim(),
        asks: String(f.get('asks') || '').trim(),
        streak: workoutStreak(),
        photos,
        feedback: null,
      }
      for (const sc of SCALES) entry[sc.key] = Number(f.get(sc.key)) || 3

      update((st) => {
        st.coaching.checkins = [...st.coaching.checkins, entry]
        if (entry.weightKg) {
          const d = st.days[entry.date] || {}
          st.days[entry.date] = { waterMl: 0, steps: 0, mood: null, todos: [], workouts: [], ...d, weightKg: entry.weightKg }
        }
        st.coaching.messages = [...st.coaching.messages, {
          id: uid(), from: 'me', at: Date.now(), read: false,
          body: `Check-in sent for ${prettyDate(entry.date)}.`,
        }]
        return st
      })
      closeSheet()
      toast('Check-in sent.')
      rerenderRoute()
    })
  })
  return s
}

function openEnquiry() {
  const body = `
    <div class="stack">
      <section class="card card--flat stack-sm">
        <h3>1-1 Coaching</h3>
        <ul class="stack-sm" style="margin:0; padding-left:1.1rem">
          <li>A programme written for your week, not a template with your name on it</li>
          <li>Weekly written feedback on your check-in, from me</li>
          <li>Macros adjusted as your weight and training change</li>
          <li>Direct messaging, answered on weekdays</li>
          <li>Form checks on video for the main lifts</li>
        </ul>
      </section>
      <section class="card card--flat stack-sm">
        <h3>Small group</h3>
        <ul class="stack-sm" style="margin:0; padding-left:1.1rem">
          <li>Everything above, on a fortnightly cycle</li>
          <li>A group thread of six, which is the accountability half</li>
        </ul>
      </section>
      <button class="btn btn--primary btn--block" data-request>Ask about a spot</button>
      <p class="lede center">This sends a message to Mimi. Nothing is charged from here.</p>
    </div>`

  sheet('Coaching options', body, (wrap) => {
    wrap.querySelector('[data-request]').addEventListener('click', () => {
      update((s) => {
        s.coaching.messages = [...s.coaching.messages, {
          id: uid(), from: 'me', at: Date.now(), read: false,
          body: 'I would like to know about a 1-1 coaching spot.',
        }]
        return s
      })
      closeSheet()
      toast('Sent. Mimi will come back to you.')
      rerenderRoute()
    })
  })
}
