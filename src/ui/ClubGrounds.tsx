import { FACILITY_INFO, MAX_FACILITY, type Club, type FacilityId } from '../game/model'
import { t } from '../game/i18n'

/**
 * ---- THE CLUB, SEEN FROM THE AIR (v1.7.0) ----
 *
 * Owner: "the club infrastructure could be visually much stronger", with a
 * city-builder's campus map as the reference - plots, roads, buildings that
 * visibly grow.
 *
 * WHAT THIS IS NOT. It is not a painting of a club and it is not a set of
 * sprites. Every mark below is drawn from `club.facilities`, so the estate on
 * screen IS the estate in the save: a gym at level 1 is a shed, a gym at level
 * 5 is three storeys with glass on the front, and the thing that changed
 * between them is a number the board signed off. A picture that did not move
 * when the number moved would be wallpaper, and the whole point of the
 * reference is that you can see what your money bought.
 *
 * WHY SVG AND NOT ART. Eight skins, six languages, nine facilities and six
 * levels each is 54 states per club before the ground and the builders, and no
 * sane amount of art covers that. Drawn, it covers all of it for 8 KB, it is
 * sharp on every phone, it costs no download, and it inherits the theme's own
 * colours - so the club's campus is dark under the night themes and pale under
 * daylight without a second version of anything.
 *
 * ---- THE PROJECTION ----
 *
 * A 2:1 isometric grid, which is the one every game of this kind uses: a tile
 * twice as wide as it is tall, so a square plot lands as a diamond and the
 * maths stays integer-friendly.
 *
 *     screen x = OX + (gx - gy) * TW/2
 *     screen y = OY + (gx + gy) * TH/2
 *
 * Read (gx + gy) as DEPTH: it rises towards the viewer, which makes the
 * painter's sort at the bottom of this file one line rather than a z-buffer.
 * The grid is 4x4. The ground takes the middle four plots and the estate takes
 * the twelve around it - nine facilities and three pieces of scenery, because
 * a campus with no car park and no trees on it reads as a circuit board.
 */

/** Tile width and height in screen units. 2:1, and the whole layout is in
 *  these - change them and everything below still lands. */
const TW = 92
const TH = 46
/** Where grid (0,0) sits. The horizontal margin is not slack: a level-5
 *  building is 34 units wide either side of its plot centre, so the far
 *  corners of the grid have to sit that far inside the viewBox or a
 *  world-class estate gets its gym clipped off at the edge. */
const OX = 180
const OY = 58

const iso = (gx: number, gy: number): [number, number] =>
  [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2]

/** A diamond on the ground plane, centred on a plot and inset by `pad` so the
 *  gaps between plots read as the roads between them. */
const plotPath = (gx: number, gy: number, pad = 5): string => {
  const [x, y] = iso(gx, gy)
  const w = TW / 2 - pad * 2, h = TH / 2 - pad
  return `M ${x},${y - h} L ${x + w},${y} L ${x},${y + h} L ${x - w},${y} Z`
}

/** A box standing on the ground plane: top face, then the two faces that catch
 *  the light differently. Everything built on this campus is one of these. */
function IsoBox({ x, y, w, d, h, top, left, right }: {
  x: number; y: number; w: number; d: number; h: number
  top: string; left: string; right: string
}) {
  return (
    <>
      <path d={`M ${x - w},${y - h} L ${x},${y + d - h} L ${x},${y + d} L ${x - w},${y} Z`} fill={left} />
      <path d={`M ${x},${y + d - h} L ${x + w},${y - h} L ${x + w},${y} L ${x},${y + d} Z`} fill={right} />
      <path d={`M ${x},${y - d - h} L ${x + w},${y - h} L ${x},${y + d - h} L ${x - w},${y - h} Z`} fill={top} />
    </>
  )
}

/**
 * WHERE EVERYTHING STANDS.
 *
 * The grass is kept together down the left and front - the playing surface,
 * the paddock and the kicking enclosure are the three that are fields rather
 * than buildings, and a club whose pitches are scattered between its offices
 * does not look like a club. The buildings run round the top and the right.
 * The gates and the forecourt take the nearest plot, because that is the one
 * the eye lands on and an entrance is what a ground has at the front.
 */
