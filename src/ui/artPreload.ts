import { CAMPUS_PLOTS } from '../game/campusPlots'
import { groundLevel, type GameState } from '../game/model'
import tacticsPitch from './tactics-pitch.png'

const ART = import.meta.env.BASE_URL + 'art/'

/**
 * ---- THE CAMPUS MAP IS FETCHED BEFORE YOU WALK TO IT (owner, v1.7.1) ----
 *
 * Reported from the test build: "the map was slowish to load". It is, and the
 * reason is arithmetic rather than a bug - the town plate is 1.5MB of PNG and
 * the ten buildings standing on it are another half a megabyte, so the first
 * time anybody opens Club Infrastructure they watch two megabytes arrive.
 *
 * Nothing about that can be made faster at the moment it is needed. What CAN
 * be changed is when it is needed: the art is asked for as soon as there is a
 * save to read levels from, in the background, while the manager is still on
 * the home screen deciding what to do with his week. By the time he reaches
 * the estate the browser already has all of it and the page paints at once.
 *
 * TEN TILES, NOT SIXTY. Only the levels this club actually holds, plus the
 * construction site, plus the one rung above whatever the builders are on so
 * the reveal is instant the week it opens. The other fifty are a single 50KB
 * file each, fetched the moment a build finishes, which nobody sees.
 *
 * NON-BLOCKING, on purpose. Holding the title screen on two megabytes would
 * trade a wait the manager can see for one he cannot do anything about, on a
 * screen where he has not asked for anything yet. This waits for the browser
 * to be idle and then just asks; if it has not finished by the time he opens
 * the page, the page loads the rest itself exactly as it did before.
 */
let started = false

export function preloadCampus(game: GameState): void {
  if (started || typeof Image === 'undefined') return
  const club = game.clubs[game.userClubId]
  if (!club) return
  started = true

  const urls = [`${ART}campus/plate.png`, `${ART}campus/construction.png`]
  const build = game.facilityBuild ?? null
  for (const plot of CAMPUS_PLOTS) {
    const lvl = plot.fid === 'stadium'
      ? groundLevel(club.capacity)
      : club.facilities?.[plot.fid] ?? 0
    urls.push(`${ART}facilities/${plot.art}-L${lvl}.png`)
    // the rung the builders are climbing to, so the week it opens is instant
    if (build?.id === plot.fid && build.level <= 5) {
      urls.push(`${ART}facilities/${plot.art}-L${build.level}.png`)
    }
  }

  const fetchAll = () => {
    for (const src of urls) {
      const img = new Image()
      // decoding async and a low fetch priority: this is background work and
      // it must never compete with whatever screen the manager is looking at
      img.decoding = 'async'
      try { (img as { fetchPriority?: string }).fetchPriority = 'low' } catch { /* not everywhere */ }
      img.src = src
    }
  }

  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void
  }).requestIdleCallback
  if (idle) idle(fetchAll, { timeout: 4000 })
  else setTimeout(fetchAll, 1500)
}

/**
 * ---- EVERY PICTURE, LOADED UNDER THE OPENING TITLES (1.8.0) ----
 *
 * Owner, 27 Sep 2026: "use the intro animation to load up all images in game
 * so they dont have to load when you switch to that page". The game has few
 * pictures and they add up to about 3.3MB: the tactics pitch, the campus map
 * and its building site, and six levels of each of the ten buildings. All of
 * it is asked for as the intro starts (it has five seconds with nothing else
 * to fetch), decoded, and held here so the browser keeps it, so the first
 * visit to Tactics or Club Infrastructure paints at once.
 *
 * With the intro off (the Settings switch, reduce motion, a second launch in
 * the same session) the same list is fetched when the browser is idle, as the
 * campus art always was. Either way it never blocks anything: a picture that
 * has not arrived loads itself when its page opens, exactly as before.
 */
const held: HTMLImageElement[] = []
let allStarted = false

export function allArtUrls(): string[] {
  const urls = [tacticsPitch, `${ART}campus/plate.png`, `${ART}campus/construction.png`]
  for (const plot of CAMPUS_PLOTS) for (let l = 0; l <= 5; l++) urls.push(`${ART}facilities/${plot.art}-L${l}.png`)
  return urls
}

export function preloadAllArt(opts: { now?: boolean } = {}): void {
  if (allStarted || typeof Image === 'undefined') return
  allStarted = true
  const fetchAll = () => {
    for (const src of allArtUrls()) {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      img.decode?.().catch(() => { /* a missing file loads on its page instead */ })
      held.push(img)
    }
  }
  if (opts.now) { fetchAll(); return }
  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void
  }).requestIdleCallback
  if (idle) idle(fetchAll, { timeout: 4000 })
  else setTimeout(fetchAll, 1500)
}
