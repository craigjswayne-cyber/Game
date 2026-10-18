// The match-day squad sheet and the assistant's read on how fresh the XV is.

import { useEffect, useState } from 'react'
import { useStore } from '../../../store'
import { MAX_SUBS, isFrontRower, needsFrontRower, type SideCtx, shirtNumber } from '../../../game/matchEngine'
import { XV_SLOTS, type Player, type Pos } from '../../../game/model'
import { BRIEF_BY_ID, briefForSeat } from '../../../game/bench'
import { BriefIcon } from '../../tacticsArt'
import { posName, t } from '../../../game/i18n'
import { Glyph } from '../../glyphs'
import { Veil } from '../../Veil'

/** Replacements the user can still make: the law's count, capped by the fit men
 *  left on the bench. The engine keeps its own count; this is what we show. */
export function usableChanges(game: { players: Record<number, Player> }, side: SideCtx, subsUsed: number): number {
  const fit = side.lineup.slice(15).filter(id => {
    const p = id != null ? game.players[id] : null
    return !!p && !p.injury && !side.onPitch.has(p.id) && !side.ratings.has(p.id)
  }).length
  return Math.max(0, Math.min(MAX_SUBS - subsUsed, fit))
}

/** The match-day squad, mid-match: the XV on the left, the bench on the right,
 *  tap one then the other to make a change, and keep going until the bench is
 *  gone or you are happy.
 *
 *  It replaces a pair of <select> dropdowns and a Make button. Those could only
 *  do one change per visit to the panel, showed no shirt number, no rating and
 *  no sign of who had picked up a knock, and gave the bench in squad order
 *  rather than telling you who actually covered the shirt you were emptying.
 *
 *  `forcedOffId` is the injury flow (feedback 9-3): when a man goes down badly
 *  the sheet opens with him already armed, so the only decision left is who
 *  comes on. */
