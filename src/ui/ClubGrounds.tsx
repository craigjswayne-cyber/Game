import { FACILITY_INFO, MAX_FACILITY, type Club, type FacilityId } from '../game/model'
import { t } from '../game/i18n'

/**
 * ---- THE CLUB, SEEN FROM THE AIR ----
 *
 * Owner: "the club infrastructure could be visually much stronger", with a
 * city-builder's campus map as the reference.
 *
 * WHAT THIS WAS, AND WHY IT CHANGED. Until now every mark on this map was
 * drawn in code: isometric boxes built out of three shaded faces, a kit of
 * roof furniture, and an emoji laid on top of each roof to say what the
 * building was. The file carried a long argument for that approach - nine
 * facilities at six levels is 54 states before the ground and the builders,
 * and no sane amount of art covers it - and the argument was wrong, because
 * the owner had already drawn all 54. Ten ladders, nine facilities and the
 * ground, six stages each, painted. They sat in the conversation while the
 * game drew coloured boxes, and the owner's verdict on the result was the
 * correct one: "the visual is crap".
 *
 * So the drawing code is gone, about 880 lines of it, and this file now places
 * the owner's art. scripts/sprites.mjs is the pipeline that cuts the ladders
 * into the 60 sprites in ./sprites, and it carries the detail of how.
 *
 * WHAT IS UNCHANGED, and matters more than the art: the estate on screen is
 * still the estate in the save. Every plot reads its own level out of
 * club.facilities and the ground reads its capacity, so a gym at level 1 is
 * the shed the board paid for and a gym at level 5 is the building they paid
 * for later. A picture that did not move when the number moved would be
 * wallpaper.
 *
 * ---- THE PROJECTION ----
 *
 * A 2:1 isometric grid, the one every game of this kind uses: a tile twice as
 * wide as it is tall, so a square plot lands as a diamond.
 *
 *     screen x = OX + (gx - gy) * TW/2
 *     screen y = OY + (gx + gy) * TH/2
 *
 * Read (gx + gy) as DEPTH: it rises towards the viewer, which makes the
 * painter's sort one line rather than a z-buffer. That sort matters more now
 * than it did with boxes - these tiles carry their own landscaping and overlap
 * their neighbours, so drawing them out of order puts a hedge in front of a
 * building that stands behind it.
 */

/**
 * THE SPRITES, ALL SIXTY, BY NAME. Eager because the map needs whichever nine
 * levels the save happens to hold and there is no telling which until it is
 * read; what is eager here is the URL, not the image, so the bundle gains 60
 * short strings and the browser still fetches only the nine on screen.
 */
