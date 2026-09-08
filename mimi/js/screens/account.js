/*
 * ACCOUNT: who you are, how it is going, and every switch in the app.
 *
 * The graphs are drawn from the same day records the tracker writes, so a chart
 * can never disagree with the calendar. Weekly consistency counts sessions, not
 * minutes, because a person who did four short sessions had a better week than
 * one who did a single long one.
 */
import { esc, iso, addDays, prettyDate, initials, plural, round } from '../util.js'
import { get, update, reset, weightSeries, workoutStreak } from '../state.js'
import { sectionHead, lineChart, barChart, toast, sheet, closeSheet } from '../ui.js'
import { PROGRAMS, programById } from '../data/programs.js'
import { progressOf } from './workouts.js'
import { available as healthAvailable } from '../health.js'
import { isDownloaded, removeDownload, cacheReady } from '../offline.js'
import { go, render as rerenderRoute } from '../router.js'

const MEASURES = [
  { key: 'waistCm', label: 'Waist' },
  { key: 'hipsCm', label: 'Hips' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'thighCm', label: 'Thigh' },
]

/* Sessions per week over the last eight weeks, oldest first. */
function weeklySessions(s, weeks = 8) {
  const out = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end = addDays(iso(), -7 * w)
    let n = 0
    for (let d = 0; d < 7; d++) n += (s.days[addDays(end, -d)]?.workouts?.length || 0)
    out.push({ label: w === 0 ? 'now' : `-${w}`, value: n })
  }
  return out
}

export function body() {
  const s = get()
  const p = s.profile
  const series = weightSeries()
  const latest = series.length ? series[series.length - 1].kg : p.startWeightKg
  const moved = round(latest - p.startWeightKg, 1)
  const program = s.enrolment ? programById(s.enrolment.programId) : null
  const pr = program ? progressOf(program, s.enrolment) : null
  const downloaded = PROGRAMS.filter((x) => isDownloaded(x.id))

  return `<div class="stack">
    <section class="card row">
      <span class="avatar" style="width:52px; height:52px; font-size:1.1rem">${esc(initials(p.name || 'Mimi Member'))}</span>
      <span class="grow">
        <strong style="display:block; font-weight:500">${esc(p.name || 'Mimi member')}</strong>
        <span class="lede">${esc(p.level)} · trains ${esc(p.environment === 'both' ? 'home and gym' : p.environment)}</span>
      </span>
      <button class="btn btn--ghost btn--sm" data-edit>Edit</button>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Weight')}
      ${lineChart(series.map((x) => ({ date: x.date, value: x.kg })), { unit: 'kg' })}
      <div class="grid3">
        <div class="stat"><span class="num">${esc(p.startWeightKg)}</span><span class="eyebrow">Start</span></div>
        <div class="stat"><span class="num">${esc(latest)}</span><span class="eyebrow">Now</span></div>
        <div class="stat"><span class="num">${esc(p.targetWeightKg)}</span><span class="eyebrow">Target</span></div>
      </div>
      <p class="lede center">${moved === 0 ? 'Level with where you started.' : `${Math.abs(moved)}kg ${moved < 0 ? 'down' : 'up'} since ${esc(prettyDate(series[0].date))}.`}</p>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Consistency')}
      ${barChart(weeklySessions(s))}
      <p class="lede center">Sessions a week, last eight weeks. Current streak ${plural(workoutStreak(), 'day')}.</p>
      ${pr ? `<p class="lede center">${esc(program.title)}: ${pr.done} of ${pr.total} sessions, ${pr.pct} percent.</p>` : ''}
    </section>

    <section class="card stack-sm">
      ${sectionHead('Measurements')}
      <div class="grid2">
        ${MEASURES.map((m) => `
          <label class="field">
            <span>${esc(m.label)} (cm)</span>
            <input type="number" step="0.5" inputmode="decimal" data-measure="${m.key}" value="${esc(p.measurements[m.key] ?? '')}" placeholder="-" />
          </label>`).join('')}
      </div>
      <button class="btn btn--ghost btn--sm" data-save-measures>Save measurements</button>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Apple Health')}
      <p class="lede">${esc(healthAvailable()
        ? 'Connected. Steps and active energy are read on sync, water is written back if you allow it.'
        : 'Available on the iOS build. These switches decide what it will read once it is.')}</p>
      ${[['steps', 'Read steps'], ['energy', 'Read active energy'], ['water', 'Write water intake back']].map(([k, label]) => `
        <div class="switch">
          <span>${esc(label)}</span>
          <input type="checkbox" data-health="${k}" ${s.settings.health[k] ? 'checked' : ''} />
        </div>`).join('')}
    </section>

    <section class="card stack-sm">
      ${sectionHead('Downloads')}
      ${downloaded.length ? `<ul class="list">
        ${downloaded.map((x) => `
          <li class="row row--between" style="padding:var(--s3) 0">
            <span class="grow">${esc(x.title)}</span>
            <button class="btn btn--sm btn--ghost" data-undownload="${esc(x.id)}">Remove</button>
          </li>`).join('')}
      </ul>` : '<p class="lede">Nothing downloaded. Open a programme and tap the download button to keep it for the days with no signal.</p>'}
      <p class="lede">${esc(cacheReady() ? 'Offline cache is active.' : 'Offline cache starts once the app is served over http rather than opened as a file.')}</p>
    </section>

    <section class="card stack-sm">
      ${sectionHead('Your data')}
      <p class="lede">Everything lives on this device. Nothing is uploaded, and there is no account to delete.</p>
      <div class="row">
        <button class="btn btn--ghost btn--sm grow" data-export>Export a backup</button>
        <button class="btn btn--danger btn--sm grow" data-reset>Start over</button>
      </div>
    </section>

    <p class="lede center">Made by Mimi · prototype build</p>
  </div>`
}

