// Crisp stroke icons for the bottom nav - no emoji, premium finish.

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// Home is the club summary now that the inbox is its own screen (user: "buttons
// on the left should be home (summary) Inbox, squad, selection and tactics"), so
// the tray icon moved to Inbox and Home got a roof.
export const IcoHome = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M5.5 9.6V19h13V9.6" />
    <path d="M10 19v-5h4v5" />
  </svg>
)

export const IcoInbox = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 5h16v14H4z" />
    <path d="M4 13h5l1.5 2h3L15 13h5" />
  </svg>
)

export const IcoBall = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <ellipse cx="12" cy="12" rx="9.2" ry="6" transform="rotate(-28 12 12)" />
    <path d="M8.6 13.8l6.8-3.6M10.3 15.4l6.8-3.6M6.9 12.2l6.8-3.6" strokeWidth="1.4" />
  </svg>
)

export const IcoClipboard = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3h6v1.5" />
    <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4.5" strokeWidth="1.4" />
  </svg>
)

export const IcoTrophy = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
    <path d="M8 5.5H5a3 3 0 0 0 3 4.5M16 5.5h3a3 3 0 0 1-3 4.5" />
    <path d="M12 14v3.5M8.5 20.5h7M10 17.5h4" />
  </svg>
)

/** The country desk. A globe with the meridians a rugby ball's seams suggest -
 *  it has to read at 20px on a bottom bar beside a trophy and a clipboard, so
 *  it is three strokes and no more. */
export const IcoGlobe = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17" />
  </svg>
)

export const IcoTransfer = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 8.5h12.5M13.5 4.5l4 4-4 4" />
    <path d="M20 15.5H7.5M10.5 11.5l-4 4 4 4" />
  </svg>
)

export const IcoPress = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4.5 5.5h12v14h-12a1.8 1.8 0 0 1-1.8-1.8V7.3a1.8 1.8 0 0 1 1.8-1.8z" transform="translate(1.3 -0.5)" />
    <path d="M17.8 9h2.4a1 1 0 0 1 1 1v7.2a1.8 1.8 0 0 1-1.8 1.8" />
    <path d="M8.5 9h6M8.5 12.2h6M8.5 15.4h3.6" strokeWidth="1.4" />
  </svg>
)

// The match controls (owner, 27 Sep 2026: "play should be just a play/pause
// button, skip becomes a fast-forward button, squad just the two heads").
// Filled, not stroked: at 20px on a button a stroked triangle reads thin.
export const IcoPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" /></svg>
)
export const IcoPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>
)
export const IcoFastForward = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3 6.3v11.4a.8.8 0 0 0 1.2.7l8.3-5.7a.8.8 0 0 0 0-1.4L4.2 5.6A.8.8 0 0 0 3 6.3z" />
    <path d="M12 6.3v11.4a.8.8 0 0 0 1.2.7l8.3-5.7a.8.8 0 0 0 0-1.4l-8.3-5.7a.8.8 0 0 0-1.2.7z" />
  </svg>
)
export const IcoPeople = () => (
  <svg viewBox="0 0 24 24" {...S} aria-hidden>
    <circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <circle cx="16.5" cy="9" r="2.6" /><path d="M16.2 14.1c2.8.1 4.8 2.1 4.8 5" />
  </svg>
)

// The board's objectives on Finances (1.8.0): met, on course, not yet. They
// were three emoji, and the owner will not have emoji in the game's UI.
export const IcoTick = () => (
  <svg viewBox="0 0 24 24" {...S} aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M8 12.4l2.7 2.7L16.2 9.6" /></svg>
)
export const IcoClock = () => (
  <svg viewBox="0 0 24 24" {...S} aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
)
export const IcoOpen = () => (
  <svg viewBox="0 0 24 24" {...S} aria-hidden><rect x="4.5" y="4.5" width="15" height="15" rx="2.5" /></svg>
)
