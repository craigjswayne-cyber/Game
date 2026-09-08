/*
 * THE CENTRE TAB: mindset, calendar and the daily planner.
 *
 * A month of dots at the top, one day's habits underneath, the planner after
 * that, and the Mindset core at the foot. Everything writes through editDay(),
 * so the calendar, the streaks and the analytics on the last tab are all
 * reading the same record.
 */
import { esc, icon, iso, fromIso, prettyDate, monthName, clockTime, clamp, uid } from '../util.js'
import { get, update, dayOf, editDay, workoutStreak, waterStreak } from '../state.js'
import { pageHead, quoteCard, sectionHead, bar, toast } from '../ui.js'
import { MOODS, SESSIONS, HABIT_GUIDES, gratitudeFor } from '../data/mindset.js'
import { available as healthAvailable, readDay } from '../health.js'
import { render as rerenderRoute } from '../router.js'

let selected = iso()
let cursor = { y: new Date().getFullYear(), m: new Date().getMonth() }

export function render() {
  const s = get()
  const day = dayOf(selected)
  const p = s.profile
  const isToday = selected === iso()
  const prompt = gratitudeFor(s.settings.quoteSeed)
  const gratitudeToday = s.mindset.gratitude.find((g) => g.date === iso())

  return `<main class="page stack">
    ${pageHead('Today', 'Your calendar, your habits, your head')}

    ${calendar(s)}

    <div class="row row--between">
      <h2 style="font-size:var(--t-head)">${esc(isToday ? 'Today' : prettyDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
      ${isToday ? '' : '<button class="btn btn--sm btn--ghost" data-today>Back to today</button>'}
    </div>

    <div class="grid2">
      <div class="card card--flat stat">
        <span class="num">${icon.flame()} ${workoutStreak()}</span>
        <span class="eyebrow">Workout streak</span>
      </div>
      <div class="card card--flat stat">
        <span class="num">${icon.drop()} ${waterStreak()}</span>
        <span class="eyebrow">Water streak</span>
      </div>
    </div>

    <section class="card stack-sm">
      ${sectionHead('Water')}
      <div class="glass" role="img" aria-label="${esc(day.waterMl)} of ${esc(p.waterGoalMl)} millilitres">
        <i style="height:${clamp(Math.round((day.waterMl / (p.waterGoalMl || 1)) * 100), 0, 100)}%"></i>
        <span>${esc(day.waterMl)}ml</span>
      </div>
      <div class="row" style="justify-content:center; gap:var(--s2)">
        <button class="chip" data-water="-250">-250</button>
        <button class="chip" data-water="250">+250ml</button>
        <button class="chip" data-water="500">+500ml</button>
      </div>
      <p class="lede center">Goal ${esc(p.waterGoalMl)}ml${day.waterMl >= p.waterGoalMl ? ', hit for the day' : ''}</p>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Steps')}
      ${bar(day.steps, p.stepGoal)}
      <div class="row">
        <label class="field grow">
          <span class="sr-only">Steps today</span>
          <input type="number" inputmode="numeric" data-steps value="${esc(day.steps || '')}" placeholder="0" />
        </label>
        <button class="btn btn--ghost btn--sm" data-sync>Sync</button>
      </div>
      <p class="lede">${esc(healthLine())}</p>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Mood')}
      <div class="chips">
        ${MOODS.map((m) => `<button class="chip" data-mood="${m.id}" aria-pressed="${day.mood === m.id}">${esc(m.label)}</button>`).join('')}
      </div>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Weight')}
      <div class="row">
        <label class="field grow">
          <span class="sr-only">Weight in kilograms</span>
          <input type="number" inputmode="decimal" step="0.1" data-weight value="${esc(day.weightKg ?? '')}" placeholder="kg" />
        </label>
        <button class="btn btn--ghost btn--sm" data-save-weight>Log</button>
      </div>
      <p class="lede">Once or twice a week is plenty. Daily weight is mostly water and salt.</p>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Planner')}
      <form class="row" data-todo-form>
        <input class="grow" type="text" data-todo-input placeholder="One thing that would make today count" maxlength="90" />
        <button class="iconbtn" type="submit" aria-label="Add">${icon.plus()}</button>
      </form>
      ${day.todos.length ? `<ul class="list" style="margin-top:var(--s2)">
        ${sortTodos(day.todos).map((t) => `
          <li class="todo">
            <input type="checkbox" id="td-${esc(t.id)}" data-todo="${esc(t.id)}" ${t.done ? 'checked' : ''} />
            <label for="td-${esc(t.id)}">
              ${esc(t.text)}
              <span class="lede" style="display:block; font-size:var(--t-micro)">
                ${t.priority ? 'Priority · ' : ''}added ${esc(t.at ? clockTime(t.at) : 'earlier')}
              </span>
            </label>
            <button class="iconbtn" data-flag="${esc(t.id)}" aria-pressed="${Boolean(t.priority)}"
              aria-label="${t.priority ? 'Remove priority' : 'Mark as priority'}">${icon.spark()}</button>
            <button class="iconbtn" data-todo-del="${esc(t.id)}" aria-label="Delete">&times;</button>
          </li>`).join('')}
      </ul>` : '<p class="lede">Nothing on the list yet.</p>'}
    </section>

    <section class="card stack-sm">
      ${sectionHead('Sessions')}
      ${day.workouts.length ? `<ul class="list">
        ${day.workouts.map((w) => `
          <li class="row row--between" style="padding:var(--s3) 0">
            <span class="grow"><strong style="font-weight:500">${esc(w.title)}</strong><br><span class="lede">${esc(w.minutes)} min · logged ${esc(clockTime(w.at))}</span></span>
            <span class="tag tag--good">Done</span>
          </li>`).join('')}
      </ul>` : `<p class="lede">No session logged${isToday ? ' yet today' : ' on this day'}. A rest day is part of the plan, not a gap in it.</p>`}
      <button class="btn btn--ghost btn--sm" data-nav="/workouts">Open workouts</button>
    </section>

    <hr class="divider" />

    <section class="stack-sm">
      ${sectionHead('Mindset core', { to: '/mindset', label: 'All sessions' })}
      <p class="lede">Two minutes of gratitude, guided audio, grounding, and the habit guides that make the rest of this stick.</p>

      <div class="card stack-sm">
        <div class="row row--between">
          <p class="eyebrow" style="margin:0">Today’s gratitude prompt</p>
          <span class="tag tag--quiet">2 min</span>
        </div>
        <p style="font-family:var(--serif); font-style:italic; font-size:1.05rem; margin:var(--s2) 0">${esc(prompt)}</p>
        ${gratitudeToday ? `
          <div class="card card--flat"><p style="margin:0">${esc(gratitudeToday.text)}</p></div>
          <p class="lede">Written today. It is in your journal.</p>
        ` : `
          <textarea data-gratitude placeholder="A sentence is enough."></textarea>
          <button class="btn btn--primary btn--sm" data-save-gratitude>Save it</button>
        `}
      </div>

      <ul class="list card">
        ${SESSIONS.slice(0, 4).map((x) => `
          <li>
            <button class="listrow" data-nav="/mindset/${esc(x.id)}">
              <span class="thumb">${x.kind === 'breath' ? icon.leaf() : x.kind === 'audio' ? icon.sound() : icon.spark()}</span>
              <span class="grow">
                <strong style="display:block; font-weight:500">${esc(x.title)}</strong>
                <span class="lede">${esc(x.kind === 'audio' ? 'Guided audio' : x.kind === 'breath' ? 'Breathwork' : 'Journal')} · ${esc(x.minutes)} min</span>
              </span>
              <span class="chev">${icon.chevron()}</span>
            </button>
          </li>`).join('')}
      </ul>

      ${sectionHead('Habit guides')}
      <ul class="list card">
        ${HABIT_GUIDES.map((h) => `
          <li>
            <button class="listrow" data-nav="/habit/${esc(h.id)}">
              <span class="grow">
                <strong style="display:block; font-weight:500">${esc(h.title)}</strong>
                <span class="lede">${esc(h.minutes)} min read</span>
              </span>
              <span class="chev">${icon.chevron()}</span>
            </button>
          </li>`).join('')}
      </ul>
    </section>

    ${quoteCard('tracker')}
  </main>`
}

