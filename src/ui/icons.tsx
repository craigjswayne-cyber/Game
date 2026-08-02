// Crisp stroke icons for the bottom nav — no emoji, premium finish.

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

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
