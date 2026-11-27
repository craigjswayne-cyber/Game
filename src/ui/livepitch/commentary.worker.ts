// THE COMMENTARY OFF THE MAIN THREAD (overnight run). commentate() reads the whole record each time it grows:
// 127 ms at the end of a match on a desktop, several frames on a phone, every dead ball. Here it runs beside
// the pitch and hands back the lines (plain objects; the words are put together on the main thread, in the
// player's language, by commentary.ts render).
import { commentate, type Context } from '../../game/sim/commentary'
import type { SimResult } from '../../game/sim/record'

/** the first ask carries the names, the teams and the occasion; every ask carries the plays since the last (the
 *  record only ever grows), so a late-match ask copies a handful of plays, not six hundred */
export interface CommentaryAsk { id: number; from: number; plays: SimResult['plays']; rest: Omit<SimResult, 'plays'>; teams?: [string, string]; names?: [string, string][]; context?: Context }

const kept: SimResult['plays'] = []
let teams: [string, string] = ['', '']
let m = new Map<string, string>()
let context: Context = {}

self.onmessage = (e: MessageEvent<CommentaryAsk>) => {
  const { id, from, plays, rest } = e.data
  if (e.data.teams) teams = e.data.teams
  if (e.data.names) m = new Map(e.data.names)
  if (e.data.context) context = e.data.context
  kept.length = from
  for (const p of plays) kept.push(p)
  const result: SimResult = { ...rest, plays: kept }
  // (a fault in the words keeps the lines the screen has, and says why; it never takes the worker down)
  try {
    const lines = commentate(result, { teams, player: p => m.get(p) ?? '' }, context)
    ;(self as unknown as Worker).postMessage({ id, lines })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, lines: null, error: String((err as Error)?.message ?? err) })
  }
}
