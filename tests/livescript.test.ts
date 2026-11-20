// THE DIRECTOR (2.0.0 rebuild): what the pitch plays keeps the laws.
//
// Owner, 20 Nov 2026: "commentary, graphics and animation are all doing
// different things - they need to be in harmony." The engine's lines skip
// steps (about one line in five: a lineout with nothing going into touch, a
// scrum with no knock-on, play after a score with no kick-off). The director
// supplies each missing step once. This holds it to the laws on whole
// matches: every beat follows legally from the last, every throw-in and
// put-in goes to the right side, and no line is lost.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import type { Fixture, MatchEvent } from '../src/game/model'
import { Laws, type LawEvent } from '../src/ui/livepitch/law'
import { direct, lawOf, type Beat } from '../src/ui/livepitch/script'
import type { Phase } from '../src/ui/livepitch/phase'

function match(seed: number) {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  const r = simMatch(g, fx!, weekRng(g), true) as unknown as { events?: MatchEvent[] }
  return { events: (fx!.events ?? r.events ?? []) as MatchEvent[], homeId: fx!.homeId }
}

const beatLaw = (b: Beat): LawEvent | null =>
  b.law ?? (b.kind === 'knockon' ? 'STOP' : b.kind === 'intotouch' ? 'TOUCH' : lawOf(b as unknown as Phase))

describe('the director', () => {
  for (const seed of [4242, 777, 11, 2024, 31337, 9]) {
    it(`directs a whole match within the laws (seed ${seed})`, () => {
      const { events, homeId } = match(seed)
      const d = direct(events, homeId)
      expect(d.beats.length).toBe(events.length)
      // no line the laws could not reach
      expect(d.lost).toBe(0)
      const flat = d.beats.flat()
      const L = new Laws()
      let illegal = 0
      /** the last ball into touch: who put it out, and whether they keep the throw */
      let out: { by: boolean; own: boolean } | null = null
      let pen: boolean | null = null
      let stop: { by: boolean } | null = null
      for (const b of flat) {
        const law = beatLaw(b)
        if (!law) continue
        if (!L.go(law)) { illegal++; L.jump(law); L.go(law) }
        if (b.then && !L.go(b.then)) illegal++
        if (law === 'PENALTY') pen = b.law === 'PENALTY' ? !b.homeBall : b.homeBall
        if (law === 'TOUCH') {
          const by = b.kind === 'intotouch' ? b.byHome! : b.homeBall
          out = { by, own: b.label === 'lp.fifty22' || (b.kind === 'kick' && pen === b.homeBall) }
        }
        if (law === 'LINEOUT') {
          // law 18: the throw is against the side that put it out, unless a penalty or a 50:22
          expect(out, `lineout at line ${b.src} with nothing into touch`).not.toBeNull()
          expect(b.homeBall, `wrong throw at line ${b.src}`).toBe(out!.own ? out!.by : !out!.by)
          out = null
        }
        if (law === 'STOP') stop = { by: b.byHome! }
        if (law === 'SCRUM' && stop) {
          // law 11: the put-in is against the side that knocked it on
          expect(b.homeBall, `wrong put-in at line ${b.src}`).toBe(!stop.by)
          stop = null
        }
        if (law !== 'PENALTY' && law !== 'TOUCH') pen = null
      }
      expect(illegal).toBe(0)
      // what is left out is colour or a summary, never something that happened, and never much of the match
      const hid = d.hidden.map((h, i) => (h ? i : -1)).filter(i => i >= 0)
      for (const i of hid) {
        expect(events[i].type, `line ${i} (${events[i].k}) is an event and was hidden`).toBe('SUB')
        expect((events[i].k ?? '').replace(/^comm\./, ''), `line ${i} hidden`).toMatch(/^(pbp|defSet|defHit|move|flav|styles\.|terr|day_)/)
        expect(d.beats[i].length).toBe(0)
      }
      expect(hid.length / events.length).toBeLessThan(0.15)
      // the engine's own lines are all still there, in order
      expect(flat.filter(b => !b.supplied).map(b => b.src)).toEqual(d.beats.map((r, i) => r.some(b => !b.supplied) ? i : -1).filter(i => i >= 0))
    })
  }
})
