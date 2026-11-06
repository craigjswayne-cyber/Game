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
