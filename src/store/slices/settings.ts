import { MGR_GENDER_KEY, readSkin, SKIN_KEY, skinLocked, type Skin } from '../skins'
import { initLang, setLang as applyLang, setManagerGender, type Lang } from '../../game/i18n'
import { hasSupporter } from '../../game/monetise'
import type { Gender } from '../../game/gender'
import { noteUse } from '../../game/usage'
import type { GetState, SetState, Store } from '../types'

export const settingsSlice = (set: SetState, get: GetState) => ({
  // NIGHT IS THE DEFAULT (design brief): a fresh install opens under the
  // floodlights, and only an explicit '0' - the player choosing daylight -
  // turns them off. The old default was day, which nobody who reported in
  // ever used.
  night: typeof localStorage === 'undefined' || localStorage.getItem('rm-night') !== '0',

  /* THE SKIN (v1.2.1). Read once at boot like the language and the type
     scale, so the first paint is already in the chosen colours rather than
     flashing the default and correcting itself. 'default' means the built-in
     pair - the floodlight toggle's night and day - and is what every save
     that has never opened Settings gets. */
  skin: readSkin(),
  setSkin: (skin: Skin) => {
    // Belt and braces behind the Settings UI: a locked skin never becomes the
    // choice, so no route into this setter can dress a free game in a paid
    // palette.
    if (skinLocked(skin)) return
    if (skin !== get().skin) noteUse('skin')
    try { localStorage.setItem(SKIN_KEY, skin) } catch { /* private mode */ }
    set({ skin })
  },

  // WRITTEN IN TWO PLACES, deliberately. The save owns it - it is a fact about
  // the manager and it travels with the career to another phone - and the
  // device remembers the last answer so a second career does not open as a man
  // again. i18n.ts is told directly rather than through the subscription above,
  // which only fires when the game OBJECT changes; this mutates the one that is
  // already open.
  setMgrGender: (g: Gender) => {
    try { localStorage.setItem(MGR_GENDER_KEY, g) } catch { /* private mode */ }
    const game = get().game
    if (game) game.mgrGender = g
    setManagerGender(g)
    set(st => ({ tick: st.tick + 1 }))
    // WRITTEN THROUGH, not left for the next week to carry. A career resumed
    // after a reload comes off the last save on disk, so a pronoun changed on
    // a Tuesday and never followed by an autosave came back as it was
    // (scripts/mgrgender.mjs, section 4).
    // NOT the queue: the comment above is a guarantee, and mgrgender.mjs
    // reloads to check it. A coalesced write would race the reload.
    if (game) void get().persistNow()
  },
  toggleNight: () => set(s => {
    const night = !s.night
    noteUse('night')
    try { localStorage.setItem('rm-night', night ? '1' : '0') } catch { /* private mode */ }
    return { night }
  }),

  // parsed defensively: a mangled value must read as the default, never as NaN
  // (NaN zoom would blank the whole app)
  textScale: (() => {
    if (typeof localStorage === 'undefined') return 1
    const v = Number(localStorage.getItem('rm-zoom'))
    return [1.15, 1.3].includes(v) ? v : 1
  })(),
  setTextScale: (v: number) => {
    const scale = [1.15, 1.3].includes(v) ? v : 1
    try { localStorage.setItem('rm-zoom', String(scale)) } catch { /* private mode */ }
    set({ textScale: scale })
  },

  // initLang reads the stored choice, or takes the device's hint the first
  // time. Doing it here rather than in a useEffect means the very first paint
  // is already in the right language: a French phone never flashes English.
  lang: initLang(),
  // applyLang may finish later: a dictionary that is a lazy chunk (v1.2.0)
  // only commits once it has loaded, so the store cannot read the answer
  // synchronously - the onLangChange subscription below carries the commit
  // into React whenever it lands, first tap or slow network alike.
  setLang: (l: Lang) => { if (l !== get().lang) noteUse('lang'); return applyLang(l) },

  supporter: hasSupporter(),
  claimSupporter: () => set(s => ({ supporter: hasSupporter(), tick: s.tick + 1 })),

  tut: false,
  openTut: () => set({ tut: true }),
  feedback: false,
  openFeedback: () => set({ feedback: true }),
  closeFeedback: () => set({ feedback: false }),
  closeTut: () => {
    try { localStorage.setItem('rm-tut', '1') } catch { /* private mode */ }
    set({ tut: false })
  },

  newGender: 'm',
  setNewGender: (g) => set({ newGender: g }),
} satisfies Partial<Store>)
