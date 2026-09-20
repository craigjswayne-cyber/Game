/**
 * ==================================================================
 * PHASE: the design system's components.
 * ==================================================================
 *
 * ---- WHY THESE EXIST ----
 *
 * The game shipped twenty exported components and none of them were a
 * button, a card, a table or a tab. Those existed only as CSS class names
 * applied to raw elements and then adjusted at the call site: 1,109 inline
 * `style={{ }}` objects across src/ui, 202 `className="card"`, 68 cards
 * carrying a hand-written `borderLeft: '4px solid ...'` to mean "this one
 * matters", and fourteen distinct inline font sizes in half-pixel steps.
 *
 * That is the whole of why the product reads as assembled rather than
 * designed. Every screen was free to invent its own spacing, its own
 * emphasis and its own idea of what a heading is, and every screen took the
 * offer. No amount of restyling fixes it while the offer stands.
 *
 * So: these are the parts. A screen composes them and does not reach past
 * them. scripts/tokenlint.ts ratchets the inline-style count per file - it
 * may fall and may never rise - which is how the old way stops coming back.
 *
 * ---- WHAT IS DELIBERATELY NOT HERE ----
 *
 * A Table. `.dtable` in theme.css is dense, tabular-figured, sticky-headed,
 * highlights your own row and has been through a sideways-scroll audit in
 * five languages. It is finished work. It gets a thin wrapper in a later
 * phase, not a rewrite.
 *
 * Crest, Jersey and CrestT in components.tsx likewise: procedural club
 * identity, per-club, both themes, zero assets. They stay where they are.
 */
import type { CSSProperties, ReactNode } from 'react'

type Div = { className?: string; style?: CSSProperties; children?: ReactNode }

/* ==================================================================
   TEXT
   ================================================================== */

/** The type roles. A screen asks for what a thing IS, never for a size.
 *
 *  `overline` is the only uppercase role in the system. The game used
 *  uppercase-and-tracked for section titles, chip labels, tile heads, table
 *  headers and metadata simultaneously, which is most of the reason nothing
 *  on a screen looked more important than anything else. */
export type TextRole =
  | 'hero' | 'figure' | 'title' | 'section'
  | 'overline' | 'label'
  | 'lead' | 'body' | 'meta'
export type Tone = 'default' | 'muted' | 'pos' | 'neg' | 'val' | 'info'

const TONE: Record<Tone, string> = {
  default: '', muted: 't-muted', pos: 't-pos',
  neg: 't-neg', val: 't-val', info: 't-info',
}

export function Text({ role = 'body', tone = 'default', num, as, className = '', style, children }: {
  role?: TextRole
  tone?: Tone
  /** tabular figures. Set it on anything that sits in a column beside
   *  another number, which in this game is most numbers. */
  num?: boolean
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3'
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  const Tag = as ?? (role === 'hero' || role === 'title' ? 'h2' : role === 'section' ? 'h3' : 'div')
  return (
    <Tag className={`t t-${role} ${TONE[tone]} ${num ? 't-num' : ''} ${className}`.trim()} style={style}>
      {children}
    </Tag>
  )
}

/* ==================================================================
   LAYOUT
   ================================================================== */

type Gap = 1 | 2 | 3 | 4 | 5 | 6

/** A column. Replaces `style={{ display: 'flex', flexDirection: 'column',
 *  gap: 8 }}`, which appears in some form on nearly every screen. */
export function Stack({ gap = 3, className = '', style, children }: Div & { gap?: Gap }) {
  return <div className={`stk g-${gap} ${className}`.trim()} style={style}>{children}</div>
}

/** A row. `wrap` for chip rows and filter bars. */
export function Inline({ gap = 2, wrap, className = '', style, children }: Div & { gap?: Gap; wrap?: boolean }) {
  return <div className={`inl g-${gap} ${wrap ? 'inl-wrap' : ''} ${className}`.trim()} style={style}>{children}</div>
}

/** The thing that takes the slack in a row. */
export function Grow({ className = '', style, children }: Div) {
  return <div className={`grow ${className}`.trim()} style={style}>{children}</div>
}

/* ==================================================================
   ICON
   ================================================================== */

/** Wraps an icon from icons.tsx at one of four sizes.
 *
 *  Colour comes from `currentColor`, always: an icon is the same colour as
 *  the text beside it or it is not part of the sentence. This is the whole
 *  argument against the 225 emoji it replaces - an emoji brings its own
 *  palette into a design that has a rule about colour. */
export function Icon({ glyph: Glyph, size = 18, className = '', style }: {
  glyph: () => JSX.Element
  size?: 14 | 18 | 22 | 28
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`ico ico-${size} ${className}`.trim()} style={style} aria-hidden="true">
      <Glyph />
    </span>
  )
}

