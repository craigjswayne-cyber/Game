#!/usr/bin/env python3
"""Apply a reviewer's Afrikaans edits from the review workbook to af.json.

    python3 scripts/tools/af-review-import.py path/to/afrikaans-review.xlsx [--dry-run]

Reads every row whose 'Your version' is filled in. A row is refused, and
reported, when its {placeholders} differ from the current Afrikaans, so a
renamed or dropped {club} cannot reach a phone. af.json is edited in place,
value by value, so its formatting and every untouched line stay as they are.
Store-listing rows are printed for pasting into docs/store-listing.md by hand.
Run `npx vite-node scripts/langparity.ts` afterwards.
"""
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
AF_PATH = ROOT / 'src/locales/af.json'
PH = re.compile(r'\{(\w+)\}')


def phs(s):
    return sorted(PH.findall(s))


def lookup(node, path):
    for p in re.findall(r'[^.\[\]]+|\[\d+\]', path):
        if p.startswith('['):
            node = node[int(p[1:-1])]
        else:
            node = node[p]
    return node


def locate(text, path, old):
    """Offset of `"leaf": "old"` inside the right branch of the raw JSON text."""
    parts = re.findall(r'[^.\[\]]+|\[\d+\]', path)
    leaf = parts[-1]
    needle = (json.dumps(leaf, ensure_ascii=False) if not leaf.startswith('[') else '') \
        + (': ' if not leaf.startswith('[') else '') + json.dumps(old, ensure_ascii=False)
    lo, hi = 0, len(text)
    for p in parts[:-1]:
        if p.startswith('['):
            continue
        m = re.compile(re.escape(json.dumps(p, ensure_ascii=False)) + r':\s*[\[{]').search(text, lo, hi)
        if not m:
            return None
        lo = m.end()
    hits = [m.start() for m in re.finditer(re.escape(needle), text[lo:hi])]
    if not hits:
        return None
    # the first hit after the parent opens is the one inside it
    return lo + hits[0], needle


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if not args:
        sys.exit(__doc__)
    wb = load_workbook(args[0], read_only=True)
    text = AF_PATH.read_text(encoding='utf-8')
    data = json.loads(text)
    applied, refused, listing = 0, [], []

    for ws in wb.worksheets:
        rows = ws.iter_rows(values_only=True)
        head = next(rows, None)
        if not head or 'Your version' not in head:
            continue
        ki, ni = head.index('Key'), head.index('Your version')
        for row in rows:
            key, new = row[ki], row[ni]
            if not key or new is None or not str(new).strip():
                continue
            new = str(new).strip()
            if key.startswith('store-listing:'):
                listing.append((key, new))
                continue
            try:
                old = lookup(data, key)
            except (KeyError, IndexError, TypeError):
                refused.append((key, 'key no longer exists in af.json'))
                continue
            if new == old:
                continue
            if phs(new) != phs(old):
                refused.append((key, f'placeholders changed: {phs(old)} -> {phs(new)}'))
                continue
            found = locate(text, key, old)
            if not found:
                refused.append((key, 'could not find the line in af.json'))
                continue
            at, needle = found
            replacement = needle[: len(needle) - len(json.dumps(old, ensure_ascii=False))] \
                + json.dumps(new, ensure_ascii=False)
            candidate = text[:at] + replacement + text[at + len(needle):]
            if lookup(json.loads(candidate), key) != new:
                refused.append((key, 'matched the wrong line in af.json; edit by hand'))
                continue
            text = candidate
            applied += 1

    if not dry:
        AF_PATH.write_text(text, encoding='utf-8')
    print(f'{"would apply" if dry else "applied"} {applied} edit(s) to src/locales/af.json')
    for key, why in refused:
        print(f'  REFUSED {key}: {why}')
    if listing:
        print('\nStore listing edits (paste into docs/store-listing.md, Afrikaans listing):')
        for key, new in listing:
            print(f'\n[{key}]\n{new}')
    if refused:
        sys.exit(1)


if __name__ == '__main__':
    main()
