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
import Legacy from './screens/Legacy'
import Jobs from './screens/Jobs'

const TITLES: Record<string, string> = {
  home: 'Inbox', squad: 'Squad', tactics: 'Selection & Tactics', fixtures: 'Fixtures',
  tables: 'Competitions', transfers: 'Transfer Centre', training: 'Training',
  finances: 'Finances', club: 'Club', press: 'Press Room', player: 'Player Profile',
  nations: 'International Rugby', history: 'Roll of Honour', legacy: 'Manager Legacy',
  jobs: 'Job Centre',
}

const IcoMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
  </svg>
)
const IcoSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </svg>
)

export default function App() {
  const nav = useStore(s => s.nav)
  const game = useStore(s => s.game)
  const night = useStore(s => s.night)
  useStore(s => s.tick)
  const { back, go, home, continueWeek, toggleNight } = useStore.getState()

  const cur = nav[nav.length - 1]
  const appClass = `app${night ? ' night' : ''}`

  if (cur.screen === 'menu') return <div className={`${appClass} no-rail`}><Menu /></div>
  if (cur.screen === 'newgame') return <div className={`${appClass} no-rail`}><NewGame /></div>
  if (!game) return <div className={`${appClass} no-rail`}><Menu /></div>

  if (cur.screen === 'matchday') {
    const mdClub = game.clubs[game.userClubId]
    return (
      <div className={`${appClass} no-rail`} style={{ '--club1': mdClub.colors[0], '--club2': mdClub.colors[1] } as CSSProperties}>
        <MatchDay />
      </div>
    )
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
      case 'legacy': return <Legacy />
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
    <div className={appClass} style={clubVars}>
      <header className="masthead">
        <div className="masthead-row">
          {nav.length > 1
            ? <button className="back-btn" onClick={back}>‹</button>
            : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{cur.screen === 'home' ? (game.unemployed ? 'Unemployed' : club.name) : TITLES[cur.screen] ?? ''}</h1>
            <div className="date">{weekDate(game.season, game.week)} · {seasonLabel(game.season)} · Wk {game.week}</div>
          </div>
          <button className="night-btn" onClick={toggleNight} aria-label="Toggle floodlit mode">
            {night ? <IcoSun /> : <IcoMoon />}
          </button>
          <button className="continue-btn" onClick={continueWeek}>Continue ▸</button>
        </div>
      </header>
      <main className="content">{screen()}</main>
      <nav className="bottom-nav">
        {navBtn('home', <IcoInbox />, 'Inbox', unread)}
        {game.unemployed ? (
          <>
            {navBtn('jobs', <IcoClipboard />, 'Jobs', game.vacancies.length)}
            {navBtn('tables', <IcoTrophy />, 'Comps')}
            {navBtn('legacy', <IcoBall />, 'Career')}
          </>
        ) : (
          <>
            {navBtn('squad', <IcoBall />, 'Squad')}
            {navBtn('tactics', <IcoClipboard />, 'Tactics')}
            {navBtn('tables', <IcoTrophy />, 'Comps')}
            {navBtn('transfers', <IcoTransfer />, 'Transfers', offersOpen)}
            {navBtn('press', <IcoPress />, 'Press', pressOpen)}
          </>
        )}
      </nav>
    </div>
  )
}
