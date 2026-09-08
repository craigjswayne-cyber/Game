/*
 * WORKOUTS: the hub.
 *
 * A programme is a repeating week, so the schedule is generated rather than
 * stored: week 1 day 1, week 1 day 2, ... week 8 day 3. `sessionKey` is the id
 * that ties a completion, a set log and a calendar entry together.
 *
 * The filter bar is three questions: where, how long, and what are we training.
 * Duration and muscle group are read off the sessions themselves, so a filter
 * can never offer a combination the library cannot fill.
 */
import { esc, icon } from '../util.js'
import { get, update } from '../state.js'
import { pageHead, sectionHead, bar, empty, toast } from '../ui.js'
import { PROGRAMS, EXPRESS, programById } from '../data/programs.js'
import { EXERCISES, byId } from '../data/exercises.js'
import { suggestProgram } from './onboarding.js'

/* Filter state is deliberately not persisted: a filter that survives a restart
   is a filter people forget they set. */
let env = null
let duration = 'any'
let muscle = 'any'
let tab = 'programs'

export const sessionKey = (week, dayId) => `w${week}:${dayId}`

export function schedule(program) {
  const out = []
  for (let w = 1; w <= program.weeks; w++) {
    for (const day of program.days) out.push({ week: w, day, key: sessionKey(w, day.id) })
  }
  return out
}

export function nextSession(program, enrolment) {
  const done = new Set(enrolment?.completed || [])
  return schedule(program).find((s) => !done.has(s.key)) || null
}

