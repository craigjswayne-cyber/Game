# Contrast audit - every text-on-surface pair the token system promises

Generated from src/ui/tokens.css; re-run whenever a token moves. Bars are WCAG
2.1 AA: 4.5:1 for normal text, 3:1 for large text (24px and up, or 18.66px and
up when bold) and for non-text indicators such as the focus ring (1.4.11).

## The WCAG pass (1.9.x)

An accessibility audit found the old floor in scripts/nightcontrast.mjs sat at
2.2:1, so the mastheads and the live scoreboard were reading at 2.4 to 3.8:1
with the harness green. The harness now holds the real AA bar, by text size,
and it sweeps all ten palettes: the built-in pair plus Midnight, Heritage,
Stealth and the tour red, each at night and in daylight.

| measure | before | after |
|---|---|---|
| nightcontrast floor | flat 2.2:1 | 4.5:1, large text 3:1 |
| palettes swept | 2 (built-in night/day) | 10 (5 palettes x 2 themes) |
| places below AA (built-in pair) | 136 | 0 |
| places below AA (all 10 palettes) | not measured | 0 |
| worst ratio anywhere on screen | 2.44:1 | 3.48:1 (large text, 3:1 bar) |
| focus ring vs canvas and surfaces | 1.57 to 2.31:1 (--border-strong) | 3.85:1 or better (--focus-ring) |

What moved, and why:

- Night hero gradient end `#1e8c4e` -> `#135c39`, and `--on-hero-soft`
  `#b9cfc2` -> `#c0d4c8`. The soft ink was 2.60:1 and the chalk 3.85:1 on
  the light end; the gradient now runs between two deep greens and keeps its
  direction. Darkened rather than lightening the ink, which had nowhere to go.
- Day hero gradient end `#0f7a43` -> `#0c6a3a`, and `--on-hero-soft`
  `#cfe3d6` -> `#d6e8dc` (4.02:1 -> 5.24:1).
- Tour hero gradient end `#C8102E` -> `#9C0C24` in both modes. The shirt red
  stays as `--primary-pressed`; the soft ink was 3.9:1 on it and the live
  score 2.4:1.
- `--text-muted`: night `#8b958f` -> `#a5afa9`, day `#6b7671` -> `#5f6a65`;
  Midnight `#7F8CA3` -> `#8C99AF`, Heritage `#948E86` -> `#A09A92`, Stealth
  `#8A8A8E` -> `#98989C` (each was 4.0 to 4.4:1 on the raised home card), with
  each skin's `--text-secondary` lifted to stay above its muted.
- Day `--gold` `#8a6516` -> `#7a5a12` (4.48:1 on surface-2) and night
  `--danger` `#ef6c63` -> `#f27a71` (4.13:1 on surface-2).
