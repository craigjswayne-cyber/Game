/*
 * THE INTAKE.
 *
 * Seven steps, answered once, and every other screen in the app reads the
 * result: which programs are offered, what the macro targets are, what the
 * water and step rings are measured against. A person who skips it gets the
 * defaults in state.js, which are deliberately sane rather than empty.
 *
 * The draft lives here rather than in the store, so a half finished intake is
 * never written over a real profile.
 */
import { esc, clamp } from '../util.js'
import { get, update } from '../state.js'
import { go } from '../router.js'
import { ACTIVITY } from '../macros.js'
import { PROGRAMS } from '../data/programs.js'
import { toast } from '../ui.js'

let step = 0
let draft = null

const LEVELS = [
  { id: 'beginner', label: 'Beginner', hint: 'New to this, or coming back after a long break' },
  { id: 'intermediate', label: 'Intermediate', hint: 'Training regularly, comfortable with the main lifts' },
  { id: 'advanced', label: 'Advanced', hint: 'Years in, chasing specific numbers' },
]
const ENVS = [
  { id: 'home', label: 'At home', hint: 'A mat, some space, maybe a band or a bell' },
  { id: 'gym', label: 'In the gym', hint: 'Full rack, machines, the lot' },
  { id: 'both', label: 'Both', hint: 'Gym when I can, home when I cannot' },
]
const DISCIPLINES = [
  { id: 'strength', label: 'Strength' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'pilates', label: 'Pilates' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'conditioning', label: 'Conditioning' },
]
const GOALS = [
  { id: 'strength', label: 'Build strength' },
  { id: 'fatloss', label: 'Lose fat' },
  { id: 'endurance', label: 'Build endurance' },
  { id: 'lifestyle', label: 'Habits and lifestyle' },
]

const STEPS = 7

function ensureDraft() {
  if (!draft) draft = JSON.parse(JSON.stringify(get().profile))
}

const pick = (on, id, label, hint) => `
  <button class="pick" data-pick="${esc(id)}" aria-pressed="${on ? 'true' : 'false'}">
    <strong>${esc(label)}</strong>
    ${hint ? `<span>${esc(hint)}</span>` : ''}
  </button>`

const numField = (key, label, suffix, min, max) => `
  <label class="field">
    <span>${esc(label)}</span>
    <div class="row">
      <input class="grow" type="number" inputmode="decimal" data-num="${esc(key)}"
        value="${esc(draft[key] ?? '')}" min="${min}" max="${max}" />
      <span class="lede" style="flex:0 0 auto">${esc(suffix)}</span>
    </div>
  </label>`

function body() {
  const p = draft
  switch (step) {
    case 0: return `
      <p class="eyebrow">Made by Mimi</p>
      <h1 style="margin:var(--s2) 0 var(--s4)">Let's build your side of this.</h1>
      <p class="lede">Seven quick questions. They set your programme, your macros and the numbers on your dashboard. You can change any of it later.</p>
      <label class="field" style="margin-top:var(--s5)">
        <span>What should I call you?</span>
        <input type="text" data-text="name" value="${esc(p.name)}" placeholder="First name" autocomplete="given-name" />
      </label>`
    case 1: return `
      <h2>Where are you starting from?</h2>
      <p class="lede">There is no wrong answer here, only a wrong programme.</p>
      <div class="stack" style="margin-top:var(--s5)">
        ${LEVELS.map((l) => pick(p.level === l.id, l.id, l.label, l.hint)).join('')}
      </div>`
    case 2: return `
      <h2>Where will you train?</h2>
      <p class="lede">This decides which programmes you see first.</p>
      <div class="stack" style="margin-top:var(--s5)">
        ${ENVS.map((e) => pick(p.environment === e.id, e.id, e.label, e.hint)).join('')}
      </div>`
    case 3: return `
      <h2>What do you enjoy?</h2>
      <p class="lede">Pick as many as you like. The programme grid sorts by these.</p>
      <div class="stack" style="margin-top:var(--s5)">
        ${DISCIPLINES.map((d) => pick(p.disciplines.includes(d.id), d.id, d.label)).join('')}
      </div>`
    case 4: return `
      <h2>What are you here for?</h2>
      <p class="lede">Your macro targets follow from this.</p>
      <div class="stack" style="margin-top:var(--s5)">
        ${GOALS.map((g) => pick(p.goals.includes(g.id), g.id, g.label)).join('')}
      </div>`
    case 5: return `
      <h2>Your numbers</h2>
      <p class="lede">Used for the macro calculator and to draw your first progress graphs. Nothing here leaves your phone.</p>
      <div class="stack" style="margin-top:var(--s5)">
        <div class="seg" role="group" aria-label="Sex for the energy formula">
          <button data-sex="female" aria-pressed="${p.sex === 'female'}">Female</button>
          <button data-sex="male" aria-pressed="${p.sex === 'male'}">Male</button>
        </div>
        <p class="lede">The Mifflin-St Jeor equation takes a sex term. It is the only place this is used.</p>
        <div class="grid2">
          ${numField('age', 'Age', 'yrs', 14, 100)}
          ${numField('heightCm', 'Height', 'cm', 120, 220)}
          ${numField('startWeightKg', 'Weight now', 'kg', 30, 250)}
          ${numField('targetWeightKg', 'Target', 'kg', 30, 250)}
        </div>
        <label class="field">
          <span>How active is the rest of your week?</span>
          <select data-select="activity">
            ${ACTIVITY.map((a) => `<option value="${a.id}" ${p.activity === a.id ? 'selected' : ''}>${esc(a.label)}: ${esc(a.hint)}</option>`).join('')}
          </select>
        </label>
      </div>`
    case 6: return `
      <h2>Daily habits</h2>
      <p class="lede">The two rings on your tracker. Start where you actually are, not where you wish you were.</p>
      <div class="stack" style="margin-top:var(--s5)">
        <div class="card">
          <div class="row row--between"><span>Water</span><strong class="num" data-out="water">${esc(p.waterGoalMl)}ml</strong></div>
          <input type="range" min="1000" max="4000" step="250" value="${esc(p.waterGoalMl)}" data-range="waterGoalMl" />
        </div>
        <div class="card">
          <div class="row row--between"><span>Steps</span><strong class="num" data-out="steps">${esc(p.stepGoal.toLocaleString())}</strong></div>
          <input type="range" min="2000" max="20000" step="500" value="${esc(p.stepGoal)}" data-range="stepGoal" />
        </div>
      </div>`
    default: return ''
  }
}

