import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useStore } from '../store'
import { recordCrash } from '../game/bugreport'
import { t } from '../game/i18n'

interface Props { children: ReactNode }
interface State { err: Error | null }

/** The last line of defence (blocker A1).
 *
 *  React unmounts the whole tree when a render throws, so before this existed a
 *  single bad read on one screen - one undefined club, one player id pointing at
 *  a sold player - left the manager staring at a white rectangle with no back
 *  button, no menu, and no idea whether the save still existed. It did: saves
 *  live in IndexedDB and are written every week. The screen was the only thing
 *  that was gone.
 *
 *  So the fallback says exactly that, shows the error so it can be reported,
 *  and offers the two ways out. Back to the title screen is tried first because
 *  it keeps the session: almost every crash of this kind is one screen reading
 *  something it should not, and the rest of the game is fine. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(err: Error): State {
    return { err }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('render crashed', err, info.componentStack)
    // the crash screen has always said this message is the useful bit to pass
    // on, and always left the player to copy it off the glass by hand
    recordCrash('render', err.message || String(err), err.stack ?? info.componentStack ?? undefined)
  }

  /** Leave the screen that threw, keep the session. */
  /** Straight to the report with the crash already attached. Same trick as
   *  toMenu: navigate first, clear second, or we re-render the screen that threw. */
  private toReport = () => {
    useStore.setState({ nav: [{ screen: 'menu' }, { screen: 'bug' }], liveMatch: null })
    this.setState({ err: null })
  }

  private toMenu = () => {
    // navigate first, clear the error second: clearing first would re-render
    // the very screen that just threw and land straight back here.
    useStore.setState({ nav: [{ screen: 'menu' }], liveMatch: null })
    this.setState({ err: null })
  }

  render() {
    const { err } = this.state
    if (!err) return this.props.children

    return (
      <div className="crash">
        <div className="crash-box">
          <h2>{t('report.crashTitle')}</h2>
          <p>{t('report.crashBody')}</p>
          <pre className="crash-err">{err.message || String(err)}</pre>
          <div className="crash-btns">
            <button className="btn gold" onClick={this.toMenu}>{t('report.crashToTitle')}</button>
            <button className="btn ghost" onClick={() => location.reload()}>{t('report.crashReload')}</button>
            <button className="btn ghost" onClick={this.toReport}>{t('report.crashReport')}</button>
          </div>
          <div className="crash-note">
            {t('report.crashNote')}
          </div>
        </div>
      </div>
    )
  }
}
