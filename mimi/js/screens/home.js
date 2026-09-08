/*
 * HOME: the five second answer to "what am I doing today?"
 *
 * Greeting and quote, then the active session, then today's numbers, then the
 * three doors that make this app more than a workout log: mindset, coaching,
 * community.
 */
import { esc, icon, iso, prettyDate } from '../util.js'
import { get, dayOf, workoutStreak } from '../state.js'
import { quoteCard, sectionHead, bar } from '../ui.js'
import { programById } from '../data/programs.js'
import { macrosFor } from '../macros.js'
import { nextSession } from './workouts.js'

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

  return `<main class="page stack">
    <header class="pagehead" style="margin-bottom:0">
      <p class="eyebrow">${esc(prettyDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h1>${esc(greeting(p.name))}</h1>
    </header>

    ${quoteCard('home')}

    ${program && next ? `
      <button class="card card--brand card--tap" data-nav="/session/${esc(program.id)}/${next.week}/${esc(next.day.id)}">
        <p class="eyebrow">Up next, week ${next.week} of ${program.weeks}</p>
        <h2 style="margin:var(--s2) 0 var(--s1)">${esc(next.day.title)}</h2>
        <p class="lede" style="margin-bottom:var(--s3)">${esc(program.title)}, about ${esc(next.day.minutes)} minutes</p>
        <span class="btn btn--soft btn--sm">${icon.play()} Start session</span>
      </button>` : `
      <button class="card card--brand card--tap" data-nav="/workouts">
        <p class="eyebrow">No programme running</p>
        <h2 style="margin:var(--s2) 0 var(--s1)">Pick a block to follow</h2>
        <p class="lede">Eight weeks of structure beats eight weeks of choosing.</p>
      </button>`}

    <section class="card stack-sm">
      ${sectionHead('Today', { to: '/tracker', label: 'Open' })}
      <div class="row row--between" style="padding-top:var(--s2)">
        <span class="lede">${icon.drop()} Water</span>
        <span>${esc(day.waterMl)} of ${esc(p.waterGoalMl)}ml</span>
      </div>
      ${bar(day.waterMl, p.waterGoalMl, 'bar--water')}
      <div class="row row--between" style="padding-top:var(--s3)">
        <span class="lede">${icon.steps()} Steps</span>
        <span>${esc(day.steps.toLocaleString())} of ${esc(p.stepGoal.toLocaleString())}</span>
      </div>
      ${bar(day.steps, p.stepGoal)}
      <div class="row" style="padding-top:var(--s3); gap:var(--s2)">
        <span class="tag">${icon.flame()} ${streak} day streak</span>
        ${day.workouts.length ? '<span class="tag tag--good">Session logged</span>' : '<span class="tag tag--quiet">No session yet</span>'}
      </div>
    </section>

    <button class="card card--tap stack-sm" data-nav="/nutrition">
      ${sectionHead('Today’s targets')}
      <div class="grid3" style="padding-top:var(--s2)">
        <div class="stat"><span class="num">${esc(targets.protein)}g</span><span class="eyebrow">Protein</span></div>
        <div class="stat"><span class="num">${esc(targets.carbs)}g</span><span class="eyebrow">Carbs</span></div>
        <div class="stat"><span class="num">${esc(targets.fat)}g</span><span class="eyebrow">Fat</span></div>
      </div>
      <p class="lede center">${esc(targets.kcal.toLocaleString())} kcal, set for ${esc(goalLabel(p))}</p>
    </button>

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

    <button class="card card--tap" data-nav="/mindset">
      <div class="row">
        <span class="avatar" style="background:var(--good-wash); color:var(--good)">${icon.leaf()}</span>
        <span class="grow">
          <strong style="display:block">Mindset</strong>
          <span class="lede">Breathwork, grounding and the prompts that keep you honest</span>
        </span>
        <span class="chev">${icon.chevron()}</span>
      </div>
    </button>

    <section class="stack-sm">
      ${sectionHead('From the community', { to: '/community', label: 'See all' })}
      ${s.community.posts.slice(0, 2).map((post) => `
        <article class="card card--flat">
          <div class="row" style="align-items:flex-start">
            <span class="avatar">${esc(post.author.slice(0, 1))}</span>
            <span class="grow">
              <strong style="display:block; font-weight:500">${esc(post.author)}</strong>
              <span class="lede">${esc(post.body)}</span>
            </span>
          </div>
        </article>`).join('')}
    </section>
  </main>`
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
