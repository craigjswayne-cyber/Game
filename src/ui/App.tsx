import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore, type Screen } from '../store'
import { natFixtureThisWeek, userFixtureThisWeek } from '../game/season'
import { weekDate, seasonLabel } from '../game/model'
import { IcoBall, IcoClipboard, IcoHome, IcoInbox, IcoPress, IcoTransfer, IcoTrophy } from './icons'
import Menu from './screens/Menu'
import NewGame from './screens/NewGame'
import Home from './screens/Home'
import Inbox from './screens/Inbox'
import Offers from './screens/Offers'
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
import Handbook from './screens/Handbook'
import Jobs from './screens/Jobs'
import Feed from './screens/Feed'
import Wire from './screens/Wire'
import Medical from './screens/Medical'
import TeamReport from './screens/TeamReport'
import Profile from './screens/Profile'
import Saves from './screens/Saves'
import DreamTeam from './screens/DreamTeam'
import WeekResults from './screens/WeekResults'
import SeasonReview from './screens/SeasonReview'
import Agency from './screens/Agency'
import Infrastructure from './screens/Infrastructure'
import Academy from './screens/Academy'
import Tutorial from './Tutorial'

const TITLES: Record<string, string> = {
  home: 'Home', inbox: 'Inbox', offers: 'Bids For Your Players', results: 'Full-Time Round-Up', squad: 'Squad', agency: 'Scouting Agency', tactics: 'Selection & Tactics', fixtures: 'Fixtures',
  tables: 'Competitions', transfers: 'Transfer Centre', training: 'Training & Coaching',
  finances: 'Finances', club: 'Club', press: 'Press Room', player: 'Player Profile',
  nations: 'International Rugby', history: 'Roll of Honour', legacy: 'Manager Legacy',
  jobs: 'Job Centre', feed: 'The Rugby Wire', medical: 'Medical Centre',
  report: 'Team Report', profile: 'Manager Profile', saves: 'Game Status',
  dreamteam: 'Team of the Week', wire: 'The Rugby Wire', infra: 'Club Infrastructure',
  handbook: "The Manager's Handbook",
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

/** The game is a landscape experience - nudge portrait users to rotate.
 *
 *  A nudge, not a wall (blocker A3). This veil covers the entire viewport in
 *  portrait, and a phone with its rotation lock switched on will never leave
 *  portrait no matter how it is held, so an escape hatch is the difference
 *  between a hint and a locked door. */
function RotateVeil() {
  const ok = useStore(s => s.portraitOk)
  if (ok) return null
  return (
    <div className="rotate-veil">
      <div className="phone">📱</div>
      <h2>Turn your phone sideways</h2>
      <p>Rugby Manager plays in landscape - like every good dugout view.</p>
      <button className="btn ghost" onClick={() => useStore.getState().allowPortrait()}>
        Play anyway
      </button>
      <p style={{ fontSize: 11.5 }}>Tables and the live pitch will be tight, but nothing is off limits.</p>
    </div>
  )
}

/** A save that fails in silence is the worst failure a management game has
 *  (blocker A4): you keep playing for two hours and lose all of it. */
function SaveWarning() {
  const fails = useStore(s => s.saveFail)
  const msg = useStore(s => s.saveFailMsg)
  if (!fails) return null
  return (
    <div className="save-warn">
      <div>
        <b>⚠ Save failed{fails > 1 ? ` (${fails} in a row)` : ''}.</b>{' '}
        Nothing since your last successful save is being written to this phone. Usually this is storage:
        clear some space, then press Continue. {msg ? <span className="save-warn-why">{msg}</span> : null}
      </div>
      <div className="save-warn-btns">
        <button className="btn tiny gold" onClick={() => void useStore.getState().persist()}>Try again</button>
        <button className="btn tiny ghost" onClick={() => useStore.getState().dismissSaveFail()}>Hide</button>
      </div>
    </div>
  )
}

/** The trophy moment, the promotion, the challenge completed.
 *
 *  This block used to sit in App's function body as an orphaned statement
 *  rather than inside the returned tree, so it was parsed, type-checked, and
 *  never rendered: four systems wrote state.celebration and nothing ever showed
 *  it or cleared it (blocker A5). */
function Celebration() {
  const game = useStore(s => s.game)
  useStore(s => s.tick)
  if (!game?.celebration) return null
  const cel = game.celebration
  return (
    <div className="celebrate-veil" onClick={() => { game.celebration = null; useStore.getState().touch() }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <i key={i} className="confetti" style={{
          left: `${(i * 137) % 100}%`,
          animationDelay: `${(i * 0.23) % 2.4}s`,
          animationDuration: `${2.6 + (i % 5) * 0.5}s`,
          background: ['#e3b92e', '#2e57ab', '#c0392f', '#2f7d4f', '#9fc2e8'][i % 5],
        }} />
      ))}
      <div className="celebrate-box">
        <div style={{ fontSize: 64, lineHeight: 1 }}>{cel.icon}</div>
        <h1>{cel.headline}</h1>
        <div className="sub">{cel.sub}</div>
        <div className="muted" style={{ marginTop: 14 }}>Tap anywhere - the party carries on without you.</div>
      </div>
    </div>
  )
}

