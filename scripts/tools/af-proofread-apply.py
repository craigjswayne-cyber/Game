#!/usr/bin/env python3
# Apply the Fiverr proofreader's Afrikaans edits (Game screens sheet) to af.json.
# Run from the repo root: python3 scripts/tools/af-proofread-apply.py <returned.xlsx> [--dry]
import json, re, sys, openpyxl
SRC = sys.argv[1]; AF = 'src/locales/af.json'; DRY = '--dry' in sys.argv
HOLD = {  # her version changes the meaning; kept as it is until she answers
 'common.confirmSell', 'desk.moneyRoom', 'store.charterRefused', 'home.fanBouncing', 'wizard.dreamBlurb',
 'common.friendly', 'desk.moneyAdmin', 'store.pinnacleLine', 'store.callMade', 'desk.tRival', 'store.charterActivate',
}
FIX = {  # her edit, with a typo or a button label put right
 'home.inboxSub': lambda s: s.replace('dierugbywêreld', 'die rugbywêreld'),
 'store.creditNotSpent': lambda s: s.replace("plek 'n probeer", 'plek en probeer'),
 'common.formFalling': lambda s: s.replace('Dallende', 'Dalende'),
 'settings.floodlights': lambda s: 'Vloedligte',
 'common.floodlitToggle': lambda s: 'Skakel vloedligte aan/af',
 'titles.draw': lambda s: 'Die Trekking',
 'titles.legacy': lambda s: 'Bestuurder se Erfenis',
 'home.snTable': lambda s: s.replace('Ranglys {rows}', 'Ranglys: {rows}'),
 'home.handoverTitle': lambda s: 'Die Play Store-app maak veranderings',
 'home.handoverBody': lambda s: s.replace('titleskerm', 'titelskerm'),
 'common.turningWeek': lambda s: 'Einde van die week…',
 'common.saveFailBody': lambda s: s.replace('druk dan probeer weer', 'druk dan Probeer weer'),
 'store.funding': lambda s: 'Raadsfinansiering',
 'store.fundingLine': lambda s: s.replace('raads besluite', 'Raadsbesluite'),
 'settings.pronounLine': lambda s: s.replace('die raad', 'die Raad'),
 'settings.skinStealthLine': lambda s: re.sub(r'\.(?=\S)', '. ', s),
}
def tidy(new, cur):
    s = new.replace(' ', ' ')
    s = re.sub(r'(^|[\s(“"])n (?=[^\W\d_])', r"\1'n ", s)      # 'n, the article
    s = re.sub(r' {2,}', ' ', s).strip()
    s = re.sub(r' +([.,;:!?…])', r'\1', s)                      # no space before punctuation
    s = re.sub(r'\.{2,}$', '…' if cur.rstrip().endswith('…') else '.', s)
    # end as the original ends: a full stop only where it had one
    if cur.rstrip().endswith('.') and not re.search(r'[.!?…]$', s): s += '.'
    if not cur.rstrip().endswith('.') and s.endswith('.') and not s.endswith('..'): s = s[:-1]
    # first letter as the original had it (a label in a sentence stays lower case)
    if cur[:1].islower() and s[:1].isupper() and not s.startswith(('Raad', 'Pro')): s = s[0].lower() + s[1:]
    return s
ph = lambda s: sorted(re.findall(r'\{[a-z_0-9]+\}', s))
wb = openpyxl.load_workbook(SRC, data_only=True)
raw = open(AF, encoding='utf8').read(); data = json.loads(raw)
def get(key):
    node = data
    for part in key.split('.'):
        if not isinstance(node, dict) or part not in node: return None
        node = node[part]
    return node
applied, held, skipped = [], [], []
for r in wb['Game screens'].iter_rows(min_row=2, values_only=True):
    key, en, cur, new, note = (list(r) + [None] * 5)[:5]
    if not key or not new or str(new).strip() in ('', '?'): continue
    new = str(new); cur = str(cur)
    if key in HOLD: held.append(key); continue
    live = get(key)
    if not isinstance(live, str): skipped.append((key, 'not a plain string here')); continue
    val = tidy(new, cur)
    if key in FIX: val = FIX[key](val)
    if ph(val) != ph(live): skipped.append((key, f'placeholders {ph(live)} -> {ph(val)}')); continue
    if val == live: continue
    # replace the JSON-encoded value in place, so the file's layout is untouched
    old_enc = json.dumps(live, ensure_ascii=False); new_enc = json.dumps(val, ensure_ascii=False)
    leaf = key.split('.')[-1]
    pat = re.compile(r'("' + re.escape(leaf) + r'":\s*)' + re.escape(old_enc))
    hits = pat.findall(raw)
    if len(hits) == 0: skipped.append((key, 'not found')); continue
    raw = pat.sub(lambda m: m.group(1) + new_enc, raw)
    applied.append((key, live, val))
json.loads(raw)
for k, a, b in applied: print(f'{k}\n   was: {a}\n   now: {b}')
print(f'\napplied {len(applied)}, held {len(held)}, skipped {len(skipped)}')
for k, why in skipped: print('  skipped', k, why)
if not DRY: open(AF, 'w', encoding='utf8').write(raw)
