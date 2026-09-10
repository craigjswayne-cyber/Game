#!/usr/bin/env python3
"""Set speech in the marks the language actually uses.

frenchprobe has held the French to guillemets since it was written, on the
grounds that a plain " in French speech is a sentence somebody translated
without looking at the ones around it. The same was never checked anywhere
else, and the same thing had happened:

    Spanish: 208 entries in guillemets, 31 in plain quotes.
    Italian: 56 in guillemets, 184 in plain quotes.

Both languages set dialogue in caporali. A file that does it three times in
four is not following a convention, it is following whoever wrote that line.
This settles both on « », which is what the majority of each file already did
and what the French has done all along.

Afrikaans is left alone: " is ordinary in Afrikaans digital text and the file
uses it consistently, which is the thing that matters. Japanese is already
uniform on 「」 with not one plain quote in six thousand entries.

Run: python3 scripts/tools/quotes.py [--apply]
"""
import json, re, sys

LANGS = ['es', 'it']


def swap(text: str) -> str:
    """Every balanced pair of plain quotes becomes « », outside-in."""
    if text.count('"') % 2:
        return text                      # an odd one is a measurement, not speech
    out, opening = [], True
    for ch in text:
        if ch == '"':
            out.append('«' if opening else '»')
            opening = not opening
        else:
            out.append(ch)
    return ''.join(out)


def main() -> int:
    apply = '--apply' in sys.argv
    total = 0
    for lang in LANGS:
        p = f'src/locales/{lang}.json'
        raw = open(p, encoding='utf-8').read()
        d = json.loads(raw)
        n = [0]

        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k == '_meta':
                        continue
                    if isinstance(v, str) and '"' in v:
                        new = swap(v)
                        if new != v:
                            o[k] = new
                            n[0] += 1
                    else:
                        walk(v)
            elif isinstance(o, list):
                for i, v in enumerate(o):
                    if isinstance(v, str) and '"' in v:
                        new = swap(v)
                        if new != v:
                            o[i] = new
                            n[0] += 1
                    else:
                        walk(v)

        walk(d)
        total += n[0]
        print(f'{lang}: {n[0]} entries')
        if apply:
            json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            open(p, 'a', encoding='utf-8').write('\n')
    print(f"{'set' if apply else 'would set'} {total} entries in guillemets")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
