import { applyCharter, applyEstate, applyHeal, applyInjection, applyPinnacle } from '../../game/grants'
import {
  agencyFile, armAnalyst, insideWordFavour, physioFavour, secondOpinionFavour, tapeRoomFavour,
  teamNightFavour, townCollection,
} from '../../game/rewarded'
import type { GetState, SetState, Store } from '../types'

export const purchasesSlice = (set: SetState, get: GetState) => ({
  boardInject: (tier) => {
    const g = get().game
    if (!g) return false
    const done = applyInjection(g, tier)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  signCharter: () => {
    const g = get().game
    if (!g) return false
    const done = applyCharter(g)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  healSquad: () => {
    const g = get().game
    if (!g) return false
    const done = applyHeal(g)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  buildEstate: () => {
    const g = get().game
    if (!g) return false
    const done = applyEstate(g)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  makeTheCall: (nat?: string) => {
    const g = get().game
    if (!g) return false
    const done = applyPinnacle(g, nat)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardPhysio: (pid) => {
    const g = get().game
    if (!g) return null
    const out = physioFavour(g, pid)
    if (out != null) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return out
  },

  rewardAgency: (pid) => {
    const g = get().game
    if (!g) return false
    const done = agencyFile(g, pid)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardAnalyst: () => {
    const g = get().game
    if (!g) return
    armAnalyst(g)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  rewardTown: () => {
    const g = get().game
    if (!g) return null
    const amt = townCollection(g)
    if (amt != null) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return amt
  },

  rewardInside: (pid) => {
    const g = get().game
    if (!g) return false
    const done = insideWordFavour(g, pid)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardOpinion: (pid) => {
    const g = get().game
    if (!g) return false
    const done = secondOpinionFavour(g, pid)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardTapeRoom: (oppId) => {
    const g = get().game
    if (!g) return false
    const done = tapeRoomFavour(g, oppId)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardTeamNight: (pressId) => {
    const g = get().game
    if (!g) return false
    const done = teamNightFavour(g, pressId)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },
} satisfies Partial<Store>)
