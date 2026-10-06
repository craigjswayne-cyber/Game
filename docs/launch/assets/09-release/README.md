# Release communications

One file per release, everything else generated from it.

```
docs/releases/X.Y.Z.md  (the approved words, six languages)
        │
        ├─ node scripts/launch/release.mjs check X.Y.Z   (fails on >500 chars, dashes, missing languages)
        │
GitHub Release vX.Y.Z published
        ├─ .github/workflows/release.yml
        │     ├─ Discord #announcements   (webhook secret DISCORD_RELEASE_WEBHOOK)
        │     └─ run summary: social post + store "What's new", ready to paste
        └─ push to main ─ .github/workflows/pages.yml
              └─ phaserugbymanager.com/changelog.html   (regenerated on every deploy)
```

Nothing downstream adds a word. If the release file is missing or fails its
check, the workflow fails and nothing is posted.

## Per release

1. Copy `docs/releases/TEMPLATE.md` to `docs/releases/X.Y.Z.md`; write en, then the five translations.
2. `node scripts/launch/release.mjs check X.Y.Z` until it passes.
3. Paste `node scripts/launch/release.mjs store X.Y.Z` into each store locale.
4. Commit, merge to main (the website changelog updates).
5. Publish a GitHub Release tagged `vX.Y.Z` (Discord posts itself).
6. Post the staged social copy by hand, with `LCH-12` regenerated for the version (edit `h` and `sub` in `04-social/source/posts.json`, then `node scripts/launch/social.mjs LCH-12`).

## Release notes format

```
PHASE 1.8.11

What's new
• ...

Fixes
• ...

Available now.
```

Six languages: en, fr, es, it, ja, af. The 1.8.11 file keeps each translation's
existing approved wording (some translations shorten the English, as shipped).
