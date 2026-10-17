import { useStore } from '../../store'
import { userMatchThisWeek } from '../../game/season'
import { t } from '../../game/i18n'
import { Live } from './matchday/Live'
import { NationPreview } from './matchday/NationPreview'
import { Preview } from './matchday/Preview'

export default function MatchDay() {
  const game = useStore(s => s.game)!
  const live = useStore(s => s.liveMatch)
  const { back } = useStore.getState()

  // ONE DECISION POINT, OR THE SCREEN LIES.
  //
  // This used to read the CLUB fixture first and fall back to the Test, while
  // store.kickOff and store.instantResult both read userMatchThisWeek, which
  // ranks the Test above it. So on a week holding both, this screen previewed
  // Northampton's Saturday and the button underneath played Scotland's (user:
  // "it showed my club game, I ran it and it played another international
  // game"). The preview and the kick-off now read the same function, so they
  // cannot disagree; the club game the assistant is taking is named below
  // rather than offered.
  const fx = live?.fixture ?? userMatchThisWeek(game)
  if (!fx) {
    return (
      <div className="title-screen">
        <div>{t('matchday.noFixture')}</div>
        <button className="btn gold" style={{ marginTop: 16 }} onClick={back}>{t('matchday.back')}</button>
      </div>
    )
  }
  if (live) return <Live />
  const isClubMatch = fx.homeId === game.userClubId || fx.awayId === game.userClubId
  return isClubMatch ? <Preview fxId={fx.id} /> : <NationPreview fxId={fx.id} />
}

// The named exports this file has always had, so they stay importable from here.
export { SquadSheet, condWord } from './matchday/SquadSheet'