export function SquadSheet({ onClose, freeCoverId, waitId, title, note, hurtName, hurtDesc, hurtId, mustDecide, onTactics }: {
  onClose: () => void
  /** An injured man the match is waiting on (1.9.1): nobody has gone on for
   *  him yet, and the sheet stays until the manager has named who does. */
  waitId?: number
  /** The man the assistant sent on to cover an injury. Swapping him is free. */
  freeCoverId?: number
  title?: string
  note?: string
  /** The injured man, named in the sheet body as well as the heading, because the
   *  heading scrolls out of reach on a phone once the bench is in view. */
  hurtName?: string
  hurtDesc?: string
  /** the injured man's id, so the sheet can say what his shirt needs */
  hurtId?: number
  /** A forced stop: the sheet cannot be dismissed until a change is made. Used
   *  for injuries, where somebody has to come on and the choice is the
   *  manager's, not the assistant's. */
  mustDecide?: boolean
  /** route through to the tactics panel, for the Squad button in the control row */
  onTactics?: () => void
}) {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)!
  const { halfTimeSub, injuryCover, injuryPick, undoSub, swapPositions } = useStore.getState()
  const waiting = () => waitId != null && !!live.ctx.injWait?.some(w => w.hurtId === waitId)
  // THE FREE OVERRIDE ONLY EXISTS WHILE THE ASSISTANT'S MAN IS OUT THERE TO BE
  // TAPPED. If he is not (nobody could go on, or the law took him straight back
  // off), there is nothing to override and nothing to wait for: the side plays
  // on with what it has, and the sheet can always be closed (owner, round 6:
  // "I can't continue in the game").
  const live0 = live.ctx.home.teamId === live.ctx.userSideId ? live.ctx.home : live.ctx.away
  const coverOn = freeCoverId != null && live0.onPitch.has(freeCoverId) && live0.lineup.slice(0, 15).includes(freeCoverId)
  const [offId, setOffId] = useState<number | null>(waitId != null && waiting() ? waitId : coverOn ? freeCoverId! : null)
  const [freeLeft, setFreeLeft] = useState(coverOn)
  /** a decision has been made: a change, a swap, or keeping the assistant's man.
   *  A refused tap is not one, so it does not open the door. */
  const [decided, setDecided] = useState(false)
  const [log, setLog] = useState<string[]>([])
  // COUNT THE CHANGES, do not count the lines about them. The Done button used to
  // read log.length, and log is a display list capped with .slice(0, 4) - so a
  // fifth change still said "4 changes made" (user: "when you make more than 4
  // substitution it says you've made 4 subs"). It was wrong in the other direction
  // too: "keeps the shirt" goes in the log and is not a change. A number the player
  // reads has to come from the thing itself, not from a list that was trimmed to
  // fit. Per visit, so it is not derivable from ctx.subsUsed - that counts the
  // whole match, and a free injury swap does not burn one at all.
  const [made, setMade] = useState(0)

  const ctx = live.ctx
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  // the law allows MAX_SUBS; the bench may hold fewer fit men than that
  const lawLeft = MAX_SUBS - ctx.subsUsed

  // The XV in shirt order, because that is how a team sheet reads and how the
  // man you are looking for is found.
  // the number he walked out in: a replacement in 23 stays 23 (1.8.16)
  const xv = mine.lineup.slice(0, 15).map((id, i) => ({
    shirt: (id != null ? shirtNumber(mine, id) : undefined) ?? i + 1,
    p: id != null ? game.players[id] : null,
  })).filter((r): r is { shirt: number; p: Player } => !!r.p)

  const fresh = mine.lineup.slice(15)
    .map(id => (id != null ? game.players[id] : null))
    .filter((p): p is Player => !!p && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))
  // with the bench spent, a replaced front-rower may come back on for an
  // injured front-rower (Law 3.35), so he is a choice too
  const waitP = waitId != null && waiting() ? game.players[waitId] : null
  const bench = fresh.length || !waitP || !isFrontRower(waitP) ? fresh : mine.lineup.slice(15)
    .map(id => (id != null ? game.players[id] : null))
    .filter((p): p is Player => !!p && !p.injury && !mine.onPitch.has(p.id) && mine.ratings.has(p.id) && isFrontRower(p)
      && !mine.binned.has(p.id) && !mine.sentOff?.has(p.id))
  // A WAIT WITH NOBODY TO SEND ON (1.9.1 bug hunt). The wait opens when the
  // bench has a man for the shirt, but a head-injury check in the same minute
  // can take that man, and then this sheet had no row to tap and no way to
  // close: the match stood still. The engine's answer for an empty bench is
  // to play on a man short (coverInjury with nobody chosen), which is what
  // the hint here already says will happen, so that is what happens.
  const noAnswer = waitP != null && bench.length === 0
  useEffect(() => {
    if (noAnswer && waitId != null) injuryPick(waitId, null)
  }, [noAnswer, waitId, injuryPick])
  // CHANGES YOU CAN ACTUALLY MAKE (owner, round 2): the header said "6 changes
  // left" with four fit men on the bench after injuries. The number shown and the
  // number allowed are both the smaller of the law's count and the usable bench.
  const left = Math.min(lawLeft, bench.length)

  const off = offId != null ? game.players[offId] : null
  // THE SHIRT, NOT THE MAN WEARING IT. With the assistant's cover armed, the
  // shirt being filled is the injured man's: a back sent on for a flanker is
  // wearing 6, and the bench should be read for 6, not for wherever the back
  // usually plays.
  const offSlot = offId != null ? mine.lineup.indexOf(offId) : -1
  const shirtPos: Pos | null = off ? (offSlot >= 0 && offSlot < 15 ? XV_SLOTS[offSlot].pos : off.pos) : null
  // Natural cover first, same as the engine's own bench discipline, so the
  // like-for-like choice is the one at the top of the list. Everybody else is
  // still a choice: any fit man can take any shirt but the front row's.
  const covers = (p: Player) => !!shirtPos && (p.pos === shirtPos || p.alt.includes(shirtPos))
  const benchSorted = [...bench].sort((a, b) => Number(covers(b)) - Number(covers(a)) || b.ca - a.ca)

  // Swapping the injury cover is free and does not burn one of them, so it
  // routes through injuryCover rather than a normal substitution.
  const isFreeSwap = freeLeft && offId != null && offId === freeCoverId
  // shirts 1 to 3 want a trained front-rower while there is one (needsFrontRower);
  // when there is none, anybody may go on and the scrums go uncontested
  const frShirt = offSlot >= 0 && offSlot <= 2
  const frOnly = off ? needsFrontRower(game, mine, off.id, isFreeSwap ? off.id : undefined) : false
  const blocked = (p: Player) => frOnly && !isFrontRower(p)
  const hurtP = hurtId != null ? game.players[hurtId] : null
  const isWait = waitP != null && offId === waitP.id
  const doSub = (inP: Player) => {
    if (offId == null || blocked(inP)) return
    if (isWait) {
      // free, like every injury replacement; the engine has the last word
      const msg = injuryPick(waitP.id, inP.id)
      if (msg) { setLog(l => [msg, ...l].slice(0, MAX_SUBS)); return }
      setLog(l => [t('touch.takesShirtInstead', { on: inP.name, off: waitP.name }), ...l].slice(0, MAX_SUBS))
      setMade(n => n + 1)
      setDecided(true)
      setOffId(null)
      return
    }
    const msg = isFreeSwap ? injuryCover(offId, inP.id) : halfTimeSub(offId, inP.id)
    // the engine has the last word: a refused change changes nothing here either
    if (!mine.onPitch.has(inP.id)) { setLog(l => [msg, ...l].slice(0, MAX_SUBS)); return }
    if (isFreeSwap) setFreeLeft(false)
    // the display list holds the whole bench now rather than four of it, because a
    // log that quietly drops entries is what made the count wrong in the first place
    setLog(l => [msg, ...l].slice(0, MAX_SUBS))
    setMade(n => n + 1)
    setDecided(true)
    setOffId(null)
  }

  // a forced stop is satisfied by any change, including keeping the assistant's
  // man - tapping him again is a decision, it is just the same decision
  const settled = waitId != null ? !waiting() : !mustDecide || decided || !freeLeft
  return (
    <Veil onClose={() => { if (settled) onClose() }} boxClassName="modal squad-sheet">
      <div className="grab" />
      {/* THE WHOLE BRIEF STICKS, not just the title.
          The title was made sticky on its own after a screenshot showed the
          sheet scrolled down to the bench with the heading off the top, so the
          manager was being asked to replace a man the screen no longer named.
          That fixed the name and left the instruction behind: reported from a
          live game, "she could see the team xv but couldnt see the text above
          it". Measured at 412x640 the hint sat 215px above the top of the
          screen once the list was scrolled far enough to reach the bench.
          The hint is the one line that CHANGES as you tap - it goes from "tap a
          man on the pitch" to "Ollie Sleightholme is coming off, now tap his
          replacement" - so it is the one line that must never be off screen.
          All three ride together in one sticky block. */}
      <div className="sheet-top">
        <div className="sheet-head">
          <h3>{title ?? t('matchday.matchDaySquad')}</h3>
          <span className="meta">{t('matchday.changesLeft', { n: left })}</span>
        </div>
        {/* who is hurt, named in his own line rather than buried in a
            paragraph of instructions */}
        {hurtName && (
          <div className="sheet-casualty">
            <Glyph name="medical" /> <b>{hurtName}</b>{t('matchday.casualty')}{hurtDesc ? t('matchday.casualtyDesc', { desc: hurtDesc }) : ''}
          </div>
        )}
        {hurtP && ctx.uncontested && (
          <div className="meta sheet-hint" style={{ fontWeight: 700 }}>{t('matchday.injUncontested')}</div>
        )}
        <div className="meta sheet-hint">
          {note ? <>{note}{' '}</> : null}
          {hurtP && !coverOn && bench.length === 0 ? t('matchday.injNoCover')
            : isFreeSwap && off ? t('matchday.hintFree', { player: off.name })
            : isWait && off ? t('matchday.hintWait', { player: off.name })
            : off ? t('matchday.hintArmed', { player: off.name })
            : left <= 0 ? t('matchday.hintNoneLeft')
            : t('matchday.hintTap')}
        </div>
      </div>
      <div className="sheet-cols">
        <div className="sheet-col">
          <div className="fact-label">{t('matchday.onThePitch')}</div>
          {xv.map(({ shirt, p }) => {
            const on = mine.onPitch.has(p.id)
            const e = Math.round(mine.energy.get(p.id) ?? 70)
            const r = mine.ratings.get(p.id)
            const binned = (mine.yellowUntil.get(p.id) ?? 0) > ctx.tick * 4
            // the free injury swap stays available even with the bench emptied
            const canFree = freeLeft && p.id === freeCoverId
            return (
              <button key={p.id} className={`sheet-row ${offId === p.id ? 'armed' : ''}`}
                // while a shirt waits for its man, that shirt is the only one
                // to fill: a tactical change now would leave it empty and the
                // match still waiting (hlliveprobe made eight of them)
                disabled={p.id === waitP?.id ? false : !!waitP || !on || (lawLeft <= 0 && !canFree)}
                onClick={() => {
                  // the man the match is waiting on can always be armed again
                  if (p.id === waitP?.id) { setOffId(p.id); return }
                  // Re-tapping the man the assistant sent on means "he stays".
                  // That is a decision, so it settles a forced stop - and it has
                  // to be answerable here, because he is already on the pitch
                  // and so never appears in the bench column.
                  if (canFree && offId === p.id) {
                    setFreeLeft(false)
                    setDecided(true)
                    // no setMade here on purpose: keeping the assistant's man is a
                    // decision, which settles the forced stop, but it is not a change
                    setLog(l => [t('matchday.keepsShirt', { player: p.name }), ...l].slice(0, MAX_SUBS))
                    setOffId(null)
                    return
                  }
                  // a second on-pitch tap is a positional switch (16B, user:
                  // "swap the 12 and 13 over"): free, burns nothing
                  if (offId != null && offId !== p.id && !isFreeSwap && mine.onPitch.has(offId) && on) {
                    const msg = swapPositions(offId, p.id)
                    setLog(l => [msg, ...l].slice(0, MAX_SUBS))
                    setDecided(true)
                    setOffId(null)
                    return
                  }
                  setOffId(offId === p.id ? null : p.id)
                }}>
                <span className="sh-num">{shirt}</span>
                {/* the position, not just the shirt (Round 27, user: "it
                    should have their positions"). The bench column has always
                    said what a man is; the pitch column made you know the
                    numbering by heart to work out who you were taking off. */}
                <span className="sh-pos">{p.pos}</span>
                <span className="sh-name">{p.name}</span>
                {binned && <span className="sh-flag" title={t('matchday.inTheBin')} style={{ color: 'var(--gold)' }}><Glyph name="card" /></span>}
                {p.injury && <span className="sh-flag" title={t('matchday.injuredFlag')}><Glyph name="medical" /></span>}
                {/* A man off the pitch who is neither binned nor hurt was sent
                    off - a substituted man leaves the lineup entirely, so this
                    is the only remaining way to be gone. Without the flag his
                    row was just dead grey with no reason on it, which is how
                    subreach failed one suite run and taught the sheet to say
                    why (round 23). */}
                {!on && !binned && !p.injury && <span className="sh-flag" title={t('matchday.sentOff')} style={{ color: 'var(--danger)' }}><Glyph name="card" /></span>}
                {r != null && <span className="sh-rate">{r.toFixed(1)}</span>}
                {/* THE NUMBER, NOT THE WORD (Round 27, user: "percentage
                    rather than words"). 25D-2 put the assistant's phrasing in
                    here for the fog of war and it was wrong twice over: this
                    column is 32px, built for "43%", so "out on his feet"
                    wrapped to four lines and tore the row open; and this is
                    the screen where the substitution is actually decided, so
                    it is the one place that wants a hard number rather than a
                    feel. The words keep their home in the assistant's read
                    below, where they are commentary rather than an input. */}
                <span className={`sh-nrg ${energyTone(e)}`}>{e}%</span>
              </button>
            )
          })}
        </div>
        <div className="sheet-col">
          <div className="fact-label">{shirtPos ? t('matchday.benchCover', { pos: posName(shirtPos) }) : t('matchday.bench')}</div>
          {/* the front row is the one shirt with a rule on it, said where the
              choice is made rather than discovered as a refusal */}
          {off && frShirt && benchSorted.length > 0 && (frOnly || !ctx.uncontested) && (
            <div className="meta sheet-frnote">{t(frOnly ? 'matchday.frOnlyNote' : 'matchday.frNoneNote')}</div>
          )}
          {benchSorted.length === 0 && <div className="meta">{t('matchday.benchEmpty')}</div>}
          {benchSorted.map(p => {
            // what he was told before kick-off, so the choice is informed (F4)
            const seat = mine.seatOf.get(p.id)
            const brief = seat != null ? briefForSeat(game.clubs[mine.teamId], seat) : 'orders'
            return (
              <button key={p.id} className={`sheet-row ${off && covers(p) ? 'cover' : ''}`}
                disabled={!off || (left <= 0 && !isFreeSwap && !isWait) || blocked(p)}
                onClick={() => doSub(p)}>
                <span className="sh-num">{p.pos}</span>
                <span className="sh-name">{p.name}</span>
                {brief !== 'orders' && (
                  <span className="sh-flag" title={t(BRIEF_BY_ID[brief].name)}><BriefIcon brief={brief} /></span>
                )}
                {off && covers(p) && <span className="sh-flag" title={t('matchday.naturalCover')}>✓</span>}
                <span className="sh-rate">{p.ca}</span>
              </button>
            )
          })}
        </div>
      </div>
      {log.map((m, i) => <div key={i} className="meta sheet-log">{m}</div>)}
      {/* the wrong tap can be taken back at the same stoppage (16B, user:
          "i made a substitution but selected the wrong player, i couldnt
          undo it"). Only the LAST change, and only until play resumes. */}
      {ctx.lastSub && (
        <button className="btn ghost block" onClick={() => {
          const msg = undoSub()
          setLog(l => [msg, ...l].slice(0, MAX_SUBS))
          setMade(n => Math.max(0, n - 1))
          setOffId(null)
        }}>{t('matchday.takeBack')}</button>
      )}
      {mustDecide && !settled && (
        <div className="meta sheet-log" style={{ color: 'var(--danger)', fontWeight: 700 }}>
          {t(waitP ? 'matchday.mustDecideWait' : 'matchday.mustDecide')}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 8 }}>
        {onTactics && (
          <button className="btn ghost" onClick={onTactics}>{t('matchday.tacticsBtn')}</button>
        )}
        <button className="btn gold" style={{ flex: 1.6 }} disabled={!settled} onClick={onClose}>
          {made ? t('matchday.doneChanges', { n: made })
            : t(settled ? 'matchday.backToMatch' : 'matchday.nameFirst')}
        </button>
      </div>
    </Veil>
  )
}