type Scenery = 'gates' | 'trees' | 'park'
const PLOTS: { id: FacilityId | Scenery; gx: number; gy: number }[] = [
  { id: 'trees', gx: 0, gy: 0 },
  { id: 'academy', gx: 1, gy: 0 },
  { id: 'briefing', gx: 2, gy: 0 },
  { id: 'gym', gx: 3, gy: 0 },
  { id: 'park', gx: 0, gy: 1 },
  { id: 'recovery', gx: 3, gy: 1 },
  { id: 'kicking', gx: 0, gy: 2 },
  { id: 'hospitality', gx: 3, gy: 2 },
  { id: 'paddock', gx: 0, gy: 3 },
  { id: 'pitch', gx: 1, gy: 3 },
  { id: 'shop', gx: 2, gy: 3 },
  { id: 'gates', gx: 3, gy: 3 },
]
/** The three that are fields, not buildings. */
const GRASS: ReadonlySet<string> = new Set<FacilityId>(['pitch', 'paddock', 'kicking'])
const isScenery = (id: string): id is Scenery => id === 'gates' || id === 'trees' || id === 'park'

/** Lighten or darken a club colour for the faces of a solid. Falls back to the
 *  token ramp for a club whose colours are CSS variables rather than hex. */
function shade(hex: string, k: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return hex
  const ch = (i: number) => {
    const v = parseInt(h.slice(i * 2, i * 2 + 2), 16)
    return Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))))
  }
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
}

export default function ClubGrounds({ club, buildingId, selected, onPick }: {
  club: Club
  /** the facility the builders are on site for, if any */
  buildingId: FacilityId | null
  selected: FacilityId | null
  onPick: (fid: FacilityId) => void
}) {
  const lvl = (fid: FacilityId) => club.facilities?.[fid] ?? 0
  const [c1, c2] = club.colors

  /**
   * THE GROUND ITSELF, and the one number on this screen that is not a
   * facility level. Capacity runs from a village ground to a Test arena across
   * more than an order of magnitude, so the bowl is drawn on the CUBE ROOT of
   * it rather than on the figure: a stadium four times the size is about one
   * and a half times as wide on the map, which is what a stand four times as
   * long actually looks like from the air. Drawn linearly, an 82,000-seat bowl
   * would have swallowed the entire campus and a 5,000-seat one would have
   * been a dot.
   */
  const cap = Math.max(2_000, club.capacity)
  const k = Math.cbrt(cap / 20_000)
  const rx = Math.max(50, Math.min(80, 64 * k))
  const ry = rx * 0.5
  const bowlH = Math.max(16, Math.min(30, 20 * k))
  const [sx, sy] = iso(1.5, 1.5)

  /** Painter's order: back to front, which on this grid is depth ascending.
   *  The ground sits at the centre of the four plots it covers, so it takes
   *  their depth and lands between the back row and the front one. */
  const order = [...PLOTS].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy) || a.gx - b.gx)
  const back = order.filter(p => p.gx + p.gy < 3)
  const front = order.filter(p => p.gx + p.gy >= 3)

  /** One plot, drawn at whatever it currently is. */
  const draw = (p: { id: FacilityId | Scenery; gx: number; gy: number }) => {
    const [x, y] = iso(p.gx, p.gy)
    if (isScenery(p.id)) return <Scene key={p.id} kind={p.id} x={x} y={y} c1={c1} />

    const fid = p.id
    const l = lvl(fid)
    const building = buildingId === fid
    const on = selected === fid
    const grass = GRASS.has(fid)
    return (
      <g key={fid} className={`gplot${on ? ' on' : ''}${building ? ' building' : ''}`}
        onClick={() => onPick(fid)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(fid) } }}
        aria-label={`${t(FACILITY_INFO[fid].name)} · ${t('world.infLevelOf', { n: l, max: MAX_FACILITY })}`}>
        {grass ? <Field fid={fid} x={x} y={y} lvl={l} c1={c1} /> : <Block fid={fid} x={x} y={y} lvl={l} c1={c1} c2={c2} />}
        {/* THE CRANE SAYS SO. A build takes weeks and the only sign of one used
            to be a line of text on a card; here the plot itself is a site. */}
        {building && (
          <g className="gcrane">
            <path d={`M ${x - 2},${y - 4} L ${x - 2},${y - 52} L ${x + 26},${y - 52}`}
              stroke="var(--gold)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M ${x + 22},${y - 52} L ${x + 22},${y - 40}`} stroke="var(--gold)" strokeWidth="1.6" />
          </g>
        )}
        {/* The level, as the same pips the cards use, drawn small under the
            plot. Five dots is the whole scale, so a glance across the campus
            reads as a glance down the list. */}
        <g className="gpips">
          {Array.from({ length: MAX_FACILITY }).map((_, i) => (
            <circle key={i} cx={x - 14 + i * 7} cy={y + TH / 2 - 3} r="2.1"
              fill={i < l ? 'var(--gold)' : 'var(--border)'} />
          ))}
        </g>
      </g>
    )
  }

  return (
    <svg className="grounds" viewBox="0 0 360 248" role="img"
      aria-label={t('world.infGroundsAlt', { club: club.short })}>
      {/* the estate's footprint: one diamond of tarmac under everything, so
          the gaps the plots leave read as the roads between them */}
      <path d={`M ${OX - TW * 2},${OY + TH * 1.5} L ${OX},${OY - TH / 2}
                L ${OX + TW * 2},${OY + TH * 1.5} L ${OX},${OY + TH * 3.5} Z`}
        fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1" />
      {PLOTS.map(p => (
        <path key={`g${p.gx}${p.gy}`} d={plotPath(p.gx, p.gy)}
          fill="var(--surface-1)" fillOpacity={0.55}
          stroke="var(--border)" strokeWidth="0.7" strokeOpacity={0.6} />
      ))}

      {back.map(draw)}
      <Bowl x={sx} y={sy} rx={rx} ry={ry} h={bowlH} c1={c1} c2={c2} big={cap >= 30_000} />
      {front.map(draw)}
    </svg>
  )
}

