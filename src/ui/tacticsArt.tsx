import type { CSSProperties, ReactNode } from 'react'
import type { Club, GameState } from '../game/model'
import { XV_SLOTS } from '../game/model'
import { BRIEF_BY_ID, benchSeats, briefForSeat, isForward, type Brief } from '../game/bench'
import { t } from '../game/i18n'
import { Jersey, PosBadge } from './components'
import { IcoBreak, IcoBurst, IcoClock, IcoLineout, IcoRecharge, IcoShield, IcoShirt, IcoStopwatch } from './icons'

/* ---- THE SET PIECE AND THE BENCH, DRAWN (1.8.0) ----
 *
 * Owner: "I want to work on Set Piece / Bench & Prep... I want them to be more
 * visual." Every call on those pages was a name and a sentence, and a lineout
 * call is a picture a coach draws on a whiteboard before he says a word about
 * it. So each one is drawn here, the way the highlight pitch draws the game:
 * mown grass, white chalk, our men in white, theirs in dark, and the call
 * itself in yellow.
 *
 * These are pictures of what the option MEANS, never of what the engine rolls:
 * the engine reads the option's id and nothing drawn here feeds back into it.
 * Every diagram is aria-hidden because it always sits inside a button that
 * already says, in words, what it is.
 *
 * One frame for all of them, 120 x 80, so a lineout, a scrum and a kick sit
 * the same size side by side. We always attack to the RIGHT. */

const W = 120
const H = 80

const st = (fill: string, stroke?: string, w?: number): CSSProperties =>
  ({ fill, stroke: stroke ?? 'none', strokeWidth: w })

/** the frame: striped grass, and whatever lines the picture needs */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg className="dg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <rect key={i} x={i * 20} y={0} width={20.5} height={H} style={st(i % 2 ? 'var(--hl-grass-b)' : 'var(--hl-grass-a)')} />
      ))}
      {children}
    </svg>
  )
}

const chalk = (w = 1): CSSProperties => ({ fill: 'none', stroke: 'var(--dg-chalk)', strokeWidth: w })
const soft = (w = 0.8): CSSProperties => ({ fill: 'none', stroke: 'var(--dg-chalk-soft)', strokeWidth: w, strokeDasharray: '2.5 2.5' })

/** a player, seen from above */
const Us = ({ x, y, r = 3 }: { x: number; y: number; r?: number }) =>
  <circle cx={x} cy={y} r={r} style={st('var(--dg-us)', 'var(--dg-us-edge)', 0.6)} />
const Them = ({ x, y, r = 3 }: { x: number; y: number; r?: number }) =>
  <circle cx={x} cy={y} r={r} style={st('var(--dg-them)', 'var(--dg-them-edge)', 0.7)} />
/** the man the call is about */
const Key = ({ x, y, r = 4.6, dashed }: { x: number; y: number; r?: number; dashed?: boolean }) =>
  <circle cx={x} cy={y} r={r} style={{ fill: 'none', stroke: 'var(--dg-move)', strokeWidth: 1.3, strokeDasharray: dashed ? '1.6 1.6' : undefined }} />
const Ball = ({ x, y }: { x: number; y: number }) =>
  <ellipse cx={x} cy={y} rx={2.2} ry={1.4} style={st('var(--hl-ball)', 'var(--hl-ball-edge)', 0.5)} />

/** A move: a curve from one point to another with its own arrowhead (drawn,
 *  not a <marker>, so twenty diagrams on a page share no ids). `bend` pushes
 *  the curve's middle sideways; `dash` for a kick in the air or a ball thrown. */
function Move({ x1, y1, x2, y2, bend = 0, dash, w = 1.6, head = 3.2, faint }: {
  x1: number; y1: number; x2: number; y2: number; bend?: number; dash?: boolean; w?: number; head?: number; faint?: boolean
}) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  // the control point sits `bend` units off the chord's midpoint
  const cx = mx - ((y2 - y1) / len) * bend, cy = my + ((x2 - x1) / len) * bend
  // the arrowhead follows the curve's direction where it arrives
  const a = Math.atan2(y2 - cy, x2 - cx)
  const p = (da: number) => `${x2 - head * Math.cos(a + da)},${y2 - head * Math.sin(a + da)}`
  const style: CSSProperties = { fill: 'none', stroke: 'var(--dg-move)', strokeWidth: w, strokeLinecap: 'round', strokeDasharray: dash ? '2.4 2' : undefined }
  return (
    <g opacity={faint ? 0.55 : 1}>
      <path d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} style={style} />
      <polygon points={`${x2},${y2} ${p(0.45)} ${p(-0.45)}`} style={st('var(--dg-move)')} />
    </g>
  )
}