/** Everything that floats above whatever screen you happen to be on. One
 *  component so the five return paths through App cannot disagree about it. */
function Overlays() {
  return (
    <>
      <SaveWarning />
      <Tutorial />
      <Celebration />
      <RotateVeil />
    </>
  )
}

/** Best-effort hard lock where the platform allows it (installed PWA). */
function useOrientationLock() {
  useEffect(() => {
    const tryLock = () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      o?.lock?.('landscape').catch(() => { /* browser tabs refuse - the veil handles it */ })
    }
    tryLock()
    window.addEventListener('click', tryLock, { once: true })
    return () => window.removeEventListener('click', tryLock)
  }, [])
}

interface MenuItem {
  ico: string
  label: string
  /** doubles as the react key, so it stays required even for action items */
  screen: Screen
  badge?: number
  /** opens something in place instead of navigating (How to play) */
  action?: () => void
}

export default function App() {
  const nav = useStore(s => s.nav)
  const game = useStore(s => s.game)
  const night = useStore(s => s.night)
  useStore(s => s.tick)
  const { back, go, home, continueWeek, toggleNight, openInbox } = useStore.getState()
  const [menu, setMenu] = useState<null | 'club' | 'world' | 'manager'>(null)
  useOrientationLock()

  const cur = nav[nav.length - 1]
  const appClass = `app${night ? ' night' : ''}`

  if (cur.screen === 'menu') return <div className={`${appClass} no-rail`}><Menu /><Overlays /></div>
  if (cur.screen === 'newgame') return <div className={`${appClass} no-rail`}><NewGame /><Overlays /></div>
  if (!game) return <div className={`${appClass} no-rail`}><Menu /><Overlays /></div>

  if (cur.screen === 'matchday') {
    const mdClub = game.clubs[game.userClubId]
    return (
      <div className={`${appClass} no-rail`} style={{ '--club1': mdClub.colors[0], '--club2': mdClub.colors[1] } as CSSProperties}>
        <MatchDay />
        <Overlays />
      </div>
    )
  }

  const club = game.clubs[game.userClubId]
  const unread = game.news.filter(n => !n.read && n.type !== 'gossip').length
  const wireUnread = game.news.filter(n => !n.read && n.type === 'gossip').length
  const pressOpen = game.press.filter(p => !p.answered).length
  const offersOpen = game.offers.filter(o => o.status === 'pending' && o.forUser).length
  const injuredCount = club.players.filter(id => game.players[id]?.injury).length
  const clubVars = {
    '--club1': club.colors[0],
    '--club2': club.colors[1],
  } as CSSProperties

  const screen = () => {
    switch (cur.screen) {
      case 'home': return <Home />
      case 'inbox': return <Inbox />
      case 'offers': return <Offers />
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
      case 'handbook': return <Handbook />
      case 'jobs': return <Jobs />
      case 'feed': return <Feed />
      case 'wire': return <Wire />
      case 'medical': return <Medical />
      case 'report': return <TeamReport />
      case 'profile': return <Profile />
      case 'saves': return <Saves />
      case 'dreamteam': return <DreamTeam />
      case 'results': return <WeekResults param={cur.param as string} />
      case 'seasonreview': return <SeasonReview />
      case 'agency': return <Agency />
      case 'infra': return <Infrastructure />
      case 'academy': return <Academy />
      default: return <Home />
    }
  }

  const MENUS: Record<'club' | 'world' | 'manager', { title: string; items: MenuItem[] }> = {
    club: {
      title: club.short,
      items: [
        { ico: '📋', label: 'Team Report', screen: 'report' },
        { ico: '🏋️', label: 'Training & Coaching', screen: 'training' },
        { ico: '🏥', label: 'Medical Centre', screen: 'medical', badge: injuredCount },
        { ico: '📅', label: 'Fixtures & Results', screen: 'fixtures' },
        { ico: '💰', label: 'Finances', screen: 'finances' },
        { ico: '🔁', label: 'Transfer Centre', screen: 'transfers', badge: offersOpen },
        { ico: '🎙️', label: 'Press Room', screen: 'press', badge: pressOpen },
        { ico: '🎓', label: 'Academy & A League', screen: 'academy' },
        { ico: '🏗️', label: 'Club Infrastructure', screen: 'infra' },
        { ico: '🏟️', label: 'Club Information', screen: 'club' },
      ],
    },
    world: {
      title: 'World',
      items: [
        { ico: '📰', label: 'The Rugby Wire', screen: 'feed', badge: wireUnread },
        { ico: '🏉', label: 'Team of the Week', screen: 'dreamteam' },
        { ico: '🔭', label: 'Scouting Agency', screen: 'agency' },
        { ico: '🏆', label: 'Competitions', screen: 'tables' },
        { ico: '🌍', label: 'International Rugby', screen: 'nations' },
        { ico: '📜', label: 'Roll of Honour', screen: 'history' },
        { ico: '🕴️', label: 'Job Centre', screen: 'jobs', badge: game.vacancies.length },
      ],
    },
    manager: {
      title: game.managerName,
      items: [
        { ico: '👤', label: 'Manager Profile', screen: 'profile' },
        { ico: '📜', label: 'Manager Legacy', screen: 'legacy' },
        { ico: '📖', label: "The Manager's Handbook", screen: 'handbook' },
        // dismissing the welcome dialog used to be final and irreversible
        { ico: '❓', label: 'How to play', screen: 'home', action: () => useStore.getState().openTut() },
        { ico: '💾', label: 'Save / Load Game', screen: 'saves' },
      ],
    },
  }

  const navBtn = (s: string, ico: ReactNode, label: string, badge?: number) => (
    <button className={cur.screen === s ? 'active' : ''} title={label} aria-label={label}
      onClick={() => {
        setMenu(null)
        // the mail icon is a queue, not a link: each tap serves the next unread
        if (s === 'inbox') { openInbox(); return }
        if (s === 'home') { home(); return }
        go(s as Screen)
      }}>
      <span className="ico nbadge">{ico}{badge ? <span className="dot">{badge > 9 ? '9+' : badge}</span> : null}</span>
      <span className="nlbl">{label}</span>
    </button>
  )

  const groupBtn = (id: 'club' | 'world' | 'manager', ico: ReactNode, label: string, badge?: number) => (
    <button className={menu === id ? 'active' : ''} title={label} aria-label={label}
      onClick={() => setMenu(menu === id ? null : id)}>
      <span className="ico nbadge">{ico}{badge ? <span className="dot">{badge > 9 ? '9+' : badge}</span> : null}</span>
      <span className="nlbl">{label} ▸</span>
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
          <button className="continue-btn" onClick={continueWeek}>
            {(!game.unemployed && userFixtureThisWeek(game)) || natFixtureThisWeek(game) ? 'Matchday ▸' : 'Continue ▸'}
          </button>
        </div>
      </header>
      <main className="content">{screen()}</main>
      <nav className="bottom-nav">
        {/* Order asked for: home (summary), inbox, squad, selection and tactics,
            then the rest. Home carries no unread badge any more - the inbox is a
            button of its own and wearing the count itself. */}
        {navBtn('home', <IcoHome />, 'Home')}
        {game.unemployed ? (
          <>
            {navBtn('inbox', <IcoInbox />, 'Inbox', unread)}
            {navBtn('jobs', <IcoClipboard />, 'Jobs', game.vacancies.length)}
            {groupBtn('world', <IcoTrophy />, 'World', wireUnread)}
            {groupBtn('manager', <IcoBall />, 'Manager')}
          </>
        ) : (
          <>
            {navBtn('inbox', <IcoInbox />, 'Inbox', unread)}
            {navBtn('squad', <IcoBall />, 'Squad')}
            {navBtn('tactics', <IcoClipboard />, 'Tactics')}
            {groupBtn('club', <IcoTransfer />, 'Club', offersOpen + pressOpen + injuredCount)}
            {groupBtn('world', <IcoTrophy />, 'World', wireUnread + game.vacancies.length)}
            {groupBtn('manager', <IcoPress />, 'Manager')}
          </>
        )}
      </nav>

      {menu && (
        <div className="submenu-veil" onClick={() => setMenu(null)}>
          <div className="submenu" onClick={e => e.stopPropagation()}>
            <div className="submenu-head">{MENUS[menu].title}</div>
            {MENUS[menu].items.map(it => (
              <button key={it.label} className="submenu-item"
                onClick={() => { setMenu(null); if (it.action) it.action(); else go(it.screen) }}>
                <span className="mico">{it.ico}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {it.badge ? <span className="mbadge">{it.badge > 9 ? '9+' : it.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      <Overlays />
    </div>
  )
}
