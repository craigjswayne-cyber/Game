# Palette migration note - where the old palette had no clean equivalent

The two-accent token system (src/ui/tokens.css) replaced the charcoal-and-
one-green palette. Most of the move was mechanical: --paper became
--surface-1, --ink became the text ramp, --hairline became --border, and the
old --gold accent family split by MEANING - its action uses (active tabs,
selected tiles, meters, focus) went to the primary green family, its value
and attention uses (unread stripes, big-moment flashes, elite figures, the
captain's mark) went to the real gold. The judgement calls:

1. **Club identity is data, not theme.** --club1 / --club2 / --club1-ink and
   the fixture channels (--home-c/--away-c, --c1/--c2) are set per save from
   club data at runtime. They stay outside the token file by design; their
   FALLBACKS now reference tokens instead of hexes. scripts/tokenlint.ts
   exempts src/data/** for the same reason.

2. **Match-scene props.** The referee's cards, the ball, the posts, the
   kicking tee and the white-on-scene labels are depictions of objects: a
   yellow card is yellow in both modes. They live in tokens.css under
   --prop-* with identical values in both modes, outside the two-accent rule.

3. **The old "Best XV gradient" buttons.** The previous wave put a green
   gradient on Continue and .btn.gold. The brief restricts the hero gradient
   to the club header and matchday hero, so those buttons became FLAT filled
   primary (--primary + --on-primary), which also satisfies "one filled
   primary button per view". The masthead and scoreboard took the gradient.

4. **Added tokens the brief did not name** (all in tokens.css):
   --on-gold, --on-danger, --on-info (chip text pairings), --on-hero /
   --on-hero-soft (text over the hero gradient), --scrim (modal veil),
   --pitch-a/--pitch-b (the brief's "desaturated dark green" pitch, per
   mode), --gold-fill at night (= --gold there; day splits text/fill), and
   the --prop-* scene set. Night --on-primary was amended #0b1310 to #070d0a
   with approval, clearing 4.5:1 on the pressed state.

5. **De-coloured on principle** ("nothing else gets colour"): draw pips and
   the D form pip are neutral (--border-strong); mid-tier status words
   ("Secure", scout grade 2) dropped from a second green to text tokens;
   section-heading underlines and table rules dropped from accent to
   --border-strong; press metadata (outlet, dates) reads as text, not gold.
   Manager badges: gold badge is --gold, platinum leans --info, silver
   --text-secondary, bronze --prop-tee-edge.

6. **Elevation is lightness now.** var(--shadow-1/2) is gone and buttons/
   cards are flat surfaces (surface-1 to 3). Achromatic rgba() overlays
   remain in two roles only: legibility scrims over imagery/pitch scenes and
   glass highlights on scene props - they are not elevation and not hex, and
   tokenlint flags anything chromatic that tries to come back as rgba.

7. **The share card** (season summary image) wears the hero gradient with
   on-hero text and gold cups - brand imagery, treated as a hero surface.

8. **Mode wiring.** Night is the default: a fresh install (no rm-night key)
   opens under the floodlights; rm-night='0' is daylight. The night block is
   scoped to :root AND .app.night, day to .app.day/.app:not(.night), so the
   existing toggle works unchanged.

Enforcement: scripts/tokenlint.ts (no hex outside tokens.css, retired token
names banned), scripts/paletteqa.mjs (rendered-page contract: night default,
both modes' anchors, hero rationing, one filled primary per view, neutral key
numbers, selection = primary), docs/contrast-audit.md (66 token pairs, 60
pass, 6 converted into usage rules).