export function mount(root) {
  root.querySelector('[data-edit]')?.addEventListener('click', openEdit)

  root.querySelector('[data-save-measures]')?.addEventListener('click', () => {
    update((s) => {
      root.querySelectorAll('[data-measure]').forEach((inp) => {
        const v = Number(inp.value)
        s.profile.measurements[inp.dataset.measure] = Number.isFinite(v) && v > 0 ? v : null
      })
      return s
    })
    toast('Measurements saved.')
  })

  root.querySelectorAll('[data-health]').forEach((box) => box.addEventListener('change', () => {
    update((s) => { s.settings.health[box.dataset.health] = box.checked; return s })
  }))

  root.querySelectorAll('[data-undownload]').forEach((b) => b.addEventListener('click', () => {
    removeDownload(b.dataset.undownload)
    toast('Download removed.')
    rerenderRoute()
  }))

  root.querySelector('[data-export]')?.addEventListener('click', exportBackup)

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    sheet('Start over', `
      <p>This clears your profile, your logs, your journal and your posts on this device. It cannot be undone.</p>
      <div class="row" style="margin-top:var(--s4)">
        <button class="btn btn--ghost grow" data-close-sheet>Keep my data</button>
        <button class="btn btn--danger grow" data-confirm-reset>Clear everything</button>
      </div>`, (wrap) => {
      wrap.querySelector('[data-confirm-reset]').addEventListener('click', () => {
        reset()
        closeSheet()
        go('/home')
        toast('Cleared.')
      })
    })
  })
}

function openEdit() {
  const p = get().profile
  sheet('Edit profile', `
    <form class="stack" data-form>
      <label class="field"><span>Name</span><input type="text" name="name" value="${esc(p.name)}" maxlength="40" /></label>
      <div class="grid2">
        <label class="field"><span>Age</span><input type="number" name="age" value="${esc(p.age)}" /></label>
        <label class="field"><span>Height (cm)</span><input type="number" name="heightCm" value="${esc(p.heightCm)}" /></label>
        <label class="field"><span>Start weight (kg)</span><input type="number" step="0.1" name="startWeightKg" value="${esc(p.startWeightKg)}" /></label>
        <label class="field"><span>Target (kg)</span><input type="number" step="0.1" name="targetWeightKg" value="${esc(p.targetWeightKg)}" /></label>
        <label class="field"><span>Water goal (ml)</span><input type="number" step="100" name="waterGoalMl" value="${esc(p.waterGoalMl)}" /></label>
        <label class="field"><span>Step goal</span><input type="number" step="500" name="stepGoal" value="${esc(p.stepGoal)}" /></label>
      </div>
      <label class="field">
        <span>Where you train</span>
        <select name="environment">
          ${['home', 'gym', 'both'].map((e) => `<option value="${e}" ${p.environment === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Experience</span>
        <select name="level">
          ${['beginner', 'intermediate', 'advanced'].map((e) => `<option value="${e}" ${p.level === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
        </select>
      </label>
      <button class="btn btn--primary btn--block" type="submit">Save</button>
    </form>`, (wrap) => {
    wrap.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = new FormData(e.target)
      update((s) => {
        s.profile.name = String(f.get('name') || '').slice(0, 40)
        for (const k of ['age', 'heightCm', 'startWeightKg', 'targetWeightKg', 'waterGoalMl', 'stepGoal']) {
          const v = Number(f.get(k))
          if (Number.isFinite(v) && v > 0) s.profile[k] = v
        }
        s.profile.environment = String(f.get('environment'))
        s.profile.level = String(f.get('level'))
        return s
      })
      closeSheet()
      toast('Saved.')
      rerenderRoute()
    })
  })
}

/* A backup is the whole store as JSON. No server means the person's own file
   system is the only place a backup can live. */
function exportBackup() {
  const blob = new Blob([JSON.stringify(get(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `made-by-mimi-${iso()}.json`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  toast('Backup saved to your downloads.')
}