export function render() {
  ensureDraft()
  const first = step === 0
  return `<div class="onb">
    <div class="steps" aria-hidden="true">
      ${Array.from({ length: STEPS }, (_, i) => `<i class="${i <= step ? 'is-done' : ''}"></i>`).join('')}
    </div>
    <div class="body stack">${body()}</div>
    <div class="foot">
      ${first ? '' : '<button class="btn btn--ghost" data-back>Back</button>'}
      <button class="btn btn--primary grow" data-next>${step === STEPS - 1 ? 'Build my dashboard' : 'Continue'}</button>
    </div>
  </div>`
}

export function mount(root) {
  const rerender = () => { root.innerHTML = render(); mount(root) }

  root.querySelector('[data-back]')?.addEventListener('click', () => { step = Math.max(0, step - 1); rerender() })

  root.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.pick
    if (step === 1) draft.level = id
    if (step === 2) draft.environment = id
    if (step === 3) draft.disciplines = toggle(draft.disciplines, id)
    if (step === 4) draft.goals = toggle(draft.goals, id)
    rerender()
  }))

  root.querySelectorAll('[data-sex]').forEach((btn) => btn.addEventListener('click', () => {
    draft.sex = btn.dataset.sex
    rerender()
  }))

  root.querySelector('[data-text="name"]')?.addEventListener('input', (e) => { draft.name = e.target.value.slice(0, 40) })
  root.querySelectorAll('[data-num]').forEach((inp) => inp.addEventListener('input', (e) => {
    const v = Number(e.target.value)
    draft[e.target.dataset.num] = Number.isFinite(v) && v > 0 ? v : draft[e.target.dataset.num]
  }))
  root.querySelector('[data-select="activity"]')?.addEventListener('change', (e) => { draft.activity = e.target.value })

  root.querySelectorAll('[data-range]').forEach((inp) => inp.addEventListener('input', (e) => {
    const key = e.target.dataset.range
    draft[key] = Number(e.target.value)
    const out = root.querySelector(key === 'waterGoalMl' ? '[data-out="water"]' : '[data-out="steps"]')
    if (out) out.textContent = key === 'waterGoalMl' ? `${draft[key]}ml` : draft[key].toLocaleString()
  }))

  root.querySelector('[data-next]').addEventListener('click', () => {
    if (step === 3 && !draft.disciplines.length) return toast('Pick at least one.')
    if (step === 4 && !draft.goals.length) return toast('Pick at least one.')
    if (step < STEPS - 1) { step++; rerender(); return }
    finish()
  })
}

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

function finish() {
  draft.age = clamp(Number(draft.age) || 28, 14, 100)
  draft.heightCm = clamp(Number(draft.heightCm) || 167, 120, 220)
  draft.startWeightKg = clamp(Number(draft.startWeightKg) || 68, 30, 250)
  draft.targetWeightKg = clamp(Number(draft.targetWeightKg) || draft.startWeightKg, 30, 250)

  update((s) => {
    s.profile = { ...s.profile, ...draft }
    s.onboarded = true
    /* The first weight entry, so the progress graph has somewhere to start. */
    const today = s.createdOn
    s.days[today] = { ...(s.days[today] || {}), weightKg: draft.startWeightKg, waterMl: 0, steps: 0, mood: null, todos: [], workouts: [] }
    /* Enrol in the best match rather than dropping the person on an empty grid. */
    const suggestion = suggestProgram(draft)
    if (suggestion) s.enrolment = { programId: suggestion.id, startedOn: today, completed: [] }
    return s
  })
  step = 0
  draft = null
  go('/home')
  toast('Dashboard built. Welcome in.')
}

/* Score every program against the intake and take the best. Environment is
   worth most: a home-only person offered a barbell block will not start it. */
export function suggestProgram(profile) {
  const score = (p) => {
    let n = 0
    if (profile.environment === 'both' || p.env === profile.environment) n += 4
    if (p.level === profile.level) n += 3
    n += p.disciplines.filter((d) => profile.disciplines.includes(d)).length * 2
    n += p.goals.filter((g) => profile.goals.includes(g)).length
    return n
  }
  return [...PROGRAMS].sort((a, b) => score(b) - score(a))[0] || null
}
