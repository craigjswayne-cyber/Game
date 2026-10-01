import type { ReactNode } from 'react'

// ---- ICONS, NOT EMOJI (owner, 27 Sep 2026) ----
//
// "Across the game can we use icons instead of emojis. Feels like it cheapens
// the game." Emoji draw differently on every phone (and as a coloured blob in
// the middle of a dark, typographic screen), so the menus and the news carry
// these instead: one stroke weight, one size, drawn in currentColor so every
// theme colours them. icons.tsx keeps the bottom nav's set; these are the rest.

const S = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}
const G = ({ children }: { children: ReactNode }) => (
  <svg className="glyph" viewBox="0 0 24 24" width="1em" height="1em" {...S} aria-hidden>{children}</svg>
)

/** Every icon by name. A name the table lacks draws nothing, never an emoji. */
const PATHS: Record<string, ReactNode> = {
  // the match screen (weather, cards, calls, how to watch)
  rain: <><path d="M7 15a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 18.5 9 3.5 3.5 0 0 1 18 16H7z" /><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" /></>,
  wind: <><path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" /></>,
  snow: <><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  stop: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8" /></>,
  card: <><rect x="7" y="4" width="10" height="16" rx="1.5" fill="currentColor" stroke="none" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M3 15h18M7 5v4M12 5v4M17 5v4M7 15v4M12 15v4M17 15v4" /></>,
  ffwd: <><path d="M3 6.3v11.4l8.5-5.7zM12 6.3v11.4l8.5-5.7z" /></>,
  posts: <><path d="M7 3v18M17 3v18M7 12h10" /></>,
  bolt: <><path d="M13 2L5 13h6l-1 9 8-11h-6z" /></>,
  ball: <><ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-35 12 12)" /><path d="M9 15l6-6M10.5 10.5l3 3" /></>,
  crowd: <><circle cx="8" cy="9" r="2.6" /><circle cx="16" cy="9" r="2.6" /><path d="M3 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6M11 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6" /></>,
  calm: <><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></>,
  wolf: <><path d="M4 4l3 5 5-2 5 2 3-5v9c0 4-3.6 7-8 7s-8-3-8-7z" /><path d="M9 13h.01M15 13h.01M11 16.5h2" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  // the club menu
  team: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="16.5" cy="9" r="2.6" /><path d="M16.2 14.1c2.8.1 4.8 2.1 4.8 5" /></>,
  report: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  tactics: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10l2 2 4-4M9 16h6" /></>,
  academy: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6" /></>,
  training: <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></>,
  medical: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M9 6V4h6v2M12 10v6M9 13h6" /></>,
  fixtures: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  finances: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 8.5c-.6-.9-1.5-1.3-2.6-1.3-1.6 0-2.6 1-2.6 2.2 0 3 5.6 1.6 5.6 4.6 0 1.3-1.2 2.3-2.9 2.3-1.2 0-2.3-.5-2.9-1.4M12 5.5v1.7M12 16.3v2.2" /></>,
  transfers: <><path d="M4 8h14l-3-3M20 16H6l3 3" /></>,
  infra: <><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" /></>,
  club: <><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.1-7.5 9.5-4.4-1.4-7.5-5.1-7.5-9.5V6z" /><path d="M9 12l2 2 4-4" /></>,
  store: <><path d="M4 8h16l-1.5 12h-13z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  // the manager's menu
  profile: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></>,
  press: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  legacy: <><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8z" /></>,
  handbook: <><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  bug: <><rect x="7" y="8" width="10" height="12" rx="5" /><path d="M9 8a3 3 0 0 1 6 0M3 13h4M17 13h4M4 7l3 2M20 7l-3 2M4 19l3-2M20 19l-3-2" /></>,
  about: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.6M12 17h.01" /></>,
  save: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  exit: <><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" /></>,
  // the world menu
  competitions: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" /></>,
  country: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  nations: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" /></>,
  dreamteam: <><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8z" /></>,
  agency: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></>,
  history: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  // the news
  result: <><ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-35 12 12)" /><path d="M9 15l6-6M10.5 10.5l3 3" /></>,
  transfer: <><path d="M4 8h14l-3-3M20 16H6l3 3" /></>,
  injury: <><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)" /><path d="M10 10l4 4" /></>,
  intl: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" /></>,
  board: <><path d="M3 20h18M4 10h16M12 4l8 5H4zM6 10v8M10 10v8M14 10v8M18 10v8" /></>,
  award: <><circle cx="12" cy="9" r="5" /><path d="M9 13.5L7.5 21l4.5-2.5 4.5 2.5-1.5-7.5" /></>,
  contract: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h4" /></>,
  general: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 9h10M7 13h10M7 17h6" /></>,
  youth: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>,
  gossip: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  // the facilities and the ground (model.ts FACILITY_INFO, CampusMap, the store)
  pitch: <><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M12 5v14M3 9.5h2.5v5H3M21 9.5h-2.5v5H21" /></>,
  gym: <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" /></>,
  recovery: <><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" /></>,
  paddock: <><path d="M12 21v-9M12 12C12 8 9.5 6 5 6c0 4 2.5 6 7 6zM12 14c0-3.5 2.2-5.5 7-5.5 0 3.5-2.5 5.5-7 5.5zM6 21h12" /></>,
  kicking: <><path d="M7 21V3M17 21V3M7 13h10" /><ellipse cx="12" cy="7" rx="2.4" ry="1.5" transform="rotate(-30 12 7)" /></>,
  briefing: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M12 16v5M8 21h8M7.5 12l3-3 2 2 4-4" /></>,
  hospitality: <><path d="M7 3h10l-.5 5a4.5 4.5 0 0 1-9 0z" /><path d="M12 12.5V20M8.5 20.5h7" /></>,
  stadium: <><ellipse cx="12" cy="9" rx="9" ry="3.5" /><path d="M3 9v6c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V9M7.5 12.1v5.6M16.5 12.1v5.6M12 12.5v6" /></>,
  build: <><path d="M12.5 3.5l8 8-2.5 2.5-8-8z" /><path d="M12.25 9.75l-8.5 8.5a1.6 1.6 0 0 0 2.25 2.25l8.5-8.5" /></>,
  // honours and moments
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" /></>,
  star: <><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8z" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.1-7.5 9.5-4.4-1.4-7.5-5.1-7.5-9.5V6z" /></>,
  promoted: <><circle cx="12" cy="12" r="8.5" /><path d="M12 16.5v-9M8 11l4-4 4 4" /></>,
  crown: <><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></>,
  badge: <><circle cx="12" cy="9" r="6" /><path d="M8.5 13.9L7 21l5-2.8 5 2.8-1.5-7.1" /><path d="M12 6.3l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.4l2-.3z" /></>,
  trait: <><path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z" /><path d="M19 15v5M16.5 17.5h5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".9" /></>,
  derby: <><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.3-5.3 3.5-8.3.9 1.6 1.2 2.9 1.2 4 1.6-1.4 2.6-4 2.3-7.5 3.6 2.4 6 6.3 6 10.9 0 4.1-2.6 7.1-6.5 7.1z" /></>,
  // people and paper
  handshake: <><path d="M2.5 10.5L6 7l3.5 1.5M21.5 10.5L18 7l-4.5 1.5-4 3.5a1.4 1.4 0 0 0 2 2l2-1.5 4.5 4" /><path d="M5 12.5l5 5a1.4 1.4 0 0 0 2-2M8.5 15.5l2.5 2.5a1.4 1.4 0 0 0 2-2l-1-1" /></>,
  pen: <><path d="M4 20l1.2-4.8L15.5 4.9a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L8.8 18.8z" /><path d="M13.5 7l3.5 3.5" /></>,
  talk: <><path d="M4 5h16v11H9l-5 4z" /></>,
  scout: <><circle cx="6.5" cy="15.5" r="3.5" /><circle cx="17.5" cy="15.5" r="3.5" /><path d="M10 15.5h4M4.5 12.5L6.5 5H9l.8 7.5M19.5 12.5L17.5 5H15l-.8 7.5" /></>,
  tag: <><path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9z" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
  heart: <><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" /></>,
  paper: <><path d="M4 5h13v14a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 19z" /><path d="M17 9h3v10a1.5 1.5 0 0 1-3 0M7 9h7M7 12.5h7M7 16h4" /></>,
  tv: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 3l4 4 4-4" /></>,
  // states and settings
  warning: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></>,
  text: <><path d="M3 19L8 6l5 13M4.8 14.5h6.4M14.5 19l3.25-8.5L21 19M15.6 16.2h4.3" /></>,
  sound: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  // the supporters' mood (owner, round 6: "fans mood should be a face"),
  // five drawn faces from furious to delighted, never an emoji
  faceAngry: <><circle cx="12" cy="12" r="9" /><path d="M7.2 8.2l3.3 1.6M16.8 8.2l-3.3 1.6M8.5 17c1.9-2 5.1-2 7 0" /><circle cx="9.2" cy="11.6" r="1.1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="11.6" r="1.1" fill="currentColor" stroke="none" /></>,
  faceSad: <><circle cx="12" cy="12" r="9" /><path d="M8.5 16.6c1.9-1.6 5.1-1.6 7 0" /><circle cx="9.2" cy="10" r="1.1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="10" r="1.1" fill="currentColor" stroke="none" /></>,
  faceNeutral: <><circle cx="12" cy="12" r="9" /><path d="M8.8 15.4h6.4" /><circle cx="9.2" cy="10" r="1.1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="10" r="1.1" fill="currentColor" stroke="none" /></>,
  faceHappy: <><circle cx="12" cy="12" r="9" /><path d="M8.3 14.2c2 2.3 5.4 2.3 7.4 0" /><circle cx="9.2" cy="10" r="1.1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="10" r="1.1" fill="currentColor" stroke="none" /></>,
  faceDelighted: <><circle cx="12" cy="12" r="9" /><path d="M7.6 10.4c.7-1.2 2.4-1.2 3.1 0M13.3 10.4c.7-1.2 2.4-1.2 3.1 0" /><path d="M7.8 13.3h8.4a4.2 4.2 0 0 1-8.4 0z" fill="currentColor" /></>,
  // the match plans (tactics.ts PRESETS)
  attack: <><path d="M5 6l6 6-6 6M13 6l6 6-6 6" /></>,
  wall: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19" /></>,
  tight: <><path d="M3 12h6M6 9l3 3-3 3M21 12h-6M18 9l-3 3 3 3" /></>,
  scales: <><path d="M12 4v16M8 20h8M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" /></>,
}

