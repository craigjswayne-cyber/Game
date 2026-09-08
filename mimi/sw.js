/*
 * The offline cache.
 *
 * Precache the shell on install, then serve cache first for anything in it and
 * fall back to the network. The app is entirely static and its data ships in
 * JavaScript modules, so a warm cache is a fully working app: programmes,
 * cues, recipes, macro maths and every log already on the device.
 *
 * Bump CACHE when the shell changes. An old cache is deleted on activate, which
 * is the only thing keeping a stale build from outliving a deploy.
 */
const CACHE = 'mimi-shell-v1'

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/fonts.css',
  './styles/tokens.css',
  './fonts/sora-latin-wght-normal.woff2',
  './fonts/playfair-display-latin-wght-normal.woff2',
  './fonts/playfair-display-latin-wght-italic.woff2',
  './styles/app.css',
  './icons/icon.svg',
  './js/app.js',
  './js/router.js',
  './js/state.js',
  './js/ui.js',
  './js/util.js',
  './js/macros.js',
  './js/health.js',
  './js/offline.js',
  './js/data/programs.js',
  './js/data/exercises.js',
  './js/data/recipes.js',
  './js/data/quotes.js',
  './js/data/mindset.js',
  './js/screens/home.js',
  './js/screens/workouts.js',
  './js/screens/program.js',
  './js/screens/session.js',
  './js/screens/exercise.js',
  './js/screens/tracker.js',
  './js/screens/nutrition.js',
  './js/screens/recipe.js',
  './js/screens/account.js',
  './js/screens/mindset.js',
  './js/screens/community.js',
  './js/screens/coaching.js',
  './js/screens/onboarding.js',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      // Same origin only, which is everything: the fonts are served from here
      // too, so nothing this app needs comes from another host.
      if (res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    }).catch(() => caches.match('./index.html'))),
  )
})

// The download button on a programme. The shell is already cached, so keeping a
// programme is a no-op today and the hook is here for the build that has video.
self.addEventListener('message', (e) => {
  if (e.data?.type === 'keep' || e.data?.type === 'drop') {
    // Nothing programme specific to fetch yet. Left deliberately empty rather
    // than pretending to download something that does not exist.
  }
})
