# Afrikaans native-speaker review

Feedback (Nov 2026, Elma Smit): the Afrikaans is machine translated and reads
"a bit too Dutch". Elma offered to help with the copy. This folder is the
hand-off.

`afrikaans-review.xlsx` holds every Afrikaans string next to its English
source, with an empty **Your version** column. Sheets run in the order a
player meets the text:

| Sheet | Strings | What |
|---|---|---|
| 1 First 10 minutes | 514 | menus, buttons, career setup, home |
| 2 Game screens | 3,944 | squad, tactics, matchday, transfers, finances... |
| 3 Stories & commentary | 4,779 | news, commentary, press, replies, handbook |
| Store listing | 16 | Google Play title and descriptions |

The **Start here** sheet explains the rules (keep `{placeholders}`, `.one` /
`.other` plural forms, `_f` women's-game lines).

## Round trip

```
python3 scripts/tools/af-review-export.py                 # rebuild the workbook from af.json
python3 scripts/tools/af-review-import.py returned.xlsx --dry-run
python3 scripts/tools/af-review-import.py returned.xlsx   # write af.json
npx vite-node scripts/langparity.ts
```

The import edits `af.json` value by value (formatting untouched), refuses any
row whose `{placeholders}` changed, and prints store-listing edits for pasting
into `docs/store-listing.md` by hand.

## Paid proofread (Word)

`afrikaans-proofread.docx` is the 2,901-word brief for a paid proofreader:
store listing, menus, setup, home, settings, Today, shop and Pro Manager. The
proofreader edits the yellow column, with or without Track Changes.
`afrikaans-proofread.keys.json` maps each row number back to its key, so keep
it alongside the document and regenerate both together.

```
python3 scripts/tools/af-review-docx.py export
python3 scripts/tools/af-review-docx.py import returned.docx --dry-run
python3 scripts/tools/af-review-docx.py import returned.docx
```

## Round 1 back: the Fiverr proofread (10 Nov 2026)

`proofread-returned-2026-11-10.xlsx` is the brief as the native speaker
returned it: 466 lines, 113 edited, 352 left as they were (the brief says an
empty "Your version" means the line is fine), 20 question marks, and a notes
sheet of 142 rows.

Applied in 1.9.12 (`scripts/tools/af-proofread-apply.py`, then
`scripts/tools/af-proofread-patterns.py`):

- **68 of her edits**, tidied: 'n with its apostrophe, no space before
  punctuation, the full stop and the first letter as the original line had
  them, and her typos (dierugbywêreld, plek n probeer, Dallende, titleskerm,
  Vloed ligte).
- **Three of her word changes across the whole game**, so no screen says one
  word and the next another: direksie to Raad (210 lines; compounds as
  Raadskamer, Raadsvertroue; plural rade), spangroep to span (185), spreilig
  to vloedlig (6). Rugsteun (back-up) became kopie, after her "Laai 'n vorige
  kopie terug", not stoor, which is the save slots.
- The store listing title stays **PHASE: Rugby Manager** (owner). Her other
  listing edits are not applied yet.

**Held as they were, waiting on her answers** (her version changes the
meaning, because the brief gave no context):

| Key | Why held |
|---|---|
| common.confirmSell | "Confirm sale" sells a player; she wrote aankoop (purchase) |
| desk.moneyRoom | "Wage room" is budget headroom; kamer is a physical room |
| store.charterRefused | "no club on the desk" means out of work; she wrote "no club offers" |
| home.fanBouncing | fans ecstatic, not "Bons" |
| wizard.dreamBlurb | her version drops the instruction sentence |
| common.friendly | a friendly match; she read the adjective (vriendelik) |
| desk.moneyAdmin | administration means insolvency; bewindstelling is the term |
| store.pinnacleLine | "on the spot" (at once) became "daar" (there) |
| store.callMade | "aan gaan" doubles the verb |
| desk.tRival | "speler bankies" for dugout: asked |
| store.charterActivate | "activate on this career" became "activate this career" |

**Asked of her** (the reply sent on Fiverr): the 20 abbreviations (W/G/V,
T, BES 3w, INTL, ordinals, /wk, KE/HE/EIND/US, v, {n}w, wk{n}, pte), academy
(she suggested Instutuut; akademie kept, 134 lines), derby (she suggested
wedstryd; kept, 32 lines), wage share (she suggested aandele, which reads as
stock), and Nasionale Een.

Not covered by this round: about 8,500 lines (news, commentary, press) were
not in the brief; only the three word changes above reached them.
