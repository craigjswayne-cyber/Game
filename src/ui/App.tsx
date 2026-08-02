import type { CSSProperties, ReactNode } from 'react'
import { useStore } from '../store'
import { weekDate, seasonLabel } from '../game/model'
import { IcoBall, IcoClipboard, IcoInbox, IcoPress, IcoTransfer, IcoTrophy } from './icons'
import Menu from './screens/Menu'
import NewGame from './screens/NewGame'
import Home from './screens/Home'
import Squad from './screens/Squad'
import PlayerScreen from './screens/PlayerScreen'
import Tactics from './screens/Tactics'
import Fixtures from './screens/Fixtures'
import Tables from './screens/Tables'
import Transfers from './screens/Transfers'
import Training from './screens/Training'
import Finances from './screens/Finances'
import ClubScreen from './screens/ClubScreen'
import MatchDay from './screens/MatchDay'
import Press from './screens/Press'
import Nations from './screens/Nations'
import History from './screens/History'

const TITLES: Record<string, string> = {
  home: 'Inbox', squad: 'Squad', tactics: 'Selection & Tactics', fixtures: 'Fixtures',
  tables: 'Competitions', transfers: 'Transfer Centre', training: 'Training',
  finances: 'Finances', club: 'Club', press: 'Press Room', player: 'Player Profile',
  nations: 'International Rugby', history: 'Roll of Honour',
}

export default function App() {
  const nav = useStore(s => s.nav)
  const game = useStore(s => s.game)
  useStore(s => s.tick)
  const { back, go, home, continueWeek } = useStore.getState()

  const cur = nav[nav.length - 1]

  if (cur.screen === 'menu') return <div className="app"><Menu /></div>
  if (cur.screen === 'newgame') return <div className="app"><NewGame /></div>
  if (!game) return <div className="app"><Menu /></div>

  if (game.unemployed) {
    return (
      <div className="app">
        <div className="title-screen">
          <div style={{ fontSize: 46 }}>📄</div>
          <hr className="rules" />
          <h1 style={{ fontSize: 30 }}>SACKED</h1>
          <div className="tagline">
            {game.clubs[game.userClubId].name} have parted company with {game.managerName}.<br />
            The game, as they say, is gone.
          </div>
          <hr className="rules" />
          <div className="menu-btns">
            <button className="btn gold" style={{ fontSize: 16, padding: 13 }}
              onClick={() => useStore.setState({ game: null, nav: [{ screen: 'menu' }] })}>
              Start a New Career
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (cur.screen === 'matchday') {
    return <div className="app"><MatchDay /></div>
  }

  const club = game.clubs[game.userClubId]
  const unread = game.news.filter(n => !n.read).length
  const pressOpen = game.press.filter(p => !p.answered).length
  const offersOpen = game.offers.filter(o => o.status === 'pending' && o.forUser).length
  const clubVars = {
    '--club1': club.colors[0],
    '--club2': club.colors[1],
  } as CSSProperties

  const screen = () => {
    switch (cur.screen) {
      case 'home': return <Home />
      case 'squad': return <Squad />
      case 'player': return <PlayerScreen playerId={cur.param as number} />
      case 'tactics': return <Tactics />
      case 'fixtures': return <Fixtures />
      case 'tables': return <Tables initial={cur.param as string | undefined} />
      case 'transfers': return <Transfers />
      case 'training': return <Training />
      case 'finances': return <Finances />
      case 'club': return <ClubScreen clubId={(cur.param as string) ?? game.userClubId} />
      case 'press': return <Press />
      case 'nations': return <Nations />
      case 'history': return <History />
      default: return <Home />
    }
  }

  const navBtn = (s: string, ico: ReactNode, label: string, badge?: number) => (
    <button className={cur.screen === s ? 'active' : ''} onClick={() => (s === 'home' ? home() : go(s as never))}>
      <span className="ico nbadge">{ico}{badge ? <span className="dot">{badge > 9 ? '9+' : badge}</span> : null}</span>
      {label}
    </button>
  )

  return (
    <div className="app" style={clubVars}>
      <header className="masthead">
        <div className="masthead-row">
          {nav.length > 1
            ? <button className="back-btn" onClick={back}>‹</button>
            : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{cur.screen === 'home' ? club.name : TITLES[cur.screen] ?? ''}</h1>
            <div className="date">{weekDate(game.season, game.week)} · {seasonLabel(game.season)} · Wk {game.week}</div>
          </div>
          <button className="continue-btn" onClick={continueWeek}>Continue ▸</button>
        </div>
      </header>
      <main className="content">{screen()}</main>
      <nav className="bottom-nav">
        {navBtn('home', <IcoInbox />, 'Inbox', unread)}
        {navBtn('squad', <IcoBall />, 'Squad')}
        {navBtn('tactics', <IcoClipboard />, 'Tactics')}
        {navBtn('tables', <IcoTrophy />, 'Comps')}
        {navBtn('transfers', <IcoTransfer />, 'Transfers', offersOpen)}
        {navBtn('press', <IcoPress />, 'Press', pressOpen)}
      </nav>
    </div>
  )
}