/* ==================================================================
   BUTTON
   ================================================================== */

export type ButtonIntent = 'primary' | 'secondary' | 'ghost' | 'danger'

/**
 * Every state a control can be in, in one place.
 *
 * `selected` is separate from `:active` on purpose and it is not carried by
 * colour: a chosen segment keeps an inset ring, because the game has a
 * colour-blindness probe (scripts/colourblind.ts) that fails any state
 * encoded in hue alone.
 *
 * `loading` keeps the button's width and hides the label rather than
 * swapping it, so a row of buttons does not jump the moment one is pressed.
 */
export function Button({
  intent = 'secondary', size = 'md', block, selected, loading,
  icon, iconRight, onClick, disabled, title, ariaLabel, className = '', style, children,
}: {
  intent?: ButtonIntent
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  selected?: boolean
  loading?: boolean
  icon?: () => JSX.Element
  iconRight?: () => JSX.Element
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  title?: string
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  const cls = [
    'b', `b-${size}`, `b-${intent}`,
    block ? 'b-block' : '', selected ? 'b-on' : '', loading ? 'b-loading' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} style={style} onClick={onClick}
      disabled={disabled || loading} title={title} aria-label={ariaLabel}
      aria-pressed={selected === undefined ? undefined : selected}
      aria-busy={loading || undefined}>
      <span className="b-lab inl g-2">
        {icon && <Icon glyph={icon} size={size === 'sm' ? 14 : 18} />}
        {children}
        {iconRight && <Icon glyph={iconRight} size={size === 'sm' ? 14 : 18} />}
      </span>
    </button>
  )
}

/* ==================================================================
   SURFACES
   ================================================================== */

/**
 * PANEL: a grouping. The quietest surface in the system - one step of
 * lightness, no border, no shadow, no accent bar.
 *
 * The accent bar is the thing this deliberately does not have. `.card` grew
 * a hand-written `borderLeft: '4px solid'` at 68 sites, in gold for the next
 * fixture, gold for the dream, gold for the physio, green for a quiet
 * treatment room, red for a warning and danger red for a sacking. Six
 * meanings, one mark, no rule. Emphasis is position, size and type now.
 */
export function Panel({ flush, onClick, className = '', style, children }: Div & {
  flush?: boolean
  onClick?: () => void
}) {
  const cls = `panel ${flush ? 'panel-flush' : ''} ${className}`.trim()
  return onClick
    ? <button className={cls} style={style} onClick={onClick}>{children}</button>
    : <div className={cls} style={style}>{children}</div>
}

/**
 * TILE: one fact, and its whole job is to let a number be big.
 *
 * THE DELTA IS THE ONLY GREEN THING, which is rule 4 of the colour system:
 * a key figure renders in --text-primary and green appears on the change
 * beside it, never on the figure itself. The arrow is the non-colour channel
 * that carries the same information for anyone who cannot see the hue.
 */
export function StatTile({ label, value, delta, deltaDir, sub, size = 'md', onClick, className = '', style }: {
  label: string
  value: ReactNode
  delta?: string
  deltaDir?: 'up' | 'down'
  sub?: string
  size?: 'md' | 'lg'
  onClick?: () => void
  className?: string
  style?: CSSProperties
}) {
  const body = (
    <>
      <div className="t t-overline">{label}</div>
      <Inline gap={2}>
        <div className="tile-v">{value}</div>
        {delta && (
          <div className={`tile-d ${deltaDir ?? ''}`}>
            {deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : ''}{delta}
          </div>
        )}
      </Inline>
      {sub && <div className="t t-meta t-muted">{sub}</div>}
    </>
  )
  const cls = `tile ${size === 'lg' ? 'tile-lg' : ''} ${className}`.trim()
  return onClick
    ? <button className={cls} style={style} onClick={onClick}>{body}</button>
    : <div className={cls} style={style}>{body}</div>
}