/** ---- THE STADIUM ----
 *  A bowl: the footprint, a skirt of stands extruded up from it, the seating
 *  deck in the club's own colours and the pitch inside. Floodlights only on
 *  the grounds big enough to own a set, which is the one detail that makes a
 *  Premiership arena and a second-tier ground read differently at a glance. */
function Bowl({ x, y, rx, ry, h, c1, c2, big }: {
  x: number; y: number; rx: number; ry: number; h: number; c1: string; c2: string; big: boolean
}) {
  const skirt = `M ${x - rx},${y} A ${rx},${ry} 0 0 0 ${x + rx},${y}`
    + ` L ${x + rx},${y - h} A ${rx},${ry} 0 0 1 ${x - rx},${y - h} Z`
  const lights: [number, number][] = [[-0.72, -0.62], [0.72, -0.62], [-0.72, 0.62], [0.72, 0.62]]
  return (
    <g className="gbowl">
      <ellipse cx={x} cy={y + 3} rx={rx * 1.04} ry={ry * 1.04} fill="rgba(0,0,0,.28)" />
      <path d={skirt} fill={shade(c1, 0.58)} />
      <ellipse cx={x} cy={y - h} rx={rx} ry={ry} fill={shade(c1, 0.88)} stroke={shade(c2, 1.15)} strokeWidth="1.2" />
      {/* the deck, then the roof line that separates it from the pitch */}
      <ellipse cx={x} cy={y - h} rx={rx * 0.74} ry={ry * 0.74} fill={shade(c1, 1.18)} opacity="0.85" />
      <ellipse cx={x} cy={y - h} rx={rx * 0.58} ry={ry * 0.58} fill="var(--pitch-a)" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
      <line x1={x - rx * 0.58} y1={y - h} x2={x + rx * 0.58} y2={y - h} stroke="rgba(255,255,255,.45)" strokeWidth="0.9" />
      {big && lights.map(([fx, fy], i) => (
        <g key={i}>
          <line x1={x + rx * fx} y1={y - h + ry * fy} x2={x + rx * fx} y2={y - h + ry * fy - 22}
            stroke="var(--text-muted)" strokeWidth="1.4" />
          <rect x={x + rx * fx - 7} y={y - h + ry * fy - 26} width="14" height="4.5" rx="1"
            fill="var(--gold-fill)" opacity="0.95" />
          <rect x={x + rx * fx - 5} y={y - h + ry * fy - 21.5} width="10" height="2" rx="1"
            fill="var(--gold-fill)" opacity="0.45" />
        </g>
      ))}
    </g>
  )
}

