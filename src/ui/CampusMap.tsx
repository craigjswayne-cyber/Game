import { CAMPUS_PLOTS, PLOT_OVERSIZE, stadiumLevel, type CampusId } from '../game/campusPlots'
import { FACILITY_INFO, MAX_FACILITY, type Club, type GameState } from '../game/model'

/** Where the art lives. `base` rather than a bare '/' because vite is built
 *  with base './' - the game is served from a path on some hosts and from the
 *  file system in the packaged build, and an absolute URL breaks both. */
const ART = import.meta.env.BASE_URL + 'art/'

/** The plate is drawn at 768x1024, and the map has to hold that shape exactly
 *  or every plot rect - which is a percentage of it - lands off its plot. */
const PLATE_W = 768
const PLATE_H = 1024

/** What stands on a plot right now. The nine facilities read their level off
 *  the club; the ground reads its own off the capacity, because seats are
 *  bought a stand at a time rather than a level at a time. */
function levelOf(club: Club, fid: CampusId): number {
  if (fid === 'stadium') return stadiumLevel(club.capacity)
  return club.facilities?.[fid] ?? 0
}

function iconOf(fid: CampusId): string {
  return fid === 'stadium' ? '🏟️' : FACILITY_INFO[fid].icon
}

/**
 * THE CLUB CAMPUS, as a map (owner, v1.6.6).
 *
 * Ten plots on one hand-drawn town plate, each carrying the tile for the level
 * that facility is actually at, so the estate you have been building for six
 * seasons is finally a place rather than a list of nine progress bars. Upgrade
 * the gym and the gym on the map grows the next week; put the builders on it
 * and the plot turns into a construction site with a hard hat over it.
 *
 * The geometry is generated (src/game/campusPlots.ts) by the same script that
 * exports the art, measured off the rendered plate rather than laid out on a
 * grid: it is a drawn town, the plots vary by about 3%, and a tidy grid would
 * have put half the buildings in the road.
 *
 * Tiles draw at PLOT_OVERSIZE, centred, so a level-five facility reads at map
 * scale instead of sitting in its plot like a postage stamp. The overspill is
 * even, and lands on the verge rather than across a junction.
 */
export default function CampusMap({ game, onPick }: {
  game: GameState
  onPick?: (fid: CampusId) => void
}) {
  const club = game.clubs[game.userClubId]
  const build = game.facilityBuild ?? null

  return (
    <div className="card" style={{ padding: 6, overflow: 'hidden' }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: `${PLATE_W} / ${PLATE_H}`,
        borderRadius: 6, overflow: 'hidden', background: 'var(--panel, #10141a)',
      }}>
        <img src={`${ART}campus/plate.png`} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

        {/* ---- the buildings ----
            CAMPUS_PLOTS comes out of the generator sorted north to south, and
            it is rendered in that order on purpose: where two oversized tiles
            touch, the southern one paints over the northern one, which is the
            way round the light already falls. */}
        {CAMPUS_PLOTS.map(p => {
          const lvl = levelOf(club, p.fid)
          const building = build?.id === p.fid
          const src = building
            ? `${ART}campus/construction.png`
            : `${ART}facilities/${p.art}-L${lvl}.png`
          // centred overspill: half the extra comes off each side
          const pad = (PLOT_OVERSIZE - 1) / 2
          return (
            <img key={p.fid} src={src} alt="" draggable={false}
              style={{
                position: 'absolute',
                left: `${p.x - p.w * pad}%`, top: `${p.y - p.h * pad}%`,
                width: `${p.w * PLOT_OVERSIZE}%`, height: `${p.h * PLOT_OVERSIZE}%`,
                pointerEvents: 'none', display: 'block',
              }} />
          )
        })}

        {/* ---- the labels, and the hit areas ----
            A second pass so every pill sits above every tile: a label drawn in
            the first pass would be painted over by the next building south of
            it. The button is the plot itself; the pill hangs under it. */}
        {CAMPUS_PLOTS.map(p => {
          const lvl = levelOf(club, p.fid)
          const building = build?.id === p.fid
          const name = p.fid === 'stadium' ? club.stadium : iconOf(p.fid)
          return (
            <button key={p.fid} type="button" title={name}
              onClick={() => onPick?.(p.fid)}
              style={{
                position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
                width: `${p.w}%`, height: `${p.h}%`,
                background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
              }}>
              {/* THE BUILDERS' MARK, across the plot itself (owner, v1.6.6:
                  "a little building icon across it like a hammer or building
                  hat"). The site tile alone reads as bare ground at map scale
                  on a phone; the hat says at a glance which plot the builders
                  are on without having to find its pill. */}
              {building && (
                <span style={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  display: 'grid', placeItems: 'center', width: '58%', aspectRatio: '1',
                  borderRadius: '50%', fontSize: 15, lineHeight: 1,
                  background: 'rgba(8, 11, 15, 0.62)',
                  border: '1.5px solid var(--gold)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                }}>🔨</span>
              )}
              <span style={{
                position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 2px)',
                display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap',
                padding: '1px 4px', borderRadius: 7, fontSize: 9, lineHeight: 1.35, fontWeight: 700,
                background: 'rgba(8, 11, 15, 0.72)',
                border: `1px solid ${building ? 'var(--gold)' : 'rgba(255,255,255,0.18)'}`,
                color: building ? 'var(--gold)' : '#fff',
              }}>
                <span>{building ? '🔨' : iconOf(p.fid)}</span>
                <span style={{ letterSpacing: 0.2 }}>
                  {building ? `L${build!.level}` : `${lvl}/${MAX_FACILITY}`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