/* ==================================================================
   CHIP
   ================================================================== */

/**
 * A STATUS, never a fact.
 *
 * The game used chips to display values - "Value £3.4m", "Wage £5.8k/wk",
 * "Balance £2.1m", "Contract to 2029" - fourteen of them on a player profile
 * and eight on Finances. That is what flattens a screen: every number in an
 * identical pill means no number is primary, which is why the player profile
 * has no headline rating and Finances has no headline figure.
 *
 * Facts are StatTiles or definition lists. A chip says injured, listed,
 * captain, on loan, window open. A state, not a measurement.
 */
export function Chip({ tone = 'default', icon, className = '', style, children }: Div & {
  tone?: 'default' | 'pos' | 'val' | 'neg' | 'info'
  icon?: () => JSX.Element
}) {
  return (
    <span className={`chip ${tone !== 'default' ? `chip-${tone}` : ''} ${className}`.trim()} style={style}>
      {icon && <Icon glyph={icon} size={14} />}
      {children}
    </span>
  )
}

/* ==================================================================
   TABS
   ================================================================== */

export function Tabs<T extends string>({ value, onChange, items, className = '' }: {
  value: T
  onChange: (v: T) => void
  items: { id: T; label: string }[]
  className?: string
}) {
  return (
    <div className={`tabs ${className}`.trim()} role="tablist">
      {items.map(it => (
        <button key={it.id} role="tab" aria-selected={it.id === value}
          className={it.id === value ? 'on' : ''}
          onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ==================================================================
   SHEET
   ================================================================== */

/**
 * The one thing in the system allowed to cast a shadow, because it is the
 * one thing genuinely above the page rather than on it.
 *
 * The veil closes it and the body does not, which is the behaviour the
 * eleven existing `.modal-veil` call sites already rely on.
 */
export function Sheet({ onClose, label, className = '', children }: {
  onClose: () => void
  label?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className="sheet-veil" onClick={onClose}>
      <div className={`sheet ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label}
        onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        {children}
      </div>
    </div>
  )
}

/* ==================================================================
   RATING
   ================================================================== */

/**
 * The big number a player profile is built around.
 *
 * It rolls when it changes. A rating going 79 to 80 after a season of
 * training is the most satisfying event a management game has, and this one
 * renders it in a chip the same size as "Character Loyal". `key` on the
 * value is what restarts the animation; the caller passes the rating and
 * gets the moment for free.
 */
export function Rating({ value, sub, size = 'lg' }: {
  value: number | string
  sub?: string
  size?: 'sm' | 'lg'
}) {
  return (
    <div className={`rating ${size === 'sm' ? 'rating-sm' : ''}`}>
      <span key={String(value)} className="rating-v rating-roll">{value}</span>
      {sub && <span className="t t-overline">{sub}</span>}
    </div>
  )
}

/* ==================================================================
   METER
   ================================================================== */

/**
 * ONE progress bar for the whole game. Board confidence, the contract clock,
 * a facility build, manager reputation and the dressing room were five
 * hand-drawn bars with five different heights and radii.
 *
 * It animates by transform rather than width: width is a layout property and
 * animating it makes the browser re-lay-out the row on every frame, which on
 * a phone is how a list judders while a number ticks up.
 */
export function Meter({ value, tone = 'default', label }: {
  /** 0 to 1 */
  value: number
  tone?: 'default' | 'val' | 'neg'
  label?: string
}) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`meter ${tone === 'val' ? 'meter-val' : tone === 'neg' ? 'meter-neg' : ''}`}
      role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}
      aria-label={label}>
      <i style={{ transform: `scaleX(${v})` }} />
    </div>
  )
}

export function Divider({ style }: { style?: CSSProperties }) {
  return <hr className="divider" style={style} />
}
