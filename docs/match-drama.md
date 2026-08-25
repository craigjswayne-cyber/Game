# Making the match feel like a match — v1.1.1

**Owner's brief, 25 August, testing live:** *"the animation of match play needs
working on to be more realistic. it should reflect momentum and possession. it
should build and make you edgy if the score is close. is there any way to make
it a bit more interesting - have it more realistic to the commentary?"*

That is one complaint with three parts, and all three have the same root: **the
engine already knows the shape of the game and the presentation does not read
it.**

---

## 0. What is already there, unused

* `ctx.momo`, −1..+1. Recomputed every tick from the possession delta with a
  0.62 decay, and shoved by big moments (a howler swings it 0.3). It is a
  genuine, tuned momentum figure.
* `ctx.momoHist`, the home possession share of every tick.
* A `.last10` bar on the scoreboard that draws both of them, plus the penalty
  counts and the referee's patience.

So the game measures pressure honestly and then draws a ball whose position is
`50 + dir * (10 + min % 20)` — **a sawtooth on the clock**. Nothing about where
the ball sits has ever had anything to do with the match being played. That is
the whole of the "doesn't reflect momentum and possession" complaint, and it is
four lines of arithmetic.

## 1. Territory is momentum

Momentum *is* field position in rugby: a side with it is camped in the other
half. Home attacks right (the try-zone colours and the try positions already
agree on this), so:

```
territory = 50 + momo * 30          // 20 .. 80
nudge     = towardHome ? +9 : −9    // whose work this event is
```

Scoring stays decisive and unchanged: a try is at 88/12 because that is where
tries happen; a penalty or drop goal at 72/28.

The result is a ball that drifts up the field while a side builds, and gets
pinned back when they lose the game — visible pressure, from a number that was
already being computed and drawn two centimetres above.

## 2. Tension is late **and** close

```
late   = clamp((min − 55) / 25, 0, 1)      // nothing before the hour
close  = clamp(1 − |margin| / 14, 0, 1)    // one score is 7; 14 is two
tension = late * close
```

A product, not a sum, and deliberately: 3–0 at 20 minutes is not tense, and
neither is 40–3 at 78. Both terms have to be true.

**What tension buys:** the beat between revealed events stretches by up to
60%. The game slows down when it matters, which is the whole of "make you
edgy" — a clock that will not hurry when you want it to. It never speeds up:
shortening the beat would race a probe and rob a rout of its own pace.

## 3. The screen says so

Tension above 0.45 puts a state on the scoreboard: a band, and a word for what
this is now — a one-score game inside the closing quarter. Static, not a pulse:
`prefers-reduced-motion` collapses every duration in this codebase
(`motionprobe` holds that), so information that lives only in movement is
information some players never get.

## 4. What this does NOT do

* **No engine change.** Every one of these reads state the engine already
  publishes. `fingerprint` must stay green: the rng stream is not touched, no
  draw is added, moved or re-ordered.
* **No new commentary.** Situation-aware lines are a real idea and a separate
  job: the safe pattern is a same-length "clutch" bank chosen by situation and
  indexed by the *same* rng draw, so the stream survives. It needs writing in
  both languages and is out of scope here.
* **No faster clock.** See §2.

## 5. The guard

`scripts/dramaprobe.mjs` (in `suite.sh`'s browser list, because a probe that no
run ever runs is decoration). It drives a real match, answers its own touchline
calls and intervals, and reads the pixels the renderer actually produced —

* **every** ball position IS the territory model, to 0.01% of the pitch. This
  is exact rather than a correlation, and can be: `advanceLive()` writes the
  store and React renders from it, so the `momo` read straight afterwards is
  the very number the render used.
* and is **nothing like the sawtooth** it replaced — the old formula, scored
  against the same events, puts the ball an average of 9-13% of the pitch away
  from where it now is.
* a one-score finish is **paced 1.3× slower** than a rout, measured on the wall
  clock, and the rout still gets the speed the manager chose.
* the band appears only when late **and** close: nothing in a blowout, nothing
  at 20 minutes level, and three different words for level / a kick in it / one
  score in it.
* the ball never leaves the pitch.

The last three run on a **replay**: at full time every event is on the books,
so the cursor is wound back and the tail re-revealed with rewritten scores.
`advanceLive` only reveals while the cursor trails the events, so nothing is
re-simulated — one real match can be both a nail-biter and a rout without the
engine being touched.

---

## 6. The call you never saw

Shipped in the same release, from the same message: *"ive played 4 games now
with no decision making coming like kick for goal etc? is that feature still
included?"*

It is. A forty-match measurement puts it at **2.55 kickable penalties a match**,
8% of which pass without a call. What the owner had run into is that **Skip
answers every one of them at the posts, silently** — `skipToBreak` has always
recorded the choice (it must, or a resumed replay stops at a question nobody
answered), and has never once told the manager it made one.

So it counts them now, and the scoreboard says what it did: *"⏭ Skip answered 2
touchline calls for you — the points were taken."* The note belongs to the skip,
not to the match, so it clears the moment play restarts.

No behaviour changed — the same calls are answered the same way. The only thing
added is that you find out.
