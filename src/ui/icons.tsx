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

/* ==================================================================
   THE FULL SET (1.8.0)
   ==================================================================

   The eight icons above were the bottom nav and nothing else. Everywhere
   else the game used emoji - 225 glyphs across the UI source: 🏥 🏋️ 📊 🎓
   💰 🔁 🏗️ in the hub menu, 🗣️ 🧊 📣 😄 as team-talk buttons, 🎯 🧱 ⚔️ as
   game plans, 📅 📝 🏛 in the season card.

   Emoji are the loudest "generated application" signal in the product and
   they are not a style choice, they are the absence of one. They render as
   a different drawing on every operating system, they cannot take
   currentColor so they never match the text beside them, they cannot be
   aligned to a baseline, they carry their own colour into a palette that
   has a rule about colour, and at 11px on a menu row they are mud.

   These replace them. One grid (24), one stroke (1.8 via S above, 1.4 for
   interior detail), currentColor throughout, and drawn to read at 18px
   because that is the size a menu row and a tab actually use.

   Emoji survive in exactly one place: inside commentary and news PROSE,
   where they are the writer's voice rather than the interface's iconography.
*/

/** Medical. A cross in a rounded square rather than the 🏥 building: at 18px
 *  a hospital is a smudge and a cross is a cross. */
export const IcoMedical = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)

/** Training. A dumbbell, read end-on so it is symmetrical at small sizes. */
export const IcoTraining = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5" />
    <path d="M7 12h10" />
  </svg>
)

/** Analysis. Bars, because the briefing suite is where numbers are read. */
export const IcoChart = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8.5 20v-6M13 20v-10M17.5 20v-4" />
  </svg>
)

/** The academy. A mortar board, flattened so it does not read as an envelope. */
export const IcoAcademy = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M12 4.5 21.5 9 12 13.5 2.5 9z" />
    <path d="M6.5 11v5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5" />
  </svg>
)

/** Money. A coin with a bar through it - a bag (💰) needs three curves the
 *  stroke weight cannot afford at this size. */
/* A NOTE, NOT A POUND SIGN IN A CIRCLE. The first drawing put a £ at 1.4
   stroke inside an 8.5r circle, which is legible on the systemqa contact
   sheet at 22px and a grey smudge in the Hub at 20px in --text-muted, where
   it actually has to work. Nothing inside a small icon can be a letterform
   except a letterform that IS the icon (see IcoHelp). */
export const IcoMoney = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.7" />
    <path d="M6 9.6v4.8M18 9.6v4.8" strokeWidth="1.4" />
  </svg>
)

/** The ground. Stands round a pitch, seen flat on. */
/* A BOWL WITH A RECTANGULAR PITCH IN IT. Two concentric ellipses is an eye,
   and that is what the Hub's Club Information row looked like. The pitch has
   to be square-ish for the shape to read as a ground seen from the stand
   rather than as a pupil. */
export const IcoStadium = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M2.6 8.7c1.8-1.8 5.3-2.9 9.4-2.9s7.6 1.1 9.4 2.9l-2 8.1c-1.7 1.3-4.4 2.1-7.4 2.1s-5.7-.8-7.4-2.1z" />
    <path d="M8 10.7h8l-.9 4.4H8.9z" strokeWidth="1.4" />
  </svg>
)

/** Building work. A crane arm, which is also what the campus map draws on a
 *  plot the builders are on. */
/* TWO BLOCKS AND A GROUND LINE. The first drawing was an abstract L with a
   spur, meant to read as a crane; at 20px it read as a flag. Infrastructure
   is buildings, so the icon is buildings - a low one and a tall one, which
   also says the thing the screen is about, that they grow. */
export const IcoBuild = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M2.8 20.5h18.4" />
    <path d="M5.4 20.5V10.2h5.6v10.3" />
    <path d="M11 20.5V4.4h7.6v16.1" />
    <path d="M13.9 8.4h1.8M13.9 12.4h1.8" strokeWidth="1.4" />
  </svg>
)

/** The calendar, for fixtures and the season ahead. */
export const IcoCalendar = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2.6" />
    <path d="M3.5 10.5h17" />
    <path d="M8 3.5v4M16 3.5v4" />
  </svg>
)

