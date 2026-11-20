// ---- THE APPOINTMENT AND THE ERA (1.9.14) ----
//
// Owner: being national coach "should be an honour". The job arrived as an
// inbox letter and a card on the Profile, and when it ended the record was a
// win-loss line. Now the appointment is a moment (the union unveils its new
// head coach, with three things it will judge the tenure on), and the tenure
// keeps an era: the best world ranking, the first caps handed out, the wins
// over the world's best, the titles.
import type { GameState } from './model'
import { natRankOrder } from './natrank'
import { eraOf } from './nattest'
import { activeWindows } from './season/internationals'
import { openNatWindow } from './natwin'

/** The round-robin title this nation contests, if the world has one. */
export function natTitleComp(state: GameState, nat: string): string | null {
  for (const id of ['sn', 'wsn', 'w:sn', 'trc', 'wp4', 'w:p4', 'pnc']) {
    const c = state.comps[id]
    if (c && c.teamIds.includes(nat)) return id
  }
  // a women's world names its comps with its own prefix
  for (const [id, c] of Object.entries(state.comps)) {
    if (c.type === 'intl' && /sn|p4|trc|pnc/.test(id) && c.teamIds.includes(nat)) return id
  }
  return null
}

/** A tenure begins: the union's terms, the era, and the unveiling to show. */
export function startTenure(state: GameState): void {
  const nat = state.natTeam
  if (!nat) return
  state.natTerm = null
  state.natEra = null
  termOf(state)
  eraOf(state)
  state.natUnveil = { nat, season: state.season, week: state.week }
  // APPOINTED MID-WINDOW (QA, 1.9.15): the federation had already named the
  // squad, and with no campaign opened there was no target, no announcement
  // and no review for the rest of the window. He inherits the squad and the
  // window's campaign from today.
  const w = activeWindows(state).find(x => x.nations.includes(nat) && state.week >= x.start && state.week <= x.end)
  if (w && (state.natSquads[nat] ?? []).length) openNatWindow(state, w)
}

/** The terms for the tenure held now; a coach appointed before they existed
 *  is given them from where his nation stands today, without the unveiling. */
function termOf(state: GameState): NonNullable<GameState['natTerm']> | null {
  const nat = state.natTeam
  if (!nat) return null
  if (!state.natTerm || state.natTerm.nat !== nat) {
    const rank = natRankOrder(state).indexOf(nat) + 1
    const target = rank <= 0 ? 10 : rank <= 3 ? 1 : rank <= 8 ? rank - 2 : Math.max(5, rank - 3)
    state.natTerm = { nat, since: state.season, rank: target, comp: natTitleComp(state, nat) }
  }
  return state.natTerm
}

export interface TermLine { k: string; v: Record<string, string | number>; done: boolean }

/** The three things the union said it would judge the tenure on, and where
 *  each stands: a world ranking, the nation's title (or a win over a top-five
 *  side where it has none), and three first caps handed out. */
export function termLines(state: GameState): TermLine[] {
  const nat = state.natTeam
  const term = termOf(state)
  if (!nat || !term) return []
  const now = natRankOrder(state).indexOf(nat) + 1
  const era = eraOf(state)
  const out: TermLine[] = [
    { k: term.rank === 1 ? 'natera.termTop' : 'natera.termRank', v: { n: term.rank, nat_k: `nation.${nat}` }, done: now > 0 && now <= term.rank },
  ]
  if (term.comp) {
    const won = state.mgr.trophies.some(t => t.compId === term.comp && t.season >= term.since)
    out.push({ k: 'natera.termTitle', v: { comp: state.comps[term.comp]?.name ?? term.comp }, done: won })
  } else {
    out.push({ k: 'natera.termTopWin', v: {}, done: !!era?.topWin })
  }
  out.push({ k: 'natera.termDebuts', v: { n: 3, done: era?.debuts.length ?? 0 }, done: (era?.debuts.length ?? 0) >= 3 })
  return out
}
