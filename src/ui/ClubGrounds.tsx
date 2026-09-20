import { FACILITY_INFO, MAX_FACILITY, type Club, type FacilityId } from '../game/model'
import { t } from '../game/i18n'
import {
  IcoAcademy, IcoBuild, IcoCart, IcoChart, IcoDeal, IcoMedical, IcoPitch,
  IcoTarget, IcoTraining,
} from './icons'

/**
 * ---- THE CLUB, AS A SITE PLAN ----
 *
 * Owner: "the problem is in the design asset, not the UI code... the current
 * estate artwork has been designed with sloping / tilted geometry... redesign
 * the estate artwork from the ground up" as a clean orthographic top-down
 * view, everything on one horizontal and vertical grid.
 *
 * WHY THE PAINTED TILES COULD NOT BE KEPT. The ten ladders were rendered in
 * isometric projection, and an isometric render cannot be turned into a plan:
 * the roofs hide the footprints, the walls are visible at all, and every
 * building is seen from one fixed corner. No transform undoes that, which is
 * exactly why the owner asked for the ASSET to change rather than the CSS. The
 * sprites stay in ./sprites, unreferenced - they are the owner's work and not
 * mine to delete - and because nothing imports them now, Vite stops emitting
 * them and the build loses about 862KB.
 *
 * WHY THIS IS DRAWN, when the last drawn estate was thrown out for looking
 * cheap. That one was isometric, and an isometric building is a solid: it
 * needs painted light on three faces to read as anything but a coloured box,
 * which is how it read. A plan is the opposite case. From above a stand IS a
 * rectangle, a road IS a straight band, a pitch IS a marked rectangle, and
 * what separates a good site plan from a bad one is whether the geometry is
 * exact. Code is better at exact geometry than any generated image, and every
 * line here is on the same two axes by construction - so the quality test the
 * owner set, is the pitch straight, are the stands parallel, are the roads
 * horizontal and vertical, cannot fail by accident.
 *
 * DEPTH WITHOUT TILT. Shadows fall one way on every building, roofs carry
 * parapets, rooflights and plant, the turf changes with the money spent on it.
 * Nothing is rotated: there is no rotate(), no skew(), and no coordinate in
 * this file that is not an axis-aligned rectangle on the site grid. That is
 * the distinction the brief draws between dimensional and tilted, made
 * structural rather than left to care.
 *
 * ---- THE GRID ----
 *
 * X runs right, Y runs down, in site units. Three columns and four rows with
 * roads between them, the ground on the middle block, the wall round the lot,
 * the car park along the front. Facilities differ in size and never in
 * orientation.
 */

/** The whole site, in site units. Everything below is a rectangle in these. */
const W = 412
const H = 316
/** Landscaping outside the wall: enough to breathe, not a void. The estate
 *  covers about 90% of the canvas, which is what the brief asks for. */
const PAD = 10

type Rect = { x: number; y: number; w: number; h: number }

/**
 * THE MASTERPLAN. Columns at 16/130/296, rows at 16/96/230/280, roads in the
 * gaps. The ground takes the middle block because it is the hero. The grass
 * sits along the top and left where it reads as open land; the buildings take
 * the right-hand column and the front, which is where a ground puts the things
 * the public touches.
 */
const PLAN: Record<FacilityId, Rect> = {
  academy: { x: 16, y: 16, w: 100, h: 66 },
  paddock: { x: 130, y: 16, w: 152, h: 66 },
  gym: { x: 296, y: 16, w: 100, h: 66 },
  kicking: { x: 16, y: 96, w: 100, h: 120 },
  /* The playing surface IS the ground's pitch - one place, two numbers. The
     stands come off the capacity the board buys and the turf off this
     facility's level, so the middle block draws both and a tap opens the
     surface. */
  pitch: { x: 130, y: 96, w: 152, h: 120 },
  briefing: { x: 296, y: 96, w: 100, h: 120 },
  recovery: { x: 16, y: 230, w: 100, h: 42 },
  hospitality: { x: 130, y: 230, w: 152, h: 42 },
  shop: { x: 296, y: 230, w: 100, h: 42 },
}
const CAR_PARK: Rect = { x: 16, y: 280, w: 380, h: 20 }

