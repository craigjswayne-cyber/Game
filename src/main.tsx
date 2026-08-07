import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App'
import ErrorBoundary from './ui/ErrorBoundary'
import './ui/theme.css'

// the boundary sits outside App on purpose: a boundary can only catch what its
// children throw, so anything inside App would go down with it.
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
        el.textContent = '⬆ Update ready - tap to refresh'
        el.onclick = () => location.reload()
        Object.assign(el.style, {
          position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)',
          zIndex: '200', padding: '10px 18px', borderRadius: '22px', border: 'none',
          background: '#0d1f3f', color: '#f0d98c', fontWeight: '700', fontSize: '14px',
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
