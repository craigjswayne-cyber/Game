/*
 * Small helpers shared by every screen: escaping, dates, maths, icons.
 *
 * Screens render by returning an HTML string, so ANY value that came from a
 * person (a to-do, a community post, a check-in answer) must go through esc()
 * on the way in. That is the whole of the XSS story in this app and it is worth
 * keeping in one place.
 */

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
export const round = (n, dp = 0) => { const f = 10 ** dp; return Math.round(n * f) / f }
export const sum = (list) => list.reduce((a, b) => a + b, 0)
export const uid = () => Math.random().toString(36).slice(2, 10)

/* ---- dates, always local, always YYYY-MM-DD ---- */
export const iso = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (isoDate, n) => {
  const d = fromIso(isoDate)
  d.setDate(d.getDate() + n)
  return iso(d)
}
export const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 86400000)
export const prettyDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  fromIso(s).toLocaleDateString(undefined, opts)
export const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
export const clockTime = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
export const mmss = (secs) => `${Math.floor(secs / 60)}:${String(Math.max(0, secs % 60)).padStart(2, '0')}`

/* One day, two days. A counter that says "1 days" reads as a bug in the app. */
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/* ---- a stable initial for avatars ---- */
export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/* ---- inline icons, 24px stroke set ---- */
const svg = (paths, size = 24) =>
  `<svg class="tabicon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true">${paths}</svg>`

export const icon = {
  home: () => svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>'),
  dumbbell: () => svg('<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>'),
  calendar: () => svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  plate: () => svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>'),
  people: () => svg('<circle cx="9.5" cy="8.5" r="3.25"/><path d="M3.5 20c0-3.4 2.8-5.5 6-5.5s6 2.1 6 5.5"/><path d="M16 5.6a3.25 3.25 0 0 1 0 6.3"/><path d="M17.5 14.9c2 .7 3 2.4 3 5.1"/>'),
  person: () => svg('<circle cx="12" cy="8" r="3.75"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>'),
  chevron: () => svg('<path d="M9 5l7 7-7 7"/>', 18),
  back: () => svg('<path d="M15 5l-7 7 7 7"/>', 18),
  plus: () => svg('<path d="M12 5v14M5 12h14"/>', 20),
  play: () => svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>', 22),
  heart: () => svg('<path d="M12 20s-7.5-4.7-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.3 12 20 12 20z"/>', 18),
  spark: () => svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>', 18),
  flame: () => svg('<path d="M12 3s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.7-2.8 1.4-3.7.3 1.2 1 2 1.9 2.2C11 8 12 5.6 12 3z"/>', 18),
  drop: () => svg('<path d="M12 3.5s5.5 5.6 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.1 12 3.5 12 3.5z"/>', 18),
  steps: () => svg('<path d="M7 20c-1.2-3 .3-4.4 0-7.2C6.7 10.2 8 8.5 9.8 8.8c1.9.3 2 2.4 1.6 4.2-.4 1.9-.6 3.4.2 5"/><path d="M15.5 15.5c-.9-2.2.2-3.3 0-5.3-.2-1.9.8-3.2 2.1-3 1.4.2 1.5 1.8 1.2 3.1-.3 1.4-.5 2.6.1 3.8"/>', 18),
  check: () => svg('<path d="M4.5 12.5l5 5 10-11"/>', 18),
  lock: () => svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 18),
  download: () => svg('<path d="M12 4v10m0 0l-4-4m4 4l4-4"/><path d="M5 19h14"/>', 18),
  message: () => svg('<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5V16.5a2 2 0 0 1-1-1.7z"/>', 18),
  clock: () => svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 18),
  hand: () => svg('<path d="M9 12.5V6a1.5 1.5 0 0 1 3 0v5.5"/><path d="M12 11.5V5a1.5 1.5 0 0 1 3 0v6.5"/><path d="M15 11.5V7a1.5 1.5 0 0 1 3 0v7.5a6 6 0 0 1-6 6h-.7a5 5 0 0 1-4-2l-2.6-3.6a1.5 1.5 0 0 1 2.3-1.9L9 15"/>', 18),
  camera: () => svg('<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><circle cx="12" cy="13.2" r="3.4"/><path d="M8.5 7l1.3-2.5h4.4L15.5 7"/>', 18),
  swap: () => svg('<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>', 18),
  sound: () => svg('<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/>', 18),
  list: () => svg('<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>', 18),
  leaf: () => svg('<path d="M5 19c0-7 5-11 14-11 0 8-4.5 12-11 12"/><path d="M5 19c3-4 6-6 9-7"/>', 18),
}
