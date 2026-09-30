import { useState } from 'react'
import type { Attrs, Club, GameState } from '../game/model'
import {
  MOVES, MOVE_BY_ID, isRedCall, isStrike, mixOf, moveEdge, moveFit, moveMatchup, type DefTrait, type Move,
} from '../game/moves'
import { userFixtureThisWeek } from '../game/season'
import { t } from '../game/i18n'
import { SectionTitle } from './components'
import { MoveDiagram } from './tacticsArt'
import { STYLE_MOVES, moveAffinity, stylesOf } from '../game/styles'
import { ADAPT_WORTH, adaptOf, tapeOf } from '../game/armsrace'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, routineEffect } from '../game/playbook'

/**
 * THE PLAYBOOK, on the Set Piece tab's Moves view (1.8.1 moves, 1.8.2
 * playbook, game/moves.ts and game/armsrace.ts).
 *
 * Four calls: the base shape the side plays in open phases, the primary and
 * the secondary strike off first-phase ball, and the red-zone play for their
 * 22; the set-piece launch they come off (the lineout and scrum calls) is
 * named under them, and is picked on the Calls view. ONE card for all of it,
 * because the tab was already long: the top row picks which call you are
 * looking at (and says what each is set to), the chips under it make the
 * call, and the picture and the facts beside it say what the move needs, what
 * it beats, how well drilled and how familiar it is, whether the men in the
 * XV suit it, what this week's opposition defence does to it, and how much
 * of it is on their tape.
 */

const TRAIT_KEY: Record<DefTrait, string> = {
  rush: 'moves.traitRush', drift: 'moves.traitDrift', narrow: 'moves.traitNarrow', wide: 'moves.traitWide',
}

type Slot = 'shape' | 'main' | 'alt' | 'red'
type SlotKey = 'moveShape' | 'moveMain' | 'moveAlt' | 'moveRed'
const SLOTS: [Slot, string, SlotKey, (m: Move) => boolean][] = [
  ['shape', 'moves.shape', 'moveShape', m => m.group === 'shape'],
  ['main', 'moves.offLineout', 'moveMain', m => isStrike(m.id)],
  ['alt', 'moves.offScrum', 'moveAlt', m => isStrike(m.id)],
  ['red', 'moves.slotRed', 'moveRed', m => isRedCall(m.id)],
]
const MIXES: [number, string][] = [[80, 'moves.mixLean'], [67, 'moves.mixTwo'], [50, 'moves.mixEven']]