/** The four that are land rather than buildings. */
const GRASS = new Set<FacilityId>(['pitch', 'paddock', 'kicking', 'academy'])

const FAC_ICON: Record<FacilityId, () => JSX.Element> = {
  pitch: IcoPitch, gym: IcoTraining, recovery: IcoMedical, paddock: IcoBuild,
  kicking: IcoTarget, briefing: IcoChart, academy: IcoAcademy, shop: IcoCart,
  hospitality: IcoDeal,
}

/** Where the ground's six stages fall. Read as "this many seats or more". */
const GROUND_TIERS = [45_000, 26_000, 17_000, 11_000, 6_000]
const groundTier = (cap: number): number => {
  const i = GROUND_TIERS.findIndex(n => cap >= n)
  return i < 0 ? 0 : 5 - i
}

/** A rectangle inset on every side. The only shape-making this file does. */
const pad = (r: Rect, n: number): Rect =>
  ({ x: r.x + n, y: r.y + n, w: Math.max(1, r.w - n * 2), h: Math.max(1, r.h - n * 2) })

const R = (r: Rect, cls: string, rx = 0) =>
  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={rx} className={cls} />

/**
 * ---- GRASS ----
 *
 * The surface says what was spent on it without a number: bare ground at
 * nothing, rough grass at one, then markings, then the full set, then the
 * equipment a real session needs. Touchlines run horizontally and try lines
 * vertically - not as a matter of care, but because there is no other kind of
 * rectangle in this file.
 */
function Field({ r, lvl, marks = true }: { r: Rect; lvl: number; marks?: boolean }) {
  const turf = lvl === 0 ? 'p-earth' : lvl === 1 ? 'p-grass-poor' : 'p-grass'
  const p = pad(r, 5)
  return (
    <>
      {R(r, turf, 2)}
      {/* mowing bands, always horizontal, at a whisper of contrast: the thing
          that says "maintained" before a single marking does */}
      {lvl >= 2 && [0, 1, 2, 3].map(i => (
        <rect key={i} x={r.x} y={r.y + (r.h / 4) * i} width={r.w} height={r.h / 8} className="p-mow" />
      ))}
      {marks && lvl >= 2 && <Markings r={p} full={lvl >= 3} />}
      {/* sleds and pads, in a row, square to the touchline */}
      {lvl >= 4 && [0, 1, 2, 3].map(i => (
        <rect key={i} x={p.x + 5 + i * 9} y={p.y + p.h - 8} width={6} height={4} className="p-kit" />
      ))}
      {lvl >= 5 && R({ x: p.x + p.w - 24, y: p.y + 3, w: 21, h: 9 }, 'p-canopy', 2)}
    </>
  )
}

/** Rugby, from above: touchlines, try lines, a halfway line, the 22s and the
 *  posts. The set of marks that could not be any other sport. */
function Markings({ r, full }: { r: Rect; full: boolean }) {
  const inX = r.x + r.w * 0.12
  const outX = r.x + r.w * 0.88
  const mid = r.x + r.w / 2
  return (
    <g className="p-line">
      <rect x={r.x} y={r.y} width={r.w} height={r.h} />
      <line x1={inX} y1={r.y} x2={inX} y2={r.y + r.h} />
      <line x1={outX} y1={r.y} x2={outX} y2={r.y + r.h} />
      <line x1={mid} y1={r.y} x2={mid} y2={r.y + r.h} />
      {full && <>
        <line x1={r.x + r.w * 0.31} y1={r.y} x2={r.x + r.w * 0.31} y2={r.y + r.h} className="p-dash" />
        <line x1={r.x + r.w * 0.69} y1={r.y} x2={r.x + r.w * 0.69} y2={r.y + r.h} className="p-dash" />
      </>}
      {/* the posts: from directly above, a crossbar with an upright at each
          end. A bare line read as a stray dash. */}
      {[inX, outX].map((px, i) => (
        <g key={i}>
          <line x1={px} y1={r.y + r.h / 2 - 5} x2={px} y2={r.y + r.h / 2 + 5} className="p-post" />
          <circle cx={px} cy={r.y + r.h / 2 - 5} r="1.4" className="p-post-up" />
          <circle cx={px} cy={r.y + r.h / 2 + 5} r="1.4" className="p-post-up" />
        </g>
      ))}
    </g>
  )
}

