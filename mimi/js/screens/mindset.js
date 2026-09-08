/*
 * MINDSET: the part of the app that is not about the body.
 *
 * Three kinds of session share one screen. A breath session runs a paced orb, a
 * read session is a script you follow at your own pace, and a journal session
 * saves what you write so the next restart can read what the last one said.
 */
import { esc, icon, iso, prettyDate, mmss, uid } from '../util.js'
import { get, update } from '../state.js'
import { pageHead, quoteCard, sectionHead, toast } from '../ui.js'
import { SESSIONS, sessionById, HABIT_GUIDES, habitById } from '../data/mindset.js'
import { render as rerenderRoute } from '../router.js'

let breathTimer = null
let audioTimer = null
let audioLeft = 0

export function render() {
  const s = get()
  const done = new Set(s.mindset.completed.map((c) => c.id))
  const themes = [...new Set(SESSIONS.map((x) => x.theme))]

  return `<main class="page stack">
    ${pageHead('Mindset core', 'Guided audio, breathwork, grounding and the questions worth sitting with', { to: '/tracker', label: 'Today' })}

    ${quoteCard('mindset')}

    <div class="grid2">
      <div class="card card--flat stat">
        <span class="num">${s.mindset.completed.length}</span>
        <span class="eyebrow">Sessions done</span>
      </div>
      <div class="card card--flat stat">
        <span class="num">${s.mindset.journal.length + s.mindset.gratitude.length}</span>
        <span class="eyebrow">Journal entries</span>
      </div>
    </div>

    ${themes.map((theme) => `
      <section class="stack-sm">
        ${sectionHead(theme)}
        <ul class="list card">
          ${SESSIONS.filter((x) => x.theme === theme).map((x) => `
            <li>
              <button class="listrow" data-nav="/mindset/${esc(x.id)}">
                <span class="thumb">${x.kind === 'breath' ? icon.leaf() : x.kind === 'journal' ? icon.spark() : x.kind === 'audio' ? icon.sound() : icon.clock()}</span>
                <span class="grow">
                  <strong style="display:block; font-weight:500">${esc(x.title)}</strong>
                  <span class="lede">${esc(x.minutes)} min · ${esc(x.blurb)}</span>
                </span>
                ${done.has(x.id) ? '<span class="tag tag--good">Done</span>' : `<span class="chev">${icon.chevron()}</span>`}
              </button>
            </li>`).join('')}
        </ul>
      </section>`).join('')}

    <section class="stack-sm">
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

    ${s.mindset.gratitude.length ? `
      <section class="stack-sm">
        ${sectionHead('Gratitude')}
        ${s.mindset.gratitude.slice().reverse().slice(0, 3).map((g) => `
          <article class="card card--flat">
            <p class="eyebrow">${esc(prettyDate(g.date))}</p>
            <p style="margin:var(--s2) 0 0">${esc(g.text)}</p>
          </article>`).join('')}
      </section>` : ''}

    ${s.mindset.journal.length ? `
      <section class="stack-sm">
        ${sectionHead('Your journal')}
        ${s.mindset.journal.slice().reverse().slice(0, 4).map((entry) => `
          <article class="card card--flat">
            <p class="eyebrow">${esc(prettyDate(entry.date))} · ${esc(entry.title)}</p>
            ${entry.answers.map((a) => `<p style="margin:var(--s2) 0 0">${esc(a)}</p>`).join('')}
          </article>`).join('')}
      </section>` : ''}
  </main>`
}