const SPRITES = import.meta.glob('./sprites/*.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>
const sprite = (id: string, lvl: number): string | undefined =>
  SPRITES[`./sprites/${id}-${Math.max(0, Math.min(5, lvl))}.webp`]

/** Tile width and height in screen units. 2:1, and the whole layout is in
 *  these - change them and everything below still lands. */
const TW = 92
const TH = 46
const OX = 180
const OY = 64

const iso = (gx: number, gy: number): [number, number] =>
  [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2]

/**
 * WHERE EVERYTHING STANDS. The grass is kept together down the left and front
 * - the playing surface, the paddock and the kicking enclosure are fields
 * rather than buildings, and a club whose pitches are scattered between its
 * offices does not look like a club. The buildings run round the top and the
 * right, and the ground takes the middle four plots.
 *
 * The three scenery plots are gone with the drawing code. They existed because
 * a campus of nine bare boxes read as a circuit board and it needed trees; the
 * owner's tiles arrive with their own hedges, trees and parked cars, so the
 * scenery would now be a second, worse set of trees beside the real ones.
 */
const PLOTS: { id: FacilityId; gx: number; gy: number }[] = [
  { id: 'academy', gx: 1, gy: 0 },
  { id: 'briefing', gx: 2, gy: 0 },
  { id: 'gym', gx: 3, gy: 0 },
  { id: 'recovery', gx: 3, gy: 1 },
  { id: 'kicking', gx: 0, gy: 2 },
  { id: 'hospitality', gx: 3, gy: 2 },
  { id: 'paddock', gx: 0, gy: 3 },
  { id: 'pitch', gx: 1, gy: 3 },
  { id: 'shop', gx: 2, gy: 3 },
]

/**
 * THE GROUND'S SIX STAGES ARE CAPACITY BANDS, not a facility level. It is the
 * one thing on this campus the board does not build in levels - it adds SEATS
 * (requestExpansion, season.ts), anywhere from a few hundred to a new stand -
 * so the ladder is read off the seat count instead. The bands sit where the
 * real grounds in the database sit, so moving up one is a thing that happens
 * across a career rather than never or constantly.
 */
const GROUND_TIERS = [45_000, 26_000, 17_000, 11_000, 6_000]
const groundTier = (cap: number): number => {
  const i = GROUND_TIERS.findIndex(n => cap >= n)
  return i < 0 ? 0 : 5 - i
}

/**
 * One tile, stood on its plot.
 *
 * THE BOX IS TALLER THAN THE TILE AND ALIGNED TO ITS FOOT. Every sprite in a
 * ladder shares one canvas, bottom-anchored, so the foot of the image is the
 * foot of the ground plate whatever is built on it (scripts/sprites.mjs step
 * 4). Give SVG a generous box and `xMidYMax meet` and it scales the tile to
 * the width, leaves the spare height empty above, and stands the plate exactly
 * on the plot. That is what lets a level 5 grow upward out of the same
 * footprint a level 0 sits in, rather than being scaled down to fit a box.
 */
function Tile({ id, lvl, gx, gy, w, alt }: {
  id: string; lvl: number; gx: number; gy: number; w: number; alt?: string
}) {
  const href = sprite(id, lvl)
  if (!href) return null
  const [x, y] = iso(gx, gy)
  const box = w * 1.35
  return (
    <image href={href} x={x - w / 2} y={y + TH / 2 - box} width={w} height={box}
      preserveAspectRatio="xMidYMax meet" {...(alt ? { 'aria-label': alt } : {})} />
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
  const cap = Math.max(2_000, club.capacity)

  /** Painter's order: back to front, which on this grid is depth ascending.
   *  The ground sits at the centre of the four plots it covers, so it takes
   *  their depth and lands between the back row and the front one. */
  const order = [...PLOTS].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy) || a.gx - b.gx)
  const back = order.filter(p => p.gx + p.gy < 3)
  const front = order.filter(p => p.gx + p.gy >= 3)

  /** One plot, drawn at whatever it currently is. */
  const draw = (p: { id: FacilityId; gx: number; gy: number }) => {
    const fid = p.id
    const l = lvl(fid)
    const [x, y] = iso(p.gx, p.gy)
    const building = buildingId === fid
    const on = selected === fid
    return (
      <g key={fid} className={`gplot${on ? ' on' : ''}${building ? ' building' : ''}`}
        onClick={() => onPick(fid)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(fid) } }}
        aria-label={`${t(FACILITY_INFO[fid].name)} · ${t('world.infLevelOf', { n: l, max: MAX_FACILITY })}`}>
        <Tile id={fid} lvl={l} gx={p.gx} gy={p.gy} w={PLOT_W} />
        {/* THE TAP TARGET IS THE PLOT, NOT THE PICTURE. An <image> with
            transparent corners still takes a tap on those corners, so nine
            overlapping rectangles would steal each other's taps along every
            shared edge. The diamond is the footprint the eye sees. */}
        <path className="ghit" d={`M ${x},${y - TH / 2} L ${x + TW / 2},${y} L ${x},${y + TH / 2} L ${x - TW / 2},${y} Z`} />
        {/* THE CRANE SAYS SO. A build takes weeks and the only sign of one used
            to be a line of text on a card; here the plot itself is a site. */}
        {building && (
          <g className="gcrane">
            <path d={`M ${x - 2},${y - 4} L ${x - 2},${y - 62} L ${x + 26},${y - 62}`}
              stroke="var(--gold)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M ${x + 22},${y - 62} L ${x + 22},${y - 50}`} stroke="var(--gold)" strokeWidth="1.6" />
          </g>
        )}
        {/* The level, as the same pips the cards use, drawn small under the
            plot. Five dots is the whole scale, so a glance across the campus
            reads as a glance down the list. */}
        <g className="gpips">
          {Array.from({ length: MAX_FACILITY }).map((_, i) => (
            <circle key={i} cx={x - 14 + i * 7} cy={y + TH / 2 - 2} r="2.1"
              fill={i < l ? 'var(--gold)' : 'var(--border)'} />
          ))}
        </g>
      </g>
    )
  }

  return (
    /* THE BOX IS MEASURED, NOT GUESSED. The first cut carried 43 units of
       empty sky above the estate and 59 below it, which on a phone is most of
       a thumb of nothing inside a framed card. These are the real extents:
       the ground's roof reaches y = -9, the front plots' pips end at 205, and
       the paddock and the gym put the sides at -10 and 370. */
    <svg className="grounds" viewBox="-14 -16 392 232" role="img"
      aria-label={t('world.infGroundsAlt', { club: club.short })}>
      {/* NO GROUND PLANE UNDER THE TILES. There used to be a diamond of
          tarmac here so the gaps between the drawn boxes read as roads. Each
          tile now arrives with its own plate - grass to the fence, gravel to
          the kerb - so the tarmac only showed in the three cells the scenery
          used to hold, as a grey wedge sticking out from under the estate.
          The tiles sit on the card, the way they sit on the ladders. */}
      {back.map(draw)}
      <Tile id="stadium" lvl={groundTier(cap)} gx={1.5} gy={1.5} w={GROUND_W} />
      {front.map(draw)}
    </svg>
  )
}

/** A plot tile is drawn a shade wider than its diamond so neighbouring plates
 *  meet instead of leaving tarmac showing between them, which is how every
 *  isometric tile set is laid out. The ground covers four plots. */
const PLOT_W = 104
const GROUND_W = 208