/**
 * ---- THE KICKING ENCLOSURE ----
 *
 * It was drawn as a field with its markings suppressed, which left a plain
 * green rectangle: the one plot on the estate that said nothing about itself.
 * A kicking ground has its own marks, and they are not a pitch's - a single
 * set of posts at one end, distance arcs stepped back from them, and the ball
 * carts. Straight, like everything else here, and unmistakably not a pitch.
 */
function Kicking({ r, lvl }: { r: Rect; lvl: number }) {
  const p = pad(r, 6)
  const postY = p.y + 6
  return (
    <>
      <Field r={r} lvl={lvl} marks={false} />
      {lvl >= 1 && (
        <g className="p-line">
          {/* the posts, at the top of the enclosure, seen from above */}
          <line x1={p.x + p.w / 2 - 7} y1={postY} x2={p.x + p.w / 2 + 7} y2={postY} className="p-post" />
          <circle cx={p.x + p.w / 2 - 7} cy={postY} r="1.4" className="p-post-up" />
          <circle cx={p.x + p.w / 2 + 7} cy={postY} r="1.4" className="p-post-up" />
          {/* distance lines, stepped back from the posts */}
          {Array.from({ length: Math.min(4, lvl) }).map((_, i) => (
            <line key={i} x1={p.x + 4} y1={postY + 16 + i * 18} x2={p.x + p.w - 4} y2={postY + 16 + i * 18}
              className="p-dash" />
          ))}
        </g>
      )}
      {/* ball carts, in a row along the bottom edge and clear of the canopy:
          at level 5 the two used to land on the same corner and smear */}
      {lvl >= 3 && [0, 1].map(i => (
        <rect key={i} x={p.x + 5 + i * 11} y={p.y + p.h - 10} width={8} height={5} className="p-kit" />
      ))}
      {lvl >= 5 && R({ x: p.x + p.w - 22, y: p.y + p.h - 12, w: 18, h: 9 }, 'p-canopy', 2)}
    </>
  )
}

/**
 * ---- BUILDINGS ----
 *
 * A roof, from straight above. It grows across its plot as the level climbs
 * and gains what a bigger building has on top of it: rooflights, then plant,
 * then a landscaped roof. The shadow falls down and right on every one of
 * them, which is what makes the estate read as lit from one place rather than
 * as a collage.
 */
