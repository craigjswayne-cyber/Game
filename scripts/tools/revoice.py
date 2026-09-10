#!/usr/bin/env python3
"""Vary the closing hinge on the stories that all ended the same way.

Owner: "humanise all text across all languages" - "too ai style" - and then
"can we check that it is natural language".

The check came first and the numbers are in scripts/voiceprobe.ts. The short
version: the English is clean of the obvious tells - no delve, no tapestry, no
"it is not X, it is Y", no sentence opening Moreover - and carries exactly one
real tic. Ninety-three long pieces ended on a wry coda hung off a dash:

    "Write the script yourself - you could not do better."
    "Your reputation travels with you - and so does the story of how this ended."
    "Plan the run-in accordingly - and welcome back a tourist."

Each of those is a decent line. Ninety-three of them is a mannerism, and the
Spanish translation is the proof: the same stories, recast into ordinary
Spanish punctuation, sit at 2% where the English sat at 32%. The hinge carries
no meaning. It is a habit.

This varies the close on the stories - a full stop here, a comma there, a colon
where the second half really is a consequence of the first - and leaves alone
the ones where the dash is doing a job: the handbook glosses, and the help lines
that say what to tap next. Fifty of the ninety-three are gone. What is left is
mostly instruction, where a dash is punctuation and not a flourish.

Each key names the punctuation its final " - " should become. Applied to the
LAST occurrence only, in every locale that has one, to the key and its gendered
siblings. Japanese is left alone: it uses "——" as an ordinary device and its
rate is not the English tic wearing a translation.
"""
import json, re, sys

# key -> what the final hinge becomes: '.' full stop, ',' comma, ':' colon
PLAN = {
    'news.aheadOfSchedule': ',',
    'news.sackedPushed': '.',
    'comm.tryAtTestimonial': '.',
    'comm.tryCareerMilestone': ',',
    'news.rankTop': '.',
    'news.mentCeiling': '.',
    'till.boardBlurb': ',',
    'news.wAgent3': '.',
    'news.toneSwagger': ',',
    'news.giantOther': '.',
    'news.wGrumble2': ':',
    'news.wFrosty1': ',',
    'news.wRift': '.',
    'matchday.farewellAway': '.',
    'news.mentorLost': ',',
    'comm.con8': '.',
    'press.coldBlameR': ',',
    'press.plansEarnR1': ',',
    'news.lionsCallA': '.',
    'news.lionsCallB': '.',
    'news.loanStar': '.',
    'news.preVoid': '.',
    'news.bidIn': '.',
    'news.heal': ',',
    'news.wTalksFail': ',',
    'press.plansOutR1': ',',
    'press.plansInR2': ',',
    'press.weightRestR': ',',
    'reply.notHomeBased': ',',
    'comm.ycRepeated': '.',
}
LANGS = ['en', 'fr', 'es', 'it', 'af']       # ja deliberately excluded
SIBS = ['', '_f', '_w', '_fw']


def revoice(text: str, mark: str, lang: str) -> str:
    i = text.rstrip().rfind(' - ')
    if i < 0:
        return text
    head, tail = text[:i], text[i + 3:]
    if mark == '.':
        tail = tail[0].upper() + tail[1:] if tail and tail[0].isalpha() else tail
    # French sets a narrow no-break space in front of a colon, and frenchprobe
    # holds it there
    joint = '\u202f:' if (mark == ':' and lang == 'fr') else mark
    return f'{head}{joint} {tail}'


def main() -> int:
    apply = '--apply' in sys.argv
    changed = 0
    for lang in LANGS:
        p = f'/home/user/game/src/locales/{lang}.json'
        d = json.load(open(p, encoding='utf-8'))
        for dotted, mark in PLAN.items():
            sec, key = dotted.split('.')
            for sib in SIBS:
                k = key + sib
                v = d.get(sec, {}).get(k)
                if not isinstance(v, str) or ' - ' not in v:
                    continue
                new = revoice(v, mark, lang)
                if new != v:
                    changed += 1
                    if not apply:
                        print(f'{lang} {sec}.{k}\n   - {v[-90:]}\n   + {new[-90:]}')
                    d[sec][k] = new
        if apply:
            json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False,
                      indent=2 if lang == 'fr' else 1)
            open(p, 'a', encoding='utf-8').write('\n')
    print(f"{'rewrote' if apply else 'would rewrite'} {changed} closes")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