export function Glyph({ name }: { name: string }) {
  const p = PATHS[name]
  return p ? <G>{p}</G> : null
}

/** the icon for a news item's type */
export const newsGlyph = (type: string) => <Glyph name={type in PATHS ? type : 'general'} />

/**
 * THE SUPPORTERS' MOOD, AS A FACE (owner, round 6: "fans mood should be a face
 * - angry, sad, neutral, happy, delighted"). Five bands of game.fanMood, the
 * same thresholds as the words beside it (Home, Club): 80 delighted, 62 happy,
 * 45 neutral, 30 sad, below that angry. Drawn in the theme's own tones, so it
 * reads in both themes, and labelled for a screen reader.
 */
export type FanFaceLevel = 'angry' | 'sad' | 'neutral' | 'happy' | 'delighted'
export const fanFaceLevel = (m: number): FanFaceLevel =>
  m >= 80 ? 'delighted' : m >= 62 ? 'happy' : m >= 45 ? 'neutral' : m >= 30 ? 'sad' : 'angry'
const FACE_TONE: Record<FanFaceLevel, string> = {
  delighted: 'var(--text-positive)', happy: 'var(--text-positive)', neutral: 'var(--gold)',
  sad: 'var(--text-negative)', angry: 'var(--text-negative)',
}
export function FanFace({ mood, label, className }: { mood: number; label: string; className?: string }) {
  const lvl = fanFaceLevel(mood)
  const name = `face${lvl[0].toUpperCase()}${lvl.slice(1)}`
  return (
    <span className={`fan-face${className ? ` ${className}` : ''}`} data-face={lvl} role="img" aria-label={label}
      style={{ color: FACE_TONE[lvl] }}>
      <Glyph name={name} />
    </span>
  )
}
