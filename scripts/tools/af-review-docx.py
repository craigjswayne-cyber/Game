#!/usr/bin/env python3
"""The Afrikaans proofread brief as a Word document, and the way back.

    python3 scripts/tools/af-review-docx.py export
    -> docs/afrikaans-review/afrikaans-proofread.docx
       docs/afrikaans-review/afrikaans-proofread.keys.json  (row number -> key)

    python3 scripts/tools/af-review-docx.py import returned.docx [--dry-run]

The proofreader edits the Afrikaans column directly, with or without Track
Changes: tracked insertions count and tracked deletions do not, so an
unaccepted document reads as if every change were accepted. Changed rows go
through af-review-import.py, which checks {placeholders} and patches af.json.
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/afrikaans-review/afrikaans-proofread.docx'
KEYS = ROOT / 'docs/afrikaans-review/afrikaans-proofread.keys.json'

spec = importlib.util.spec_from_file_location('afx', Path(__file__).with_name('af-review-export.py'))
afx = importlib.util.module_from_spec(spec)
spec.loader.exec_module(afx)


def word_count(s):
    return len(afx.re.findall(r'[^\s{}]+', afx.PH_RE.sub('', s)))


def shade(cell, hex_fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_fill)
    tc_pr.append(shd)


def table(doc, rows, start):
    t = doc.add_table(rows=1, cols=3)
    t.style = 'Table Grid'
    head = t.rows[0].cells
    for cell, label in zip(head, ['No.', 'English (for meaning only)', 'Afrikaans (edit this column)']):
        cell.text = label
        cell.paragraphs[0].runs[0].bold = True
        shade(cell, 'D9E2DC')
    n = start
    for key, en, af in rows:
        cells = t.add_row().cells
        cells[0].text = str(n)
        cells[1].text = en
        cells[2].text = af
        for run in cells[1].paragraphs[0].runs:
            run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        shade(cells[2], 'FFF7D6')
        n += 1
    widths(t, [Cm(1.3), Cm(12.6), Cm(12.6)])
    return n


def widths(t, cols):
    t.autofit = False
    for col, w in zip(t.columns, cols):
        col.width = w
    for row in t.rows:
        for cell, w in zip(row.cells, cols):
            cell.width = w


def export():
    listing = afx.store_listing_rows()
    screens = [(p, afx.english_for(p), af) for p, af in afx.flatten(afx.AF)
               if p.split('.')[0] in afx.BRIEF and af.strip()]
    words = sum(word_count(r[2]) for r in listing + screens)

    doc = Document()
    sec = doc.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = sec.page_height, sec.page_width
    for side in ('left_margin', 'right_margin', 'top_margin', 'bottom_margin'):
        setattr(sec, side, Cm(1.5))
    doc.styles['Normal'].font.size = Pt(10)

    doc.add_heading('Afrikaans proofread: PHASE: Rugby Manager', 0)
    intro = [
        f'There are {words:,} Afrikaans words to proofread: the yellow column. '
        'The grey English column is there for meaning only and is not part of the job.',
        "The Afrikaans was machine translated, and a native speaker told us it reads 'a bit too Dutch'. "
        'It should read the way South Africans normally speak and write: natural, everyday Afrikaans.',
        'How to work: edit the yellow column directly. Track Changes on or off, either is fine. '
        'If a line is already fine, leave it as it is.',
        'Keep every {word in curly brackets} exactly as it is: the app fills in names and numbers there. '
        'You may move it within the sentence.',
        'Buttons and short labels have little space, so keep those about as short as they are now.',
        "At the end there is a 'Your notes' table. Please list the changes you made most often, "
        "for example 'say X, not Y' or 'this word sounds Dutch'. We use these notes to fix the rest of the app.",
    ]
    for line in intro:
        doc.add_paragraph(line, style='List Bullet')

    keys = {}
    doc.add_heading('1. App store description', 1)
    n = table(doc, listing, 1)
    for i, (k, _, af) in enumerate(listing, 1):
        keys[i] = [k, af]
    doc.add_heading('2. Menus, screens and shop', 1)
    first = n
    table(doc, screens, first)
    for i, (k, _, af) in enumerate(screens, first):
        keys[i] = [k, af]

    doc.add_heading('Your notes', 1)
    notes = doc.add_table(rows=6, cols=3)
    notes.style = 'Table Grid'
    for cell, label in zip(notes.rows[0].cells, ['Instead of', 'Say', 'Why / example']):
        cell.text = label
        cell.paragraphs[0].runs[0].bold = True
        shade(cell, 'D9E2DC')
    widths(notes, [Cm(8.8), Cm(8.8), Cm(8.9)])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    KEYS.write_text(json.dumps(keys, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(listing)} listing rows, {len(screens)} screen rows, {words} Afrikaans words')
    print(f'wrote {OUT.relative_to(ROOT)} and {KEYS.relative_to(ROOT)}')


def cell_text(cell):
    """Text as if every tracked change were accepted."""
    paras = []
    for p in cell._tc.iter(qn('w:p')):
        out = []
        for el in p.iter():
            if el.tag == qn('w:t'):
                if any(a.tag == qn('w:del') for a in el.iterancestors()):
                    continue
                out.append(el.text or '')
            elif el.tag == qn('w:br'):
                out.append('\n')
            elif el.tag == qn('w:tab'):
                out.append('\t')
        paras.append(''.join(out))
    return '\n'.join(paras).strip()


def do_import(path, dry):
    keys = json.loads(KEYS.read_text(encoding='utf-8'))
    doc = Document(path)
    edits, notes = [], []
    for t in doc.tables:
        for row in t.rows:
            cells = row.cells
            if len(cells) != 3:
                continue
            first = cell_text(cells[0])
            if first.isdigit() and first in keys:
                key, original = keys[first]
                new = cell_text(cells[2])
                if new and new != original.strip():
                    edits.append((key, new))
            elif first not in ('No.', 'Instead of') and any(cell_text(c) for c in cells):
                notes.append([cell_text(c) for c in cells])
    print(f'{len(edits)} changed line(s) in the document')
    if notes:
        print('\nReviewer notes:')
        for a, b, c in notes:
            print(f'  {a} -> {b}   {c}')
    if not edits:
        return
    wb = Workbook()
    ws = wb.active
    ws.append(['Key', 'English', 'Current Afrikaans', 'Your version', 'Note'])
    for key, new in edits:
        ws.append([key, '', '', new, ''])
    tmp = Path(path).with_suffix('.edits.xlsx')
    wb.save(tmp)
    cmd = [sys.executable, str(Path(__file__).with_name('af-review-import.py')), str(tmp)]
    if dry:
        cmd.append('--dry-run')
    sys.exit(subprocess.call(cmd))


if __name__ == '__main__':
    if sys.argv[1:2] == ['export']:
        export()
    elif sys.argv[1:2] == ['import'] and len(sys.argv) > 2:
        do_import(sys.argv[2], '--dry-run' in sys.argv)
    else:
        sys.exit(__doc__)