/** where a kick goes out: a small cross on the touchline */
const Out = ({ x, y }: { x: number; y: number }) =>
  <path d={`M${x - 2} ${y - 2} L${x + 2} ${y + 2} M${x - 2} ${y + 2} L${x + 2} ${y - 2}`} style={{ stroke: 'var(--dg-move)', strokeWidth: 1.3, strokeLinecap: 'round' }} />
/** where a kick comes down */
const Land = ({ x, y }: { x: number; y: number }) =>
  <circle cx={x} cy={y} r={3.2} style={{ fill: 'none', stroke: 'var(--dg-move)', strokeWidth: 1, strokeDasharray: '1.4 1.2' }} />

// ---------------------------------------------------------------------------
// Lineout: the touchline across the top, the 5 m and 15 m lines under it, our
// file on the left of the line of touch and theirs on the right. The hooker
// throws from the touchline; the yellow ring is the man it is thrown to.
// ---------------------------------------------------------------------------

// the lineout is drawn close up: six a side between the 5 m line and the 15 m
const LO_FILE = [22, 30, 38, 46, 54, 62]
const LO_JUMP: Record<string, number> = { lo_front: 30, lo_middle: 46, lo_back: 62, lo_dummy: 62, lo_maul: 38, lo_top: 38 }
const R = 3.2