/* ---- one session ---- */
export const detail = {
  render({ id }) {
    const x = sessionById(id)
    if (!x) return `<main class="page">${pageHead('Not found', '', { to: '/mindset', label: 'Mindset' })}</main>`
    const doneOn = get().mindset.completed.find((c) => c.id === id)

    const bodies = {
      breath: `
        <div class="breath"><div class="orb" data-orb></div></div>
        <p class="center" data-breath-cue>In for ${esc(x.pattern.in)}, hold for ${esc(x.pattern.hold)}, out for ${esc(x.pattern.out)}.</p>
        <p class="center lede" data-breath-round>${esc(x.pattern.rounds)} rounds, about ${esc(x.minutes)} minutes</p>
        <button class="btn btn--primary btn--block" data-breath-start>Start</button>`,
      read: `
        <ol class="stack" style="padding-left:1.1rem">
          ${(x.script || []).map((line) => `<li>${esc(line)}</li>`).join('')}
        </ol>`,
      audio: `
        <div class="video">
          <span class="playmark">${icon.sound()}</span>
        </div>
        <p class="lede center">Mimi's recording (${esc(x.track || '')}) streams here in the shipping app. The timer and the written version work now.</p>
        <div class="row" style="justify-content:center; gap:var(--s3)">
          <button class="btn btn--primary" data-audio-start>Start ${esc(x.minutes)} minutes</button>
          <span class="num" data-audio-clock>${esc(mmss(x.minutes * 60))}</span>
        </div>
        <ol class="stack" style="padding-left:1.1rem">
          ${(x.script || []).map((line) => `<li>${esc(line)}</li>`).join('')}
        </ol>`,
      journal: `
        <div class="stack">
          ${(x.prompts || []).map((p, i) => `
            <label class="field">
              <span>${esc(p)}</span>
              <textarea data-prompt="${i}" placeholder="Write it as it comes out."></textarea>
            </label>`).join('')}
        </div>`,
    }

    return `<main class="page stack">
      ${pageHead(x.title, `${x.theme} · ${x.minutes} minutes`, { to: '/mindset', label: 'Mindset' })}
      <p>${esc(x.blurb)}</p>
      ${bodies[x.kind]}
      <button class="btn ${x.kind === 'breath' ? 'btn--ghost' : 'btn--primary'} btn--block" data-complete>
        ${x.kind === 'journal' ? 'Save and finish' : 'Mark as done'}
      </button>
      ${doneOn ? `<p class="lede center">Last completed ${esc(prettyDate(doneOn.date))}.</p>` : ''}
    </main>`
  },

  mount(root, { id }) {
    const x = sessionById(id)
    if (!x) return

    root.querySelector('[data-breath-start]')?.addEventListener('click', (e) => {
      if (breathTimer) { stopBreath(root); e.target.textContent = 'Start'; return }
      e.target.textContent = 'Stop'
      runBreath(root, x)
    })

    root.querySelector('[data-audio-start]')?.addEventListener('click', (e) => {
      if (audioTimer) { stopAudio(); e.target.textContent = 'Start again'; return }
      audioLeft = x.minutes * 60
      e.target.textContent = 'Stop'
      const clock = root.querySelector('[data-audio-clock]')
      audioTimer = setInterval(() => {
        audioLeft -= 1
        if (clock) clock.textContent = mmss(Math.max(0, audioLeft))
        if (audioLeft <= 0) {
          stopAudio()
          const btn = root.querySelector('[data-audio-start]')
          if (btn) btn.textContent = 'Start again'
          toast('Session finished.')
        }
      }, 1000)
    })

    root.querySelector('[data-complete]')?.addEventListener('click', () => {
      const answers = [...root.querySelectorAll('[data-prompt]')].map((t) => t.value.trim()).filter(Boolean)
      update((s) => {
        s.mindset.completed = [...s.mindset.completed.filter((c) => c.id !== id), { id, date: iso() }]
        if (answers.length) {
          s.mindset.journal = [...s.mindset.journal, { id: uid(), sessionId: id, title: x.title, date: iso(), answers }]
        }
        return s
      })
      stopBreath(root)
      stopAudio()
      toast(answers.length ? 'Saved to your journal.' : 'Marked as done.')
      rerenderRoute()
    })
  },

  unmount() { stopBreath(document); stopAudio() },
}

function stopAudio() {
  clearInterval(audioTimer)
  audioTimer = null
}

/*
 * A HABIT GUIDE: three paragraphs and the thing that usually goes wrong.
 */
export const habit = {
  render({ id }) {
    const h = habitById(id)
    if (!h) return `<main class="page">${pageHead('Not found', '', { to: '/mindset', label: 'Mindset' })}</main>`
    return `<main class="page stack">
      ${pageHead(h.title, `${h.minutes} minute read`, { to: '/mindset', label: 'Mindset core' })}
      ${h.body.map((para) => `<p>${esc(para)}</p>`).join('')}
      <div class="card card--flat">
        <p class="eyebrow">Try it today</p>
        <p style="margin:var(--s2) 0 0">Put one line on your planner that uses this. One line, today, not a system for the year.</p>
        <button class="btn btn--ghost btn--sm" data-nav="/tracker" style="margin-top:var(--s3)">Open the planner</button>
      </div>
    </main>`
  },
}

/* The orb grows on the in breath, holds, shrinks on the out. The CSS transition
   is four seconds, so the class flips and the phase length does the pacing. */
function runBreath(root, x) {
  const orb = root.querySelector('[data-orb]')
  const cue = root.querySelector('[data-breath-cue]')
  const counter = root.querySelector('[data-breath-round]')
  const { in: inS, hold, out, rounds } = x.pattern
  let round = 0

  const phase = (name, secs, next) => {
    if (cue) cue.textContent = `${name} for ${secs}`
    breathTimer = setTimeout(next, secs * 1000)
  }

  const cycle = () => {
    if (round >= rounds) {
      if (cue) cue.textContent = 'Done. Sit with that for a moment.'
      stopBreath(root)
      return
    }
    round++
    if (counter) counter.textContent = `Round ${round} of ${rounds}`
    orb?.classList.add('is-in')
    phase('In', inS, () => phase('Hold', hold, () => {
      orb?.classList.remove('is-in')
      phase('Out', out, cycle)
    }))
  }
  cycle()
}

function stopBreath(root) {
  clearTimeout(breathTimer)
  breathTimer = null
  root?.querySelector?.('[data-orb]')?.classList.remove('is-in')
}

export function unmount() { stopBreath(document); stopAudio() }