/**
 * THE ASSISTANT'S EYE, NOT A TELEMETRY FEED (25D-2, from the fog-of-war idea
 * the user liked: reports instead of exact bars). A coach on the touchline
 * does not know a man is at 43% - he knows he is tiring. The exact number is
 * gone from every per-player readout: the word and a five-band gauge are what
 * the assistant can honestly tell you. Deterministic bands, no rng.
 */
export function condWord(e: number): string {
  return t(e >= 85 ? 'matchday.cwFresh' : e >= 70 ? 'matchday.cwGoingWell' : e >= 55 ? 'matchday.cwBlowing'
    : e >= 40 ? 'matchday.cwTiring' : e >= 25 ? 'matchday.cwEmpty' : 'matchday.cwSpent')
}

/** Every man coloured by how much he has left, from the first minute (owner,
 *  18 Oct 2026). It was always the percentage, never the clock: amber under 50
 *  and red under 25, which nobody reached before the hour, so the colours
 *  seemed to switch on at 60 minutes. Three bands now, on the same breaks as
 *  the assistant's words: fresh or going well is green, blowing or tiring is
 *  amber, empty or spent is red. */
export function energyTone(e: number): 'green' | 'amber' | 'red' {
  return e >= 70 ? 'green' : e >= 40 ? 'amber' : 'red'
}
const TONE_VAR = { green: 'var(--text-positive)', amber: 'var(--gold)', red: 'var(--text-negative)' } as const

/** The assistant's condition report on the XV, most worrying first. */
export function EnergyBars({ mine }: { mine: SideCtx }) {
  const game = useStore(s => s.game)!
  const rows = mine.lineup.slice(0, 15)
    .map(id => id != null ? game.players[id] : null)
    .filter((p): p is Player => !!p && mine.onPitch.has(p.id))
    .map(p => ({ p, e: mine.energy.get(p.id) ?? 70 }))
    .sort((a, b) => a.e - b.e)
    .slice(0, 6)
  return (
    <div style={{ marginTop: 8 }}>
      <div className="fact-label">{t('matchday.assistantsEye')}</div>
      {rows.map(({ p, e }) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: '0.75rem' }}>
          <span style={{ width: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <div style={{ flex: 1, height: 7, background: 'var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
            {/* the true width, not a banded one: a gauge that rounds to fifths
                is a gauge that quietly lies, and the number sits beside it */}
            <div style={{ width: `${e}%`, height: '100%', background: TONE_VAR[energyTone(e)] }} />
          </div>
          <span style={{ width: 118, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <b>{Math.round(e)}%</b> <span style={{ opacity: .7, fontStyle: 'italic' }}>{condWord(e)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
