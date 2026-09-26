// ---- PLAYING THROUGH A KNOCK ----
//
// Owner, 25 Sep 2026: "play-through-injury decisions (non-head only)". A
// hamstring with a week left on it, the week of the derby: do you rest him, or
// strap it and send him out?
//
// Near the end of a lay-off - KNOCK_MAX_WEEKS or less to go - the manager may
// PLAY HIM THROUGH IT. The injury becomes a knock: he is available for
// selection again, but he starts every match short of a full tank
// (KNOCK_ENERGY, read in matchEngine's mkSide), and every match he actually
// plays in is a roll on whether it flares up. It flares more the sooner he was
// rushed back. If it does, he is out again for longer than he had left. If he
// gets to the day the physio had him down for, the knock is gone and he is
// simply fit - no rust, because he never stopped playing.
//
// NEVER A HEAD INJURY. A concussion or a failed HIA is not a knock and is never
// offered: the game does not ask a manager whether to send a concussed player
// out, because the sport does not either.
//
// The flare-up is rolled on its own stream, keyed to the save, the man and the
// week, so it never touches a match's draws and the same week always ends the
// same way.
import type { GameState, Player } from './model'
import { mulberry32 } from './rng'
import { tIn } from './i18n'

/** Injuries that are never played through, whatever is left on them. */
export const HEAD_INJURIES = new Set(['injury.concussion', 'injury.hiaFail'])

/** How close to fit he has to be before playing through is on the table. */
export const KNOCK_MAX_WEEKS = 3

/** The share of his usual starting tank a man carrying a knock kicks off with. */
export const KNOCK_ENERGY = 0.85

/** The chance a match played on the knock makes it worse, by weeks he had
 *  left when he was sent out: one week early is a gamble (20%), three is
 *  reckless (46%). */
export function flareChance(weeksEarly: number): number {
  // a damaged save can lose the number: a lost one reads as the riskiest case
  // rather than as NaN on a button (hostile171)
  const w = Number.isFinite(weeksEarly) ? weeksEarly : KNOCK_MAX_WEEKS
  return Math.min(0.55, 0.2 + 0.13 * Math.max(0, w - 1))
}

function isHead(p: Player): boolean {
  const dk = p.injury?.dk ?? p.knock?.dk ?? ''
  return HEAD_INJURIES.has(dk) || /concuss|HIA/i.test(p.injury?.desc ?? '')
}

/** Weeks left on his lay-off. */
export function weeksLeft(state: GameState, p: Player): number {
  return p.injury ? Math.max(0, p.injury.until - state.week) : 0
}

/** Can the manager send him out on it this week? */
export function canPlayThrough(state: GameState, p: Player): boolean {
  if (!p.injury || p.knock || p.clubId !== state.userClubId || state.unemployed) return false
  if (isHead(p)) return false
  const left = weeksLeft(state, p)
  return left >= 1 && left <= KNOCK_MAX_WEEKS
}

/** Strap it and play him. The injury becomes a knock he carries. */
export function playThrough(state: GameState, playerId: number): { ok: boolean; k: string; v: Record<string, string | number> } {
  const p = state.players[playerId]
  if (!p || !canPlayThrough(state, p)) return { ok: false, k: 'medical.knockNotOpen', v: { name: p?.name ?? '' } }
  const inj = p.injury!
  const early = weeksLeft(state, p)
  p.knock = {
    dk: inj.dk ?? '', desc: inj.desc, until: inj.until, weeks: inj.weeks ?? early,
    early, mins: p.stats.mins,
  }
  p.injury = null
  p.specialist = false
  return { ok: true, k: 'medical.knockOn', v: { name: p.name, pct: Math.round(flareChance(early) * 100) } }
}

/** Change of heart: rest him after all, with the lay-off he had left. */
export function restKnock(state: GameState, playerId: number): { ok: boolean; k: string; v: Record<string, string | number> } {
  const p = state.players[playerId]
  if (!p?.knock) return { ok: false, k: 'medical.knockNotOpen', v: { name: p?.name ?? '' } }
  const k = p.knock
  p.knock = undefined
  if (k.until > state.week) {
    p.injury = { desc: k.desc, dk: k.dk || undefined, until: k.until, weeks: k.weeks, seen: true }
  }
  return { ok: true, k: 'medical.knockRested', v: { name: p.name } }
}

/**
 * Every week, before anything else is healed: did he play on it, and did it go?
 * Then, if he has reached the day the physio had him down for, the knock is
 * gone.
 */
export function settleKnocks(state: GameState) {
  for (const p of Object.values(state.players)) {
    const k = p.knock
    if (!k) continue
    if (p.clubId !== state.userClubId) { p.knock = undefined; continue }
    // a knock whose return week was lost (a damaged save) cannot be settled or
    // shown - "Fit in NaN wk" - so it is cleared, which is what reaching the
    // physio's date would have done (hostile171)
    if (!Number.isFinite(k.until)) { p.knock = undefined; continue }
    if (!Number.isFinite(k.mins)) k.mins = p.stats.mins
    // a new season starts the minutes from zero: take the new count as the base
    if (p.stats.mins < k.mins) k.mins = p.stats.mins
    const played = p.stats.mins > k.mins
    k.mins = p.stats.mins
    if (played) {
      const rng = mulberry32((state.seed ^ Math.imul(p.id, 2654435761) ^ Math.imul(state.season * 64 + state.week, 40503)) >>> 0)
      if (rng() < flareChance(k.early)) {
        // worse than it was: what was left, and then half the original lay-off
        // again on top, never less than two weeks
        const extra = Math.max(2, Math.ceil(k.weeks * 0.5))
        const out = Math.max(0, k.until - state.week) + extra
        p.knock = undefined
        p.injury = { desc: k.desc, dk: k.dk || undefined, until: state.week + out, weeks: out }
        if (k.dk) p.injLog = [...(p.injLog ?? []), { s: state.season, w: state.week, dk: k.dk, weeks: out }].slice(-20)
        const v = { name: p.name, n: out }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: tIn('en', 'news.knockFlaredSubj', v), body: tIn('en', 'news.knockFlared', v),
          k: 'news.knockFlared', v, playerId: p.id,
        })
        continue
      }
    }
    if (state.week >= k.until) p.knock = undefined
  }
}
