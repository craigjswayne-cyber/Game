/**
 * ---- THE BUG REPORT, FROM A GAME THAT CANNOT PHONE HOME ----
 *
 * There is no fetch, no XHR, no beacon and no server anywhere in this project,
 * and the release audit checks that there still isn't. Adding one to carry bug
 * reports would make this the first network call in the game: a privacy
 * surface, a consent question, a backend to run and a thing to keep secure,
 * all for a message the phone in the player's hand can already send four ways.
 *
 * So NOTHING IS TRANSMITTED FROM HERE. This file builds plain text. The player
 * reads the whole of it on screen before it goes anywhere, and it leaves the
 * device only through something the player drives themselves: the share sheet,
 * their mail app, the clipboard, or a file they save. That also means a report
 * still works with the phone in flight mode, which is exactly when a save-
 * corruption bug is most likely to be worth reporting.
 *
 * WHAT GOES IN IT is chosen to answer the first three questions a developer
 * asks - which build, which career, what was on screen when it broke - and
 * nothing else. No player names, no manager name, no squad, no save payload.
 * The seed is in there because it is the one field that lets a career be
 * rebuilt from scratch, and it identifies nobody.
 */
import type { GameState } from './model'

/**
 * Where a report is addressed. ONE constant, because it is the only line to
 * change if the destination moves - and it is published in the client of a
 * public build, so it should be an address that can stand being seen.
 */
export const DEV_CONTACT = 'phaserugbymanager@gmail.com'

/** How many crashes to keep. A ring, because a broken screen in a render loop
 *  can throw a hundred times a second and the first one is the interesting one. */
const CRASH_LIMIT = 6
/** How many screens back the trail goes. Enough to see the route in, short
 *  enough that the report still fits in a mail body. */
const TRAIL_LIMIT = 12

export interface Crash {
  /** where it came from: a render, a promise nobody caught, a window error */
  kind: 'render' | 'promise' | 'window'
  message: string
  stack?: string
  /** the screen showing when it went, and the in-game week, both from the trail */
  where?: string
  at: string
}

const crashes: Crash[] = []
const trail: string[] = []

/** Note a screen the player reached. Called from the store's navigation, so the
 *  report can say "he was on Squad, then Player, then it went" - the single
 *  most useful line in a bug report and the one players never think to write. */
export function noteScreen(screen: string, param?: string | number): void {
  const entry = param != null ? `${screen}:${param}` : screen
  if (trail[trail.length - 1] === entry) return
  trail.push(entry)
  if (trail.length > TRAIL_LIMIT) trail.shift()
}

/** Record a crash. Deduplicated on message, so a render loop throwing the same
 *  error every frame does not flush the buffer of everything that came before. */
export function recordCrash(kind: Crash['kind'], message: string, stack?: string): void {
  const msg = String(message ?? 'unknown').slice(0, 400)
  if (crashes.some(c => c.message === msg)) return
  crashes.push({
    kind,
    message: msg,
    stack: stack ? String(stack).split('\n').slice(0, 6).join('\n').slice(0, 900) : undefined,
    where: trail[trail.length - 1],
    at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  })
  if (crashes.length > CRASH_LIMIT) crashes.shift()
}

export const crashCount = (): number => crashes.length

/** Catch what React's ErrorBoundary cannot: a throw inside an event handler, a
 *  timer, or a promise nobody awaited. None of these unmount the tree, so the
 *  game carries on looking fine while something has quietly failed - which is
 *  the class of bug a player reports as "it just stopped doing anything". */
export function installCrashCapture(w: Window = window): void {
  w.addEventListener('error', e => {
    const err = (e as ErrorEvent).error
    recordCrash('window', (e as ErrorEvent).message || String(err), err?.stack)
  })
  w.addEventListener('unhandledrejection', e => {
    const r = (e as PromiseRejectionEvent).reason
    recordCrash('promise', r?.message ?? String(r), r?.stack)
  })
}

const line = (label: string, value: string | number | undefined | null): string =>
  value == null || value === '' ? '' : `${label.padEnd(14)}${value}\n`

/** Roughly how much room the career is taking, in KB. Cheap: the report is not
 *  worth a structured-clone of the whole state, so this measures the JSON. */
function saveSizeKb(state: GameState): number | null {
  try {
    return Math.round(JSON.stringify(state).length / 1024)
  } catch {
    return null
  }
}

