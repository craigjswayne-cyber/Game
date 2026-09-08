/*
 * HOME: the five second answer to "what am I doing today?"
 *
 * Header, three rings, the session, two minutes of mindset, and the coaching
 * door. Nothing else: everything on this screen is either a number that changed
 * today or a button that starts something.
 */
import { esc, icon, iso, prettyDate, initials } from '../util.js'
import { get, update, dayOf, workoutStreak } from '../state.js'
import { quoteCard, ring, toast } from '../ui.js'
import { programById } from '../data/programs.js'
import { gratitudeFor } from '../data/mindset.js'
import { macrosFor } from '../macros.js'
import { nextSession } from './workouts.js'
import { render as rerenderRoute } from '../router.js'

const greeting = (name) => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export function render() {
  const s = get()
  const today = iso()
  const day = dayOf(today)
  const streak = workoutStreak(today)
  const p = s.profile

  const targets = macrosFor({
    weightKg: currentWeight(s), heightCm: p.heightCm, age: p.age, sex: p.sex,
    activity: p.activity, goal: goalFromProfile(p),
  })

  const program = s.enrolment ? programById(s.enrolment.programId) : null
  const next = program ? nextSession(program, s.enrolment) : null
  const prompt = gratitudeFor(s.settings.quoteSeed)
  const answered = s.mindset.gratitude.find((g) => g.date === today)

  return `<main class="page stack">
    <header class="row" style="margin-bottom:var(--s2)">
      <button class="avatar" data-nav="/account" aria-label="Your profile and progress">${esc(initials(p.name || 'Mimi'))}</button>
      <div class="grow">
        <p class="eyebrow" style="margin:0">${esc(prettyDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        <h1 style="font-size:var(--t-title)">${esc(greeting(p.name))}</h1>
      </div>
    </header>

    ${quoteCard('home')}

    <section class="card" aria-label="Today at a glance">
      <div class="grid3" style="align-items:start">
        <button class="stat" data-nav="/tracker" aria-label="Steps: ${esc(day.steps)} of ${esc(p.stepGoal)}">
          ${ring(day.steps, p.stepGoal, day.steps >= 1000 ? `${Math.round(day.steps / 100) / 10}k` : String(day.steps), 'Steps')}
        </button>
        <button class="stat" data-nav="/tracker" aria-label="Water: ${esc(day.waterMl)} of ${esc(p.waterGoalMl)} millilitres">
          ${ring(day.waterMl, p.waterGoalMl, `${(day.waterMl / 1000).toFixed(1)}L`, 'Water')}
        </button>
        <button class="stat" data-nav="/tracker" aria-label="Streak: ${streak} days">
          ${ring(Math.min(streak, 7), 7, String(streak), 'Streak')}
        </button>
      </div>
    </section>

    ${program && next ? `
      <button class="card card--brand card--tap" data-nav="/session/${esc(program.id)}/${next.week}/${esc(next.day.id)}">
        <p class="eyebrow">Up next, week ${next.week} of ${program.weeks}</p>
        <h2 style="margin:var(--s2) 0 var(--s1)">${esc(next.day.title)}</h2>
        <p class="lede" style="margin-bottom:var(--s3)">${esc(program.title)}, about ${esc(next.day.minutes)} minutes</p>
        <span class="btn btn--soft btn--sm">${icon.play()} Continue workout</span>
      </button>` : `
      <button class="card card--brand card--tap" data-nav="/workouts">
        <p class="eyebrow">No programme running</p>
        <h2 style="margin:var(--s2) 0 var(--s1)">Pick a block to follow</h2>
        <p class="lede">Eight weeks of structure beats eight weeks of choosing.</p>
      </button>`}

    <section class="card stack-sm" aria-label="Mindset spotlight">
      <div class="row row--between">
        <p class="eyebrow" style="margin:0">Mindset spotlight</p>
        <span class="tag tag--quiet">2 min</span>
      </div>
      <p style="font-family:var(--serif); font-size:1.05rem; font-style:italic; margin:var(--s2) 0">${esc(prompt)}</p>
      ${answered ? `
        <div class="card card--flat">
          <p class="eyebrow">Written today</p>
          <p style="margin:var(--s2) 0 0">${esc(answered.text)}</p>
        </div>
        <button class="btn btn--ghost btn--sm" data-nav="/tracker">Open the Mindset core</button>
      ` : `
        <textarea data-gratitude placeholder="A sentence is enough."></textarea>
        <div class="row">
          <button class="btn btn--primary btn--sm grow" data-save-gratitude>Save it</button>
          <button class="btn btn--ghost btn--sm" data-nav="/tracker">More</button>
        </div>
      `}
    </section>

    <button class="card card--tap" data-nav="/coaching">
      <div class="row">
        <span class="avatar">M</span>
        <span class="grow">
          <strong style="display:block">1-1 coaching with Mimi</strong>
          <span class="lede">${esc(coachingLine(s))}</span>
        </span>
        <span class="chev">${icon.chevron()}</span>
      </div>
    </button>

    <button class="card card--tap stack-sm" data-nav="/nutrition">
      <div class="row row--between"><h3>Today’s targets</h3><span class="chev">${icon.chevron()}</span></div>
      <div class="grid3" style="padding-top:var(--s2)">
        <div class="stat"><span class="num">${esc(targets.protein)}g</span><span class="eyebrow">Protein</span></div>
        <div class="stat"><span class="num">${esc(targets.carbs)}g</span><span class="eyebrow">Carbs</span></div>
        <div class="stat"><span class="num">${esc(targets.fat)}g</span><span class="eyebrow">Fat</span></div>
      </div>
      <p class="lede center">${esc(targets.kcal.toLocaleString())} kcal, set for ${esc(goalLabel(p))}</p>
    </button>
  </main>`
}

export function mount(root) {
  root.querySelector('[data-save-gratitude]')?.addEventListener('click', () => {
    const box = root.querySelector('[data-gratitude]')
    const text = box.value.trim()
    if (!text) { toast('Write a line first.'); return }
    update((s) => {
      s.mindset.gratitude = [...s.mindset.gratitude.filter((g) => g.date !== iso()), { date: iso(), text }]
      return s
    })
    toast('Saved to your journal.')
    rerenderRoute()
  })
}

/* The most recent logged weight, falling back to the intake figure. */
export function currentWeight(s) {
  const logged = Object.entries(s.days)
    .filter(([, d]) => typeof d.weightKg === 'number')
    .sort((a, b) => b[0].localeCompare(a[0]))[0]
  return logged ? logged[1].weightKg : s.profile.startWeightKg
}

/* The intake asks for goals in plain language. The calculator wants one of
   three energy settings, so the mapping happens here and nowhere else. */
export function goalFromProfile(p) {
  if (p.macroGoal) return p.macroGoal
  if (p.goals.includes('fatloss')) return 'cut'
  if (p.goals.includes('strength') && !p.goals.includes('endurance')) return 'bulk'
  return 'maintain'
}

const goalLabel = (p) => ({ cut: 'fat loss', bulk: 'building muscle', maintain: 'maintenance' })[goalFromProfile(p)]

const coachingLine = (s) => {
  if (!s.coaching.checkins.length) return 'Your first check-in is waiting'
  const last = s.coaching.checkins[s.coaching.checkins.length - 1]
  return `Last check-in ${prettyDate(last.date)}`
}