function Building({ r, lvl, water }: { r: Rect; lvl: number; water?: boolean }) {
  const hard = pad(r, 3)
  if (lvl === 0) return <>{R(hard, 'p-hard', 2)}{R(hard, 'p-plot', 2)}</>
  const frac = Math.min(0.94, 0.44 + lvl * 0.1)
  const bw = Math.round((water ? hard.w * 0.6 : hard.w) * frac)
  const bh = Math.round(hard.h * Math.min(0.86, frac + 0.04))
  const b: Rect = { x: hard.x + 2, y: hard.y + Math.round((hard.h - bh) / 2), w: bw, h: bh }
  /* A ROOF IS NOT ONE RECTANGLE. The first cut drew a pale slab with three
     full-width blue bars across it, which read as a wireframe rather than a
     building. What a roof actually has from above is a dark deck, a raised
     core over the stairs and lifts, rooflights that are short strips rather
     than stripes, and plant in a cluster near one edge. All of it is still
     axis-aligned; none of it is a stripe. */
  const long = b.w >= b.h
  const core: Rect = long
    ? { x: b.x + Math.round(b.w * 0.62), y: b.y + 4, w: Math.round(b.w * 0.26), h: Math.max(5, b.h - 8) }
    : { x: b.x + 4, y: b.y + Math.round(b.h * 0.62), w: Math.max(5, b.w - 8), h: Math.round(b.h * 0.26) }
  const lights = Math.min(4, 1 + lvl)
  return (
    <>
      {R(hard, 'p-hard', 2)}
      <rect x={b.x + 3} y={b.y + 3} width={b.w} height={b.h} className="p-shadow" rx={1} />
      {R(b, 'p-roof', 1)}
      {R(pad(b, 2), 'p-parapet', 1)}
      {lvl >= 2 && R(core, 'p-core', 1)}
      {/* rooflights: short, in a run along the long axis, never full width */}
      {lvl >= 2 && Array.from({ length: lights }).map((_, i) => (
        long
          ? <rect key={i} x={b.x + 5 + i * 8} y={b.y + Math.round(b.h * 0.3)} width={5}
            height={Math.max(3, Math.round(b.h * 0.34))} className="p-light" />
          : <rect key={i} x={b.x + Math.round(b.w * 0.3)} y={b.y + 5 + i * 8}
            width={Math.max(3, Math.round(b.w * 0.34))} height={5} className="p-light" />
      ))}
      {/* plant, in a cluster at one corner the way it is on a real roof */}
      {lvl >= 4 && [0, 1].map(i => (
        <rect key={i} x={b.x + b.w - 11 + i * 5} y={b.y + 4} width={4} height={5} className="p-plant" />
      ))}
      {lvl >= 5 && R({ x: b.x + 3, y: b.y + b.h - 8, w: Math.max(6, b.w - 20), h: 5 }, 'p-green', 1)}
      {water && lvl >= 2 && (
        <>
          <rect x={hard.x + bw + 6} y={hard.y + 8} width={Math.max(6, hard.w - bw - 10)}
            height={Math.max(6, hard.h - 16)} className="p-water" rx={1} />
          <rect x={hard.x + bw + 6} y={hard.y + 8} width={Math.max(6, hard.w - bw - 10)}
            height={Math.max(6, hard.h - 16)} className="p-water-edge" rx={1} />
        </>
      )}
    </>
  )
}

/**
 * ---- THE GROUND ----
 *
 * A rectangular rugby ground from above. The pitch is a conventional
 * rectangle with its touchlines horizontal; the stands are rectangles running
 * parallel to it, added a side at a time as the board buys seats. Never
 * rotated, never trapezoid. The six stages are capacity bands rather than a
 * facility level, because the board adds SEATS rather than levels:
 *
 *   0  under 6,000   an open pitch with banks
 *   1  6,000         a perimeter wall
 *   2  11,000        the main stand, down one touchline
 *   3  17,000        the far side, and floodlights at the corners
 *   4  26,000        both ends as well
 *   5  45,000+       a continuous roof round the bowl
 */