/** A person. Squad lists, the manager, anything about one human. */
export const IcoPerson = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </svg>
)

/** People. A squad, a crowd, the bench. */
export const IcoPeople = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="9" cy="8.5" r="3.4" />
    <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16 5.6a3.4 3.4 0 0 1 0 5.8M17.4 14.6a6.2 6.2 0 0 1 3.8 4.9" strokeWidth="1.4" />
  </svg>
)

/** Settings. */
export const IcoCog = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" strokeWidth="1.4" />
  </svg>
)

/** Search. */
export const IcoSearch = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="10.8" cy="10.8" r="6.5" />
    <path d="M15.6 15.6 20.5 20.5" />
  </svg>
)

/** A filter, for the transfer market and every sortable table. */
export const IcoFilter = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M3.5 6h17l-6.6 7.6V20l-3.8-2.2v-4.2z" />
  </svg>
)

export const IcoChevronRight = () => (
  <svg viewBox="0 0 24 24" {...S}><path d="m9.5 5.5 7 6.5-7 6.5" /></svg>
)
export const IcoChevronLeft = () => (
  <svg viewBox="0 0 24 24" {...S}><path d="m14.5 5.5-7 6.5 7 6.5" /></svg>
)
export const IcoChevronDown = () => (
  <svg viewBox="0 0 24 24" {...S}><path d="m5.5 9.5 6.5 7 6.5-7" /></svg>
)
export const IcoClose = () => (
  <svg viewBox="0 0 24 24" {...S}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IcoCheck = () => (
  <svg viewBox="0 0 24 24" {...S}><path d="m4.5 12.5 5 5 10-11" /></svg>
)
export const IcoPlus = () => (
  <svg viewBox="0 0 24 24" {...S}><path d="M12 5v14M5 12h14" /></svg>
)

/** Play and pause, for the match ticker. The glyphs the speed row used were
 *  the text characters ▶ and ❚❚, which are a different width in every font. */
export const IcoPlay = () => (
  <svg viewBox="0 0 24 24" {...S} fill="currentColor" stroke="none">
    <path d="M7.5 5.2 19 12 7.5 18.8z" />
  </svg>
)
export const IcoPause = () => (
  <svg viewBox="0 0 24 24" {...S} fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
)
export const IcoSkip = () => (
  <svg viewBox="0 0 24 24" {...S} fill="currentColor" stroke="none">
    <path d="M5 5.2 14 12 5 18.8z" />
    <rect x="15.6" y="5" width="3.4" height="14" rx="1.2" />
  </svg>
)

/** A whistle: the referee, the kick-off, the full-time stamp. */
export const IcoWhistle = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M13.5 8.5h6.2a1.3 1.3 0 0 1 1.3 1.3v3.6a4.6 4.6 0 1 1-4.6-4.6" />
    <circle cx="9.4" cy="13.1" r="1.6" strokeWidth="1.4" />
    <path d="M13.5 8.5 11 5.2" />
  </svg>
)

/** An alert. Board warnings, sackings, the things that cost you. */
export const IcoAlert = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M12 4.2 21.4 19.4H2.6z" />
    <path d="M12 10v4M12 16.6v.1" />
  </svg>
)

/** A star, for the dream, the roll of honour, the player of the month. */
export const IcoStar = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="m12 3.8 2.6 5.5 5.9.8-4.3 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.5 10.1l5.9-.8z" />
  </svg>
)

/** A shirt. The squad, the kit, a player's club. */
export const IcoShirt = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M9 3.8 4 6.2l1.4 4L8 9.4V20h8V9.4l2.6.8 1.4-4-5-2.4a3 3 0 0 1-6 0z" />
  </svg>
)

/** The handbook and every written thing: rules, history, the press. */
export const IcoBook = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5H19v17H5.7A1.7 1.7 0 0 0 4 22.2z" transform="translate(0 -1)" />
    <path d="M4 18.2A1.7 1.7 0 0 1 5.7 16.5H19" strokeWidth="1.4" />
  </svg>
)

