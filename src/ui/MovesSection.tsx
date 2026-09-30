import { useState } from 'react'
import type { Club, GameState } from '../game/model'
import { MOVES, MOVE_BY_ID, familiarityOf, isRedCall, isStrike, mixOf, moveEdge, type Move } from '../game/moves'
import { t } from '../game/i18n'
import { SectionTitle } from './components'
import MovePreview from './MovePreview'

/**
 * THE PLAYBOOK, on the Set Piece tab's Moves view (1.8.1 moves, 1.8.2
 * playbook, game/moves.ts and game/armsrace.ts).
 *
 * Four slots: the base shape for open phases, the primary and the secondary
 * strike off first-phase ball, and the red-zone play for their 22.
 *
 * ONE FLOW (1.8.2, owner: "Simplify so you preview and then the slots are
 * filled"): the four slots sit compactly at the top with how familiar the
 * side is with each; under them the moves; tap one and it plays on a loop
 * (MovePreview, the highlight clip's own runs) with one line on what it does
 * and one button. "Add to playbook" fills the first empty slot the move can
 * go in; when those are all taken, the slots it could go in light up and a
 * tap on one replaces what is there. A move already in the playbook offers
 * "Remove from playbook" instead.
 */

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
  const [pick, setPick] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const tac = club.tactic
  const current = (key: SlotKey, fits: (m: Move) => boolean) => {
    const id = tac[key]
    return id && MOVE_BY_ID[id] && fits(MOVE_BY_ID[id]) ? id : null
  }
  const famPct = (id: string) => Math.round(familiarityOf(game, club, id) * 100)
  const inBook = new Set(SLOTS.map(([, , k, f]) => current(k, f)).filter((x): x is string => !!x))

  const m = pick ? MOVE_BY_ID[pick] : null
  const fitsSlot = (s: typeof SLOTS[number]) => !!m && s[3](m)
  const drilled = m ? moveEdge(game, club, m.id, 0, 0).drilled : 0
  const both = !!current('moveMain', SLOTS[1][3]) && !!current('moveAlt', SLOTS[2][3])
  const mix = mixOf(tac)

  const choose = (id: string) => { setPick(id); setReplacing(false) }
  const add = () => {
    if (!m) return
    const free = SLOTS.find(s => fitsSlot(s) && !current(s[2], s[3]))
    if (!free) { setReplacing(true); return }
    tac[free[2]] = m.id
    touch()
  }
  const remove = () => {
    if (!m) return
    for (const [, , k] of SLOTS) if (tac[k] === m.id) tac[k] = undefined
    setReplacing(false)
    touch()
  }
  const tapSlot = (s: typeof SLOTS[number], filled: string | null) => {
    if (replacing && m && fitsSlot(s)) {
      tac[s[2]] = m.id
      setReplacing(false)
      touch()
    } else if (filled) choose(filled)
  }

  return <>
    <SectionTitle sub={t('moves.headingSub')}>{t('moves.heading')}</SectionTitle>
    <div className="card mv-card" data-replacing={replacing ? '1' : undefined}>
      <div className="mv-calls">
        {SLOTS.map(s => {
          const [slot, heading, k, f] = s
          const c = current(k, f)
          const target = replacing && fitsSlot(s)
          return (
            <button key={slot} className={`preset-chip mv-callchip${target ? ' pick' : ''}${c && c === pick ? ' on' : ''}`}
              data-call={slot} data-filled={c ?? ''} disabled={!target && !c}
              onClick={() => tapSlot(s, c)}>
              <b>{t(heading)}</b>
              <span>{c ? t(MOVE_BY_ID[c].name) : t('moves.none')}</span>
              {c && <span className="mv-fam" data-fam={famPct(c)}>{t('moves.fam', { pct: famPct(c) })}</span>}
            </button>
          )
        })}
      </div>
      {both && <div className="meta mv-mixlabel">{t('moves.mixLabel', { pct: mix })}</div>}
      {both && <div className="preset-row mv-chips mv-mix">
        {MIXES.map(([v, k]) => (
          <button key={v} className={`preset-chip${mix === v ? ' on' : ''}`} aria-pressed={mix === v} data-mix={v}
            onClick={() => { tac.moveMix = v; touch() }}>{t(k)}</button>
        ))}
      </div>}

      {m ? <div className="mv-preview" data-pick={m.id}>
        <MovePreview id={m.id} />
        <div className="sp-txt">
          <b>{t(m.name)}</b>
          <span className="d">{t(m.desc)}</span>
          <span className="d" data-fam={famPct(m.id)}>{t('moves.fam', { pct: famPct(m.id) })}</span>
          {drilled < 60 && <span className="d mv-warn">{t('moves.misfire')}</span>}
        </div>
        {replacing
          ? <div className="meta mv-hint" data-hint="replace">{t('moves.replaceHint')}</div>
          : inBook.has(m.id)
            ? <button className="btn ghost block" data-act="remove" onClick={remove}>{t('moves.remove')}</button>
            : <button className="btn gold block" data-act="add" onClick={add}>{t('moves.add')}</button>}
      </div> : <div className="meta mv-hint">{t('moves.tapHint')}</div>}

      <div className="preset-row mv-chips">
        {MOVES.map(o => (
          <button key={o.id} className={`preset-chip${pick === o.id ? ' on' : ''}${inBook.has(o.id) ? ' mv-in' : ''}`}
            aria-pressed={pick === o.id} data-move={o.id} onClick={() => choose(o.id)}>
            {t(o.name)}
          </button>
        ))}
      </div>
    </div>
  </>
}
