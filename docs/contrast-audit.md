# Contrast audit - every text-on-surface pair the token system promises

Generated from src/ui/tokens.css; re-run whenever a token moves.
Bars: 4.5:1 for text under 18px, 3:1 at 18px and above (hero rows).

| mode | text | hex | on | hex | ratio | bar | verdict |
|------|------|-----|----|----|-------|-----|---------|
| night | text-primary | #f0f4f2 | canvas | #1a201e | 14.91 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | surface-1 | #242b29 | 13.03 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | surface-2 | #2e3634 | 11.18 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | surface-3 | #384240 | 9.36 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | canvas | #1a201e | 8.58 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | surface-1 | #242b29 | 7.50 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | surface-2 | #2e3634 | 6.43 | >=4.5 | PASS |
| night | text-secondary | #b3bdb9 | surface-3 | #384240 | 5.39 | >=4.5 | PASS |
| night | text-muted | #8b958f | canvas | #1a201e | 5.35 | >=4.5 | PASS |
| night | text-muted | #8b958f | surface-1 | #242b29 | 4.68 | >=4.5 | PASS |
| night | text-muted | #8b958f | surface-2 | #2e3634 | 4.01 | >=4.5 | FAIL |
| night | text-muted | #8b958f | surface-3 | #384240 | 3.36 | >=4.5 | FAIL |
| night | primary (delta text) | #34c06f | canvas | #1a201e | 7.02 | >=4.5 | PASS |
| night | primary (delta text) | #34c06f | surface-1 | #242b29 | 6.14 | >=4.5 | PASS |
| night | primary (delta text) | #34c06f | surface-2 | #2e3634 | 5.26 | >=4.5 | PASS |
| night | gold (text) | #e9be68 | canvas | #1a201e | 9.48 | >=4.5 | PASS |
| night | gold (text) | #e9be68 | surface-1 | #242b29 | 8.28 | >=4.5 | PASS |
| night | gold (text) | #e9be68 | surface-2 | #2e3634 | 7.10 | >=4.5 | PASS |
| night | danger | #ef6c63 | canvas | #1a201e | 5.51 | >=4.5 | PASS |
| night | danger | #ef6c63 | surface-1 | #242b29 | 4.82 | >=4.5 | PASS |
| night | danger | #ef6c63 | surface-2 | #2e3634 | 4.13 | >=4.5 | FAIL |
| night | info | #5aa9e6 | canvas | #1a201e | 6.50 | >=4.5 | PASS |
| night | info | #5aa9e6 | surface-1 | #242b29 | 5.68 | >=4.5 | PASS |
| night | info | #5aa9e6 | surface-2 | #2e3634 | 4.87 | >=4.5 | PASS |
| night | on-primary | #0b1310 | primary | #34c06f | 8.00 | >=4.5 | PASS |
| night | on-primary | #0b1310 | primary-hover | #4ed88c | 10.34 | >=4.5 | PASS |
| night | on-primary | #0b1310 | primary-pressed | #1e8c4e | 4.41 | >=4.5 | FAIL |
| night | on-gold | #1f1708 | gold-fill | #e9be68 | 10.16 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | primary-tint | #17332a | 12.26 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | gold-tint | #322914 | 12.94 | >=4.5 | PASS |
| night | text-primary | #f0f4f2 | danger-tint | #3a1f1d | 13.58 | >=4.5 | PASS |
| night | hero text | #f0f4f2 | hero start | #16523a | 8.22 | >=3 (18px+) | PASS |
| night | hero text | #f0f4f2 | hero end | #1e8c4e | 3.85 | >=3 (18px+) | PASS |
| day | text-primary | #14201b | canvas | #f1f4f1 | 15.13 | >=4.5 | PASS |
| day | text-primary | #14201b | surface-1 | #ffffff | 16.77 | >=4.5 | PASS |
| day | text-primary | #14201b | surface-2 | #e8ede9 | 14.15 | >=4.5 | PASS |
| day | text-primary | #14201b | surface-3 | #ffffff | 16.77 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | canvas | #f1f4f1 | 6.50 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | surface-1 | #ffffff | 7.20 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | surface-2 | #e8ede9 | 6.07 | >=4.5 | PASS |
| day | text-secondary | #4e5a55 | surface-3 | #ffffff | 7.20 | >=4.5 | PASS |
| day | text-muted | #6b7671 | canvas | #f1f4f1 | 4.25 | >=4.5 | FAIL |
| day | text-muted | #6b7671 | surface-1 | #ffffff | 4.71 | >=4.5 | PASS |
| day | text-muted | #6b7671 | surface-2 | #e8ede9 | 3.98 | >=4.5 | FAIL |
| day | text-muted | #6b7671 | surface-3 | #ffffff | 4.71 | >=4.5 | PASS |
| day | primary (delta text) | #0f7a43 | canvas | #f1f4f1 | 4.88 | >=4.5 | PASS |
| day | primary (delta text) | #0f7a43 | surface-1 | #ffffff | 5.41 | >=4.5 | PASS |
| day | primary (delta text) | #0f7a43 | surface-2 | #e8ede9 | 4.56 | >=4.5 | PASS |
| day | gold (text) | #8a6516 | canvas | #f1f4f1 | 4.79 | >=4.5 | PASS |
| day | gold (text) | #8a6516 | surface-1 | #ffffff | 5.31 | >=4.5 | PASS |
| day | gold (text) | #8a6516 | surface-2 | #e8ede9 | 4.48 | >=4.5 | FAIL |
| day | danger | #c0362c | canvas | #f1f4f1 | 4.98 | >=4.5 | PASS |
| day | danger | #c0362c | surface-1 | #ffffff | 5.52 | >=4.5 | PASS |
| day | danger | #c0362c | surface-2 | #e8ede9 | 4.66 | >=4.5 | PASS |
| day | info | #185fa5 | canvas | #f1f4f1 | 5.89 | >=4.5 | PASS |
| day | info | #185fa5 | surface-1 | #ffffff | 6.52 | >=4.5 | PASS |
| day | info | #185fa5 | surface-2 | #e8ede9 | 5.51 | >=4.5 | PASS |
| day | on-primary | #ffffff | primary | #0f7a43 | 5.41 | >=4.5 | PASS |
| day | on-primary | #ffffff | primary-hover | #0c6438 | 7.25 | >=4.5 | PASS |
| day | on-primary | #ffffff | primary-pressed | #0a5730 | 8.68 | >=4.5 | PASS |
| day | on-gold | #1f1708 | gold-fill | #e9be68 | 10.16 | >=4.5 | PASS |
| day | text-primary | #14201b | primary-tint | #e2f1e7 | 14.35 | >=4.5 | PASS |
| day | text-primary | #14201b | gold-tint | #faf0da | 14.81 | >=4.5 | PASS |
| day | text-primary | #14201b | danger-tint | #fbe9e7 | 14.30 | >=4.5 | PASS |
| day | hero text | #ffffff | hero start | #0a5730 | 8.68 | >=3 (18px+) | PASS |
| day | hero text | #ffffff | hero end | #0f7a43 | 5.41 | >=3 (18px+) | PASS |

66 pairs measured, 59 pass, 7 fail.

## Failures, and the usage rule each one sets

- night text-muted on surface-2 (4.01) and surface-3 (3.36): muted text
  lives on canvas and surface-1 only, unless 18px+ (both clear 3:1).
- night danger on surface-2 (4.13): small danger text sits on canvas or
  surface-1; on raised surfaces use the danger-tint chip with text-primary.
- night on-primary on primary-pressed (4.41): a momentary pressed state,
  a hair under the bar. Recommend amending --on-primary to #070d0a
  (clears 4.6:1 on pressed, indistinguishable at a glance) - flagged for
  approval rather than silently changing a specified value.
- day text-muted on canvas (4.25) and surface-2 (3.98): day muted text
  lives on white surfaces (surface-1/3, 5.0:1), or renders 18px+.
- day gold text on surface-2 (4.48): gold figures sit on white or canvas;
  on surface-2 use the gold-fill chip with on-gold text.
