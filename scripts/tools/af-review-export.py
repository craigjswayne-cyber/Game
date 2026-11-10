#!/usr/bin/env python3
"""Build the Afrikaans review workbook for a native-speaker reviewer.

Every Afrikaans string sits next to its English source, with an empty column
for the reviewer's version. Sheets are ordered by how soon a player meets the
text, so a reviewer with limited time fixes what matters most first.

    python3 scripts/tools/af-review-export.py
    -> docs/afrikaans-review/afrikaans-review.xlsx

    python3 scripts/tools/af-review-export.py --brief
    -> docs/afrikaans-review/afrikaans-proofread-brief.xlsx  (paid proofread:
       store listing plus the core screens, Today, shop and Pro Manager: about 2,900 words)

Bring the edits back with af-review-import.py.
"""
import json
import re
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = Path(__file__).resolve().parents[2]
EN = json.loads((ROOT / 'src/locales/en.json').read_text(encoding='utf-8'))
AF = json.loads((ROOT / 'src/locales/af.json').read_text(encoding='utf-8'))
OUT = ROOT / 'docs/afrikaans-review/afrikaans-review.xlsx'
SIBLING = re.compile(r'_(f|w|fw)$')

# Sheet 1: what a new player reads in the first ten minutes.
FIRST = ['menu', 'nav', 'titles', 'groups', 'wizard', 'common', 'home', 'settings',
         'store', 'pro', 'feedback', 'about', 'supporter', 'intro', 'tele', 'desk']
# Sheet 3: long-form story text, the bulk of the file.
STORY = ['news', 'comm', 'press', 'reply', 'talk', 'arc', 'dayroom', 'legacy',
         'hist', 'story', 'handbook', 'room', 'dream', 'mem']

SHEETS = [
    ('1 First 10 minutes', lambda s: s in FIRST),
    ('2 Game screens', lambda s: s not in FIRST and s not in STORY),
    ('3 Stories & commentary', lambda s: s in STORY),
]

HELP = """Afrikaans review: PHASE: Rugby Manager

Thank you for helping. The Afrikaans was machine translated and reads too Dutch in places.

HOW TO REVIEW
1. Read the 'Current Afrikaans' column. The English is there for meaning.
2. If a line is fine, leave 'Your version' empty.
3. If it is wrong, stiff or too Dutch, type how a South African would actually say it in 'Your version'.
4. Optional: use 'Note' for anything we should know (e.g. 'rugby players say X, not Y').

RULES THAT KEEP THE GAME WORKING
- Keep every {word in curly brackets} exactly as it is, spelled the same. The game swaps in names and numbers there.
  Example: 'Gaan voort: {manager}, {club}' -> you may move {club}, but not rename or remove it.
- Lines ending in .one / .other are singular / plural forms of the same text.
- Lines ending in _f are the women's-game version of the line above them.
- Keep it short where the English is short: buttons and tabs have little space.

WHERE TO START
Sheet 1 is what every player sees first (menus, buttons, setup). Even just that sheet makes a big difference.
Sheet 2 is the rest of the game screens. Sheet 3 is match commentary, news and stories: the most text, and the most Dutch-sounding.

The store listing text is on the last sheet.
"""


