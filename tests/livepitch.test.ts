// THE LIVE PITCH (2.0.0): smooth by construction, and it always finishes.
//
// Owner, 16 Nov 2026, on the first pass: "The animation is incredibly jumpy".
// The second pass plays every line in real time with bodies that have a top
// speed (ui/livepitch/sim.ts). This holds that promise on a whole match: no
// man ever moves faster than a sprint between two frames except across a
// cut, no line's play hangs, a full match stays a watchable length, and
// every label the pitch can show has words.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, simMatch } from '../src/game/matchEngine'
import type { Fixture, MatchEvent } from '../src/game/model'
import { readLine, type Phase } from '../src/ui/livepitch/phase'
import { PitchSim } from '../src/ui/livepitch/sim'
import { direct } from '../src/ui/livepitch/script'
import en from '../src/locales/en.json'

function match(seed: number) {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  const peek = beginMatch(newGame('leicester', 'T', seed), fx!, weekRng(g), true)
  const lineups = { home: peek.home.lineup.slice(0, 15), away: peek.away.lineup.slice(0, 15) }
  const r = simMatch(g, fx!, weekRng(g), true) as unknown as { events?: MatchEvent[] }
  return { events: (fx!.events ?? r.events ?? []) as MatchEvent[], homeId: fx!.homeId, lineups }
}

describe('the live pitch', () => {
  for (const seed of [4242, 777]) {
    it(`plays a whole match smoothly (seed ${seed})`, () => {
      const { events, homeId, lineups } = match(seed)
      expect(events.length).toBeGreaterThan(60)
      const S = new PitchSim()
      // the second match is an expansive blitzing side against a tight drifting one
      if (seed === 777) S.tac = [
        { style: 85, tempo: 80, commit: 30, defLine: 90, defWidth: 75, contest: 80 },
        { style: 15, tempo: 25, commit: 80, defLine: 10, defWidth: 20, contest: 20 },
      ]
      const lp = (en as unknown as { lp: Record<string, unknown> }).lp
      const D = direct(events, homeId)
      let cur: Phase | null = null, total = 0, top = 0, plays = 0, wall = 0
      // the laws the pitch must keep: passes go backwards
      let passes = 0, forward = 0
      for (let i = 0; i < events.length; i++) {
        const p = readLine(events[i], i, homeId, cur, events[i + 1])
        if (!p) continue
        cur = p; plays++
        // a yellow card each for part of the first match: fourteen against fourteen
        if (seed === 4242) { S.off[5] = i > 40 && i < 70; S.off[26] = i > 55 && i < 90 }
        expect(lp[p.label.replace(/^lp\./, '')], `words for ${p.label}`).toBeTypeOf('string')
        const side = p.homeBall ? lineups.home : lineups.away
        const ci = p.carrier != null ? side.indexOf(p.carrier) : -1
        // the pitch plays what the director gives it: the line's own play and the steps the laws require before it
        const row = D.beats[i]
        for (const b of row) expect(lp[b.label.replace(/^lp\./, '')], `words for ${b.label}`).toBeTypeOf('string')
        S.playLine(row.length ? row : [{ ...p, src: i }], b => (b.src === i && !b.supplied && ci >= 0 ? ci : null))
        let t = 0, prev = S.b.map(b => ({ x: b.x, y: b.y }))
        let had: unknown = null
        while (!S.done && t < 30) {
          const cutsBefore = S.cuts
          S.step(1 / 120); t += 1 / 120; wall += 1 / 120 / Math.max(0.5, S.rate)
          {
            const Z = S as unknown as { flight: { from: { x: number }; to: { x: number }; toIdx: number } | null; mode: string; holder: number }
            const f = Z.flight
            if (f && f !== had && f.toIdx >= 0 && (Z.mode === 'ruck' || Z.mode === 'carry') && (f.toIdx < 15) === p.homeBall) {
              passes++
              if ((f.to.x - f.from.x) * (p.homeBall ? 1 : -1) > 1.5) forward++
            }
            had = f
          }
          for (let k = 0; k < 30; k++) {
            if (S.cuts === cutsBefore) top = Math.max(top, Math.hypot(S.b[k].x - prev[k].x, S.b[k].y - prev[k].y) * 120)
            prev[k].x = S.b[k].x; prev[k].y = S.b[k].y
          }
        }
        expect(t, `line ${i} (${events[i].k}) finishes`).toBeLessThan(30)
        total += t
      }
      expect(plays).toBeGreaterThan(50)
      // open play is passed through the hands, and (all but the odd pop off the floor) backwards
      expect(passes).toBeGreaterThan(30)
      expect(forward / passes).toBeLessThan(0.06)
      // a sprint is 8.2 m/s, the man with the ball a touch more
      expect(top).toBeLessThan(9.5)
      // nothing is teleported after the first picture: the match never cuts
      // (but the sides are in their places for the second-half kick-off: one more, behind the half-time panel)
      // (20 Nov 2026, owner: "players jumping around the pitch randomly". A stoppage now
      // dissolves to the formed set piece instead of thirty men being wound on to it at six
      // times life speed. Live play still never cuts; a match has thirty-odd stoppages.)
      expect(S.cuts).toBeLessThanOrEqual(60)
      // a full match at Normal, on the screen's clock (quiet play is wound
      // on): long enough to watch, short enough to finish
      void total
      expect(wall).toBeGreaterThan(150)
      expect(wall).toBeLessThan(600)
    })
  }
})
