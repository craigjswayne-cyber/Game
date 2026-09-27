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
}

export function Glyph({ name }: { name: string }) {
  const p = PATHS[name]
  return p ? <G>{p}</G> : null
}

/** the icon for a news item's type */
export const newsGlyph = (type: string) => <Glyph name={type in PATHS ? type : 'general'} />
