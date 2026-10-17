import { noteScreen } from '../../game/bugreport'
import { noteWhere, WHERE_KEY } from '../nav'
import { inInbox, markRead } from '../../game/days'
import { countScreen } from '../../game/usage'
import type { GetState, SetState, Store } from '../types'

export const navSlice = (set: SetState, get: GetState) => ({
  nav: [{ screen: 'menu' }],
  wireQueue: [],
  inboxId: null,

  /** The news reader's recall window: everything unread, plus what you have read
   *  in the last five days. Gossip is in this list too now that the wire and the
   *  news are one screen, cleared stories are filed, and days.inInbox is the one
   *  place that decides. */
  // markRead and the cleared flag are career state (the desk gate and the
  // unread count read them), so each of these marks the save as well as
  // redrawing. They did not, and a story read before a reload came back unread.
  openInbox: () => { set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => inInbox(g, n))
    const unread = live.filter(n => !n.read).sort((a, b) => a.id - b.id)
    const onInbox = s.nav[s.nav.length - 1]?.screen === 'inbox'
    // the inbox opens here rather than through go(): count it as a visit
    if (!onInbox) countScreen('inbox')
    // oldest unread first: a queue is read front to back
    const next = unread[0]
    if (next) {
      markRead(g, next)
      return {
        inboxId: next.id,
        nav: onInbox ? s.nav : [...s.nav, { screen: 'inbox' as const }],
        tick: s.tick + 1,
      }
    }
    // nothing unread, and already reading: the button still moves (owner,
    // 1.8.11: "i should always be able to skip through the news"). It steps
    // one story older through the same 20-story window the arrows walk, and
    // from the oldest wraps back to the newest, so a tap is never a dead tap.
    const window20 = [...live].sort((a, b) => b.id - a.id).slice(0, 20)
    if (onInbox && window20.length > 1) {
      const i = window20.findIndex(n => n.id === s.inboxId)
      const nextOlder = window20[i < 0 || i >= window20.length - 1 ? 0 : i + 1]
      return { inboxId: nextOlder.id, tick: s.tick + 1 }
    }
    // nothing unread: open the newest story so the screen is never blank
    const newest = window20[0]
    return {
      inboxId: s.inboxId ?? newest?.id ?? null,
      nav: onInbox ? s.nav : [...s.nav, { screen: 'inbox' as const }],
      tick: s.tick + 1,
    }
  }); void get().persist() },

  inboxStep: (dir) => { set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => inInbox(g, n)).sort((a, b) => b.id - a.id).slice(0, 20)
    if (!live.length) return {}
    const i = live.findIndex(n => n.id === s.inboxId)
    // dir -1 goes back in time, which is FORWARD through a newest-first list
    const j = Math.max(0, Math.min(live.length - 1, (i < 0 ? 0 : i) + (dir === -1 ? 1 : -1)))
    markRead(g, live[j])
    return { inboxId: live[j].id, tick: s.tick + 1 }
  }); void get().persist() },

  clearRead: () => { set(s => {
    const g = s.game
    if (!g) return {}
    // gossip clears like everything else now that the wire and the news are one
    // list: exempting it meant Clear read left a screenful behind
    for (const n of g.news) if (n.read) n.cleared = true
    const left = g.news.filter(n => inInbox(g, n))
    return { inboxId: left.length ? left.sort((a, b) => b.id - a.id)[0].id : null, tick: s.tick + 1 }
  }); void get().persist() },

  go: (screen, param) => set(s => { const nav = [...s.nav, { screen, param }]; noteWhere(s.saveSlot, nav); noteScreen(screen, param); return { nav } }),
  back: () => set(s => {
    const nav = s.nav.length > 1 ? s.nav.slice(0, -1) : s.nav
    noteWhere(s.saveSlot, nav)
    return { nav }
  }),
  home: () => set(s => { noteWhere(s.saveSlot, [{ screen: 'home' as const }]); return { nav: [{ screen: 'home' }] } }),

  toTitle: () => {
    try { localStorage.removeItem(WHERE_KEY) } catch { /* private mode */ }
    set(s => ({ nav: [{ screen: 'menu' as const }], tick: s.tick + 1 }))
  },

  /** After a week has been settled, show the first day of the new one.
   *
   *  Shared by Continue and finishMatch so a week that ends in a match and a week
   *  that ends in a blank Saturday both resume on the same footing. */
  openWire: (ids, startId) => {
    // a start that is not in the list reads from the top: indexOf's -1 used
    // to slice the queue down to its last story alone (1.9.1)
    const at = startId != null ? ids.indexOf(startId) : -1
    const queue = at > 0 ? [...ids.slice(at), ...ids.slice(0, at)] : ids
    set(s => ({ wireQueue: queue, nav: [...s.nav.filter(e => e.screen !== 'wire'), { screen: 'wire' as const }], tick: s.tick + 1 }))
  },

  revealBall: () => {
    const g = get().game
    if (!g?.draw) return
    g.draw.revealed = Math.min(g.draw.ties.length, (g.draw.revealed ?? 0) + 1)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  closeDraw: () => {
    const g = get().game
    if (!g) return
    // Watched and put away. The ties themselves live in the fixture list, so
    // clearing the ceremony loses nothing - and clearing it is what stops the
    // day bulletin offering the same draw every week for the rest of the season.
    g.draw = null
    set(s => ({ nav: s.nav.filter(e => e.screen !== 'draw'), tick: s.tick + 1 }))
    void get().persist()
  },
} satisfies Partial<Store>)