export interface ReportInput {
  state?: GameState | null
  /** what the player typed. The whole point; everything else is context. */
  notes: string
  /** failed writes this session. Lives on the store rather than in the save
   *  (a save that failed to write cannot record that it failed to write), so
   *  it is passed in - and it is worth having, because a career that cannot
   *  persist is the most serious thing a player can be reporting. */
  saveFail?: { count: number; message?: string | null }
  /** injectable for the probe, which has no browser */
  nav?: { userAgent: string; language: string }
  screen?: { w: number; h: number; dpr: number; standalone: boolean }
  when?: string
}

/** The report, as the player will see it and as the developer will read it. */
export function buildReport(input: ReportInput): string {
  const { state, notes } = input
  const nav = input.nav ?? (typeof navigator !== 'undefined'
    ? { userAgent: navigator.userAgent, language: navigator.language }
    : { userAgent: 'unknown', language: 'unknown' })
  const scr = input.screen ?? (typeof window !== 'undefined'
    ? {
        w: window.innerWidth, h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      }
    : { w: 0, h: 0, dpr: 1, standalone: false })
  const saveFail = input.saveFail
  const when = input.when ?? new Date().toISOString().slice(0, 19).replace('T', ' ')
  const club = state ? state.clubs[state.userClubId] : null

  let out = ''
  out += 'PHASE: RUGBY MANAGER - BUG REPORT\n'
  out += '=================================\n\n'

  out += 'WHAT HAPPENED\n'
  out += (notes.trim() || '(the player did not add a description)') + '\n\n'

  out += 'BUILD\n'
  out += line('version', typeof __BUILD_TAG__ === 'string' ? __BUILD_TAG__ : 'unknown')
  out += line('reported', when + ' (device clock)')
  out += '\n'

  if (state) {
    out += 'CAREER\n'
    out += line('club', club ? `${club.name} (${club.id})` : state.userClubId)
    out += line('league', club?.leagueId)
    out += line('season', `${state.season} - week ${state.week}, day ${state.day ?? 0}`)
    out += line('seed', state.seed)
    out += line('challenge', state.challenge ?? 'none')
    out += line('test job', state.natTeam ?? 'none')
    out += line('squad', club ? `${club.players.length} players` : null)
    out += line('save fails', saveFail?.count ? `${saveFail.count} (${saveFail.message ?? 'no message'})` : '0')
    out += line('world', `${Object.keys(state.players).length} players, ${Object.keys(state.clubs).length} clubs`)
    out += line('save size', saveSizeKb(state) != null ? `${saveSizeKb(state)} KB` : null)
    out += '\n'
  } else {
    out += 'CAREER\nno career loaded (reported from the title screen)\n\n'
  }

  out += 'DEVICE\n'
  out += line('screen', `${scr.w}x${scr.h} at ${scr.dpr}x`)
  out += line('installed', scr.standalone ? 'yes (home screen app)' : 'no (browser tab)')
  out += line('language', nav.language)
  out += line('browser', nav.userAgent)
  out += '\n'

  if (trail.length) {
    out += 'SCREENS BEFORE THIS\n'
    out += trail.join('  >  ') + '\n\n'
  }

  if (crashes.length) {
    out += `ERRORS CAUGHT (${crashes.length})\n`
    for (const c of crashes) {
      out += `[${c.at}] ${c.kind}${c.where ? ` on ${c.where}` : ''}\n${c.message}\n`
      if (c.stack) out += c.stack + '\n'
      out += '\n'
    }
  } else {
    out += 'ERRORS CAUGHT\nnone - the game did not throw before this report\n\n'
  }

  out += 'Sent from the game. Nothing was uploaded: this text was built on the\n'
  out += 'device and shared by the player.\n'
  return out
}

/** A filename a developer can sort by, for the download route. */
export function reportFilename(state?: GameState | null): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const club = state?.clubs[state.userClubId]?.id ?? 'no-career'
  return `phase-bug-${club}-${stamp}.txt`
}

/** A mailto: body has to survive the browser, the OS handoff and the mail app,
 *  and the practical ceiling is far below what a report with stack traces can
 *  reach. Trimmed for the mail route only - share, copy and download all carry
 *  the whole thing, and the screen says so. */
export const MAILTO_LIMIT = 1800

export function mailtoUrl(report: string, subject = 'PHASE: Rugby Manager - bug report'): string {
  const body = report.length > MAILTO_LIMIT
    ? report.slice(0, MAILTO_LIMIT) + '\n\n[trimmed for e-mail - use Copy or Save for the full report]'
    : report
  return `mailto:${DEV_CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
