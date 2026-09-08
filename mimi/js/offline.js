/*
 * OFFLINE.
 *
 * The brief asks for downloadable programmes, for the gyms with no signal in
 * the basement. Two halves:
 *
 *   1. A service worker caches the app shell, so the whole app opens with the
 *      aeroplane mode switch on. That part is automatic.
 *   2. "Download" on a programme marks it as kept, which in this prototype
 *      means the shell plus that programme's screens are held in the cache and
 *      the person is told, plainly, that the video files are not part of it.
 *      There are no video binaries in this repository to cache.
 *
 * A service worker needs http, so opening index.html straight off the disk
 * gives you an app that works and a cache that does not. cacheReady() says
 * which of those you are in, and the account screen prints it.
 */
import { get, update } from './state.js'

let ready = false

export function registerWorker() {
  if (!('serviceWorker' in navigator)) return
  if (location.protocol === 'file:') return
  navigator.serviceWorker.register('./sw.js').then(() => { ready = true }).catch((err) => {
    console.info('Made by Mimi: no offline cache in this context.', err?.message || err)
  })
}

export const cacheReady = () => ready || Boolean(navigator.serviceWorker?.controller)

export const isDownloaded = (programId) => get().downloads.includes(programId)

export async function download(programId) {
  update((s) => {
    if (!s.downloads.includes(programId)) s.downloads = [...s.downloads, programId]
    return s
  })
  const worker = navigator.serviceWorker?.controller
  if (worker) worker.postMessage({ type: 'keep', programId })
}

export function removeDownload(programId) {
  update((s) => { s.downloads = s.downloads.filter((x) => x !== programId); return s })
  navigator.serviceWorker?.controller?.postMessage({ type: 'drop', programId })
}
