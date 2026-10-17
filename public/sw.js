// Offline-capable service worker.
// Navigations are NETWORK-FIRST so new deploys are picked up immediately;
// the cache is only a fallback for offline play. Hashed assets are
// cache-first (their URLs change every build, so they are immutable).
const CACHE = 'rugby-manager-v110'
// THE SCREENS, filled in by the build (vite.config.ts, swCacheName). Since
// 1.9.1 most screens are chunks fetched the first time they open, and a
// screen never opened online was missing offline, where it had always been
// there: they are all fetched at install now, as they were when they shipped
// in one file. The dictionaries for other languages stay on demand, as they
// have been since 1.2.0.
const PRECACHE = []

self.addEventListener('install', (e) => {
  // the privacy policy is precached with the shell: a store reviewer, or a
  // player on a plane, must be able to open it without a connection. One
  // screen that fails to fetch must not stop the worker installing.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './privacy.html'])
    .then(() => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {}))))))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const sameOrigin = e.request.url.startsWith(self.location.origin)

  // the app shell: always try the network so updates land, cache as fallback
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && sameOrigin) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return res
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./')))
    )
    return
  }

  // static assets: cache-first (hashed filenames), fill cache from network.
  // IGNORING VARY: a screen loaded with import() is a module request and
  // carries an Origin header, and a host that answers "Vary: Origin" made the
  // copy cached at install (which had none) never match it, so offline the
  // screen fell through to a network that was not there. A hashed file is the
  // same file whoever asks for it.
  e.respondWith(
    caches.match(e.request, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone()
          if (res.ok && sameOrigin) {
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return res
        })
    )
  )
})
