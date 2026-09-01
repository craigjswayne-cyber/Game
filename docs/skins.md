# Skins (v1.2.1)

Three palettes, chosen in Settings (manager menu, above Report a Bug). Each is
a complete swap of the same role tokens the built-in night/day pair uses, so a
skin can only reach colours the design system already owns.

The colours live in `src/ui/tokens.css` — the one file in the game allowed to
hold a hex (`scripts/tokenlint.ts` enforces it). `scripts/skinprobe.ts` measures
every pair below and fails the build if any drops under WCAG AA;
`scripts/skinui.mjs` drives the real page in a browser.

## The mapping

The brief named tokens in one vocabulary and the game uses another. They line
up like this — the left column is what was asked for, the right is what the
game actually reads:

| Brief | Token in the game | Notes |
|---|---|---|
| `appBackground` | `--canvas` | the page behind everything |
| `cardBackground` | `--surface-1` | every card and table row |
| — | `--surface-2`, `--surface-3` | elevation is surface lightness, never shadow |
| `headerBackground` | `--hero-gradient` | club header and matchday hero only |
| `primaryButtonBackground` | `--primary` | also the interactive/accent text colour |
| `primaryButtonText` | `--on-primary` | |
| `textPrimary` | `--text-primary` | |
| `textSecondary` | `--text-secondary` | |
| `textMuted` | `--text-muted` | |
| `border` / `divider` | `--border`, `--border-strong` | |
| `statusSuccess` | `--positive` (+ `--on-positive`) | wins, positive deltas |
| `statusDanger` | `--danger` (+ `--danger-fill`) | losses, alerts |
| `statusWarning` | `--gold` (+ `--gold-fill`) | value, attention, prices |

`--positive` is new in v1.2.1. It used to be an alias of `--primary`, which was
true only while every theme's accent was the positive green. Two of these skins
have a cyan or near-white accent, and a form guide that draws a win in the
button colour stops reading at a glance — which the brief specifically said must
not happen. Themes that do not declare `--positive` still fall back to
`--primary`, so the built-in pair is unchanged.

## The three

| | Tactical Midnight | Heritage Gold | OLED Stealth |
|---|---|---|---|
| `--canvas` | `#0B1320` | `#18181A` | `#000000` |
| `--surface-1` | `#162032` | `#232326` | `#1C1C1E` |
| `--primary` | `#00C2FF` | `#E06D7B` | `#E5E5EA` |
| `--gold` | `#FFB800` | `#D8A24A` | `#C8A05A` |
| `--danger` | `#FF7A6E` | `#EF6C63` | `#EC5C66` |
| `--positive` | `#3DDC84` | `#4ED88C` | `#4ED88C` |
| `--text-primary` | `#FFFFFF` | `#F4F1EA` | `#FFFFFF` |
| `--text-secondary` | `#8E9AAF` | `#9A948D` | `#9A9AA0` |
| worst measured pair | 4.8:1 | 4.63:1 | 4.95:1 |

## Where the brief and the game disagreed

Three supplied values could not ship as given. Each was changed as little as
possible and the reason is repeated beside the block in `tokens.css`:

1. **Heritage `#8C1D2A`** measured **1.73:1** on its own card — unusable as
   text. It is a surface colour, and is used as one: it is the header gradient,
   carrying `#F4F1EA` at 8.01:1. The interactive accent is its text-safe twin,
   `#E06D7B` (4.96:1).
2. **Stealth `#7C7C80`** secondary text measured **4.09:1** on `#1C1C1E`, under
   the 4.5 floor the brief itself asked for. Lifted to `#9A9AA0` (6.08:1).
3. **Stealth named one highlight** (`#E63946`) for a game that needs two roles:
   value/attention and loss/risk. Painted with one colour, a price and a defeat
   look identical. The red is kept exactly as given for alerts and losses (as
   `--danger-fill`, with `#EC5C66` as its text-safe twin) and a low-saturation
   amber carries value.

## What a skin does not touch

- **The pitch stays grass.** `--pitch-a`/`--pitch-b` are green in every skin;
  skinning the interface does not repaint a rugby field.
- **Club crests are club data**, not theme, and are unchanged — the skins were
  checked against the league table for exactly this.
- **Referee's cards, the ball, the posts and the tee** are depictions, not
  interface colour, and sit outside the palette in both modes already.
- **Nothing about the football.** No rule, rating or result reads a colour.