/** A door: the exit, the main menu, leaving a job. */
export const IcoDoor = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M14 3.5H6.5v17H14" />
    <path d="M11 12h9.5M17 8.5l3.5 3.5L17 15.5" />
  </svg>
)

/** A save: a disk, which is an anachronism everybody still reads instantly. */
export const IcoSave = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4.5 4.5h12L20 8v11.5H4.5z" />
    <path d="M8 4.5v5h7v-5M8 19.5v-5h8v5" strokeWidth="1.4" />
  </svg>
)

/** A pitch seen from above: tactics, the game plan, set pieces. */
export const IcoPitch = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="2.8" y="5" width="18.4" height="14" rx="1.4" />
    <path d="M12 5v14" />
    <path d="M2.8 9.2h2.8v5.6H2.8M21.2 9.2h-2.8v5.6h2.8" strokeWidth="1.4" />
  </svg>
)

/** A megaphone: the press room, the team talk, anything spoken at volume. */
export const IcoMegaphone = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 10v4a1.6 1.6 0 0 0 1.6 1.6h2.2L15 20V4l-7.2 4.4H5.6A1.6 1.6 0 0 0 4 10z" />
    <path d="M18 9.2a4 4 0 0 1 0 5.6" strokeWidth="1.4" />
  </svg>
)

/** A target: objectives, the board's demands, kick at goal. */
export const IcoTarget = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="4.2" strokeWidth="1.4" />
    <circle cx="12" cy="12" r=".6" strokeWidth="1.6" />
  </svg>
)

/** A stopwatch: game time, the minute clock, sharpness. */
export const IcoClock = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="13" r="7.8" />
    <path d="M12 9v4l2.6 1.8" />
    <path d="M9.6 2.8h4.8" />
  </svg>
)

/** A handshake: contracts, deals, partnerships in the dressing room. */
/* TWO ARROWS, NOT A HANDSHAKE. Four fingers and two cuffs is about fourteen
   strokes inside a 20px box; the shape it made in the Hub was a moustache.
   Opposing arrows are what every transfer market in every sport uses, and
   they survive being 20px and muted. */
export const IcoDeal = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 9.2h13" />
    <path d="M13.6 5.6 17.2 9.2l-3.6 3.6" />
    <path d="M20 14.8H7" />
    <path d="M10.4 18.4 6.8 14.8l3.6-3.6" />
  </svg>
)

/** A seedling: the academy intake, a prospect, development. */
export const IcoGrowth = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M12 20v-7" />
    <path d="M12 13c0-3.4-2.6-6-6-6 0 3.4 2.6 6 6 6z" />
    <path d="M12 13c0-3.4 2.6-6 6-6 0 3.4-2.6 6-6 6z" />
  </svg>
)

/* ---- Phase 1: the five the submenus still needed.
   The three group menus carried 29 emoji, which is a fourth icon language in
   a shell that already had drawn glyphs on the nav rail and a text chevron in
   the header. Twenty-four of the twenty-nine had a glyph here already; these
   are the five that did not. Same 24px grid, same stroke, same S. */

/** A basket: the supporter store, the only door in the game that takes money. */
export const IcoCart = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M3 5h2.2l2.3 10.2a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20 8H6.2" />
    <circle cx="9.5" cy="20" r="1.3" />
    <circle cx="17" cy="20" r="1.3" />
  </svg>
)

/** A case: a job, a vacancy, somebody else's dugout. */
export const IcoBriefcase = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3" y="7.5" width="18" height="12" rx="2" />
    <path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5" />
    <path d="M3 12.5h18" />
  </svg>
)

/** About, credits, the privacy policy: what this is and who made it. */
export const IcoInfo = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.2" />
    <path d="M12 7.9h.01" strokeWidth="2.2" />
  </svg>
)

/** How to play. The one glyph in the set that is a letterform, because a
    question mark is read faster than any drawing of one. */
export const IcoHelp = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9.7 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.8-.9 1.4v.5" />
    <path d="M12 16.6h.01" strokeWidth="2.2" />
  </svg>
)

/** A flag on a pole: a nation, as distinct from the globe the world wears. */
export const IcoFlag = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M6 21V3.8" />
    <path d="M6 4.4h11.6l-2.4 4 2.4 4H6" />
  </svg>
)