def flatten(node, path=''):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from flatten(v, f'{path}.{k}' if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from flatten(v, f'{path}[{i}]')
    elif isinstance(node, str):
        yield path, node


def english_for(path):
    """English text for an Afrikaans key; a feminine sibling maps to its base key."""
    node = EN
    parts = re.findall(r'[^.\[\]]+|\[\d+\]', path)
    for i, p in enumerate(parts):
        if p.startswith('['):
            idx = int(p[1:-1])
            node = node[idx] if isinstance(node, list) and idx < len(node) else None
        elif isinstance(node, dict):
            key = p
            if key not in node and SIBLING.search(key):
                key = SIBLING.sub('', key)
            if key not in node and i == len(parts) - 1 and 'other' in node:
                key = 'other'
            node = node.get(key)
        else:
            node = None
        if node is None:
            return ''
    return node if isinstance(node, str) else ''


def listing_blocks(md, heading):
    start = md.index(heading)
    end = md.index('\n## ', start + 5)
    return re.findall(r'### (.+?)\n\n```\n(.*?)\n```', md[start:end], re.S)[:3]


def store_listing_rows():
    """Title, short and full description; English matched block for block."""
    md = (ROOT / 'docs/store-listing.md').read_text(encoding='utf-8')
    en = [body for _, body in listing_blocks(md, '## Google Play')]
    rows = []
    for n, (heading, body) in enumerate(listing_blocks(md, '## Afrikaans listing')):
        if heading.startswith('Volledige'):
            af_paras, en_paras = body.split('\n\n'), en[n].split('\n\n')
            same = len(af_paras) == len(en_paras)
            for i, para in enumerate(af_paras):
                rows.append((f'store-listing:{heading}:{i + 1}', en_paras[i] if same else '', para))
        else:
            rows.append((f'store-listing:{heading}', en[n], body))
    return rows


HEAD = ['Key', 'English', 'Current Afrikaans', 'Your version', 'Note']
WIDTH = [24, 50, 50, 50, 30]
HEAD_FILL = PatternFill('solid', fgColor='1F4E3D')
EDIT_FILL = PatternFill('solid', fgColor='FFF7D6')


def add_sheet(wb, title, rows):
    ws = wb.create_sheet(title)
    ws.append(HEAD)
    for c, w in zip('ABCDE', WIDTH):
        ws.column_dimensions[c].width = w
    for cell in ws[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = HEAD_FILL
    for key, en, af in rows:
        ws.append([key, en, af, None, None])
    wrap = Alignment(wrap_text=True, vertical='top')
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = wrap
        row[0].font = Font(color='888888', size=8)
        row[3].fill = EDIT_FILL
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = f'A1:E{ws.max_row}'
    return len(rows)


BRIEF = ['menu', 'nav', 'titles', 'groups', 'wizard', 'common', 'home', 'settings', 'intro',
         'desk', 'store', 'pro']
BRIEF_OUT = ROOT / 'docs/afrikaans-review/afrikaans-proofread-brief.xlsx'
BRIEF_HELP = """Afrikaans proofread: PHASE: Rugby Manager (a phone app)

The Afrikaans was machine translated. A native speaker told us it reads 'a bit too Dutch'.
It should read the way South Africans normally speak and write: natural, everyday Afrikaans.

WHAT TO DO
1. Sheet 'Store listing' first, then 'Game screens'.
2. Read 'Current Afrikaans'. The English is there for meaning.
3. If a line is fine, leave 'Your version' empty.
4. If it is wrong, stiff or Dutch-sounding, write the natural version in 'Your version'.
5. On the 'Your notes' sheet, list the patterns you fixed, e.g. 'always X, not Y' or 'Z sounds Dutch'.
   These notes matter most: we will use them to fix the rest of the app's text.

RULES THAT KEEP THE APP WORKING
- Keep every {word in curly brackets} exactly as it is. The app puts names and numbers there.
  Example: 'Gaan voort: {manager}, {club}' -> you may move {club}, but not rename or remove it.
- Keys ending .one / .other are singular / plural forms of the same text.
- Keys ending _f are the women's version of the line above.
- Buttons have little space: keep those about as short as they are now.
"""


def brief():
    rows = [(p, english_for(p), af) for p, af in flatten(AF)
            if p.split('.')[0] in BRIEF and af.strip()]
    wb = Workbook()
    ws = wb.active
    ws.title = 'Start here'
    ws.column_dimensions['A'].width = 120
    for line in BRIEF_HELP.splitlines():
        ws.append([line])
    ws['A1'].font = Font(bold=True, size=14)
    listing = store_listing_rows()
    n1 = add_sheet(wb, 'Store listing', listing)
    n2 = add_sheet(wb, 'Game screens', rows)
    notes = wb.create_sheet('Your notes')
    notes.append(['Pattern or word', 'Use instead', 'Why / example'])
    for c, w in zip('ABC', [40, 40, 60]):
        notes.column_dimensions[c].width = w
    for cell in notes[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = HEAD_FILL
    wc = lambda t: len(re.findall(r'[^\s{}]+', PH_RE.sub('', t)))
    words = sum(wc(r[2]) for r in listing + rows)
    BRIEF_OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(BRIEF_OUT)
    print(f'{n1} listing rows, {n2} screen rows, {words} Afrikaans words')
    print(f'wrote {BRIEF_OUT.relative_to(ROOT)}')


PH_RE = re.compile(r'\{\w+\}')


def main():
    if '--brief' in sys.argv:
        return brief()
    rows = {name: [] for name, _ in SHEETS}
    for path, af in flatten(AF):
        section = path.split('.')[0]
        if section == '_meta' or not af.strip():
            continue
        for name, test in SHEETS:
            if test(section):
                rows[name].append((path, english_for(path), af))
                break

    wb = Workbook()
    ws = wb.active
    ws.title = 'Start here'
    ws.column_dimensions['A'].width = 120
    for line in HELP.splitlines():
        ws.append([line])
    ws['A1'].font = Font(bold=True, size=14)

    counts = {name: add_sheet(wb, name, r) for name, r in rows.items()}
    counts['Store listing'] = add_sheet(wb, 'Store listing', store_listing_rows())

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    for name, n in counts.items():
        print(f'{n:5d}  {name}')
    print(f'wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