- New `--on-primary-pressed` for the form pill's middle band (white on the
  night green was 4.27:1), and the pill now takes `--on-positive` and
  `--on-danger` on its other bands. `.desk-n` uses `--on-gold-fill` on the
  gold fill (white on it was 1.73 to 2.37:1 in the skins' daylight). Muted text
  on a picked `.club-pick` row reads in `--text-primary`.
- New `--focus-ring` per palette; see the last four rows of each mode below.
- Commentary lines wearing a club's kit pick their ink by WCAG ratio, not a
  brightness guess, and a mid-tone kit is mixed a step toward the far ink
  until its text reads at 4.5:1 (src/ui/kit.ts kitInk). Northampton's green
  with white was 4.17:1, caught mid try-flash on the tour skin.

Final sweep: 28,716 runs of text across 5 palettes x 2 themes, 0 below AA.

scripts/skinprobe.ts now also asserts, for all ten palettes, the focus ring at
3:1 on the canvas and every surface, `--on-hero` and `--on-hero-soft` at 4.5:1
on every hero stop, and the score gold at 3:1 on them.

## The built-in pair

| mode | text | hex | on | hex | ratio | bar | verdict |
|------|------|-----|----|----|-------|-----|---------|
| night | text-primary | #f0f4f2 | canvas | #1a201e | 14.91 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | surface-1 | #242b29 | 13.03 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | surface-2 | #2e3634 | 11.17 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | surface-3 | #384240 | 9.36 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | canvas | #1a201e | 8.58 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | surface-1 | #242b29 | 7.50 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | surface-2 | #2e3634 | 6.43 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | surface-3 | #384240 | 5.39 | >=4.5 | PASS |
| night | text-muted | #a5afa9 | canvas | #1a201e | 7.33 | >=4.5 | PASS |
| night | text-muted | #a5afa9 | surface-1 | #242b29 | 6.40 | >=4.5 | PASS |
| night | text-muted | #a5afa9 | surface-2 | #2e3634 | 5.49 | >=4.5 | PASS |
| night | text-muted | #a5afa9 | surface-3 | #384240 | 4.60 | >=4.5 | PASS |
| night | primary (delta text) | #34c06f | canvas | #1a201e | 7.02 | >=4.5 | PASS |
| night | primary (delta text) | #34c06f | surface-1 | #242b29 | 6.13 | >=4.5 | PASS |
| night | primary (delta text) | #34c06f | surface-2 | #2e3634 | 5.26 | >=4.5 | PASS |
| night | gold (text) | #e9be68 | canvas | #1a201e | 9.47 | >=4.5 | PASS |
| night | gold (text) | #e9be68 | surface-1 | #242b29 | 8.28 | >=4.5 | PASS |
| night | gold (text) | #e9be68 | surface-2 | #2e3634 | 7.10 | >=4.5 | PASS |
| night | danger | #f27a71 | canvas | #1a201e | 6.14 | >=4.5 | PASS |
| night | danger | #f27a71 | surface-1 | #242b29 | 5.36 | >=4.5 | PASS |
| night | danger | #f27a71 | surface-2 | #2e3634 | 4.60 | >=4.5 | PASS |
| night | info | #5aa9e6 | canvas | #1a201e | 6.50 | >=4.5 | PASS |
| night | info | #5aa9e6 | surface-1 | #242b29 | 5.68 | >=4.5 | PASS |
| night | info | #5aa9e6 | surface-2 | #2e3634 | 4.87 | >=4.5 | PASS |
| night | on-primary | #070d0a | primary | #34c06f | 8.32 | >=4.5 | PASS |
| night | on-primary | #070d0a | primary-hover | #4ed88c | 10.76 | >=4.5 | PASS |
| night | on-primary | #070d0a | primary-pressed | #1e8c4e | 4.59 | >=4.5 | PASS |
| night | on-gold-fill | #1f1708 | gold-fill | #e9be68 | 10.15 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | primary-tint | #17332a | 12.26 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | gold-tint | #322914 | 12.93 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | danger-tint | #3a1f1d | 13.58 | >=4.5 | PASS |
| night | on-hero | #f0f4f2 | hero start | #16523a | 8.22 | >=4.5 | PASS |
| night | on-hero-soft | #c0d4c8 | hero start | #16523a | 5.86 | >=4.5 | PASS |
| night | gold (live score, 27px) | #e9be68 | hero start | #16523a | 5.22 | >=3 (large) | PASS |
| night | on-hero | #f0f4f2 | hero end | #135c39 | 7.23 | >=4.5 | PASS |
| night | on-hero-soft | #c0d4c8 | hero end | #135c39 | 5.15 | >=4.5 | PASS |
| night | gold (live score, 27px) | #e9be68 | hero end | #135c39 | 4.59 | >=3 (large) | PASS |
| night | focus-ring (non-text) | #4ed88c | canvas | #1a201e | 9.07 | >=3 (large) | PASS |
| night | focus-ring (non-text) | #4ed88c | surface-1 | #242b29 | 7.93 | >=3 (large) | PASS |
| night | focus-ring (non-text) | #4ed88c | surface-2 | #2e3634 | 6.80 | >=3 (large) | PASS |
| night | focus-ring (non-text) | #4ed88c | surface-3 | #384240 | 5.70 | >=3 (large) | PASS |
| day | text-primary | #14201b | canvas | #f1f4f1 | 15.13 | >=4.5 | PASS |
| day | text-primary | #14201b | surface-1 | #ffffff | 16.77 | >=4.5 | PASS |
| day | text-primary | #14201b | surface-2 | #e8ede9 | 14.15 | >=4.5 | PASS |
| day | text-primary | #14201b | surface-3 | #ffffff | 16.77 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | canvas | #f1f4f1 | 6.49 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | surface-1 | #ffffff | 7.19 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | surface-2 | #e8ede9 | 6.07 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | surface-3 | #ffffff | 7.19 | >=4.5 | PASS |
| day | text-muted | #5f6a65 | canvas | #f1f4f1 | 5.07 | >=4.5 | PASS |
| day | text-muted | #5f6a65 | surface-1 | #ffffff | 5.62 | >=4.5 | PASS |
| day | text-muted | #5f6a65 | surface-2 | #e8ede9 | 4.74 | >=4.5 | PASS |
| day | text-muted | #5f6a65 | surface-3 | #ffffff | 5.62 | >=4.5 | PASS |
| day | primary (delta text) | #0f7a43 | canvas | #f1f4f1 | 4.87 | >=4.5 | PASS |
| day | primary (delta text) | #0f7a43 | surface-1 | #ffffff | 5.40 | >=4.5 | PASS |
| day | primary (delta text) | #0f7a43 | surface-2 | #e8ede9 | 4.56 | >=4.5 | PASS |
| day | gold (text) | #7a5a12 | canvas | #f1f4f1 | 5.74 | >=4.5 | PASS |
| day | gold (text) | #7a5a12 | surface-1 | #ffffff | 6.36 | >=4.5 | PASS |
| day | gold (text) | #7a5a12 | surface-2 | #e8ede9 | 5.37 | >=4.5 | PASS |
| day | danger | #c0362c | canvas | #f1f4f1 | 4.98 | >=4.5 | PASS |
| day | danger | #c0362c | surface-1 | #ffffff | 5.51 | >=4.5 | PASS |
| day | danger | #c0362c | surface-2 | #e8ede9 | 4.65 | >=4.5 | PASS |
| day | info | #185fa5 | canvas | #f1f4f1 | 5.88 | >=4.5 | PASS |
| day | info | #185fa5 | surface-1 | #ffffff | 6.52 | >=4.5 | PASS |
| day | info | #185fa5 | surface-2 | #e8ede9 | 5.50 | >=4.5 | PASS |
| day | on-primary | #ffffff | primary | #0f7a43 | 5.40 | >=4.5 | PASS |
| day | on-primary | #ffffff | primary-hover | #0c6438 | 7.25 | >=4.5 | PASS |
| day | on-primary | #ffffff | primary-pressed | #0a5730 | 8.68 | >=4.5 | PASS |
| day | on-gold-fill | #1f1708 | gold-fill | #e9be68 | 10.15 | >=4.5 | PASS |
| day | text-primary | #14201b | primary-tint | #e2f1e7 | 14.35 | >=4.5 | PASS |
| day | text-primary | #14201b | gold-tint | #faf0da | 14.80 | >=4.5 | PASS |
| day | text-primary | #14201b | danger-tint | #fbe9e7 | 14.30 | >=4.5 | PASS |
| day | on-hero | #ffffff | hero start | #0a5730 | 8.68 | >=4.5 | PASS |
| day | on-hero-soft | #d6e8dc | hero start | #0a5730 | 6.79 | >=4.5 | PASS |
| day | gold (live score, 27px) | #e9be68 | hero start | #0a5730 | 4.97 | >=3 (large) | PASS |
| day | on-hero | #ffffff | hero end | #0c6a3a | 6.69 | >=4.5 | PASS |
| day | on-hero-soft | #d6e8dc | hero end | #0c6a3a | 5.23 | >=4.5 | PASS |
| day | gold (live score, 27px) | #e9be68 | hero end | #0c6a3a | 3.83 | >=3 (large) | PASS |
| day | focus-ring (non-text) | #0f7a43 | canvas | #f1f4f1 | 4.87 | >=3 (large) | PASS |
| day | focus-ring (non-text) | #0f7a43 | surface-1 | #ffffff | 5.40 | >=3 (large) | PASS |
| day | focus-ring (non-text) | #0f7a43 | surface-2 | #e8ede9 | 4.56 | >=3 (large) | PASS |
| day | focus-ring (non-text) | #0f7a43 | surface-3 | #ffffff | 5.40 | >=3 (large) | PASS |

82 pairs measured, 82 pass, 0 fail.

## The skins

Worst body-text pair (primary, secondary and muted on canvas, surface-1 and
surface-2), worst hero ink on either gradient stop, and the focus ring's worst
ratio against the canvas and all three surfaces.

| skin | mode | worst text | worst hero ink | focus ring | worst ring |
|---|---|---|---|---|---|
| Midnight | night | 4.99 | 4.51 | #00c2ff | 6.03 |
| Midnight | day | 4.51 | 4.51 | #00647f | 5.44 |
| Heritage | night | 4.98 | 5.95 | #e06d7b | 3.85 |
| Heritage | day | 5.37 | 5.95 | #8c1d2a | 7.25 |
| Stealth | night | 5.25 | 7.72 | #e5e5ea | 10.46 |
| Stealth | day | 5.16 | 7.72 | #3f3f46 | 8.38 |
| Tour | night | 6.32 | 5.59 | #f2707e | 5.68 |
| Tour | day | 6.62 | 5.59 | #a80c26 | 6.19 |

## Usage rules that still hold

- Muted text still reads quietest on canvas and surface-1. It now clears
  4.5:1 on every surface in the built-in pair, but a skin is only held to it
  on canvas, surface-1 and surface-2.
- Gold and danger as TEXT on the hero are never used: the hero carries
  `--on-hero`, `--on-hero-soft`, `--gold` for the large live score, and
  `--danger-fill` for the sin-bin count.
