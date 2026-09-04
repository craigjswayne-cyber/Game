/**
 * ---- WHICH BOX THE GAME IS IN ----
 *
 * Three ways this game reaches a phone, and the move from the second to the
 * third is why this file exists (v1.2.9, the Android shell):
 *
 *   the website        a browser tab or a home-screen PWA
 *   the old Play app   a Trusted Web Activity: Chrome, showing the website
 *   the new Play app   a Capacitor shell with the game inside it
 *
 * The old app kept its saves in Chrome's storage. The new one has its own
 * WebView storage and cannot see Chrome's. So a player who updates loses
 * sight of their careers unless they carried a backup across - which is why
 * the website warns anyone it can tell is inside the old app, and the new
 * app offers Import on its first run. Purchases are on the Google account and
 * come back on their own.
 *
 * Nothing here talks to a network. The referrer is read once, at boot, and a
 * one-byte flag is kept in localStorage; netprobe stays green.
 */

const TWA_FLAG = 'rm-twa'

/** Chrome opens a Trusted Web Activity with the app's own package as the
 *  referrer, on the first navigation only. Remembered, because every later
 *  navigation inside the app looks like any other page. Call once at boot. */
export function noteShell(): void {
  try {
    if (typeof document !== 'undefined' && /^android-app:\/\/com\.phaserugbymanager\.app/.test(document.referrer)) {
      localStorage.setItem(TWA_FLAG, '1')
    }
  } catch { /* private mode: the warning simply does not show */ }
}

/** Running inside the old Play app (the Chrome wrapper). */
export function isOldPlayApp(): boolean {
  try { return localStorage.getItem(TWA_FLAG) === '1' && !isAndroidShell() } catch { return false }
}

type WithCap = { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }

/** Running inside the new Play app (the Capacitor shell). */
export function isAndroidShell(): boolean {
  const cap = (globalThis as unknown as WithCap).Capacitor
  return !!cap && cap.isNativePlatform?.() === true && cap.getPlatform?.() === 'android'
}

/** A one-time card the player can put away. */
export function dismissed(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
export function dismiss(key: string): void {
  try { localStorage.setItem(key, '1') } catch { /* then it shows again; harmless */ }
}
