/*
 * THE SESSION PLAYER.
 *
 * One card per exercise, one row per set: weight, reps, and a tick that both
 * records the set and starts the rest clock for that exercise. Everything is
 * written as it is typed, because a person who closes the app mid session and
 * loses four sets does not open it again.
 *
 * The rest timer is a module level interval. mount() starts nothing on its own
 * and unmount() always clears it, which is the whole reason the router insists
 * on that pair.
 */
import { esc, icon, iso, mmss, uid } from '../util.js'
import { get, update, editDay } from '../state.js'
import { pageHead, toast } from '../ui.js'
import { programById } from '../data/programs.js'
import { byId } from '../data/exercises.js'
import { sessionKey } from './workouts.js'
import { go } from '../router.js'

let ticker = null
let restLeft = 0
let restLabel = ''

const logKey = (programId, week, dayId) => `${programId}:w${week}:${dayId}`

function logFor(programId, week, dayId, day) {
  const key = logKey(programId, week, dayId)
  const existing = get().logs[key]
  if (existing) return existing
  const sets = {}
  for (const w of day.work) {
    sets[w.ex] = Array.from({ length: w.sets }, () => ({ weight: '', reps: '', done: false }))
  }
  return { key, sets, startedAt: null, finishedAt: null }
}

function writeLog(key, fn) {
  update((s) => {
    const entry = s.logs[key]
    if (entry) fn(entry)
    return s
  })
}

export function render({ programId, week, dayId }) {
  const p = programById(programId)
  const day = p?.days.find((d) => d.id === dayId)
  if (!p || !day) {
    return `<main class="page">${pageHead('Session not found', '', { to: '/workouts', label: 'Workouts' })}</main>`
  }

  const key = logKey(programId, week, dayId)
  /* First open of a session materialises its empty log, so every later write
     is a plain field update rather than a create-or-update. */
  if (!get().logs[key]) {
    const fresh = logFor(programId, week, dayId, day)
    update((s) => { s.logs[key] = { ...fresh, startedAt: Date.now() }; return s })
  }
  const log = get().logs[key]
  const done = new Set(get().enrolment?.programId === programId ? get().enrolment.completed : [])
  const complete = done.has(sessionKey(Number(week), dayId))
  const setsDone = Object.values(log.sets).flat().filter((x) => x.done).length
  const setsTotal = Object.values(log.sets).flat().length

  return `<main class="page stack">
    ${pageHead(day.title, `${p.title} · week ${esc(week)} of ${p.weeks}`, { to: `/program/${p.id}`, label: p.title })}

    <section class="card card--flat row row--between">
      <span><strong data-sets-done>${setsDone}</strong> <span class="lede">of ${setsTotal} sets logged</span></span>
      ${complete ? '<span class="tag tag--good">Session complete</span>' : `<span class="tag tag--quiet">${esc(day.focus)}</span>`}
    </section>

    ${day.work.map((w, wi) => {
      const ex = byId[w.ex]
      const rows = log.sets[w.ex] || []
      return `<section class="card stack-sm" data-ex="${esc(w.ex)}">
        <div class="row row--between">
          <div class="grow">
            <h3>${esc(ex ? ex.name : w.ex)}</h3>
            <p class="lede" style="margin:0">${esc(w.sets)} × ${esc(w.reps)} · rest ${esc(w.rest)}s</p>
          </div>
          <button class="iconbtn" data-nav="/exercise/${esc(w.ex)}" aria-label="How to do ${esc(ex ? ex.name : w.ex)}">${icon.play()}</button>
        </div>
        ${w.note ? `<p class="lede">${esc(w.note)}</p>` : ''}
        <div class="colhead"><span>Set</span><span>kg</span><span>Reps</span><span>Done</span></div>
        ${rows.map((row, i) => `
          <div class="setrow">
            <span class="setno">${i + 1}</span>
            <input type="number" inputmode="decimal" placeholder="0" value="${esc(row.weight)}"
              data-set="${wi}" data-ex-id="${esc(w.ex)}" data-i="${i}" data-field="weight"
              aria-label="Weight for set ${i + 1}" />
            <input type="number" inputmode="numeric" placeholder="${esc(String(w.reps).replace(/[^0-9]/g, '') || '0')}" value="${esc(row.reps)}"
              data-ex-id="${esc(w.ex)}" data-i="${i}" data-field="reps"
              aria-label="Reps for set ${i + 1}" />
            <button class="tick ${row.done ? 'is-on' : ''}" data-tick data-ex-id="${esc(w.ex)}" data-i="${i}"
              data-rest="${esc(w.rest)}" aria-pressed="${row.done}" aria-label="Mark set ${i + 1} done">
              ${icon.check()}
            </button>
          </div>`).join('')}
      </section>`
    }).join('')}

    <button class="btn btn--primary btn--block" data-finish ${complete ? 'disabled' : ''}>
      ${complete ? 'Already logged' : 'Finish session'}
    </button>
    <p class="lede center">Everything you type is saved as you go.</p>
  </main>`
}

