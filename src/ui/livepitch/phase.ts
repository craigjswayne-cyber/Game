// THE LIVE PITCH (2.0.0): what the play looks like after each line.
//
// Owner, 16 Nov 2026, with a clip of another manager's match view: "V2.0.0 of
// Phase Rugby Manager - in game should be evolved into this. This is exactly
// what I want." The pitch stays on screen for the whole match, and every line
// of commentary moves the thirty men into the shape of what the line says: a
// scrum looks like a scrum, a lineout has a line, a kick goes up and comes
// down where the next line picks it up.
//
// NOTHING HERE IS INVENTED FOR THE LOOK OF IT. Each line already carries what
// it depicts: its key (scrum3, kickBox2, pbpRuck4, off_offFeet1), where the
// engine had the ball (fld), whose line it is (teamId) and who did it
// (playerId). This file reads those and nothing else. It never touches the
// match rng, so it cannot move a result, and it is a pure fold over the events
// so the same match always draws the same way, on a replay and after a reload.

import type { MatchEvent } from '../../game/model'

export type PhaseKind =
  | 'kickoff' | 'scrum' | 'lineout' | 'maul' | 'ruck' | 'carry' | 'kick' | 'catch'
  | 'try' | 'con' | 'goal' | 'dropout' | 'penalty' | 'heldup' | 'break' | 'hold'

export type BannerKind = 'try' | 'con' | 'conMiss' | 'pen' | 'penMiss' | 'dg' | 'dgMiss' | 'yc' | 'rc' | 'notry' | 'pentry'

export interface Banner {
  kind: BannerKind
  /** the side the banner is about (the scorer, the man carded) */
  teamId: string
  name?: string
  min: number
  /** the line it belongs to, so it is shown once */
  at: number
}

export interface Phase {
  kind: PhaseKind
  /** the side with the ball is the home side */
  homeBall: boolean
  /** the ball, in field metres: x 0 (home try line) .. 100 (away try line), y 0..70 */
  x: number
  y: number
  /** the man on the ball, when the line names him */
  carrier?: number
  /** set by the pitch once a restart has been kicked: the chase is on */
  flying?: boolean
  /** where a kick comes down, and how high it goes (metres) */
  to?: { x: number; y: number }
  hang?: number
  /** a kick at goal that went over */
  good?: boolean
  /** the label on the pitch: an i18n key and its values */
  label: string
  n?: number
  /** the line this phase is drawn from */
  at: number
  banner?: Banner
  /** a called move's name, as an i18n key (the line's move_k) */
  move?: string
  /** set by the sim, not the reader: the three forwards nearest this
   *  breakdown, the two defenders nearest it, and the man just tackled, so
   *  the men who are there are the ones drawn there */
  ruckers?: number[]
  tacklers?: number[]
  downMan?: number | null
}

/** the key without its variant number or the women's-game suffix: 'comm.scrum3_f' is 'scrum' */
export function stem(k?: string): string {
  if (!k) return ''
  return k.replace(/^comm\./, '').replace(/_f$/, '').replace(/\d+$/, '')
}

/** a small, stable hash of a line's index, for the bits a line does not say
 *  (how far across the field the ruck is). Stable so a replay draws the same. */
function wob(i: number, salt = 0): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13
  return (h % 10000) / 10000
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** lines about the side WITHOUT the ball: the tackler, the defensive line, the
 *  man who gave the penalty away */
const DEFENDING = /^(defSet|defHit|off_|notBackTen|heldUp|flav(8|12|15|23)$|ycRepeated|yc|rc)/

/**
 * ---- WHAT ONE LINE SHOWS ----
 *
 * Returns null for a line that does not move the play (the crowd, the weather,
 * a coach's note, a substitution): the pitch holds the shape it had.
 */
export function readLine(e: MatchEvent, i: number, homeId: string, prev: Phase | null, next?: MatchEvent): Phase | null {
  const p = readLine0(e, i, homeId, prev, next)
  const mk = e.v?.move_k
  if (p && typeof mk === 'string') p.move = mk
  return p
}