export function LineoutDiagram({ call }: { call: string }) {
  const jy = LO_JUMP[call] ?? 46
  const maul = call === 'lo_maul'
  // a maul binds round the catcher; every other call stands in a file
  const ours: [number, number][] = maul
    ? [[52, 30], [52, 38], [52, 46], [45, 34], [45, 42], [38, 38]]
    : LO_FILE.map(y => [52, y])
  // the 9 stands off the file, level with where the ball comes down
  const nine: [number, number] = [36, Math.min(jy + 8, 66)]
  return (
    <Frame>
      <rect x={0} y={0} width={W} height={9} style={st('var(--dg-shade)')} />
      <line x1={0} y1={9} x2={W} y2={9} style={chalk(1.3)} />
      <line x1={0} y1={17} x2={W} y2={17} style={soft()} />
      <line x1={0} y1={68} x2={W} y2={68} style={soft()} />
      {LO_FILE.map(y => <Them key={y} x={maul ? 60 : 62} y={y} r={R} />)}
      {ours.map(([x, y], i) => <Us key={i} x={x} y={y} r={R} />)}
      {/* the hooker on the touchline, the 9 by the file, the 10 and 12 */}
      <Us x={57} y={4.5} r={R} />
      {!maul && <Us x={nine[0]} y={nine[1]} r={R} />}
      <Us x={20} y={72} r={R} /><Us x={8} y={77} r={R} />
      <Them x={84} y={70} r={R} /><Them x={100} y={76} r={R} />
      {/* the dummy: a jump at the front that the ball never goes to */}
      {call === 'lo_dummy' && <Key x={52} y={30} r={6} dashed />}
      <Key x={52} y={jy} r={6} />
      <Move x1={57} y1={8} x2={55} y2={jy - 4} bend={-4} dash w={1.2} />
      {(call === 'lo_front' || call === 'lo_middle') &&
        <Move x1={48} y1={jy + 3} x2={39.5} y2={nine[1] - 2.5} bend={-2} w={1.5} />}
      {(call === 'lo_back' || call === 'lo_dummy') && <>
        <Move x1={48} y1={jy + 2} x2={39.5} y2={nine[1] - 1} w={1.5} />
        <Move x1={33} y1={nine[1] + 2} x2={23} y2={70} w={1.5} />
      </>}
      {call === 'lo_top' && <>
        {/* straight down off the top, and away to the backs in two passes */}
        <Move x1={48} y1={jy + 2} x2={39.5} y2={nine[1] - 2} w={1.5} />
        <Move x1={33} y1={nine[1] + 2} x2={23} y2={69.5} w={1.5} />
        <Move x1={17} y1={73.5} x2={11} y2={75.5} w={1.5} head={2.4} />
      </>}
      {maul && <Move x1={58} y1={38} x2={96} y2={38} w={4} head={5.5} />}
      <Ball x={52} y={jy - 7.5} />
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// Scrum: our eight on the left driving right (3-4-1: props and hooker, locks
// and flankers, the No. 8), theirs mirrored, the 9 at the put-in.
// ---------------------------------------------------------------------------

const SC_US: [number, number][] = [[53, 30], [53, 40], [53, 50], [45, 35], [45, 45], [45, 24], [45, 56], [37, 40]]

export function ScrumDiagram({ call }: { call: string }) {
  return (
    <Frame>
      <line x1={60} y1={4} x2={60} y2={76} style={soft()} />
      {SC_US.map(([x, y], i) => <Them key={i} x={120 - x} y={y} r={R} />)}
      {SC_US.map(([x, y], i) => <Us key={i} x={x} y={y} r={R} />)}
      {/* the 9 at the put-in and the 10 outside him */}
      <Us x={50} y={12} r={R} />
      <Us x={26} y={9} r={R} />
      {call === 'sc_channel1' && <>
        <Move x1={57} y1={36} x2={51} y2={17} bend={-3} w={1.5} />
        <Move x1={46} y1={11.5} x2={30.5} y2={9} w={1.5} />
        <Ball x={57} y={40} />
      </>}
      {call === 'sc_hold' && <>
        <Move x1={58} y1={40} x2={43} y2={40} dash w={1.2} />
        <Ball x={41} y={40} />
        <Key x={41} y={40} r={5} />
      </>}
      {call === 'sc_shove' && <>
        {[30, 40, 50].map(y => <Move key={y} x1={26} y1={y} x2={82} y2={y} w={2.2} head={4} />)}
      </>}
      {call === 'sc_wheel' && <>
        {/* the scrum turned, then the No. 8 away off the side */}
        <Move x1={40} y1={18} x2={74} y2={64} bend={-20} w={1.8} head={3.6} />
        <Key x={37} y={40} r={6} />
        <Move x1={35} y1={46} x2={58} y2={74} bend={10} w={1.5} />
      </>}
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// The whole pitch, for kicks: our line on the left, theirs on the right, the
// 22s, halfway and the posts. A dashed yellow line is a ball in the air, a
// ring is where it comes down, a cross is where it goes out.
// ---------------------------------------------------------------------------

function Pitch({ children }: { children: ReactNode }) {
  // 1.12 units a metre along, 72 units for the 70 metres across; the same
  // lines the highlight pitch draws (HighlightClip drawField): the 5 m, 22,
  // 10 m and halfway lines, the 5 m and 15 m dashes, and posts 5.6 m apart
  return (
    <Frame>
      <rect x={0} y={4} width={W} height={72} style={chalk(0.9)} />
      {[4, 116].map(x => <line key={x} x1={x} y1={4} x2={x} y2={76} style={chalk(1.1)} />)}
      {[28.6, 91.4].map(x => <line key={x} x1={x} y1={4} x2={x} y2={76} style={chalk(0.8)} />)}
      <line x1={60} y1={4} x2={60} y2={76} style={chalk(1)} />
      {[48.8, 71.2, 9.6, 110.4].map(x => <line key={x} x1={x} y1={4} x2={x} y2={76} style={soft(0.6)} />)}
      {TOUCH_DASHES.map(y => <line key={y} x1={4} y1={y} x2={116} y2={y} style={soft(0.5)} />)}
      {[4, 116].map(x => <Posts key={x} x={x} />)}
      {children}
    </Frame>
  )
}

/** The 5 m and 15 m lines in from each touchline, on the 72-unit width. */
const TOUCH_DASHES = [9.1, 19.4, 60.6, 70.9]
/** Posts seen from above: 5.6 m apart, centred on the 35 m line. */
const Posts = ({ x }: { x: number }) => <g>
  <line x1={x} y1={37.1} x2={x} y2={42.9} style={{ stroke: 'var(--dg-chalk)', strokeWidth: 2 }} />
  <circle cx={x} cy={37.1} r={1.1} style={st('var(--dg-chalk)')} />
  <circle cx={x} cy={42.9} r={1.1} style={st('var(--dg-chalk)')} />
</g>

export function ExitDiagram({ id }: { id: string }) {
  return (
    <Pitch>
      {id === 'box' && <>
        <Us x={15} y={60} />
        <Move x1={16} y1={58} x2={45} y2={66} bend={-14} dash />
        <Land x={46} y={66.5} />
        <Us x={30} y={70} /><Them x={50} y={62} />
        <Move x1={31.5} y1={70.5} x2={41} y2={69.5} w={1} head={2} />
      </>}
      {id === 'long' && <>
        <Us x={18} y={44} />
        <Move x1={20} y1={43} x2={74} y2={6} bend={-10} dash />
        <Out x={75} y={4} />
      </>}
      {id === 'counter' && <>
        <Us x={16} y={46} />
        <path d="M18 46 L30 38 L42 46 L56 38" style={{ fill: 'none', stroke: 'var(--dg-move)', strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        <Move x1={56} y1={38} x2={66} y2={42} w={1.6} />
        <Us x={26} y={52} /><Us x={36} y={54} />
        <Them x={40} y={32} /><Them x={52} y={50} />
      </>}
      {id === 'fifty22' && <>
        <Us x={22} y={40} />
        <Move x1={24} y1={39} x2={96} y2={62} bend={-12} dash />
        <circle cx={96} cy={62} r={1.4} style={st('var(--dg-move)')} />
        <Move x1={96.5} y1={63} x2={101} y2={74} w={1.1} />
        <Out x={101.5} y={76} />
      </>}
    </Pitch>
  )
}

export function KickStyleDiagram({ id }: { id: string }) {
  const all = id === 'balanced'
  return (
    <Pitch>
      <Us x={58} y={42} />
      {(id === 'territory' || all) && <>
        <Move x1={60} y1={41} x2={100} y2={75} bend={8} dash faint={all} />
        <Out x={100.5} y={76} />
      </>}
      {(id === 'contest' || all) && <>
        <Move x1={60} y1={40} x2={82} y2={30} bend={-10} dash faint={all} />
        <Land x={83} y={29.5} />
        {!all && <><Us x={74} y={24} /><Them x={87} y={27} /></>}
      </>}
      {(id === 'attack' || all) && <>
        {/* a grubber skids along the ground; a cross-kick finds the wing */}
        <path d="M61 44 q3 -2.5 6 0 q3 -2.5 6 0 q3 -2.5 6 0" style={{ fill: 'none', stroke: 'var(--dg-move)', strokeWidth: 1.2, strokeLinecap: 'round' }} opacity={all ? 0.55 : 1} />
        {!all && <>
          <Move x1={60} y1={39} x2={106} y2={11} bend={-8} dash />
          <Us x={108} y={10} />
          <Them x={70} y={36} /><Them x={78} y={48} />
        </>}
      </>}
    </Pitch>
  )
}

/** Their half only, halfway on the left and their line on the right: a
 *  penalty is a decision made in their territory, so the picture spends its
 *  width there rather than on eighty metres nobody is kicking across.
 *
 *  TO SCALE (1.8.1, owner: "the pitch markings on the kickable penalties are
 *  wrong"). The lines were placed by eye: the "15 m" lines sat eleven metres
 *  in, there were no 5 m lines, the posts were ten metres apart, and the
 *  frame's own edge drew a line beyond halfway. Now 2 units a metre along
 *  (halfway at 4, the 10 m line at 24, the 22 at 60, the 5 m line at 94, the
 *  try line at 104, a 6 m in-goal to the dead-ball line at 116) and the same
 *  72 units across as the full pitch. */
function HalfPitch({ children }: { children: ReactNode }) {
  return (
    <Frame>
      {[4, 76].map(y => <line key={y} x1={0} y1={y} x2={116} y2={y} style={chalk(0.9)} />)}
      <line x1={116} y1={4} x2={116} y2={76} style={chalk(0.9)} />
      <line x1={4} y1={4} x2={4} y2={76} style={chalk(1.1)} />
      <line x1={24} y1={4} x2={24} y2={76} style={soft()} />
      <line x1={60} y1={4} x2={60} y2={76} style={chalk(0.8)} />
      <line x1={94} y1={4} x2={94} y2={76} style={soft(0.6)} />
      <line x1={104} y1={4} x2={104} y2={76} style={chalk(1.1)} />
      {TOUCH_DASHES.map(y => <line key={y} x1={4} y1={y} x2={104} y2={y} style={soft(0.5)} />)}
      <Posts x={104} />
      {children}
    </Frame>
  )
}

export function PenaltyDiagram({ id }: { id: string }) {
  const ask = id === 'ask'
  // the mark: inside kicking range, off centre
  const mx = 58, my = 30
  return (
    <HalfPitch>
      <Us x={mx} y={my} />
      {(id === 'posts' || ask) && <>
        <Move x1={mx + 3} y1={my + 1} x2={103} y2={40} bend={-6} dash faint={ask} />
      </>}
      {(id === 'corner' || ask) && <>
        {/* to touch five metres out, where the lineout is thrown */}
        <Move x1={mx + 2} y1={my - 2.5} x2={94} y2={5} bend={5} dash faint={ask} />
        <Out x={94.5} y={4} />
        {!ask && <>
          <Us x={94} y={12} /><Us x={94} y={17} /><Us x={90} y={14.5} /><Us x={90} y={9.5} />
          <Move x1={97.5} y1={14} x2={109} y2={14} w={2.6} head={3.6} />
        </>}
      </>}
      {(id === 'tap' || ask) && <>
        <Move x1={mx + 3} y1={my + 3} x2={107} y2={my + 16} bend={3} w={1.8} faint={ask} />
        {!ask && <><Us x={52} y={38} /><Us x={50} y={24} /><Us x={48} y={44} /></>}
      </>}
    </HalfPitch>
  )
}

// ---------------------------------------------------------------------------
// The icons that stand for a brief and a week's preparation
// ---------------------------------------------------------------------------

const BRIEF_ICON = { shirt: IcoShirt, burst: IcoBurst, shield: IcoShield, clock: IcoClock }

/** A bench brief's icon, sized to the text beside it. Used on the bench page
 *  and the live substitution sheet, so the two always agree. */
export function BriefIcon({ brief }: { brief: Brief }) {
  const I = BRIEF_ICON[BRIEF_BY_ID[brief]?.icon ?? 'shirt']
  return <span className="brief-ico"><I /></span>
}

export const PREP_ICON = { attack: IcoBreak, defence: IcoShield, setpiece: IcoLineout, fitness: IcoStopwatch, recovery: IcoRecharge }

// ---------------------------------------------------------------------------
// The 23: the fifteen in their shape, the eight on the bench
// ---------------------------------------------------------------------------

/** Where each shirt stands, in percent of the panel. A team-sheet shape rather
 *  than the Roles pitch's: no row holds more than three men, so every surname
 *  has a third of the width and none of them has to be cut short. */
const XV_AT: Record<number, [number, number]> = {
  1: [22, 3], 2: [50, 3], 3: [78, 3],
  4: [37, 17], 5: [63, 17],
  6: [16, 31], 8: [50, 31], 7: [84, 31],
  9: [36, 46], 10: [64, 46],
  12: [30, 61], 13: [70, 61],
  11: [16, 75], 15: [50, 83], 14: [84, 75],
}

const surname = (name: string) => name.split(' ').slice(-1)[0]

export function TheTwentyThree({ game, club }: { game: GameState; club: Club }) {
  const tac = club.tactic
  const seats = benchSeats(club)
  return (
    <div className="b23">
      <div className="b23-pitch" role="list" aria-label={t('tacticsScreen.b23Xv')}>
        {XV_SLOTS.map((slot, i) => {
          const pid = tac.lineup[i]
          const p = pid != null ? game.players[pid] : null
          const [x, y] = XV_AT[slot.shirt]
          return (
            <div key={i} role="listitem" className="b23-man" style={{ '--fx': `${x}%`, '--fy': `${y}%` } as CSSProperties}>
              <span className="b23-kit"><Jersey club={club} size={28} /><span className="b23-num">{slot.shirt}</span></span>
              <span className="b23-name">{p ? surname(p.name) : '-'}</span>
            </div>
          )
        })}
      </div>
      <div className="b23-bench">
        <div className="fact-label">{t('tacticsScreen.b23Bench')}</div>
        <div className="b23-seats" role="list">
          {seats.map((seat, i) => {
            const pid = tac.lineup[15 + i]
            const p = pid != null ? game.players[pid] : null
            const b = briefForSeat(club, i)
            const fw = p ? isForward(p.pos) : isForward(seat.pos[0])
            return (
              <div key={i} role="listitem" className={`b23-seat${fw ? ' fw' : ''}`}>
                <span className="b23-kit"><Jersey club={club} size={24} /><span className="b23-num">{seat.shirt}</span></span>
                <span className="b23-sname">{p ? surname(p.name) : t('tacticsScreen.b23Empty')}</span>
                {p && <PosBadge pos={p.pos} />}
                <span className={`b23-brief${b === 'orders' ? '' : ' on'}`}>
                  <BriefIcon brief={b} /> {t(BRIEF_BY_ID[b].short)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** The bench's own clock: what the engine actually does and when. There are no
 *  planned substitution minutes in the game, so this draws the two rules that
 *  do exist, rather than a timeline of changes nobody has scheduled. */
export function BenchClock({ neutral }: { neutral: boolean }) {
  return (
    <div className="card bclock">
      <div className="fact-label">{t('tacticsScreen.bclockTitle')}</div>
      <div className="bclock-bar" aria-hidden="true">
        <span className="bclock-late" />
        <span className="bclock-ht" />
        <span className="bclock-mark" />
      </div>
      <div className="bclock-axis" aria-hidden="true">
        <span style={{ left: '0%' }}>0'</span>
        <span style={{ left: '50%' }}>40'</span>
        <span style={{ left: '80%' }}>64'</span>
        <span style={{ left: '100%' }}>80'</span>
      </div>
      <div className="meta" style={{ marginTop: 8 }}>
        {t(neutral ? 'tacticsScreen.bclockSplitNeutral' : 'tacticsScreen.bclockSplit')}
      </div>
      <div className="meta" style={{ marginTop: 4 }}>{t('tacticsScreen.bclockBriefs')}</div>
    </div>
  )
}

/** Eight pips for a split: filled for a forward's seat, open for a back's. */
export function SplitPips({ seats, label }: { seats: { pos: string[] }[]; label: string }) {
  return (
    <span className="split-pips" role="img" aria-label={label} title={label}>
      {seats.map((s, i) => <i key={i} className={['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(s.pos[0]) ? 'fw' : ''} />)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// THE ATTACKING MOVES (1.8.1, game/moves.ts), drawn the way a coach draws a
// move on the whiteboard: the set piece it comes off at the top left, the
// backline in its channels, their line waiting on the right, and the lines
// the men run in yellow. A solid line is a run, a dashed one the ball, a
// faint line a decoy; the ring is the man the move is built to put through.
// ---------------------------------------------------------------------------

/** our backline off a set piece: 9, 10, 12, 13, 15, 14 */
const BK: Record<string, [number, number]> = { n9: [34, 30], n10: [28, 39], n12: [23, 48], n13: [18, 57], n15: [10, 63], n14: [14, 71] }
const THEIR_LINE: [number, number][] = [[68, 32], [68, 42], [68, 52], [68, 62], [70, 71], [92, 56]]
const RUN: CSSProperties = { fill: 'none', stroke: 'var(--dg-move)', strokeWidth: 1.6, strokeLinecap: 'round' }

function SetPiece({ kind, top = 0 }: { kind: 'lineout' | 'scrum'; top?: number }) {
  const touch = <>
    <rect x={0} y={0} width={W} height={4} style={st('var(--dg-shade)')} />
    <line x1={0} y1={4} x2={W} y2={4} style={chalk(1.1)} />
  </>
  if (kind === 'lineout') return <>
    {touch}
    {[8, 13, 18, 23].map(y => <Us key={y} x={43} y={y} r={2.6} />)}
    {[8, 13, 18, 23].map(y => <Them key={y} x={49} y={y} r={2.6} />)}
  </>
  return <>
    {top > 0 && touch}
    {[[42, 13], [42, 19], [42, 25], [37, 16], [37, 22], [32, 19]].map(([x, y], i) => <Us key={i} x={x} y={y + top} r={2.6} />)}
    {[[48, 13], [48, 19], [48, 25], [53, 16], [53, 22], [58, 19]].map(([x, y], i) => <Them key={i} x={x} y={y + top} r={2.6} />)}
  </>
}

function Backs() {
  return <>{Object.entries(BK).map(([k, [x, y]]) => <Us key={k} x={x} y={y} r={2.8} />)}</>
}

/** A pod of forwards: the men, and a soft ring round them. */
function Pod({ x, y, n, across }: { x: number; y: number; n: number; across?: boolean }) {
  const pts = Array.from({ length: n }, (_, i) => {
    const o = (i - (n - 1) / 2) * 5.2
    return across ? [x + o, y] : [x + (n === 3 && i === 1 ? -2.4 : 0), y + o]
  })
  const long = 3.5 + n * 2.6
  return <>
    <ellipse cx={x} cy={y} rx={across ? long : 5.4} ry={across ? 5.4 : long} style={soft(0.7)} />
    {pts.map(([px, py], i) => <Us key={i} x={px} y={py} r={2.6} />)}
  </>
}

/** The ruck a phase is played off, with our 9 at it. */
const Ruck = ({ x, y }: { x: number; y: number }) => <>
  <circle cx={x} cy={y} r={3.6} style={soft(0.8)} />
  <Us x={x - 4} y={y} r={2.8} /><Ball x={x} y={y} />
</>

/** Every move the library has a picture for; a probe holds the two lists together. */
export const MOVE_DIAGRAMS = ['mv_1331', 'mv_242', 'mv_backdoor', 'mv_crash', 'mv_switch', 'mv_loop', 'mv_decoy', 'mv_blind', 'mv_inside', 'mv_strike13']

export function MoveDiagram({ id }: { id: string }) {
  const [x9, y9] = BK.n9, [x10, y10] = BK.n10, [x12, y12] = BK.n12, [x13, y13] = BK.n13
  const theirs = THEIR_LINE.map(([x, y], i) => <Them key={i} x={x} y={y} r={2.8} />)
  switch (id) {
    case 'mv_crash':
      return <Frame><SetPiece kind="lineout" /><Backs />{theirs}
        <Move x1={x9 - 2} y1={y9 + 2} x2={x10 + 2} y2={y10 - 2} dash w={1.1} head={2.4} />
        <Move x1={x10 - 1} y1={y10 + 3} x2={x12 + 2} y2={y12 - 2} dash w={1.1} head={2.4} />
        <Key x={x12} y={y12} />
        <Move x1={x12 + 3} y1={y12} x2={64} y2={y12 - 3} w={2.6} head={4} />
      </Frame>
    case 'mv_switch':
      return <Frame><SetPiece kind="scrum" /><Backs />{theirs}
        <Move x1={x10 + 2} y1={y10 + 2} x2={38} y2={58} bend={4} w={1.5} />
        <Move x1={x13 + 3} y1={y13 - 1} x2={66} y2={44} bend={-10} w={1.8} />
        <Move x1={37} y1={57} x2={40} y2={53} dash w={1.1} head={2.2} />
        <Key x={x13} y={y13} />
      </Frame>
    case 'mv_loop':
      return <Frame><SetPiece kind="lineout" /><Backs />{theirs}
        <Move x1={x10 - 1} y1={y10 + 3} x2={x12 + 2} y2={y12 - 2} dash w={1.1} head={2.4} />
        {/* the 10 loops round the back of the 12 and comes again outside him */}
        <path d={`M${x10 - 2} ${y10 + 1} C ${x10 - 12} ${y10 + 8}, ${x12 - 10} ${y12 + 14}, ${x12 + 6} ${y12 + 12}`} style={RUN} />
        <Move x1={x12 + 1} y1={y12 + 3} x2={x12 + 5} y2={y12 + 10} dash w={1.1} head={2.2} />
        <Move x1={x12 + 7} y1={y12 + 12} x2={64} y2={68} bend={-4} w={1.8} />
        <Key x={x10} y={y10} />
      </Frame>
    case 'mv_decoy':
      return <Frame><SetPiece kind="lineout" /><Backs />{theirs}
        <Key x={x12} y={y12} dashed />
        <Move x1={x12 + 3} y1={y12} x2={60} y2={y12 - 4} w={1.4} faint />
        <Move x1={x10 - 2} y1={y10 + 3} x2={x13 + 1} y2={y13 - 3} bend={6} dash w={1.1} head={2.4} />
        <Move x1={x13 + 3} y1={y13} x2={66} y2={66} bend={-4} w={1.8} />
        <Key x={x13} y={y13} />
      </Frame>
    case 'mv_blind':
      // the scrum near the touchline: the blind side is the short side above it
      return <Frame><SetPiece kind="scrum" top={7} />
        <Us x={30} y={38} r={2.8} /><Us x={24} y={46} r={2.8} /><Us x={20} y={55} r={2.8} /><Us x={24} y={12} r={2.8} />
        <Them x={64} y={10} r={2.8} /><Them x={68} y={40} r={2.8} /><Them x={68} y={52} r={2.8} />
        <Move x1={31} y1={26} x2={36} y2={14} bend={-3} w={1.5} />
        <Move x1={36} y1={12} x2={29} y2={11} dash w={1.1} head={2.2} />
        <Move x1={25} y1={9} x2={70} y2={7} bend={-7} w={1.8} />
        <Key x={24} y={12} />
      </Frame>
    case 'mv_inside':
      return <Frame><SetPiece kind="scrum" /><Backs />{theirs}
        <Move x1={x10 + 2} y1={y10 + 1} x2={44} y2={56} bend={3} w={1.5} />
        <Move x1={x12 + 3} y1={y12 + 2} x2={64} y2={40} bend={10} w={1.8} />
        <Move x1={43} y1={54} x2={45} y2={47} dash w={1.1} head={2.2} />
        <Key x={x12} y={y12} />
      </Frame>
    case 'mv_strike13':
      return <Frame><SetPiece kind="lineout" /><Backs />{theirs}
        <Move x1={x10 - 1} y1={y10 + 3} x2={x12 + 2} y2={y12 - 2} dash w={1.1} head={2.4} />
        <Move x1={x12 + 1} y1={y12 + 3} x2={x13 + 8} y2={y13 - 3} dash w={1.1} head={2.2} />
        <Move x1={x13 + 3} y1={y13} x2={68} y2={47} bend={-2} w={2} head={3.6} />
        <Key x={x13} y={y13} />
      </Frame>
    case 'mv_1331':
      // open play off a ruck in midfield: a forward on each edge and a pod of three either side
      return <Frame><Ruck x={42} y={40} />
        <Us x={34} y={6} r={2.6} /><Pod x={32} y={24} n={3} /><Pod x={32} y={56} n={3} /><Us x={34} y={74} r={2.6} />
        {[[64, 12], [62, 26], [60, 40], [62, 54], [64, 68]].map(([x, y], i) => <Them key={i} x={x} y={y} r={2.8} />)}
        <Move x1={38} y1={37} x2={33} y2={30} dash w={1.1} head={2.2} />
        <Move x1={36} y1={24} x2={56} y2={24} w={2.2} head={3.6} />
        <Move x1={36} y1={56} x2={56} y2={56} w={1.4} faint />
      </Frame>
    case 'mv_242':
      return <Frame><Ruck x={42} y={40} />
        <Pod x={34} y={10} n={2} /><Pod x={32} y={30} n={2} /><Pod x={32} y={50} n={2} /><Pod x={34} y={70} n={2} />
        <Us x={22} y={40} r={2.6} />
        {[[64, 12], [62, 28], [60, 40], [62, 52], [66, 68]].map(([x, y], i) => <Them key={i} x={x} y={y} r={2.8} />)}
        <Move x1={36} y1={42} x2={25} y2={41} dash w={1.1} head={2.2} />
        <Move x1={22} y1={43} x2={31} y2={64} bend={4} dash w={1.1} head={2.2} />
        <Move x1={38} y1={70} x2={62} y2={68} w={2} head={3.4} />
        <Key x={34} y={70} r={6} />
      </Frame>
    case 'mv_backdoor':
      return <Frame><Ruck x={42} y={30} />
        <Pod x={44} y={48} n={3} across />
        <Us x={30} y={50} r={2.8} /><Us x={22} y={60} r={2.8} /><Us x={16} y={70} r={2.8} />
        {[[64, 20], [60, 34], [60, 46], [60, 58], [64, 70]].map(([x, y], i) => <Them key={i} x={x} y={y} r={2.8} />)}
        <Move x1={39} y1={33} x2={43} y2={43} dash w={1} head={2} faint />
        <Move x1={36} y1={32} x2={31} y2={46} dash w={1.1} head={2.2} />
        <Move x1={30} y1={53} x2={23} y2={58} dash w={1.1} head={2.2} />
        <Move x1={25} y1={61} x2={62} y2={66} bend={-2} w={1.8} />
        <Key x={30} y={50} />
      </Frame>
    default:
      // no call: the shape stood up, nothing drawn on it
      return <Frame><SetPiece kind="lineout" /><Backs />{theirs}</Frame>
  }
}
