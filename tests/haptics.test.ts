// Haptics on the phone's own engine (owner, 1.9.13). iOS has
// no navigator.vibrate, so an iPhone felt nothing; the shells now carry
// Capacitor's Haptics plugin and audio.ts plays it when it is there.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { matchSfx } from '../src/ui/audio'

type G = { Capacitor?: unknown; navigator?: { vibrate?: (p: unknown) => boolean } }
const g = globalThis as unknown as G

function withPlugin() {
  const calls: string[] = []
  g.Capacitor = {
    Plugins: {
      Haptics: {
        impact: (o: { style: string }) => { calls.push(`impact:${o.style}`); return Promise.resolve() },
        notification: (o: { type: string }) => { calls.push(`note:${o.type}`); return Promise.resolve() },
      },
    },
  }
  return calls
}

afterEach(() => { delete g.Capacitor; vi.restoreAllMocks() })

describe('match haptics', () => {
  it('plays the Taptic Engine when the shell has the plugin', () => {
    const calls = withPlugin()
    matchSfx('TRY'); matchSfx('PEN'); matchSfx('YC'); matchSfx('RC')
    expect(calls).toEqual(['note:SUCCESS', 'impact:LIGHT', 'impact:HEAVY', 'note:WARNING'])
  })
  it('falls back to the browser buzz without it, as the website always did', () => {
    const buzz = vi.fn(() => true)
    const nav = (globalThis as unknown as { navigator: { vibrate?: unknown } }).navigator
    const had = nav.vibrate
    Object.defineProperty(nav, 'vibrate', { value: buzz, configurable: true, writable: true })
    matchSfx('TRY')
    expect(buzz).toHaveBeenCalledWith([30, 40, 60])
    Object.defineProperty(nav, 'vibrate', { value: had, configurable: true, writable: true })
  })
})
