import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App'
import ErrorBoundary from './ui/ErrorBoundary'
import { installCrashCapture } from './game/bugreport'
import { attachPlayBilling } from './game/playbilling'
import { attachStoreKit } from './game/storekit'
import { restore } from './game/monetise'
import { useStore } from './store'
import { t } from './game/i18n'
import './ui/tokens.css'
import './ui/theme.css'

// the boundary sits outside App on purpose: a boundary can only catch what its
// children throw, so anything inside App would go down with it.
// a throw in an event handler or an unawaited promise never unmounts the tree,
// so the ErrorBoundary never sees it and the game carries on looking fine.
// Those are the ones players report as "it just stopped responding" - the
// report screen attaches them, so they no longer depend on being noticed.
installCrashCapture()

/**
 * A RESTORE NOBODY HAS TO ASK FOR.
 *
 * Reinstalling, or moving to a new phone, loses the receipt in localStorage but
 * not the purchase on the store account. So the store is asked once at boot,
 * quietly: it grants, it never revokes, and everywhere that is not a
 * billing-enabled wrapper it does nothing at all and costs one rejected promise.
 * Deliberately not awaited - a slow store must not hold up the first paint.
 *
 * Two shells, one door. Android builds its bridge out of browser APIs and iOS
 * reads a Capacitor plugin; a device has at most one of them, and both refuse
 * to overwrite a bridge that is already there, so this order is convenience
 * rather than law. StoreKit is tried after the Play handshake has settled,
 * which also gives Capacitor's own runtime a tick to register its plugins.
 */
void attachPlayBilling()
  .then(attached => attached || attachStoreKit())
  .then(() => restore())
  .then(changed => { if (changed) useStore.getState().claimSupporter() })
  .catch(() => { /* no store, no bridge, nothing to restore */ })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// PWA service worker. New builds take control mid-session (skipWaiting +
// claim), so a long play session can run stale JS without knowing - offer a
// one-tap refresh, but never force it: a reload mid-match would lose the
// live match state.
if ('serviceWorker' in navigator && !location.hostname.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // long sessions still hear about new deploys without a navigation
      setInterval(() => { reg.update().catch(() => {}) }, 15 * 60 * 1000)
      const showUpdatePill = () => {
        if (document.getElementById('upd-pill')) return
        const el = document.createElement('button')
        el.id = 'upd-pill'
        el.textContent = t('common.updateReady')
        el.onclick = () => location.reload()
        Object.assign(el.style, {
          position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)',
          zIndex: '200', padding: '10px 18px', borderRadius: '22px', border: 'none',
          background: 'var(--surface-2)', color: 'var(--gold)', fontWeight: '700', fontSize: '14px',
          boxShadow: '0 6px 24px rgba(0,0,0,.45)', cursor: 'pointer',
        } as CSSStyleDeclaration)
        document.body.appendChild(el)
      }
      // a controller swap while a controller already existed = a new build
      let hadController = !!navigator.serviceWorker.controller
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) showUpdatePill()
        hadController = true
      })
    }).catch(() => {})
  })
}
