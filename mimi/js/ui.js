/*
 * Shared pieces of chrome. Screens return HTML strings, so everything here
 * returns a string too, apart from toast() and the small imperative helpers at
 * the bottom which touch the document directly.
 */
import { esc, icon, clamp, round } from './util.js'
import { quoteFor } from './data/quotes.js'
import { get } from './state.js'

export const pageHead = (title, sub, back) => `
  <header class="pagehead">
    ${back ? `<button class="backlink" data-nav="${esc(back.to)}">${icon.back()} ${esc(back.label)}</button>` : ''}
    <h1>${esc(title)}</h1>
    ${sub ? `<p class="lede">${esc(sub)}</p>` : ''}
  </header>`

export const quoteCard = (screen) => {
  const q = quoteFor(screen, get().settings.quoteSeed)
  return `<figure class="quote" style="margin:0">
    <q>${esc(q.text)}</q>
    <cite>${esc(q.by)}</cite>
  </figure>`
}

export const sectionHead = (title, action) => `
  <div class="row row--between">
    <h3>${esc(title)}</h3>
    ${action ? `<button class="btn btn--sm btn--ghost" data-nav="${esc(action.to)}">${esc(action.label)}</button>` : ''}
  </div>`

export const bar = (value, goal, variant = '') => {
  const pct = goal > 0 ? clamp(Math.round((value / goal) * 100), 0, 100) : 0
  return `<div class="bar ${variant}" role="img" aria-label="${pct} percent of goal">
    <i style="width:${pct}%"></i>
  </div>`
}

/* A progress ring. r is fixed at 34 so every ring in the app is the same size. */
export const ring = (value, goal, label, sub) => {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = goal > 0 ? clamp(value / goal, 0, 1) : 0
  return `<div class="ring">
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="7"/>
      <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--maroon)" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${round(c, 2)}"
        stroke-dashoffset="${round(c * (1 - pct), 2)}"/>
    </svg>
    <div class="ring-label">
      <span class="num" style="font-size:1.1rem">${esc(label)}</span><br>
      <span class="eyebrow" style="font-size:9px">${esc(sub)}</span>
    </div>
  </div>`
}

export const statTile = (num, label) => `
  <div class="stat card card--flat">
    <span class="num">${esc(num)}</span>
    <span class="eyebrow">${esc(label)}</span>
  </div>`

export const empty = (title, body, cta) => `
  <div class="empty">
    <h3>${esc(title)}</h3>
    <p class="lede">${esc(body)}</p>
    ${cta ? `<button class="btn btn--soft btn--sm" data-nav="${esc(cta.to)}">${esc(cta.label)}</button>` : ''}
  </div>`

/* ---- line chart over {date, value} points ---- */
export function lineChart(points, { unit = '', height = 160 } = {}) {
  if (points.length < 2) {
    return `<p class="lede">Two entries are needed before a line means anything. You have ${points.length}.</p>`
  }
  const w = 320
  const padL = 30
  const padB = 18
  const padT = 10
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i) => padL + (i / (points.length - 1)) * (w - padL - 8)
  const y = (v) => padT + (1 - (v - min) / span) * (height - padT - padB)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${round(x(i), 1)} ${round(y(p.value), 1)}`).join(' ')
  const area = `${path} L${round(x(points.length - 1), 1)} ${height - padB} L${round(x(0), 1)} ${height - padB} Z`
  const grid = [0, 0.5, 1].map((f) => {
    const gy = padT + f * (height - padT - padB)
    return `<line class="grid" x1="${padL}" y1="${round(gy, 1)}" x2="${w - 8}" y2="${round(gy, 1)}"/>
      <text class="axis" x="0" y="${round(gy + 3, 1)}">${round(max - f * span, 1)}</text>`
  }).join('')
  const dots = points.map((p, i) => `<circle class="dot" cx="${round(x(i), 1)}" cy="${round(y(p.value), 1)}" r="2.5"/>`).join('')
  return `<svg class="chart" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none"
      role="img" aria-label="Trend from ${esc(points[0].value)}${esc(unit)} to ${esc(points[points.length - 1].value)}${esc(unit)}">
    ${grid}
    <path class="area" d="${area}"/>
    <path class="line" d="${path}"/>
    ${dots}
  </svg>`
}

/* ---- bar chart over {label, value} ---- */
export function barChart(items, max) {
  const top = max || Math.max(1, ...items.map((i) => i.value))
  return `<div class="bars" role="img" aria-label="Weekly totals">
    ${items.map((i) => `
      <div>
        <i style="height:${clamp(Math.round((i.value / top) * 100), 2, 100)}%" title="${esc(i.value)}"></i>
        <small>${esc(i.label)}</small>
      </div>`).join('')}
  </div>`
}

/* ---- imperative bits ---- */
let toastTimer = null
export function toast(message) {
  document.querySelector('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  el.textContent = message
  document.body.append(el)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.remove(), 2400)
}

export function sheet(title, bodyHtml, onMount) {
  closeSheet()
  const wrap = document.createElement('div')
  wrap.className = 'sheet-backdrop'
  wrap.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grabber"></div>
    <div class="row row--between" style="margin-bottom:var(--s4)">
      <h2>${esc(title)}</h2>
      <button class="iconbtn" data-close-sheet aria-label="Close">&times;</button>
    </div>
    ${bodyHtml}
  </section>`
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close-sheet]')) closeSheet()
  })
  document.body.append(wrap)
  onMount?.(wrap)
  return wrap
}

export const closeSheet = () => document.querySelector('.sheet-backdrop')?.remove()