export function mount(root, { programId, week, dayId }) {
  const key = logKey(programId, week, dayId)

  root.querySelectorAll('input[data-field]').forEach((inp) => inp.addEventListener('input', (e) => {
    const { exId, i, field } = e.target.dataset
    writeLog(key, (entry) => { entry.sets[exId][Number(i)][field] = e.target.value })
  }))

  root.querySelectorAll('[data-tick]').forEach((btn) => btn.addEventListener('click', () => {
    const { exId, i, rest } = btn.dataset
    let nowDone = false
    writeLog(key, (entry) => {
      const row = entry.sets[exId][Number(i)]
      row.done = !row.done
      nowDone = row.done
    })
    btn.classList.toggle('is-on', nowDone)
    btn.setAttribute('aria-pressed', String(nowDone))
    // The header count is the only other thing on screen that changes, and a
    // full repaint here would take the focus out of whatever is being typed.
    const counter = root.querySelector('[data-sets-done]')
    if (counter) {
      counter.textContent = String(Object.values(get().logs[key].sets).flat().filter((x) => x.done).length)
    }
    if (nowDone && Number(rest) > 0) startRest(Number(rest), byId[exId]?.name || '')
  }))

  root.querySelector('[data-finish]')?.addEventListener('click', () => finish(programId, Number(week), dayId, key))
}

export function unmount() { stopRest() }

/* ---- rest clock ---- */
function startRest(seconds, label) {
  stopRest()
  restLeft = seconds
  restLabel = label
  paintRest()
  ticker = setInterval(() => {
    restLeft -= 1
    if (restLeft <= 0) {
      stopRest()
      toast('Rest over. Next set.')
      if (navigator.vibrate) navigator.vibrate(180)
      return
    }
    paintRest()
  }, 1000)
}

function stopRest() {
  clearInterval(ticker)
  ticker = null
  document.querySelector('.timer')?.remove()
}

function paintRest() {
  let el = document.querySelector('.timer')
  if (!el) {
    el = document.createElement('div')
    el.className = 'timer'
    el.setAttribute('role', 'timer')
    document.body.append(el)
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-rest-skip]')) stopRest()
      if (e.target.closest('[data-rest-more]')) { restLeft += 30; paintRest() }
    })
  }
  el.innerHTML = `
    <span class="num">${mmss(restLeft)}</span>
    <span class="grow" style="font-size:var(--t-small)">Rest${restLabel ? `, after ${esc(restLabel)}` : ''}</span>
    <button data-rest-more>+30s</button>
    <button data-rest-skip>Skip</button>`
}

/* ---- finishing ---- */
function finish(programId, week, dayId, key) {
  const today = iso()
  const p = programById(programId)
  const day = p.days.find((d) => d.id === dayId)
  const k = sessionKey(week, dayId)

  writeLog(key, (entry) => { entry.finishedAt = Date.now() })

  update((s) => {
    if (s.enrolment?.programId === programId && !s.enrolment.completed.includes(k)) {
      s.enrolment.completed = [...s.enrolment.completed, k]
    }
    return s
  })

  editDay(today, (d) => {
    d.workouts = [...d.workouts, {
      id: uid(), programId, week, dayId,
      title: day.title, minutes: day.minutes, at: Date.now(),
    }]
  })

  stopRest()
  toast('Logged. That is one more in the bank.')
  go('/tracker')
}