export function progressOf(program, enrolment) {
  const total = program.weeks * program.days.length
  const done = (enrolment?.completed || []).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

const DURATIONS = [
  { id: 'any', label: 'Any length', fits: () => true },
  { id: 'short', label: 'Under 25 min', fits: (m) => m < 25 },
  { id: 'mid', label: '25 to 45 min', fits: (m) => m >= 25 && m <= 45 },
  { id: 'long', label: '45 min plus', fits: (m) => m > 45 },
]

/* The library's own group names, in the order a person thinks about them. */
export const MUSCLES = ['any', ...['Legs', 'Glutes', 'Posterior', 'Push', 'Pull', 'Core', 'Pilates', 'Conditioning']
  .filter((g) => EXERCISES.some((e) => e.group === g))]

const groupsOf = (work) => [...new Set(work.map((w) => byId[w.ex]?.group).filter(Boolean))]
const programGroups = (p) => [...new Set(p.days.flatMap((d) => groupsOf(d.work)))]
const fitsDuration = (minutes) => (DURATIONS.find((d) => d.id === duration) || DURATIONS[0]).fits(minutes)

function visiblePrograms() {
  const wanted = env || get().profile.environment
  return PROGRAMS
    .filter((p) => (wanted === 'both' ? true : p.env === wanted || p.env === 'both'))
    .filter((p) => fitsDuration(p.minutes))
    .filter((p) => muscle === 'any' || programGroups(p).includes(muscle))
}

function visibleExpress() {
  const wanted = env || get().profile.environment
  return EXPRESS
    .filter((x) => (wanted === 'both' ? true : x.env === wanted))
    .filter((x) => fitsDuration(x.minutes))
    .filter((x) => muscle === 'any' || groupsOf(x.work).includes(muscle))
}

const programCard = (p, enrolment) => {
  const mine = enrolment?.programId === p.id
  const pr = mine ? progressOf(p, enrolment) : null
  return `<button class="card card--tap stack-sm" data-nav="/program/${esc(p.id)}">
    <div class="row row--between">
      <span class="tag tag--quiet">${esc(p.env === 'gym' ? 'Gym' : 'Home')}</span>
      ${mine ? '<span class="tag">Following</span>' : ''}
    </div>
    <h3 style="margin-top:var(--s2)">${esc(p.title)}</h3>
    <p class="lede">${esc(p.subtitle)}</p>
    <div class="row" style="gap:var(--s2); flex-wrap:wrap">
      <span class="tag tag--quiet">${esc(p.weeks)} weeks</span>
      <span class="tag tag--quiet">${esc(p.days.length)} days a week</span>
      <span class="tag tag--quiet">${esc(p.minutes)} min</span>
      <span class="tag tag--quiet">${esc(p.level)}</span>
    </div>
    ${pr ? `<div style="padding-top:var(--s2)">${bar(pr.done, pr.total)}<p class="lede" style="margin:var(--s2) 0 0">${pr.done} of ${pr.total} sessions done</p></div>` : ''}
  </button>`
}

export function render() {
  const s = get()
  const wanted = env || s.profile.environment
  const list = visiblePrograms()
  const express = visibleExpress()
  const suggestion = suggestProgram(s.profile)

  return `<main class="page stack">
    ${pageHead('Workouts', 'Programmes, express sessions and the full library')}

    <div class="seg" role="group" aria-label="Section">
      <button data-tab="programs" aria-pressed="${tab === 'programs'}">Workouts</button>
      <button data-tab="library" aria-pressed="${tab === 'library'}">Exercises</button>
    </div>

    ${tab === 'programs' ? `
      <div class="seg" role="group" aria-label="Where you train">
        <button data-env="home" aria-pressed="${wanted === 'home'}">Home</button>
        <button data-env="gym" aria-pressed="${wanted === 'gym'}">Gym</button>
        <button data-env="both" aria-pressed="${wanted === 'both'}">Both</button>
      </div>

      <div class="chips chips--scroll" role="group" aria-label="Session length">
        ${DURATIONS.map((d) => `<button class="chip" data-dur="${d.id}" aria-pressed="${duration === d.id}">${esc(d.label)}</button>`).join('')}
      </div>

      <div class="chips chips--scroll" role="group" aria-label="Target muscle group">
        ${MUSCLES.map((m) => `<button class="chip" data-muscle="${esc(m)}" aria-pressed="${muscle === m}">${esc(m === 'any' ? 'All muscles' : m)}</button>`).join('')}
      </div>

      ${!s.enrolment && suggestion ? `
        <section class="card card--flat stack-sm">
          <p class="eyebrow">Picked for you</p>
          <h3>${esc(suggestion.title)}</h3>
          <p class="lede">${esc(suggestion.blurb)}</p>
          <button class="btn btn--primary btn--sm" data-nav="/program/${esc(suggestion.id)}">Take a look</button>
        </section>` : ''}

      ${list.length ? `
        <section class="stack">
          ${sectionHead(`Programmes (${list.length})`)}
          ${list.map((p) => programCard(p, s.enrolment)).join('')}
        </section>` : ''}

      ${express.length ? `
        <section class="stack-sm">
          ${sectionHead(`Express (${express.length})`)}
          <p class="lede">One off sessions. No block behind them, and they still count towards your streak.</p>
          <ul class="list card">
            ${express.map((x) => `
              <li>
                <button class="listrow" data-nav="/session/${esc(x.id)}/1/day">
                  <span class="thumb">${icon.play()}</span>
                  <span class="grow">
                    <strong style="display:block; font-weight:500">${esc(x.title)}</strong>
                    <span class="lede">${esc(x.focus)} · ${esc(x.minutes)} min · ${esc(x.env === 'gym' ? 'gym' : 'home')}</span>
                  </span>
                  <span class="chev">${icon.chevron()}</span>
                </button>
              </li>`).join('')}
          </ul>
        </section>` : ''}

      ${!list.length && !express.length ? empty('Nothing matches', 'Widen the filters and something will turn up.') : ''}
    ` : `
      ${sectionHead(`${EXERCISES.length} movements`)}
      <div class="chips chips--scroll" role="group" aria-label="Muscle group">
        ${MUSCLES.map((m) => `<button class="chip" data-muscle="${esc(m)}" aria-pressed="${muscle === m}">${esc(m === 'any' ? 'All' : m)}</button>`).join('')}
      </div>
      <ul class="list card">
        ${EXERCISES.filter((e) => muscle === 'any' || e.group === muscle).map((e) => `
          <li>
            <button class="listrow" data-nav="/exercise/${esc(e.id)}">
              <span class="thumb">${icon.play()}</span>
              <span class="grow">
                <strong style="display:block; font-weight:500">${esc(e.name)}</strong>
                <span class="lede">${esc(e.group)} · ${esc(e.kit === 'both' ? 'home or gym' : e.kit)}</span>
              </span>
              <span class="chev">${icon.chevron()}</span>
            </button>
          </li>`).join('')}
      </ul>
    `}
  </main>`
}

export function mount(root) {
  const repaint = () => { root.innerHTML = render(); mount(root) }
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; repaint() }))
  root.querySelectorAll('[data-env]').forEach((b) => b.addEventListener('click', () => { env = b.dataset.env; repaint() }))
  root.querySelectorAll('[data-dur]').forEach((b) => b.addEventListener('click', () => { duration = b.dataset.dur; repaint() }))
  root.querySelectorAll('[data-muscle]').forEach((b) => b.addEventListener('click', () => { muscle = b.dataset.muscle; repaint() }))
}

/* Enrolling swaps whatever was running. The previous programme's set logs stay
   on disk, so going back to it later picks up where it stopped. */
export function enrol(programId, startedOn) {
  update((s) => {
    s.enrolment = { programId, startedOn, completed: s.enrolment?.programId === programId ? s.enrolment.completed : [] }
    return s
  })
  toast(`Following ${programById(programId).title}`)
}