/** ---- A BUILDING ----
 *  Height, footprint and detail all read the level, so the six states are one
 *  set of numbers rather than six drawings. Level 0 is a fenced empty plot and
 *  looks like one: the estate should show you the holes in it. */
function Block({ fid, x, y, lvl, c1, c2 }: {
  fid: FacilityId; x: number; y: number; lvl: number; c1: string; c2: string
}) {
  if (lvl === 0) return <Empty fid={fid} x={x} y={y} />
  // A LEVEL 5 IS TALLER THAN A LEVEL 1 AND STILL FITS ON ITS PLOT. The first
  // pass ran the height to 46 and the campus read as a skyline: the tall
  // buildings at the back stood over the plots in front of them and the
  // stadium disappeared behind its own offices. Growth you can see beats
  // growth that wins.
  const w = 19 + lvl * 3
  const d = 9.5 + lvl * 1.5
  const h = 9 + lvl * 5.5
  const wall = shade(c1, 0.5 + lvl * 0.06)
  return (
    <g>
      <ellipse cx={x} cy={y + d * 0.5} rx={w * 1.05} ry={d * 0.8} fill="rgba(0,0,0,.22)" />
      <IsoBox x={x} y={y} w={w} d={d} h={h}
        top={shade(c2, 1.05)} left={shade(wall, 0.72)} right={wall} />
      {/* GLASS ARRIVES WITH THE MONEY. One band at level 2, a second at 4, and
          at 5 the whole right face is a frontage - the difference between a
          unit on an industrial estate and a performance centre, and the only
          thing that changed is what the board agreed to pay for. */}
      {lvl >= 2 && (
        <path d={`M ${x + 2},${y + d - h * 0.58} L ${x + w - 3},${y - h * 0.58} L ${x + w - 3},${y - h * 0.42} L ${x + 2},${y + d - h * 0.42} Z`}
          fill="var(--gold-fill)" opacity={lvl >= 5 ? 0.85 : 0.6} />
      )}
      {lvl >= 4 && (
        <path d={`M ${x + 2},${y + d - h * 0.88} L ${x + w - 3},${y - h * 0.88} L ${x + w - 3},${y - h * 0.72} L ${x + 2},${y + d - h * 0.72} Z`}
          fill="var(--gold-fill)" opacity="0.55" />
      )}
      {/* the plant on the roof: the small, dull, expensive thing only a
          finished building has */}
      {lvl >= 5 && (
        <IsoBox x={x} y={y - h} w={9} d={4.5} h={5}
          top={shade(c2, 1.15)} left={shade(c1, 0.45)} right={shade(c1, 0.62)} />
      )}
      <text className="gicon" x={x} y={y - d - h - 5} textAnchor="middle">{FACILITY_INFO[fid].icon}</text>
    </g>
  )
}

/** ---- A FIELD ----
 *  The three facilities that are grass. Same rule: the surface grows and gains
 *  its markings as the level does, so a level-1 playing surface is a rough
 *  paddock and a level-5 one is a marked, striped, posted pitch. */
function Field({ fid, x, y, lvl, c1 }: { fid: FacilityId; x: number; y: number; lvl: number; c1: string }) {
  if (lvl === 0) return <Empty fid={fid} x={x} y={y} />
  const w = 25 + lvl * 3.2
  const d = 12.5 + lvl * 1.6
  const diamond = `M ${x},${y - d} L ${x + w},${y} L ${x},${y + d} L ${x - w},${y} Z`
  return (
    <g>
      <path d={diamond} fill="var(--pitch-a)" stroke={shade(c1, 1.2)} strokeWidth="1" />
      {/* the stripes a mown surface has, and only once it is worth mowing */}
      {lvl >= 2 && [0.35, 0.7].map((f, i) => (
        <path key={i} d={`M ${x - w * f},${y - d * (1 - f)} L ${x + w * (1 - f)},${y + d * f}`}
          stroke="var(--pitch-b)" strokeWidth={3 + lvl * 0.5} opacity="0.75" />
      ))}
      {/* markings, once the surface is worth marking */}
      {lvl >= 3 && (
        <path d={`M ${x},${y - d * 0.62} L ${x + w * 0.62},${y} L ${x},${y + d * 0.62} L ${x - w * 0.62},${y} Z`}
          fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="0.9" />
      )}
      {/* posts, for the enclosure that exists to kick at them */}
      {fid === 'kicking' && (
        <g stroke="rgba(255,255,255,.85)" strokeWidth="1.6" fill="none">
          <path d={`M ${x - w * 0.55},${y - d * 0.1} L ${x - w * 0.55},${y - d * 0.1 - 16}`} />
          <path d={`M ${x - w * 0.2},${y + d * 0.08} L ${x - w * 0.2},${y + d * 0.08 - 16}`} />
          <path d={`M ${x - w * 0.55},${y - d * 0.1 - 11} L ${x - w * 0.2},${y + d * 0.08 - 11}`} />
        </g>
      )}
      <text className="gicon" x={x} y={y - d - 4} textAnchor="middle">{FACILITY_INFO[fid].icon}</text>
    </g>
  )
}

