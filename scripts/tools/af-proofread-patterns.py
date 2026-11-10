#!/usr/bin/env python3
# The proofreader's three word changes, carried across every Afrikaans line so
# the game does not say "Raad" on one screen and "direksie" on the next.
import json, re
AF = 'src/locales/af.json'
raw = open(AF, encoding='utf8').read(); before = raw
n = {}
def sub(pat, rep, flags=0):
    global raw
    raw, k = re.subn(pat, rep, raw, flags=flags); n[pat] = k
# board: direksie -> Raad (capital, as she wrote it, so it never reads as "raad", advice)
sub(r'\b[Dd]ireksies\b', 'rade')
sub(r'\{short\}-direksie', '{short}-Raad')
sub(r'\b([Dd])ireksie-?(?=[a-zêë])', 'Raads')           # direksiekamer -> Raadskamer, Direksie-inspuiting -> Raadsinspuiting
sub(r'\b[Dd]ireksie\b', 'Raad')
sub(r'(\\n)Direksie', r'\1Raad')
# squad: spangroep -> span
sub(r'\b([Ss])pangroepe\b', r'\1panne')
sub(r'SPANGROEP', 'SPAN')
sub(r'([Ss])pangroep', r'\1pan')
# floodlights: spreilig -> vloedlig
sub(r'Spreilig', 'Vloedlig'); sub(r'spreilig', 'vloedlig')
# back-ups: rugsteun -> kopie (her "Laai 'n vorige kopie terug"), line by line
for a, b in [
    ('vir handmatige rugsteun of', 'vir handmatige kopieë of'),
    ('"Rugsteun & oordrag"', '"Kopieë & oordrag"'),
    ("om dit te rugsteun of", "om 'n kopie te hou of"),
    ('handmatige rugsteunkopieë', 'handmatige kopieë'),
    ('die enigste rugsteun wat daar is', 'die enigste kopie wat daar is'),
    ("maak 'n rugsteun", "maak 'n kopie"),
]:
    k = raw.count(a); n[a] = k; raw = raw.replace(a, b)
json.loads(raw)
open(AF, 'w', encoding='utf8').write(raw)
for k, v in n.items(): print(f'{v:4}  {k}')
left = {w: len(re.findall(w, raw, re.I)) for w in ['direksie', 'spangroep', 'spreilig', 'rugsteun']}
print('left:', left)
