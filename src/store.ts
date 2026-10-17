import { create } from 'zustand'
import { getLang, onLangChange, setManagerGender, setWorld } from './game/i18n'
import { genderOf } from './game/gender'
import { effectiveSkin, planSlots, proLocked, SKINS, skinLocked, type Skin } from './store/skins'
import type { Screen, Store } from './store/types'
import { bindStore } from './store/api'
import { saveQueue, saveStats } from './store/saveQueue'
import { isSettling, settleFault, settleInSlices } from './store/week'
import { careerSlice } from './store/slices/career'
import { navSlice } from './store/slices/nav'
import { matchSlice } from './store/slices/match'
import { TAP_GUARD_MS, weekSlice } from './store/slices/week'
import { settingsSlice } from './store/slices/settings'
import { purchasesSlice } from './store/slices/purchases'

/** THE STORE'S FRONT DOOR. The pieces live under src/store/: the types, the
 *  skin gating, the nav bookmark, the live-match helpers, the week settle, the
 *  save queue, and the actions in slices. Everything the rest of the game and
 *  the probes import still comes from here. */
export { effectiveSkin, isSettling, planSlots, proLocked, saveStats, settleFault, settleInSlices, SKINS, skinLocked, TAP_GUARD_MS }
export type { Screen, Skin }

export const useStore = create<Store>((set, get) => ({
  ...careerSlice(set, get),
  ...navSlice(set, get),
  ...matchSlice(set, get),
  ...weekSlice(set, get),
  // the only slice whose initial values read the device (night, skin, text
  // scale, language, supporter), in the order they always were
  ...settingsSlice(set, get),
  ...purchasesSlice(set, get),
}))
// the save queue and the week settle reach the store through this, rather
// than importing this file back (src/store/api.ts)
bindStore(useStore)

// THE WAY OUT IS WHERE A PHONE KILLS A PROCESS. Not a crash - a home button, a
// task switch, a locked screen. pagehide fires for all three where visibility
// alone does not, and both are listened for because Safari and Chrome disagree
// about which arrives. Guarded for the probes, which import this file in node.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => saveQueue.flushSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveQueue.flushSync()
  })
}

// The language lives in the i18n module; the store mirrors it so React
// re-renders on a change. The subscription, not setLang, is what moves the
// mirror: a lazily-fetched dictionary commits whenever its chunk arrives.
onLangChange(() => useStore.setState({ lang: getLang() }))

// THE WORLD FOLLOWS THE CAREER. i18n picks a feminine string in a women's save
// and the plain one otherwise, and it learns which from here rather than from
// the game object, because it is a leaf module the whole engine imports and
// must not import the store back. Subscribed rather than set at each of the
// five places a game is opened, so a sixth cannot forget.
useStore.subscribe((s, prev) => {
  if (s.game !== prev.game) {
    setWorld(s.game ? genderOf(s.game) : 'm')
    setManagerGender(s.game?.mgrGender === 'w' ? 'w' : 'm')
  }
})

// Browser probes stage the states a natural walk cannot reach on demand - an
// injured starter on match morning, a specific inbox backlog - through this
// handle. It is the same store the app runs on; nothing ships differently for
// it, and a player poking it in devtools can only cheat at their own save.
if (typeof window !== 'undefined') {
  ;(window as unknown as { rugbyStore?: typeof useStore }).rugbyStore = useStore
  // and the save queue's counters, so savequeue.mjs can prove that a burst of
  // mutations costs one write rather than inferring it from a stopwatch
  ;(window as unknown as { rugbySaveStats?: typeof saveStats }).rugbySaveStats = saveStats
}