export default function MovesSection({ game, club, touch }: { game: GameState; club: Club; touch: () => void }) {
  const [which, setWhich] = useState<Slot>('main')
  const tac = club.tactic
  const fx = userFixtureThisWeek(game)
  const oppId = fx ? (fx.homeId === club.id ? fx.awayId : fx.homeId) : null
  const opp = oppId ? game.clubs[oppId] : undefined
  // the men in the shirts the move names, off the sheet as it stands
  const at = (shirt: number, a: keyof Attrs) => {
    const id = tac.lineup[shirt - 1]
    const p = id != null ? game.players[id] : undefined
    return p ? p.a[a] : null
  }
  const current = (key: SlotKey, fits: (m: Move) => boolean) => {
    const id = tac[key]
    return id && MOVE_BY_ID[id] && fits(MOVE_BY_ID[id]) ? id : null
  }
  const needs = (m: Move) => m.needs.map(n => t('moves.needPart', {
    shirts: n.shirts.join('/'),
    attrs: n.attrs.map(a => t(`attrs.${a}`)).join(', '),
  })).join(' · ')

  const [slot, , key, fits] = SLOTS.find(c => c[0] === which) ?? SLOTS[1]
  const cur = current(key, fits)
  const m = cur ? MOVE_BY_ID[cur] : null
  // the attack style's say in it (1.8.2): a move that belongs to the side's
  // overall game is run better, exactly as the engine reads it (moveInPlay)
  const atk = stylesOf(game, club)?.atk
  const fit = m ? Math.max(-1, Math.min(1, moveFit(m, at) + moveAffinity(atk, m.id, m.group === 'shape'))) : 0
  const match = m && opp ? moveMatchup(m, opp.tactic) : 0
  // the arms race (armsrace.ts): what their tape has on it, and whether this
  // week's opposition is set for it, as the engine takes it at kick-off
  const adapt = m && oppId ? adaptOf(game, oppId, m.id) : 0
  const e = m ? moveEdge(game, club, m.id, fit, match, adapt) : null
  const tape = tapeOf(club)
  const share = m ? tape.share[m.id] ?? 0 : 0
  const drilledPct = (id: string) => Math.round(moveEdge(game, club, id, 0, 0).drilled)
  const both = !!current('moveMain', SLOTS[1][3]) && !!current('moveAlt', SLOTS[2][3])
  const mix = mixOf(tac)
  const lo = tac.lineoutCall ?? DEFAULT_LINEOUT, sc = tac.scrumCall ?? DEFAULT_SCRUM

  return <>
    <SectionTitle sub={t('moves.headingSub')}>{t('moves.heading')}</SectionTitle>
    <div className="card mv-card" data-moves={which}>
      <div className="meta">{t('moves.rule')}</div>
      <div className="mv-calls">
        {SLOTS.map(([s, heading, k, f]) => {
          const c = current(k, f)
          return (
            <button key={s} className={`preset-chip mv-callchip${which === s ? ' on' : ''}`} aria-pressed={which === s}
              data-call={s} onClick={() => setWhich(s)}>
              <b>{t(heading)}</b>
              <span>{c ? t(MOVE_BY_ID[c].name) : t('moves.none')}</span>
            </button>
          )
        })}
      </div>
      <div className="preset-row mv-chips">
        <button className={`preset-chip${!cur ? ' on' : ''}`} aria-pressed={!cur} data-move="none"
          onClick={() => { tac[key] = undefined; touch() }}>{t('moves.none')}</button>
        {MOVES.filter(fits).map(o => (
          <button key={o.id} className={`preset-chip${cur === o.id ? ' on' : ''}`} aria-pressed={cur === o.id} data-move={o.id}
            onClick={() => {
              tac[key] = o.id
              // one move is one call: it cannot be both strikes
              if (slot === 'main' && tac.moveAlt === o.id) tac.moveAlt = undefined
              if (slot === 'alt' && tac.moveMain === o.id) tac.moveMain = undefined
              touch()
            }}>
            {t(o.name)} <span className="mv-pct">{drilledPct(o.id)}%</span>
            {atk && STYLE_MOVES[atk].includes(o.id) && <span className="mv-style"> · {t('moves.fromStyle')}</span>}
          </button>
        ))}
      </div>
      {(slot === 'main' || slot === 'alt') && both && <>
        <div className="meta mv-mixlabel">{t('moves.mixLabel', { pct: mix })}</div>
        <div className="preset-row mv-chips mv-mix">
          {MIXES.map(([v, k]) => (
            <button key={v} className={`preset-chip${mix === v ? ' on' : ''}`} aria-pressed={mix === v} data-mix={v}
              onClick={() => { tac.moveMix = v; touch() }}>{t(k)}</button>
          ))}
        </div>
      </>}
      <div className="mv-body">
        <MoveDiagram id={cur ?? 'none'} />
        <div className="sp-txt">
          <b>{m ? t(m.name) : t('moves.none')}</b>
          <span className="d">{m ? t(m.desc) : t('moves.noneDesc')}</span>
          {m && e && <>
            <span className="d mv-need">{needs(m)}</span>
            <span className="d">
              {m.beats.map(b => t('moves.beats', { trait: t(TRAIT_KEY[b]) })).join(' · ')}
              {' · '}
              {m.weak.map(w => t('moves.weak', { trait: t(TRAIT_KEY[w]) })).join(' · ')}
            </span>
            <span className="rt-bar"><i style={{ width: `${Math.round(e.drilled)}%` }} /></span>
            <span className="d">
              {t('tacticsScreen.drilled', { pct: Math.round(e.drilled) })}
              {e.gain >= 0.02 ? t('tacticsScreen.worth', { pct: Math.round(e.gain * 100) })
                : e.gain <= -0.02 ? t('tacticsScreen.costing', { pct: Math.round(-e.gain * 100) }) : t('tacticsScreen.aboutLevel')}
            </span>
            {e.q < 0 && <span className="d mv-warn">{t('moves.misfire')}</span>}
            <span className="d" data-fam={Math.round(e.fam * 100)}>
              {e.fam < 0.2 ? t('moves.famNew') : t('moves.fam', { pct: Math.round(e.fam * 100) })}
            </span>
            <span className={`d${fit < -0.15 ? ' mv-warn' : ''}`}>
              {t(fit > 0.15 ? 'moves.fitGood' : fit < -0.15 ? 'moves.fitPoor' : 'moves.fitOk')}
            </span>
            {opp && <span className={`d${match < -0.15 ? ' mv-warn' : ''}`}>
              {t(match > 0.15 ? 'moves.vsGood' : match < -0.15 ? 'moves.vsBad' : 'moves.vsEven', { team: opp.short })}
            </span>}
            {m.group === 'strike' && !m.red && <span className="d" data-tape={Math.round(share * 100)}>
              {share >= 0.05 && tape.total >= 3 ? t('moves.tape', { pct: Math.round(share * 100) }) : t('moves.tapeNone')}
            </span>}
            {opp && adapt >= ADAPT_WORTH && <span className="d mv-warn" data-adapt={Math.round(adapt * 100)}>{t('moves.adapted', { team: opp.short })}</span>}
          </>}
          <span className="d mv-launch">{t('moves.launch', {
            lo: t(`playbook.${lo}`), lp: Math.round(routineEffect(club, lo).drilled),
            sc: t(`playbook.${sc}`), sp: Math.round(routineEffect(club, sc).drilled),
          })}</span>
        </div>
      </div>
    </div>
  </>
}
