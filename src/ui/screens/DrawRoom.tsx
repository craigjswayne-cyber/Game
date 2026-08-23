import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { SectionTitle } from '../components'
import { t } from '../../game/i18n'

/* keys, not words - the table is built once, the language can change after */
const STAGE_NAME: Record<string, string> = {
  R16: 'week.stageR16', QF: 'week.stageQFs', SF: 'week.stageSFs', F: 'week.stageFinal', BAR: 'week.stageBarrage',
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
        <div className="meta">{t('week.drawNoDraw')}</div>
        <button className="btn gold block" style={{ marginTop: 10 }} onClick={closeDraw}>{t('week.wireContinue')}</button>
      </div>
    )
  }

  const comp = game.comps[draw.compId]
  const stage = STAGE_NAME[draw.stage] ? t(STAGE_NAME[draw.stage]) : draw.stage
  const mine = [game.userClubId, game.natTeam].filter(Boolean) as string[]
  const out = draw.ties.slice(0, draw.revealed)
  const left = draw.ties.length - draw.revealed
  // `tie`, not `t`: t() is the translator
  const ourTie = draw.ties.find(tie => mine.includes(tie.homeId) || mine.includes(tie.awayId))
  const ourTieOut = out.some(tie => mine.includes(tie.homeId) || mine.includes(tie.awayId))

  return (
    <div className="draw-room">
      <SectionTitle sub={t('week.drawSub', { comp: comp?.name ?? t('week.drawCup'), n: draw.ties.length })}>
        {t('week.drawTitle', { stage })}
      </SectionTitle>

      <div className="draw-balls">
        {out.map((tie, i) => {
          const ours = mine.includes(tie.homeId) || mine.includes(tie.awayId)
          return (
            <div key={i} className={`draw-tie${ours ? ' ours' : ''}`}>
              <span className="draw-num">{i + 1}</span>
              <span className="draw-home">{teamShort(game, tie.homeId)}</span>
              <span className="draw-v">{t('common.v')}</span>
              <span className="draw-away">{teamShort(game, tie.awayId)}</span>
            </div>
          )
        })}
        {left > 0 && (
          <div className="draw-waiting meta">
            {t(left === 1 ? 'week.drawBallLeft' : 'week.drawBallsLeft', { n: left })}
          </div>
        )}
      </div>

      {ourTieOut && ourTie && (
        <div className="card draw-verdict">
          {mine.includes(ourTie.homeId)
            ? t('week.drawAtHome', { club: teamShort(game, ourTie.awayId) })
            : t('week.drawAway', { club: teamShort(game, ourTie.homeId) })}
        </div>
      )}

      {left > 0
        ? <button className="btn gold block draw-next" onClick={revealBall}>{t('week.drawNextBall')}</button>
        : <button className="btn gold block draw-next" onClick={closeDraw}>{t('week.drawThatIsIt')}</button>}
    </div>
  )
}
