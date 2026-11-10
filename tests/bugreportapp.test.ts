// The bug report said "installed: no (browser tab)" from inside the App Store
// and Play Store apps, because it only asked whether a web page had been added
// to the home screen. The game is not on the website at all, so a report read
// as if the player was somewhere they cannot be (1.9.12, the shirt 1 report).
import { describe, expect, it } from 'vitest'
import { buildReport } from '../src/game/bugreport'

const base = { state: null, notes: '', nav: { userAgent: 'x', language: 'en-GB' }, when: '2026-11-10 12:00:00' }
const screen = { w: 390, h: 844, dpr: 3, standalone: false }

describe('where the report says the game was running', () => {
  it('names the iPhone app', () => {
    expect(buildReport({ ...base, screen, app: 'ios' })).toMatch(/running in\s+iPhone\/iPad app \(App Store\)/)
  })
  it('names the Android app', () => {
    expect(buildReport({ ...base, screen, app: 'android' })).toMatch(/running in\s+Android app \(Google Play\)/)
  })
  it('says browser only when there is no app around it', () => {
    const r = buildReport({ ...base, screen, app: null })
    expect(r).toMatch(/running in\s+a web browser/)
    expect(r).not.toMatch(/browser tab/)
  })
})
