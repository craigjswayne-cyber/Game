/*
 * A hash router with five tabs and a stack of detail screens under them.
 *
 * A screen module exports render(params) and may export mount(root, params) and
 * unmount(). render returns a string; mount is where timers, focus and anything
 * else stateful gets attached, and unmount is where it gets torn down. Missing
 * that pairing is how a rest timer keeps ticking on the recipe screen.
 */
import { esc, icon } from './util.js'
import { closeSheet } from './ui.js'

const ROUTES = []
let current = null
let root = null
let guard = null

export function defineRoutes(list) { ROUTES.push(...list) }

export const TABS = [
  { id: 'home', to: '/home', label: 'Home', ico: icon.home },
  { id: 'workouts', to: '/workouts', label: 'Workouts', ico: icon.dumbbell },
  { id: 'tracker', to: '/tracker', label: 'Today', ico: icon.calendar, centre: true },
  { id: 'nutrition', to: '/nutrition', label: 'Nutrition', ico: icon.plate },
  { id: 'you', to: '/you', label: 'Community', ico: icon.people },
]

export function go(to) {
  const path = to.startsWith('#') ? to.slice(1) : to
  if (location.hash === `#${path}`) { render() } else { location.hash = path }
}

function match(path) {
  for (const r of ROUTES) {
    const rp = r.pattern.split('/').filter(Boolean)
    const pp = path.split('/').filter(Boolean)
    if (rp.length !== pp.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < rp.length; i++) {
      if (rp[i].startsWith(':')) params[rp[i].slice(1)] = decodeURIComponent(pp[i])
      else if (rp[i] !== pp[i]) { ok = false; break }
    }
    if (ok) return { route: r, params }
  }
  return null
}

const tabbar = (activeTab) => `
  <nav class="tabbar" aria-label="Main">
    ${TABS.map((t) => `
      <button data-nav="${t.to}" class="${t.centre ? 'tab-centre' : ''}"
        ${activeTab === t.id ? 'aria-current="page"' : ''}>
        <span class="tabicon">${t.ico()}</span>
        <span>${esc(t.label)}</span>
      </button>`).join('')}
  </nav>`

export function render() {
  const asked = (location.hash || '#/home').slice(1)
  // The guard is how the intake keeps hold of the screen: it rewrites every
  // path to /welcome until the profile exists.
  const path = guard?.(asked) || asked
  const hit = match(path) || match('/home')
  if (!hit) { root.innerHTML = '<p class="empty">Nothing here.</p>'; return }

  current?.unmount?.()
  // A sheet lives outside #app, so a hash change would otherwise leave it open
  // over the screen it was opened from. Seen for real: the swap sheet followed
  // the person from the session player onto the tracker.
  closeSheet()
  current = hit.route.screen

  const html = hit.route.screen.render(hit.params)
  root.innerHTML = hit.route.chrome === false ? html : html + tabbar(hit.route.tab)
  hit.route.screen.mount?.(root, hit.params)

  // A new screen always starts at the top. Detail screens opened from halfway
  // down a list inherited the scroll position and looked blank.
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
}

export function start(mountPoint, routeGuard) {
  root = mountPoint
  guard = routeGuard || null
  addEventListener('hashchange', render)
  // one delegated listener for every navigation control in the app
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]')
    if (!nav) return
    e.preventDefault()
    go(nav.dataset.nav)
  })
  render()
}

export const repaint = () => { if (root) render() }