function Ground({ r, tier, surface }: { r: Rect; tier: number; surface: number }) {
  const bowl = pad(r, 2)
  const S = 15
  const inner = tier >= 2
    ? {
      x: bowl.x + (tier >= 4 ? S : 0),
      y: bowl.y + S,
      w: bowl.w - (tier >= 4 ? S * 2 : 0),
      h: bowl.h - (tier >= 3 ? S * 2 : S),
    }
    : pad(bowl, 5)

  /* A STAND, FROM ABOVE. The first cut drew three thick red lines across a
     grey band, which read as a barcode. What you actually see looking down on
     a stand is the roof deck, its leading edge over the front row, and the
     seating in the strip the roof does not cover - fine, close together, and
     in the club's colour only because that is what seats are. Four parts, all
     parallel to the touchline they serve. */
  /* A STAND, FROM ABOVE, IN THE RIGHT ORDER. The first cut laid the roof over
     the whole deck and then drew the seat rows on top of it, which is the one
     thing you cannot see from above - a roof hides its seats. What you do see
     is the roof over the back of the stand and the front rows in the strip it
     does not reach, with the eave line between them. Three bands, all parallel
     to the touchline, and the open strip always faces the pitch. */
  const Stand = ({ b, side }: { b: Rect; side: 'n' | 's' | 'w' | 'e' }) => {
    const horiz = side === 'n' || side === 's'
    const cover = 0.58
    const roof: Rect = horiz
      ? { x: b.x, y: side === 'n' ? b.y : b.y + b.h * (1 - cover), w: b.w, h: b.h * cover }
      : { x: side === 'w' ? b.x : b.x + b.w * (1 - cover), y: b.y, w: b.w * cover, h: b.h }
    const eave = horiz
      ? (side === 'n' ? roof.y + roof.h : roof.y)
      : (side === 'w' ? roof.x + roof.w : roof.x)
    return (
      <g>
        {R(b, 'p-stand', 1)}
        {R(roof, 'p-stand-roof', 1)}
        {/* the front rows, in the open strip, facing the pitch */}
        {[0, 1, 2].map(i => {
          const o = 2.4 + i * 2.2
          return horiz
            ? <line key={i} x1={b.x + 3} y1={side === 'n' ? eave + o : eave - o}
              x2={b.x + b.w - 3} y2={side === 'n' ? eave + o : eave - o} className="p-seat" />
            : <line key={i} x1={side === 'w' ? eave + o : eave - o} y1={b.y + 3}
              x2={side === 'w' ? eave + o : eave - o} y2={b.y + b.h - 3} className="p-seat" />
        })}
        {horiz
          ? <line x1={b.x} y1={eave} x2={b.x + b.w} y2={eave} className="p-eave" />
          : <line x1={eave} y1={b.y} x2={eave} y2={b.y + b.h} className="p-eave" />}
      </g>
    )
  }

  return (
    <>
      {tier >= 5 && R(bowl, 'p-bowl', 3)}
      {tier >= 1 && R(bowl, 'p-wall-in', 3)}
      <Field r={inner} lvl={Math.max(2, surface)} />
      {tier >= 2 && <Stand b={{ x: bowl.x, y: bowl.y, w: bowl.w, h: S }} side="n" />}
      {tier >= 3 && <Stand b={{ x: bowl.x, y: bowl.y + bowl.h - S, w: bowl.w, h: S }} side="s" />}
      {tier >= 4 && <>
        <Stand b={{ x: bowl.x, y: bowl.y, w: S, h: bowl.h }} side="w" />
        <Stand b={{ x: bowl.x + bowl.w - S, y: bowl.y, w: S, h: bowl.h }} side="e" />
      </>}
      {/* floodlights, one at each corner, square to the ground */}
      {tier >= 3 && [[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy], i) => (
        <rect key={i} x={bowl.x - 3 + cx * bowl.w} y={bowl.y - 3 + cy * bowl.h}
          width={6} height={6} className="p-flood" />
      ))}
    </>
  )
}

