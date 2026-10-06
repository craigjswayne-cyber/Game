# PHASE: Brand sheet

One page. The marketing is PHASE stepping outside the app, so everything here is
taken from the game itself. Nothing is invented for marketing.

Proof sheets: `assets/01-brand/final/palette.png`, `typography.png`, `icon/icon-size-check.png`.

## The idea

> **PHASE: Rugby Manager. The rugby management game where the world remembers what you did.**

The loop every asset sells: **decision → consequence → memory → identity → story.**
It is not a slogan bolted on. `src/game/memory.ts` opens with "THE CONSEQUENCE
ENGINE: THE WORLD REMEMBERS WHAT YOU DID", and every story in the store frames
was written by that engine.

## Name

- Full: **PHASE: Rugby Manager**. Short: **PHASE**. Always capitals for PHASE.
- Never "Phase", "PHASE Rugby", "Phase RM".

## Logo

| File | Use |
|---|---|
| `01-brand/final/logo/mark.svg` | The ball and ring. Master vector. |
| `01-brand/final/icon/icon-master.svg`, `icon-master-1024.png` | App icon master (full-bleed square). |
| `01-brand/final/logo/lockup-horizontal-*.png` | Mark + PHASE + RUGBY MANAGER. |
| `01-brand/final/logo/lockup-stacked-dark-bg.png` | Square spaces, press. |
| `01-brand/final/logo/wordmark-*.png` | Where the mark is already present. |

- The geometry is `BrandMark` in `src/ui/components.tsx` and `public/icon.svg`. If one changes, all change, and `scripts/launch/brandkit.mjs` regenerates every export.
- Clear space: at least the ring's width on every side.
- At 32 px and below use `05-website/final/favicon-small.svg`: the ring is dropped so the ball survives.
- Don't recolour, outline, add effects, rotate or place on a busy photograph.

## Colour

Read from `src/ui/tokens.css` (night, the game's default) by `scripts/launch/brand.mjs`. There is no separate marketing palette.

| Role | Token | Hex |
|---|---|---|
| Canvas (backgrounds) | `--canvas` | #1a201e |
| Raised surface | `--surface-1` | #242b29 |
| Rules and frames | `--border-strong` | #4a5553 |
| Text | `--text-primary` | #f0f4f2 |
| Secondary text | `--text-secondary` | #b3bdb9 |
| Action green (one accent) | `--primary` | #34c06f |
| Badge green (icon) | `ramp-g7` | #0f7a43 |
| Value gold (quotes' lead lines only) | `--gold` | #e9be68 |

Rules, from the game's own palette doctrine: green means positive or actionable,
gold means value or attention, red means loss or risk, nothing else gets colour.
In marketing the green appears once per composition, usually as the headline's
full stop.

## Type

**Space Grotesk** (SIL Open Font License 1.1), the game's only typeface: the same
self-hosted variable file, `src/ui/fonts/space-grotesk-latin.woff2`.

| Level | Spec |
|---|---|
| Headline | 700, UPPERCASE, tracking -2 at 1080 px wide, line-height 1.0, set by hand into 2 or 3 lines |
| Eyebrow | 700, uppercase, tracked +5.5, secondary text, mark + PHASE + rule + label |
| Body | 400, secondary text, about 33 px at 1080 px wide |
| Numbers | 700, tight, tabular as in the game |

## Composition

- One idea per asset. Headline, one supporting line, one real screen.
- Real screens only, captured from the build by `scripts/launch/capture.mjs`. No mock UI, no device chrome, no arrows, no circles.
- The screen bleeds off the edge. Let it breathe. Generous negative space.
- Dark canvas with a faint lift behind the screen. No gradients for decoration.

## Voice

British English. Short sentences. Contractions where natural. A rugby
publication that happens to make a game.

- Yes: "Every decision leaves a mark." "Keep your word and they will run through a wall for you."
- No: "ultimate", "revolutionary", "next-level", "immersive experience", "unleash", "embark", "game-changing", exclamation marks, "DOWNLOAD NOW".
- **No em dashes.** Use a full stop, a comma or a colon.
- Never claim what the code doesn't do. Check `docs/launch/FACTS.md` first.
