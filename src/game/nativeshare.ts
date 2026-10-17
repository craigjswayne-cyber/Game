/**
 * ---- A BACKUP THAT REALLY LEAVES THE PHONE (1.8.18) ----
 *
 * Export used to make an <a download> link to a blob: URL and click it. In a
 * browser that drops a file in Downloads; in the Capacitor shell the store
 * builds run in, the WebView has no download handler, so nothing happened at
 * all - and the screen still said "Career exported - keep the file safe". The
 * Share button was hidden there too, because the WebView has no
 * navigator.share. A player could believe their career was backed up when it
 * was nowhere but the phone it was meant to protect.
 *
 * In the shells, the save is now written to the app's cache folder with the
 * Filesystem plugin and handed to the phone's own share sheet with the Share
 * plugin: a cloud drive, a chat with yourself, an e-mail. The game uploads
 * nothing; the operating system hands the file to whatever the player picks.
 *
 * NOTHING IS IMPORTED, for the reason storekit.ts gives: both plugins are
 * reached through the global Capacitor injects, so the web build gains no
 * dependency and netprobe stays green. In a browser this file finds nothing
 * and the old browser paths stand.
 */

interface FilesystemPlugin {
  writeFile(o: { path: string; data: string; directory: string; encoding: string }): Promise<{ uri: string }>
  appendFile(o: { path: string; data: string; directory: string; encoding: string }): Promise<void>
}
interface SharePlugin {
  share(o: { title?: string; files?: string[]; dialogTitle?: string }): Promise<unknown>
}
type Cap = {
  PluginHeaders?: { name?: string }[]
  isPluginAvailable?: (name: string) => boolean
  registerPlugin?: <T>(name: string) => T
  Plugins?: Record<string, unknown>
}

/** The same honest lookup storekit.ts uses: the native side must say the
 *  plugin is there, because registerPlugin answers to every name. */
function plugin<T>(name: string): T | null {
  const cap = (globalThis as unknown as { Capacitor?: Cap }).Capacitor
  if (!cap) return null
  const already = cap.Plugins?.[name] as T | undefined
  if (already) return already
  const native = cap.PluginHeaders
    ? cap.PluginHeaders.some(h => h?.name === name)
    : cap.isPluginAvailable?.(name) ?? false
  if (!native) return null
  try { return cap.registerPlugin?.<T>(name) ?? null } catch { return null }
}

/** Can this build hand a save to the phone's share sheet? */
export function canShareNatively(): boolean {
  return !!plugin<FilesystemPlugin>('Filesystem') && !!plugin<SharePlugin>('Share')
}

type ShareResult = 'shared' | 'cancelled' | 'unavailable' | 'failed'

/** A save is several megabytes of text. It crosses the native bridge in
 *  pieces, so no single message is the whole career. */
const CHUNK = 1 << 20

/** Where the next piece ends. Never between the two halves of a character
 *  outside the basic plane (an emoji in a manager's name): each half alone
 *  is not a character, and the native side would write it as '?'. */
export function chunkEnd(text: string, start: number, size = CHUNK): number {
  let end = Math.min(start + size, text.length)
  if (end < text.length) {
    const c = text.charCodeAt(end - 1)
    if (c >= 0xd800 && c <= 0xdbff) end--
  }
  return end
}

/** ONE FILE IN THE CACHE, ALWAYS THE SAME NAME. The share sheet shows the file
 *  under this name, so it says what it is; reusing it means a player who
 *  exports every week does not fill the phone with old careers. */
const CACHE_NAME = 'phase-rugby-career.json'

/** One write at a time: a second tap while the first is still writing would
 *  interleave two careers into one file. */
let busy = false

/**
 * Write `text` to the cache folder as `name` and open the share sheet on it.
 * 'shared' only once the sheet has closed on a choice; a player backing out
 * is 'cancelled', which is not a failure and is not reported as one.
 */
export async function shareSaveNatively(name: string, text: string): Promise<ShareResult> {
  const fs = plugin<FilesystemPlugin>('Filesystem')
  const sh = plugin<SharePlugin>('Share')
  if (!fs || !sh) return 'unavailable'
  if (busy) return 'cancelled' // the first tap is still writing; this one adds nothing
  busy = true
  try {
    let uri: string
    try {
      const base = { path: CACHE_NAME, directory: 'CACHE', encoding: 'utf8' }
      let end = chunkEnd(text, 0)
      const first = await fs.writeFile({ ...base, data: text.slice(0, end) })
      while (end < text.length) {
        const next = chunkEnd(text, end)
        await fs.appendFile({ ...base, data: text.slice(end, next) })
        end = next
      }
      uri = first.uri
    } catch {
      return 'failed'
    }
    try {
      await sh.share({ title: name, files: [uri], dialogTitle: name })
      return 'shared'
    } catch (e) {
      // Android rejects with "Share canceled", iOS with a cancel message: the
      // player changed their mind, which is not the game's failure
      return /cancel/i.test(String((e as Error)?.message ?? e)) ? 'cancelled' : 'failed'
    }
  } finally {
    busy = false
  }
}