/* Flagged first, then oldest first, so the list reads as a plan rather than a
   pile. Done items sink to the bottom whatever their flag. */
const sortTodos = (todos) => [...todos].sort((a, b) =>
  Number(a.done) - Number(b.done)
  || Number(Boolean(b.priority)) - Number(Boolean(a.priority))
  || (a.at || 0) - (b.at || 0))

function calendar(s) {
  const first = new Date(cursor.y, cursor.m, 1)
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  /* Monday first: getDay() is 0 for Sunday, so shift it. */
  const lead = (first.getDay() + 6) % 7
  const today = iso()
  const goal = s.profile.waterGoalMl || 2000
  const cells = []
  for (let i = 0; i < lead; i++) cells.push('<button class="pad" tabindex="-1" aria-hidden="true"></button>')
  for (let d = 1; d <= daysInMonth; d++) {
    const date = iso(new Date(cursor.y, cursor.m, d))
    const rec = s.days[date]
    const worked = Boolean(rec?.workouts?.length)
    const habits = Boolean(rec) && (rec.waterMl >= goal || (rec.todos || []).some((t) => t.done))
    const classes = [
      date === today ? 'is-today' : '',
      date === selected ? 'is-sel' : '',
      worked ? 'has-work' : '',
      habits ? 'has-habit' : '',
    ].filter(Boolean).join(' ')
    const what = worked ? 'session logged' : habits ? 'habits logged' : 'nothing logged'
    cells.push(`<button class="${classes}" data-date="${date}" aria-label="${esc(prettyDate(date))}, ${what}">${d}</button>`)
  }
  return `<section class="card stack-sm">
    <div class="row row--between">
      <button class="iconbtn" data-month="-1" aria-label="Previous month">${icon.back()}</button>
      <strong>${esc(monthName(cursor.y, cursor.m))}</strong>
      <button class="iconbtn" data-month="1" aria-label="Next month">${icon.chevron()}</button>
    </div>
    <div class="cal">
      ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="dow">${d}</span>`).join('')}
      ${cells.join('')}
    </div>
    <p class="lede center" style="margin:0">
      <span class="dot-key dot-key--work"></span> session
      <span class="dot-key dot-key--habit"></span> habits
    </p>
  </section>`
}

const healthLine = () => healthAvailable()
  ? 'Connected to Apple Health. Sync pulls today’s steps and active energy.'
  : 'Apple Health syncs on the iOS build. Here, type the number in.'

export function mount(root) {
  const repaint = () => rerenderRoute()

  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => {
    const m = cursor.m + Number(b.dataset.month)
    cursor = { y: cursor.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    repaint()
  }))

  root.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => {
    selected = b.dataset.date
    repaint()
  }))

  root.querySelector('[data-today]')?.addEventListener('click', () => {
    selected = iso()
    const d = fromIso(selected)
    cursor = { y: d.getFullYear(), m: d.getMonth() }
    repaint()
  })

  root.querySelectorAll('[data-water]').forEach((b) => b.addEventListener('click', () => {
    editDay(selected, (d) => { d.waterMl = clamp(d.waterMl + Number(b.dataset.water), 0, 8000) })
    repaint()
  }))

  root.querySelector('[data-steps]')?.addEventListener('change', (e) => {
    editDay(selected, (d) => { d.steps = clamp(Math.round(Number(e.target.value) || 0), 0, 200000) })
    repaint()
  })

  root.querySelector('[data-sync]')?.addEventListener('click', async () => {
    const res = await readDay(selected)
    if (!res.ok) { toast('No Health connection on this build.'); return }
    editDay(selected, (d) => {
      if (typeof res.data.steps === 'number') d.steps = res.data.steps
      if (typeof res.data.waterMl === 'number' && get().settings.health.water) d.waterMl = res.data.waterMl
    })
    toast('Synced from Apple Health.')
    repaint()
  })

  root.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => {
    editDay(selected, (d) => { d.mood = d.mood === b.dataset.mood ? null : b.dataset.mood })
    repaint()
  }))

  root.querySelector('[data-save-weight]')?.addEventListener('click', () => {
    const raw = Number(root.querySelector('[data-weight]').value)
    if (!Number.isFinite(raw) || raw <= 0) { toast('Give me a number first.'); return }
    editDay(selected, (d) => { d.weightKg = clamp(Math.round(raw * 10) / 10, 20, 300) })
    toast('Weight logged.')
    repaint()
  })

  root.querySelector('[data-todo-form]')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = root.querySelector('[data-todo-input]')
    const text = input.value.trim()
    if (!text) return
    editDay(selected, (d) => {
      d.todos = [...d.todos, { id: uid(), text, done: false, at: Date.now(), priority: false }]
    })
    input.value = ''
    repaint()
  })

  root.querySelectorAll('[data-todo]').forEach((box) => box.addEventListener('change', () => {
    editDay(selected, (d) => {
      d.todos = d.todos.map((t) => (t.id === box.dataset.todo ? { ...t, done: box.checked } : t))
    })
  }))

  root.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => {
    editDay(selected, (d) => {
      d.todos = d.todos.map((t) => (t.id === b.dataset.flag ? { ...t, priority: !t.priority } : t))
    })
    repaint()
  }))

  root.querySelectorAll('[data-todo-del]').forEach((b) => b.addEventListener('click', () => {
    editDay(selected, (d) => { d.todos = d.todos.filter((t) => t.id !== b.dataset.todoDel) })
    repaint()
  }))

  root.querySelector('[data-save-gratitude]')?.addEventListener('click', () => {
    const box = root.querySelector('[data-gratitude]')
    const text = box.value.trim()
    if (!text) { toast('Write a line first.'); return }
    update((s) => {
      s.mindset.gratitude = [...s.mindset.gratitude.filter((g) => g.date !== iso()), { date: iso(), text }]
      return s
    })
    toast('Saved to your journal.')
    repaint()
  })
}
