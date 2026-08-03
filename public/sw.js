// Offline-capable service worker.
// Navigations are NETWORK-FIRST so new deploys are picked up immediately;
// the cache is only a fallback for offline play. Hashed assets are
// cache-first (their URLs change every build, so they are immutable).
const CACHE = 'rugby-manager-v2'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./'])))
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

  // static assets: cache-first (hashed filenames), fill cache from network
  e.respondWith(
    caches.match(e.request).then(
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