export default function ClubGrounds({ club, buildingId, selected, onPick }: {
  club: Club
  /** the facility the builders are on site for, if any */
  buildingId: FacilityId | null
  selected: FacilityId | null
  onPick: (fid: FacilityId) => void
}) {
  const lvl = (fid: FacilityId) => club.facilities?.[fid] ?? 0
  const tier = groundTier(Math.max(2_000, club.capacity))
  const ids = Object.keys(PLAN) as FacilityId[]

  const plot = (fid: FacilityId) => {
    const r = PLAN[fid]
    const l = lvl(fid)
    const on = selected === fid
    const site = buildingId === fid
    const Ico = FAC_ICON[fid]
    return (
      <g key={fid} className={`gplot${on ? ' on' : ''}${site ? ' building' : ''}`}
        onClick={() => onPick(fid)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(fid) } }}
        aria-label={`${t(FACILITY_INFO[fid].name)} · ${t('world.infLevelOf', { n: l, max: MAX_FACILITY })}`}>
        {fid === 'pitch'
          ? <Ground r={r} tier={tier} surface={l} />
          : fid === 'kicking'
            ? <Kicking r={r} lvl={l} />
            : GRASS.has(fid)
              ? <Field r={r} lvl={l} />
              : <Building r={r} lvl={l} water={fid === 'recovery'} />}
        {/* A SITE UNDER CONSTRUCTION, said the way a site plan says it: the
            plot hatched and outlined. Not a crane in elevation, which would be
            the one thing on this map seen from the side. */}
        {site && <>{R(r, 'p-site', 2)}{R(r, 'p-site-edge', 2)}</>}
        {/* the marker: the facility's glyph, horizontal, in the corner of its
            plot where it cannot land on top of a pitch marking */}
        <g className="p-mark" transform={`translate(${r.x + 4} ${r.y + 4})`}>
          <rect width={16} height={16} rx={3} className="p-mark-bg" />
          <g transform="translate(2 2) scale(0.5)" className="p-mark-ico"><Ico /></g>
        </g>
        {/* the level, as the pips the cards use, along the bottom edge */}
        <g className="gpips">
          {Array.from({ length: MAX_FACILITY }).map((_, i) => (
            <circle key={i} cx={r.x + r.w - 6 - i * 6} cy={r.y + r.h - 5} r="2"
              className={i < l ? 'p-pip on' : 'p-pip'} />
          ))}
        </g>
        {/* the tap target and the selection mark are the plot itself */}
        {R(r, 'ghit', 2)}
      </g>
    )
  }

  return (
    <svg className="grounds" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={t('world.infGroundsAlt', { club: club.short })}>
      <rect x="0" y="0" width={W} height={H} className="p-land" />
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} className="p-inside" rx={3} />
      {/* Roads: horizontal and vertical, full width or full height, meeting at
          square junctions. The whole network is five rectangles. */}
      <g className="p-road">
        <rect x={PAD} y={82} width={W - PAD * 2} height={14} />
        <rect x={PAD} y={216} width={W - PAD * 2} height={14} />
        <rect x={PAD} y={272} width={W - PAD * 2} height={8} />
        <rect x={116} y={PAD} width={14} height={262} />
        <rect x={282} y={PAD} width={14} height={262} />
      </g>
      <g className="p-lane">
        <line x1={PAD} y1={89} x2={W - PAD} y2={89} />
        <line x1={PAD} y1={223} x2={W - PAD} y2={223} />
        <line x1={123} y1={PAD} x2={123} y2={272} />
        <line x1={289} y1={PAD} x2={289} y2={272} />
      </g>

      {/* the car park along the front, bays square to the kerb */}
      {R(CAR_PARK, 'p-hard', 2)}
      {Array.from({ length: 24 }).map((_, i) => (
        <line key={i} x1={CAR_PARK.x + 8 + i * 15.6} y1={CAR_PARK.y + 2}
          x2={CAR_PARK.x + 8 + i * 15.6} y2={CAR_PARK.y + CAR_PARK.h - 2} className="p-bay" />
      ))}

      {ids.map(plot)}

      {/* landscaping: trees along the wall, on the grid like everything else */}
      <g className="p-tree">
        {Array.from({ length: 13 }).map((_, i) => <circle key={`t${i}`} cx={22 + i * 30} cy={H - PAD - 4} r="3" />)}
        {Array.from({ length: 7 }).map((_, i) => <circle key={`l${i}`} cx={PAD + 4} cy={24 + i * 38} r="3" />)}
      </g>

      {/* the wall, last, so nothing paints over the boundary */}
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} className="p-wall" rx={3} />
    </svg>
  )
}
