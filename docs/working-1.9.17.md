# 1.9.17 working notes (22 Nov 2026)

A French player's feedback, points 1 to 7, plus two bugs the owner hit as England coach.

## Built
1. Cards on the live scoreboard: who is in the bin with minutes left, who was sent off. Read from the lines already shown.
2. A penalty has a mark: metres out and metres across (`penWide`, `penMark`, `markAdj` in match/kicking.ts). It moves the kick's chance by -0.22 to +0.12. The panel shows it. AI sides go to the corner from the hardest marks. Average held: 74.5% of 9,296 over two seasons against 74.0% before.
3. Renewal length is the manager's choice (1 to 3 seasons); each season away from the player's own term costs 6% more.
4. The contract chip shows the month and year the deal ends.
5. Medical jokers: a news warning one week before he goes, and a Keep button on his page (full contract, to the end of next season).
6. A man out on loan leaves the development focus and personal plans, and no longer counts against them.
7. One reset on the squad sheet puts the side back as it was, however many changes were made at the stoppage. Closing the sheet (back to the match) commits them: no undo after. The engine can still take back any one change by name (`undoSubstitution(state, ctx, inId)`).
- The loan card names the loan club.
- The shop row names the three Pro challenges.

## Fixed
- A national coach with no club saw his host club under every news story. Stories now show the club they name, or his nation.
- The debut promise card still said "Uncapped" after the man had played.

- Player page: yellow cards and red cards are separate chips. The bare "N appearances for the club" line is gone (owner: the count before the career is invented).

## Left out (owner's call)
- International tries and points. Loan matches in career history and per-club history.

## Checks
- tests/v1917.test.ts; scripts/subsprobe.mjs updated for the new undo buttons.
- scripts/fingerprint.ts unchanged (no kick in its six matches flipped).
