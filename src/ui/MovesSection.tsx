import { useState } from 'react'
import type { Club, GameState } from '../game/model'
import { MOVES, MOVE_BY_ID, isPenCall, isRedCall, isStrike, mixOf, type Move } from '../game/moves'
import { t } from '../game/i18n'
import { SectionTitle } from './components'
import MovePreview from './MovePreview'

/**
 * THE PLAYBOOK, on the Set Piece tab's Moves view (1.8.1 moves, 1.8.2
 * playbook, game/moves.ts and game/armsrace.ts).
 *
 * Five slots: the base shape for open phases, the primary and the secondary
 * strike off first-phase ball, the red-zone play for their 22, and (round 6,
 * owner: "Penalty tap options should be a new slot on what to do in a
 * penalty situation") the tap play the side runs when it takes a quick tap.
 * Whether it taps at all is still the kickable-penalty call on the Kicking
 * view.
 *
 * PREVIEW, THEN PICK THE SLOT (owner: "You should be able to select which of
 * the moves goes where, like the main menu save option"): the slots sit
 * compactly at the top; under them the moves; tap one and it plays on a loop
 * (MovePreview, the highlight clip's own runs) with one line on what it does.
 * "Add to playbook" opens the slots as a list in the save-slot picker's look,
 * each saying what it holds now; one the move cannot go in is there but
 * greyed, and a tap on any other puts the move there, replacing what was. A
 * move already in the playbook offers "Remove from playbook" instead. How
 * well the side knows a move is not shown at all: familiarity, and what a
 * half-learnt move costs on the day, are left to the matches to teach (owner).
 *
 * EVERY SLOT TAKES A TAP (round 6, owner: "I can't tap Open-Play Call"). The
 * slot buttons were disabled while empty, and a new career's are all empty,
 * so the first one anybody tried did nothing at all. Now a filled slot
 * previews its move, and an empty one narrows the moves below to the ones
 * that fit it; the move picked from there goes straight in with one tap.
 */

type Slot = 'shape' | 'main' | 'alt' | 'red' | 'pen'
type SlotKey = 'moveShape' | 'moveMain' | 'moveAlt' | 'moveRed' | 'movePen'
type SlotDef = [Slot, string, SlotKey, (m: Move) => boolean]
const SLOTS: SlotDef[] = [
  ['shape', 'moves.shape', 'moveShape', m => m.group === 'shape'],
  ['main', 'moves.offLineout', 'moveMain', m => isStrike(m.id)],
  ['alt', 'moves.offScrum', 'moveAlt', m => isStrike(m.id)],
  ['red', 'moves.slotRed', 'moveRed', m => isRedCall(m.id)],
  ['pen', 'moves.slotPen', 'movePen', m => isPenCall(m.id)],
]
const MIXES: [number, string][] = [[80, 'moves.mixLean'], [67, 'moves.mixTwo'], [50, 'moves.mixEven']]

export default function MovesSection({ game, club, touch }: { game: GameState; club: Club; touch: () => void }) {
  const [pick, setPick] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  /** the empty slot last tapped: the moves below are the ones that fit it */
  const [want, setWant] = useState<Slot | null>(null)
  const wantS = want ? SLOTS.find(s => s[0] === want) ?? null : null
  const tac = club.tactic
  const current = (key: SlotKey, fits: (m: Move) => boolean) => {
    const id = tac[key]
    return id && MOVE_BY_ID[id] && fits(MOVE_BY_ID[id]) ? id : null
  }
  const inBook = new Set(SLOTS.map(([, , k, f]) => current(k, f)).filter((x): x is string => !!x))

  const m = pick ? MOVE_BY_ID[pick] : null
  const both = !!current('moveMain', SLOTS[1][3]) && !!current('moveAlt', SLOTS[2][3])
  const mix = mixOf(tac)

  const choose = (id: string) => { setPick(id); setChoosing(false) }
  const place = (s: SlotDef) => {
    if (!m || !s[3](m)) return
    tac[s[2]] = m.id
    setChoosing(false)
    setWant(null)
    touch()
  }
  const remove = () => {
    if (!m) return
    for (const [, , k] of SLOTS) if (tac[k] === m.id) tac[k] = undefined
    setChoosing(false)
    touch()
  }
  /** a filled slot previews its move; an empty one shows what fits it */
  const tapSlot = (s: SlotDef, c: string | null) => {
    if (c) { setWant(null); choose(c); return }
    setWant(want === s[0] ? null : s[0])
    setPick(null)
    setChoosing(false)
  }
  const shown = wantS ? MOVES.filter(wantS[3]) : MOVES

  return <>
    <SectionTitle sub={t('moves.headingSub')}>{t('moves.heading')}</SectionTitle>
    <div className="card mv-card" data-choosing={choosing ? '1' : undefined}>
      <div className="mv-calls">
        {SLOTS.map(s => {
          const [slot, heading, k, f] = s
          const c = current(k, f)
          const on = c ? c === pick : want === slot
          return (
            <button key={slot} className={`preset-chip mv-callchip${on ? ' on' : ''}`}
              data-call={slot} data-filled={c ?? ''} aria-pressed={on}
              onClick={() => tapSlot(s, c)}>
              <b>{t(heading)}</b>
              <span>{c ? t(MOVE_BY_ID[c].name) : t('moves.none')}</span>
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
        </div>
        {inBook.has(m.id)
          ? <button className="btn ghost block" data-act="remove" onClick={remove}>{t('moves.remove')}</button>
          : wantS && wantS[3](m) && !choosing
            // picked from an empty slot's list: straight into that slot
            ? <button className="btn gold block" data-act="put" data-slot={wantS[0]} onClick={() => place(wantS)}>{t('moves.addTo', { slot: t(wantS[1]) })}</button>
            : choosing
              ? <>
                {/* THE SLOT PICKER, in the look of the main menu's saves: one
                    row a slot, what it holds under its name */}
                <div className="meta mv-hint" data-hint="slot">{t('moves.slotHint')}</div>
                <div className="mv-slots">
                  {SLOTS.map(s => {
                    const [slot, heading, k, f] = s
                    const c = current(k, f)
                    return (
                      <button key={slot} className="btn mv-slot" data-slot={slot} data-filled={c ?? ''}
                        disabled={!f(m)} onClick={() => place(s)}>
                        <b>{t(heading)}</b>
                        <span>{c ? t(MOVE_BY_ID[c].name) : t('moves.none')}</span>
                      </button>
                    )
                  })}
                </div>
                <button className="btn ghost block" data-act="cancel" onClick={() => setChoosing(false)}>{t('player.cancel')}</button>
              </>
              : <button className="btn gold block" data-act="add" onClick={() => setChoosing(true)}>{t('moves.add')}</button>}
      </div> : !wantS && <div className="meta mv-hint">{t('moves.tapHint')}</div>}

      {wantS && <div className="mv-want" data-want={wantS[0]}>
        <span className="meta">{t('moves.pickFor', { slot: t(wantS[1]) })}</span>
        <button className="preset-chip" data-act="all" onClick={() => setWant(null)}>{t('moves.showAll')}</button>
      </div>}
      <div className="preset-row mv-chips">
        {shown.map(o => (
          <button key={o.id} className={`preset-chip${pick === o.id ? ' on' : ''}${inBook.has(o.id) ? ' mv-in' : ''}`}
            aria-pressed={pick === o.id} data-move={o.id} onClick={() => choose(o.id)}>
            {t(o.name)}
          </button>
        ))}
      </div>
    </div>
  </>
}