/** Nothing built here. A dashed plot with the facility's own icon greyed on
 *  it - the estate's gaps, named, so "we have no academy" is something you can
 *  see from the air rather than something you find by reading nine cards. */
function Empty({ fid, x, y }: { fid: FacilityId; x: number; y: number }) {
  return (
    <g className="gempty">
      <path d={`M ${x},${y - (TH / 2 - 7)} L ${x + (TW / 2 - 12)},${y} L ${x},${y + (TH / 2 - 7)} L ${x - (TW / 2 - 12)},${y} Z`}
        fill="none" stroke="var(--border)" strokeWidth="1.4" strokeDasharray="4 4" />
      <text className="gicon dim" x={x} y={y + 4} textAnchor="middle">{FACILITY_INFO[fid].icon}</text>
    </g>
  )
}

/** The three plots that are not facilities. A campus is a place before it is a
 *  spreadsheet, and the gates in particular give the eye somewhere to land. */
function Scene({ kind, x, y, c1 }: { kind: Scenery; x: number; y: number; c1: string }) {
  if (kind === 'trees') {
    return (
      <g className="gscene">
        {[[-18, 2, 9], [4, -5, 7], [16, 6, 8]].map(([dx, dy, r], i) => (
          <g key={i}>
            <ellipse cx={x + dx} cy={y + dy + 4} rx={r * 0.9} ry={r * 0.4} fill="rgba(0,0,0,.2)" />
            <circle cx={x + dx} cy={y + dy - r * 0.5} r={r} fill="var(--pitch-a)" />
            <circle cx={x + dx - r * 0.25} cy={y + dy - r * 0.8} r={r * 0.6} fill="var(--pitch-b)" opacity=".8" />
          </g>
        ))}
      </g>
    )
  }
  if (kind === 'park') {
    return (
      <g className="gscene">
        {[0, 1, 2, 3].map(i => (
          <path key={i} d={`M ${x - 22 + i * 12},${y + 2 + i * 3} L ${x - 8 + i * 12},${y + 9 + i * 3}`}
            stroke="var(--text-muted)" strokeWidth="1.2" opacity=".7" />
        ))}
        {[[-14, -2], [2, 5]].map(([dx, dy], i) => (
          <rect key={i} x={x + dx} y={y + dy} width="11" height="5" rx="1.6"
            fill={i ? 'var(--surface-3)' : shade(c1, 1.1)} opacity=".9" />
        ))}
      </g>
    )
  }
  // the gates: a forecourt, two piers and the club's own colour on the arch
  return (
    <g className="gscene">
      <path d={`M ${x},${y - 14} L ${x + 34},${y} L ${x},${y + 14} L ${x - 34},${y} Z`}
        fill="var(--surface-3)" opacity=".85" />
      {[[-16, -6], [12, 8]].map(([dx, dy], i) => (
        <g key={i}>
          <IsoBox x={x + dx} y={y + dy} w={6} d={3} h={16}
            top={shade(c1, 1.2)} left={shade(c1, 0.55)} right={shade(c1, 0.8)} />
        </g>
      ))}
      <path d={`M ${x - 16},${y - 22} L ${x + 12},${y - 8}`} stroke="var(--gold)" strokeWidth="2" fill="none" />
    </g>
  )
}
