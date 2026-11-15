# PHASE: Rugby Manager 2.0.0: ideas

Started 15 Nov 2026 (owner: "Add that to list for v2.0.0 - we will start
compiling ideas"). A list for collecting ideas, not a plan: nothing here is
promised or scheduled. Each idea says where it came from.

## Match animation

### More variety in the highlight clips

- **From:** Ruben on Instagram, 15 Nov 2026: "Like when your team is in the
  momentum to go score they show you how the try is being scored, i want to
  see more of that gameplay". Owner: "we need to develop more animation pieces
  so we have a good variety. But this is a later version".
- **Today:** the pitch animation (`src/ui/highlight/build.ts`, `momentAt`)
  plays for tries, tries ruled out and tries held up. On the default
  Highlights setting (Key) it also shows kicks and attacks late in a close
  match. Extended, in the match settings, adds kicks at goal and breaks into
  the 22.
- **Ideas:**
  - New clip kinds for moments that happen often and have no animation:
    line breaks, try-saving tackles, turnovers at the breakdown, a driving
    lineout maul, a long kick chase.
  - Decide whether Extended becomes the default, or is offered at the first
    match.
  - Possibly a third level, "Full", for players who want to watch more.
- **Guard:** a probe that holds how often each kind plays, so a match does
  not drag.
