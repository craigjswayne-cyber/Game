import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { SectionTitle } from '../components'

const STAGE_NAME: Record<string, string> = {
  R16: 'Last Sixteen', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final', BAR: 'Playoff Barrage',
}

/**
 * ---- THE DRAW (F19) ----
 *
 * A cup draw is the only moment in the sport where your season changes without
 * anybody playing, and the game used to hand it over as a line in the inbox: you
 * host somebody, here is the fixture. The ties were already in the fixture list
 * before the manager knew they existed.
 *
 * So this is the draw as a room. One ball at a time, in the order they came out,
 * every tie in the round and not only yours - because half of what makes a draw is
 * watching the rest of it and working out the road ahead. Your own tie is called
 * out when it lands.
 *
 * The reveal is a counter on the save, not a timer: a manager who closes the app
 * halfway through the draw comes back to the same three balls out and the rest
 * still in the bag.
 */
export default function DrawRoom() {
  const game = useStore(s => s.game)!
  const revealBall = useStore(s => s.revealBall)
  const closeDraw = useStore(s => s.closeDraw)
  const draw = game.draw

  if (!draw || !draw.ties.length) {
    return (
      <div className="card center" style={{ margin: '18vh 16px' }}>
        <div className="meta">No draw is waiting.</div>
        <button className="btn gold block" style={{ marginTop: 10 }} onClick={closeDraw}>Continue ▸</button>
      </div>
    )
  }

  const comp = game.comps[draw.compId]
  const stage = STAGE_NAME[draw.stage] ?? draw.stage
  const mine = [game.userClubId, game.natTeam].filter(Boolean) as string[]
  const out = draw.ties.slice(0, draw.revealed)
  const left = draw.ties.length - draw.revealed
  const ourTie = draw.ties.find(t => mine.includes(t.homeId) || mine.includes(t.awayId))
  const ourTieOut = out.some(t => mine.includes(t.homeId) || mine.includes(t.awayId))

  return (
    <div className="draw-room">
      <SectionTitle sub={`${comp?.name ?? 'Cup'} · ${draw.ties.length} ties in the hat`}>
        The {stage} Draw
      </SectionTitle>

      <div className="draw-balls">
        {out.map((t, i) => {
          const ours = mine.includes(t.homeId) || mine.includes(t.awayId)
          return (
            <div key={i} className={`draw-tie${ours ? ' ours' : ''}`}>
              <span className="draw-num">{i + 1}</span>
              <span className="draw-home">{teamShort(game, t.homeId)}</span>
              <span className="draw-v">v</span>
              <span className="draw-away">{teamShort(game, t.awayId)}</span>
            </div>
          )
        })}
        {left > 0 && (
          <div className="draw-waiting meta">
            {left} {left === 1 ? 'ball' : 'balls'} still in the bag
          </div>
        )}
      </div>

      {ourTieOut && ourTie && (
        <div className="card draw-verdict">
          {mine.includes(ourTie.homeId)
            ? `You are at home to ${teamShort(game, ourTie.awayId)}. Get the place rocking.`
            : `You travel to ${teamShort(game, ourTie.homeId)}. Quiet the crowd early and anything is possible.`}
        </div>
      )}

      {left > 0
        ? <button className="btn gold block draw-next" onClick={revealBall}>Next ball ▸</button>
        : <button className="btn gold block draw-next" onClick={closeDraw}>That is the draw ▸</button>}
    </div>
  )
}