function readLine0(e: MatchEvent, i: number, homeId: string, prev: Phase | null, next?: MatchEvent): Phase | null {
  const s = stem(e.k)
  /** the key with its number: 'flav9' and 'flav3' are different moments */
  const raw = (e.k ?? '').replace(/^comm\./, '').replace(/_f$/, '')
  const isHome = e.teamId === homeId
  const known = !!e.teamId
  const fld = e.fld ?? prev?.x ?? 50
  const prevY = prev?.y ?? 35
  // the side with the ball: the line's own side, or the other one when the
  // line is about the defence
  const defLine = DEFENDING.test(raw)
  const homeBall = known ? (defLine ? !isHome : isHome) : (prev?.homeBall ?? true)
  const dir = homeBall ? 1 : -1
  // across the field, the ball wanders from where it was rather than jumping
  const drift = (span: number, lo = 9, hi = 61) => clamp(prevY + (wob(i, 1) - 0.5) * span, lo, hi)
  const base = { homeBall, x: clamp(fld, 1, 99), at: i, carrier: e.playerId }

  // ---- the score and the cards first: they are what the banner is for
  if (e.type === 'TRY' || s.startsWith('penTry')) {
    const pen = s.startsWith('penTry')
    // a try is grounded over the line it was scored at, wherever the engine
    // last had the ball; a penalty try under the posts
    const y = pen ? 35 : clamp(prevY + (wob(i, 2) - 0.5) * 30, 6, 64)
    return { ...base, homeBall: isHome, kind: 'try', x: isHome ? 101.5 : -1.5, y, label: 'lp.try',
      banner: { kind: pen ? 'pentry' : 'try', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.type === 'CON' || s === 'conWide' || s === 'conPost') {
    const good = e.type === 'CON'
    // in line with the try, fifteen to twenty metres out
    const ty = prev?.kind === 'try' || prev?.kind === 'con' ? prev.y : 35
    const y = clamp(ty, 10, 60)
    const out = 15 + Math.abs(y - 35) * 0.25
    return { ...base, homeBall: isHome, kind: 'con', x: isHome ? 100 - out : out, y, good, label: 'lp.con',
      to: { x: isHome ? 104 : -4, y: good ? 35 : 35 + (wob(i, 3) < 0.5 ? -6 : 6) }, hang: 9,
      banner: { kind: good ? 'con' : 'conMiss', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.type === 'PEN' || e.type === 'DG' || s.startsWith('penWide') || s.startsWith('penPost') || s.startsWith('dropMiss')) {
    const good = e.type === 'PEN' || e.type === 'DG'
    const drop = e.type === 'DG' || s.startsWith('dropMiss')
    const x = clamp(fld, isHome ? 50 : 8, isHome ? 92 : 50)
    const y = drop ? drift(16, 18, 52) : clamp(prevY, 12, 58)
    return { ...base, homeBall: isHome, kind: 'goal', x, y, good, label: drop ? 'lp.drop' : 'lp.goalKick',
      to: { x: isHome ? 104 : -4, y: good ? 35 : 35 + (wob(i, 3) < 0.5 ? -7 : 7) }, hang: drop ? 7 : 10,
      banner: { kind: drop ? (good ? 'dg' : 'dgMiss') : (good ? 'pen' : 'penMiss'), teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.type === 'YC' || e.type === 'RC') {
    // the play stops where it was; the man walks
    return { ...(prev ?? { ...base, kind: 'penalty', y: prevY, label: 'lp.penalty' }), at: i, kind: 'penalty', label: 'lp.penalty',
      banner: { kind: e.type === 'YC' ? 'yc' : 'rc', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.fx === 'NOTRY' || s.startsWith('tmoNoTry')) {
    return { ...base, homeBall: isHome, kind: 'heldup', x: isHome ? 99 : 1, y: prevY, label: 'lp.tmo',
      banner: { kind: 'notry', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.fx === 'TMO' || s.startsWith('tmoReview')) {
    return { ...base, homeBall: isHome, kind: 'heldup', x: isHome ? 101 : -1, y: prevY, label: 'lp.tmo' }
  }

  // ---- the whistles
  if (e.type === 'KO') {
    return kickoff(base, isHome || !known, i, 'lp.kickoff', next)
  }
  if (s.startsWith('restart')) return kickoff({ ...base }, isHome, i, 'lp.restart', next)
  if (e.type === 'HT' || e.type === 'FT' || e.type === 'BRK') {
    return { ...base, kind: 'break', x: 50, y: 35, label: e.type === 'FT' ? 'lp.fullTime' : e.type === 'HT' ? 'lp.halfTime' : 'lp.break' }
  }

  // ---- set piece
  if (e.fx === 'SCRUM' || s.startsWith('scrum') || s.startsWith('moveCallSc') || s.startsWith('fk_scrum') || s.startsWith('off_scrum') || s.startsWith('chargeScrum') || s.startsWith('tmoFwdScrum')) {
    const pen = s.startsWith('off_') || s.startsWith('fk_')
    return { ...base, kind: pen ? 'penalty' : 'scrum', y: clamp(drift(12), 15, 55), label: pen ? 'lp.penalty' : 'lp.scrum' }
  }
  if (e.fx === 'LINEOUT' || s.startsWith('lineout') || s.startsWith('moveCallLo') || s.startsWith('fk_lineout') || s.startsWith('off_lineout') || s.startsWith('off_lifter') || s.startsWith('chargeLineout') || raw === 'flav9' || raw === 'flav18' || raw === 'flav13') {
    const pen = s.startsWith('off_') || s.startsWith('fk_')
    // the throw is on the touchline nearer the ball, and a maul set off it
    const maul = raw === 'lineout5'
    return { ...base, kind: pen ? 'penalty' : maul ? 'maul' : 'lineout', y: prevY < 35 ? 0 : 70, label: pen ? 'lp.penalty' : maul ? 'lp.maul' : 'lp.lineout' }
  }
  if (e.fx === 'MAUL' || raw === 'flav6' || s.startsWith('off_maul') || s === 'tryMaulRumbles' || s === 'tryPackDrive') {
    const y = prev?.kind === 'lineout' ? (prev.y < 35 ? 8 : 62) : drift(8)
    return { ...base, kind: 'maul', y, label: 'lp.maul' }
  }

  // ---- the quick tap, and the penalty for not being back ten that it draws
  if (s === 'quickTapPhases' || s === 'quickTapMid') return { ...base, kind: 'carry', y: prevY, label: 'lp.quickTap' }
  if (s === 'notBackTen') return { ...base, kind: 'penalty', y: prevY, label: 'lp.notBackTen' }
  // ---- penalties and free kicks in open play
  if (s.startsWith('off_') || s.startsWith('fk_') || s === 'penKickableAsk' || raw === 'flav4') {
    return { ...base, kind: 'penalty', y: drift(6), label: 'lp.penalty' }
  }
  if (s === 'penTouchOwnHalf') {
    return { ...base, kind: 'kick', y: prevY, to: { x: clamp(fld + dir * 28, 3, 97), y: prevY < 35 ? -1 : 71 }, hang: 8, label: 'lp.kickTouch' }
  }

  // ---- kicks: off the boot here, down where the next line picks it up
  if (s.startsWith('kick') && !s.startsWith('kickField') || raw === 'flav7' || raw === 'flav10' || raw === 'flav17' || s === 'gldo' || s.startsWith('chargeDown')) {
    if (s === 'gldo') {
      const x = isHome ? 1 : 99
      return { ...base, homeBall: isHome, kind: 'dropout', x, y: 35, to: { x: clamp(x + (isHome ? 1 : -1) * 32, 3, 97), y: drift(30) }, hang: 14, label: 'lp.dropout' }
    }
    if (s.startsWith('chargeDown')) return { ...base, kind: 'carry', y: drift(6), label: 'lp.chargeDown' }
    const touch = s.startsWith('kickTouch') || s.startsWith('kickExit') || raw === 'flav7'
    const box = s.startsWith('kickBox')
    const up = s.startsWith('kickUp') || raw === 'flav17'
    const pin = s.startsWith('kickPin') || raw === 'flav10'
    const dist = touch ? 30 : box ? 22 : up ? 24 : pin ? 30 : 38
    const nx = next?.fld
    // the next line knows where it landed; trust it when it is downfield
    let tx = nx != null && (nx - fld) * dir > 5 ? nx : fld + dir * dist
    tx = clamp(tx, pin ? -3 : 2, pin ? 103 : 98)
    const ty = touch ? (prevY < 35 ? -1 : 71) : drift(26, 6, 64)
    return { ...base, kind: 'kick', y: prevY, to: { x: tx, y: ty }, hang: box || up ? 18 : touch ? 9 : pin ? 2 : 13,
      label: touch ? 'lp.kickTouch' : box ? 'lp.boxKick' : up ? 'lp.upAndUnder' : pin ? 'lp.grubber' : 'lp.kick' }
  }
  if (s.startsWith('kickField') || raw === 'flav5' || raw === 'flav20') {
    return { ...base, kind: 'catch', y: prev?.to?.y != null ? clamp(prev.to.y, 4, 66) : prevY, x: prev?.to?.x != null ? clamp(prev.to.x, 1, 99) : base.x, label: 'lp.catch' }
  }

  // ---- open play
  if (s.startsWith('pbpRuck') || s.startsWith('pbpPhases') || raw === 'flav3' || raw === 'flav16' || s.startsWith('pbpWet') || s.startsWith('day_breakdown')) {
    if (s.startsWith('day_')) return null
    return { ...base, kind: 'ruck', y: drift(10), label: s.startsWith('pbpPhases') ? 'lp.phases' : raw === 'flav3' ? 'lp.turnover' : 'lp.ruck',
      n: typeof e.v?.n === 'number' ? e.v.n : undefined }
  }
  if (s.startsWith('pbp') || s.startsWith('move') || s.startsWith('flav') || s.startsWith('defSet') || s.startsWith('defHit') || s.startsWith('heldUp') || s.startsWith('chargeRegather') || s.startsWith('chargeSafe') || raw.startsWith('styles.cAtk') || raw.startsWith('styles.cTurn') || s.startsWith('tryInter')) {
    if (s.startsWith('heldUp')) return { ...base, kind: 'heldup', x: homeBall ? 100.5 : -0.5, y: prevY, label: 'lp.heldUp' }
    const tackled = s.startsWith('defHit') || s.startsWith('defSet')
    // a carry in the 22 is near the posts, a run from deep starts wide
    return { ...base, kind: tackled ? 'ruck' : 'carry', y: drift(tackled ? 8 : 18), label: tackled ? 'lp.tackle' : 'lp.carry' }
  }
  return null
}

function kickoff(base: { homeBall: boolean; x: number; at: number; carrier?: number }, kickerHome: boolean, i: number, label: string, next?: MatchEvent): Phase {
  const d = kickerHome ? 1 : -1
  // it comes down where the next line picks the play up, when that is in
  // the receivers' half; otherwise a standard restart
  const nx = next?.fld
  const tx = nx != null && (nx - 50) * d > 10 ? clamp(nx, 4, 96) : 50 + d * (14 + wob(i, 4) * 14)
  return { ...base, homeBall: kickerHome, kind: 'kickoff', x: 50, y: 35,
    to: { x: tx, y: 35 + (wob(i, 5) - 0.5) * 36 }, hang: 16, label }
}

/** the shape after the first `upto` lines: the latest phase, the banner that
 *  belongs to the newest line if it has one, and the possession run's length */
export function phaseAt(events: MatchEvent[], upto: number, homeId: string): Phase {
  let cur: Phase | null = null
  for (let i = 0; i < Math.min(upto, events.length); i++) {
    const p = readLine(events[i], i, homeId, cur, events[i + 1])
    if (p) cur = p
  }
  return cur ?? { kind: 'kickoff', homeBall: true, x: 50, y: 35, at: -1, label: 'lp.kickoff' }
}
