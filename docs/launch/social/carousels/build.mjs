// Social carousels for PHASE: Rugby Manager, one feature per carousel.
//
//   node docs/launch/social/carousels/build.mjs
//
// Writes 1080x1350 (4:5) PNGs to out/<carousel>/NN.png. 4:5 is the tallest
// shape Instagram shows uncropped in the feed, and Facebook, LinkedIn and
// TikTok photo mode take it as is.
//
// Brand: the night tokens from src/ui/tokens.css, Barlow and Barlow Semi
// Condensed from src/ui/fonts, the ball mark from public/icon.svg, the desk
// photograph from landing/img/hero.webp. Copy follows docs/voice-bible.md.
//
// The screenshots in shots/ are the real build (capture.mjs), with every player
// and club name swapped for a generated one before the shot was taken, so no
// real player's name sits behind an advert.
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')
const url = (p) => pathToFileURL(resolve(ROOT, p)).href
const shot = (n) => pathToFileURL(resolve(HERE, 'shots', n + '.jpg')).href
const MARK = readFileSync(resolve(ROOT, 'public/icon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '')

// ---- the copy ---------------------------------------------------------------
// Every claim below was checked against the build (Nov 2026): store-listing.md
// for the wording, the engine for the facts. Notes in CAPTIONS.md.

const CTA = { type: 'cta' }

const CAROUSELS = [
  {
    id: '1-match-day', label: 'Match day',
    slides: [
      { type: 'hook', kicker: 'Match day', title: 'Penalty.<br>Four minutes in.<br><em>Your call.</em>', sub: 'Posts, corner or tap. Every touchline call is yours.' },
      { type: 'card', kicker: 'The touchline', title: 'Three options.<br><em>One shout.</em>', body: 'Live text commentary, with the pitch for the tries and big moments. When the ref’s arm goes out, the call is yours.', card: 'penalty' },
      { type: 'phone', kicker: 'The dressing room', title: 'Pick the words<br><em>before kick-off.</em>', body: 'Calm the nerves or light the fuse. One speech, and you choose the tone.', img: 'teamtalk', y: 1150 },
      { type: 'phone', kicker: 'How they took it', title: 'Then see who<br><em>it landed with.</em>', body: 'Every player hears it their own way. Lifted, steady or rattled.', img: 'talkreact', y: 1150 },
      { type: 'phone', kicker: 'Mid-match', title: 'The game<br><em>keeps asking.</em>', body: 'Head injury assessment. Keep the temporary replacement or pick another. It doesn’t cost you a change.', img: 'hia', y: 330 },
      { type: 'phone', kicker: 'Full time', title: 'Won by 24.<br><em>Two things to fix.</em>', body: 'Your coach names them, then checks next week whether you did.', img: 'fulltime', y: 1430 },
      CTA,
    ],
  },
  {
    id: '2-transfers', label: 'Transfers',
    slides: [
      { type: 'hook', kicker: 'Transfers', title: 'The agent wants more.<br><em>The cap says no.</em>', sub: 'Build a squad you can actually afford.' },
      { type: 'phone', kicker: 'The market', title: 'Scout it.<br><em>Then bid.</em>', body: 'Summer and January windows, free agents, and rival clubs after the same players you are.', img: 'transfers', y: 0 },
      { type: 'list', kicker: 'The small print', title: 'It’s never<br><em>just the fee.</em>', items: [
        ['Agents who haggle', 'And remember how you treated the last one.'],
        ['Contracts that run down', 'Leave one too late and the player is free to go.'],
        ['Loans by length and wage share', 'And a parent club that tells you why it said no.'],
        ['Two marquee players', 'Name them, and work the rest of the cap around them.'],
      ] },
      { type: 'phone', kicker: 'The boardroom', title: 'And a board<br><em>with an opinion.</em>', body: 'More money, more time, a new facility. Four asks, and none of them cheap.', img: 'boardroom', y: 1080 },
      { type: 'news', kicker: 'Break your word', title: 'Agents talk<br><em>to each other.</em>', story: { tag: 'Agents', head: 'Agents talk: your word on the market', body: 'Word travels between agents. The story doing the rounds this window is the promise you broke to Rhett Harlan at Calder, and anyone weighing up a move to you wants more money up front before taking you at your word.' } },
      CTA,
    ],
  },
  {
    id: '3-academy', label: 'Academy',
    slides: [
      { type: 'hook', kicker: 'The academy', title: 'Seventeen.<br>Raw.<br><em>Yours.</em>', sub: 'Bring a teenager through and they may end up captaining the side.' },
      { type: 'phone', kicker: 'The scholars', title: 'Find the one<br><em>who’s ready.</em>', body: 'Scholars aged 17 to 19 playing A League rugby. Minutes are what turn one of them into a first-team player.', img: 'academy', y: 0 },
      { type: 'news', kicker: 'Two seasons later', title: 'You picked him<br><em>first.</em>', story: { tag: 'Academy', head: 'Kit Thackeray: from debutant to regular', body: 'You gave Kit Thackeray a first-team debut in 2026-27. This season Kit Thackeray started 19 matches for Calder. The academy staff still have the team sheet from that first day.' } },
      { type: 'news', kicker: 'And then', title: 'Remember<br><em>the debut?</em>', story: { tag: 'Academy', head: 'Kit Thackeray capped. Remember the debut?', body: 'You gave Kit Thackeray a first-team debut at Calder in 2026-27. Now Kit Thackeray has pulled on the national jersey (England). Whatever else is said about your time in charge, that debut was your call.' } },
      CTA,
    ],
  },
  {
    id: '4-the-world-remembers', label: 'The world remembers',
    slides: [
      { type: 'hook', kicker: 'The world remembers', title: 'You released him.<br><em>Today he scored<br>against you.</em>', sub: 'PHASE keeps a record of what you did, and brings it back.' },
      { type: 'news', kicker: 'Released players', title: 'Let him go?<br><em>He hasn’t gone far.</em>', story: { tag: 'Former player', head: 'Former player Ollie Brown scores against you', body: 'You released Ollie Brown in 2026-27. Today Ollie Brown came back in Wexmoor colours and crossed for a try against you. The away end made sure you heard about it.' } },
      { type: 'news', kicker: 'Rivals', title: 'You’ll see that<br><em>armband again.</em>', story: { tag: 'Former player', head: 'Ollie Brown handed the Wexmoor captaincy', body: 'You released Ollie Brown in 2026-27. Wexmoor have now made Ollie Brown their captain, and they are in your league. You will see that armband across the halfway line before long.' } },
      { type: 'news', kicker: 'Promises', title: 'Break a promise.<br><em>He won’t forget.</em>', story: { tag: 'Dressing room', head: 'Corban Kaipara has not forgotten', body: 'Corban Kaipara has not forgotten the promise you broke in 2026-27. Left out again, Corban Kaipara has gone quiet in training, and the senior players have noticed how it is being handled.' } },
      { type: 'news', kicker: 'The medical room', title: 'Played him<br><em>through a knock?</em>', story: { tag: 'Medical', head: 'Bertie Ludgate breaks down again', body: 'In week 9 of 2026-27 you sent Bertie Ludgate out to play through a knock the physio wanted rested. Bertie Ludgate is injured again now, out for 6 weeks. The medical staff have not said they told you so, and they do not need to.' } },
      { type: 'text', kicker: 'The record', title: 'Season one,<br><em>still there in<br>season fifteen.</em>', body: 'Last ten ratings and the injury history on every player. A trophy cabinet, a Hall of Fame and a Roll of Honour that outlast any one job.' },
      CTA,
    ],
  },
  {
    id: '5-tactics', label: 'Tactics',
    slides: [
      { type: 'hook', kicker: 'Tactics', title: 'Five ways to attack.<br><em>Five ways to defend.</em>', sub: 'Then the opposition starts reading you.' },
      { type: 'phone', kicker: 'The shape', title: 'Fifteen shirts.<br><em>Your plan.</em>', body: 'Roles for all fifteen, set-piece calls, the bench and a game plan.', img: 'tactics', y: 0 },
      { type: 'list', kicker: 'With the ball', title: 'Pick how<br><em>you attack.</em>', items: [
        ['Direct', 'Gain line, hard carries'], ['Pods 1-3-3-1', 'Forward pods, backs as options'], ['Width', 'Flat pass, screen and sweep'],
        ['Kick and Chase', 'Box kicks, territory, pressure'], ['Offload', 'Keep the ball alive'],
      ] },
      { type: 'list', kicker: 'Without it', title: 'And how<br><em>you defend.</em>', items: [
        ['Drift', 'Slide and push to touch'], ['Blitz', 'Line speed, no time on the ball'], ['Pendulum', 'Back three cover the kicks'],
        ['Man-to-Man', 'A direct matchup each'], ['Choke Tackle', 'Hold them up, win the ball'],
      ] },
      { type: 'news', kicker: 'The catch', title: 'Run it too often.<br><em>They’ll be ready.</em>', story: { tag: 'Your desk', src: 'ANALYSIS', head: 'Teams are reading your Crash Ball: set for it on 62% of runs lately', body: 'Your playbook is something the opposition learns to read. Mix it up, or change it before they do.' } },
      CTA,
    ],
  },
  {
    id: '6-two-games', label: 'Two games, one app',
    slides: [
      { type: 'hook', kicker: 'Men’s and women’s rugby', title: 'One app.<br><em>Two games.</em>', sub: 'The women’s game built the same way, not bolted on.' },
      { type: 'stats', kicker: 'The world', title: '15 leagues.<br><em>177 clubs.</em>', stats: [['9', 'men’s leagues', '113 clubs, from the top flight down to National One'], ['6', 'women’s leagues', '64 clubs, with their own continental cup and Test calendar']] },
      { type: 'phone', kicker: 'The season', title: 'Play-offs.<br><em>Promotion. The drop.</em>', body: 'Bonus points, a continental cup and an international calendar that takes your best players at the worst moment.', img: 'tables', y: 0 },
      { type: 'stats', kicker: 'On your phone', title: 'Plays offline.<br><em>No account.</em>', stats: [['0', 'sign-ups', 'Your career stays on your phone, saved every week'], ['6', 'languages', 'English, French, Spanish, Italian, Japanese and Afrikaans']] },
      CTA,
    ],
  },
]

// ---- the look ---------------------------------------------------------------

const CSS = `
@font-face { font-family: 'BSC'; font-weight: 600; src: url(${url('src/ui/fonts/barlow-semi-condensed-latin-600-normal.woff2')}); }
@font-face { font-family: 'BSC'; font-weight: 700; src: url(${url('src/ui/fonts/barlow-semi-condensed-latin-700-normal.woff2')}); }
@font-face { font-family: 'BSC'; font-weight: 800; src: url(${url('src/ui/fonts/barlow-semi-condensed-latin-800-normal.woff2')}); }
@font-face { font-family: 'BSC'; font-weight: 900; src: url(${url('src/ui/fonts/barlow-semi-condensed-latin-900-normal.woff2')}); }
@font-face { font-family: 'Barlow'; font-weight: 400; src: url(${url('src/ui/fonts/barlow-latin-400-normal.woff2')}); }
@font-face { font-family: 'Barlow'; font-weight: 500; src: url(${url('src/ui/fonts/barlow-latin-500-normal.woff2')}); }
@font-face { font-family: 'Barlow'; font-weight: 600; src: url(${url('src/ui/fonts/barlow-latin-600-normal.woff2')}); }
@font-face { font-family: 'Barlow'; font-weight: 700; src: url(${url('src/ui/fonts/barlow-latin-700-normal.woff2')}); }
:root {
  --canvas: #1a201e; --s1: #242b29; --s2: #2e3634; --s3: #384240; --border: #333c3a;
  --chalk: #f0f4f2; --chalk2: #b3bdb9; --muted: #a5afa9;
  --green: #34c06f; --green-hi: #4ed88c; --green-tint: #17332a; --brand: #0f7a43;
  --gold: #e9be68; --gold-tint: #322914; --danger: #f27a71; --danger-band: #c0362c;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1350px; background: var(--canvas); }
body { font-family: 'Barlow', sans-serif; color: var(--chalk); -webkit-font-smoothing: antialiased; }
.slide { position: relative; width: 1080px; height: 1350px; overflow: hidden;
  background: radial-gradient(900px 700px at 85% -10%, rgba(52,192,111,.16), transparent 70%),
              radial-gradient(700px 600px at -10% 110%, rgba(15,122,67,.18), transparent 70%), var(--canvas); }
.top { position: absolute; top: 56px; left: 72px; right: 72px; display: flex; align-items: center; justify-content: space-between; z-index: 5; }
.brand { display: flex; align-items: center; gap: 18px; }
.brand svg { width: 64px; height: 64px; }
.wm { font-family: 'BSC'; font-weight: 700; font-size: 30px; letter-spacing: 3px; line-height: 1; }
.wm b { color: var(--green); font-weight: 800; }
.count { font-family: 'BSC'; font-weight: 700; font-size: 26px; letter-spacing: 2px; color: var(--muted); }
.count b { color: var(--chalk); }
.kicker { display: inline-flex; align-items: center; gap: 14px; font-family: 'BSC'; font-weight: 700; font-size: 28px; letter-spacing: 4px; text-transform: uppercase; color: var(--green); }
.kicker::before { content: ''; width: 44px; height: 4px; background: var(--green); border-radius: 2px; }
h1 { font-family: 'BSC'; font-weight: 800; text-transform: uppercase; line-height: .96; letter-spacing: .5px; margin-top: 22px; }
h1 em { font-style: normal; color: var(--green); }
.head { position: absolute; top: 170px; left: 72px; right: 72px; z-index: 4; }
.head h1 { font-size: 92px; }
.head p { margin-top: 26px; font-size: 34px; line-height: 1.38; color: var(--chalk2); max-width: 900px; font-weight: 500; }
.bar { position: absolute; left: 72px; right: 72px; bottom: 44px; height: 5px; display: flex; gap: 8px; z-index: 6; }
.bar i { flex: 1; border-radius: 3px; background: rgba(240,244,242,.16); }
.bar i.on { background: var(--green); }

/* hook: the desk photograph under the headline */
.t-hook { background: #0c100e; }
.t-hook .photo { position: absolute; inset: 0; background: url(${url('landing/img/hero.webp')}) center 62% / cover; filter: saturate(.95); }
.t-hook .photo::after { content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(12,16,14,.92) 0%, rgba(12,16,14,.80) 38%, rgba(12,16,14,.35) 64%, rgba(12,16,14,.85) 100%); }
.t-hook .head { top: 230px; }
.t-hook h1 { font-size: 124px; }
.t-hook .swipe { position: absolute; right: 72px; bottom: 96px; z-index: 5; display: flex; align-items: center; gap: 16px;
  font-family: 'BSC'; font-weight: 700; font-size: 30px; letter-spacing: 4px; text-transform: uppercase; color: var(--chalk);
  background: rgba(26,32,30,.82); border: 2px solid var(--green); border-radius: 999px; padding: 18px 30px; }
.swipe svg { width: 34px; height: 34px; }

/* phone */
.phone { position: absolute; left: 50%; transform: translateX(-50%); top: 600px; width: 720px; height: 900px;
  border-radius: 64px; background: #0b0e0d; padding: 14px; border: 3px solid var(--s3);
  box-shadow: 0 0 0 10px rgba(52,192,111,.06), 0 40px 120px rgba(0,0,0,.55); }
.phone .screen { width: 100%; height: 100%; border-radius: 52px; overflow: hidden; position: relative; background: var(--canvas); }
.phone .screen img { position: absolute; left: 0; width: 100%; }
.phone-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 160px; z-index: 3; background: linear-gradient(180deg, transparent, var(--canvas) 85%); }

/* cards drawn the way the game draws them */
.stage { position: absolute; left: 72px; right: 72px; top: 690px; z-index: 3; }
.gcard { background: var(--s1); border: 2px solid var(--border); border-radius: 26px; padding: 34px 36px; }
.gcard.danger { border-left: 10px solid var(--danger); }
.gcard h3 { font-family: 'BSC'; font-weight: 700; font-size: 38px; }
.gcard .meta { font-size: 26px; color: var(--muted); margin-top: 8px; }
.opt { display: flex; gap: 24px; align-items: flex-start; margin-top: 18px; padding: 24px 26px; border-radius: 18px; background: var(--s2); border: 2px solid var(--s3); }
.opt.pick { border-color: var(--green); background: var(--green-tint); }
.opt .ic { flex: 0 0 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; background: var(--s3); color: var(--green); font-family: 'BSC'; font-weight: 800; font-size: 30px; }
.opt b { font-family: 'BSC'; font-weight: 700; font-size: 34px; color: var(--green-hi); display: block; }
.opt span { font-size: 26px; color: var(--chalk2); line-height: 1.35; }

.news { background: var(--s1); border: 2px solid var(--border); border-radius: 26px; overflow: hidden; }
.news .nh { display: flex; align-items: center; justify-content: space-between; padding: 22px 34px; background: var(--s2); border-bottom: 2px solid var(--border); }
.news .nh .tag { font-family: 'BSC'; font-weight: 700; font-size: 24px; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); }
.news .nh .src { font-family: 'BSC'; font-weight: 700; font-size: 24px; letter-spacing: 2px; color: var(--muted); }
.news .nb { padding: 32px 36px 38px; }
.news h3 { font-family: 'BSC'; font-weight: 700; font-size: 54px; line-height: 1.12; }
.news p { margin-top: 24px; font-size: 35px; line-height: 1.5; color: var(--chalk2); }

.list .row { display: flex; align-items: baseline; gap: 26px; padding: 24px 0; border-bottom: 2px solid var(--border); }
.list .row:last-child { border-bottom: 0; }
.list .n { font-family: 'BSC'; font-weight: 800; font-size: 34px; color: var(--green); width: 46px; flex: 0 0 46px; }
.list b { display: block; font-family: 'BSC'; font-weight: 700; font-size: 40px; }
.list span { display: block; margin-top: 4px; font-size: 27px; color: var(--chalk2); }

.stats { display: grid; gap: 28px; }
.stat { display: flex; gap: 36px; align-items: center; background: var(--s1); border: 2px solid var(--border); border-radius: 26px; padding: 34px 40px; }
.stat .big { font-family: 'BSC'; font-weight: 900; font-size: 150px; line-height: .9; color: var(--green); min-width: 130px; text-align: center; }
.stat b { font-family: 'BSC'; font-weight: 700; font-size: 44px; text-transform: uppercase; letter-spacing: 1px; display: block; }
.stat span { display: block; margin-top: 8px; font-size: 28px; line-height: 1.4; color: var(--chalk2); }

.t-text .quote { position: absolute; left: 72px; right: 72px; bottom: 150px; font-size: 36px; line-height: 1.5; color: var(--chalk2); border-left: 8px solid var(--gold); padding-left: 36px; }

/* call to action */
.t-cta { background: #0c100e; }
.t-cta .photo { position: absolute; inset: 0; background: url(${url('landing/img/hero.webp')}) center 70% / cover; }
.t-cta .photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,16,14,.55), rgba(12,16,14,.9) 45%, rgba(12,16,14,.97)); }
.t-cta .mid { position: absolute; left: 72px; right: 72px; top: 250px; z-index: 4; text-align: center; display: flex; flex-direction: column; align-items: center; }
.t-cta .mid > svg { width: 200px; height: 200px; filter: drop-shadow(0 20px 60px rgba(52,192,111,.35)); }
.t-cta h2 { margin-top: 44px; font-family: 'BSC'; font-weight: 800; font-size: 150px; line-height: .9; letter-spacing: 8px; color: var(--green); }
.t-cta h3 { font-family: 'BSC'; font-weight: 700; font-size: 62px; letter-spacing: 10px; text-transform: uppercase; margin-top: 8px; }
.t-cta .tl { margin-top: 30px; font-family: 'BSC'; font-weight: 700; font-size: 34px; color: var(--chalk2); letter-spacing: 1px; }
.t-cta .stores { margin-top: 56px; display: flex; flex-direction: column; gap: 22px; width: 640px; }
.store { display: flex; align-items: center; gap: 24px; padding: 24px 36px; border-radius: 22px; text-align: left; }
.store svg { width: 52px; height: 52px; filter: none; }
.store .l1 { display: block; font-size: 24px; letter-spacing: 1px; }
.store .l2 { display: block; font-family: 'BSC'; font-weight: 700; font-size: 44px; line-height: 1.05; }
.store.live { background: var(--green); color: #070d0a; }
.store.soon { background: rgba(240,244,242,.06); border: 2px solid var(--s3); color: var(--chalk2); }
.t-cta .url { margin-top: 44px; font-family: 'BSC'; font-weight: 700; font-size: 32px; letter-spacing: 3px; color: var(--chalk); }
.t-cta .small { position: absolute; left: 72px; right: 72px; bottom: 80px; z-index: 4; text-align: center; font-size: 20px; line-height: 1.45; color: var(--muted); }
`

const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.6 1.8a1.4 1.4 0 0 0-.5 1.1v18.2c0 .45.18.85.5 1.1l10-10.2-10-10.2Zm11.1 9.1 2.9-3-9.5-5.4 6.6 8.4Zm0 2.2-6.6 8.4 9.5-5.4-2.9-3Zm4.3-2.2-2.4-1.4-3 3.1 3 3.1 2.4-1.4c.9-.5.9-2.4 0-2.9v-.5Z"/></svg>'
const APPLE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4s-2.3-.9-2.3-3.4ZM14.3 6c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2Z"/></svg>'
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

const PHONE_W = 720 - 28 - 6 // frame width, less padding and border

function body(s) {
  const head = (extra = '') => `<div class="head"><div class="kicker">${s.kicker}</div><h1>${s.title}</h1>${s.body ? `<p>${s.body}</p>` : ''}${extra}</div>`
  switch (s.type) {
    case 'hook':
      return `<div class="photo"></div><div class="head"><div class="kicker">${s.kicker}</div><h1>${s.title}</h1><p>${s.sub}</p></div>
        <div class="swipe">Swipe ${ARROW}</div>`
    case 'phone': {
      const scale = PHONE_W / 1290
      return `${head()}<div class="phone"><div class="screen"><img src="${shot(s.img)}" style="top:${-s.y * scale}px"></div></div><div class="phone-fade"></div>`
    }
    case 'card':
      return `${head()}<div class="stage" style="top:640px"><div class="gcard danger">
        <h3>Penalty: your call from the touchline</h3>
        <div class="meta">Calder 0-0 Penford · all square, 4 minutes in</div>
        <div class="opt"><div class="ic">3</div><div><b>Take the Points</b><span>Fingal Crichton lines it up. Safe three.</span></div></div>
        <div class="opt pick"><div class="ic">5</div><div><b>Kick to the Corner</b><span>Lineout five metres out. Back the maul and go for the try.</span></div></div>
        <div class="opt"><div class="ic">›</div><div><b>Tap &amp; Go</b><span>Catch them flat-footed and keep the tempo up.</span></div></div>
      </div></div>`
    case 'news':
      return `${head()}<div class="stage" style="top:${s.title.split('<br>').length > 2 ? 680 : 560}px"><div class="news">
        <div class="nh"><span class="tag">${s.story.tag}</span><span class="src">${s.story.src ?? 'NEWS'}</span></div>
        <div class="nb"><h3>${s.story.head}</h3><p>${s.story.body}</p></div></div></div>`
    case 'list':
      return `${head()}<div class="stage" style="top:560px"><div class="gcard list">${s.items.map((it, i) =>
        `<div class="row"><div class="n">${String(i + 1).padStart(2, '0')}</div><div><b>${it[0]}</b><span>${it[1]}</span></div></div>`).join('')}</div></div>`
    case 'stats':
      return `${head()}<div class="stage" style="top:600px"><div class="stats">${s.stats.map(([n, b, t]) =>
        `<div class="stat"><div class="big">${n}</div><div><b>${b}</b><span>${t}</span></div></div>`).join('')}</div></div>`
    case 'text':
      return `<div class="head"><div class="kicker">${s.kicker}</div><h1 style="font-size:112px">${s.title}</h1></div><div class="quote">${s.body}</div>`
    case 'cta':
      return `<div class="photo"></div><div class="mid">${MARK}
        <h2>PHASE</h2><h3>Rugby Manager</h3><div class="tl">Stories, seasons &amp; silverware</div>
        <div class="stores">
          <div class="store live">${PLAY}<div><span class="l1">Free on</span><span class="l2">Google Play</span></div></div>
          <div class="store soon">${APPLE}<div><span class="l1">Coming soon to</span><span class="l2">the App Store</span></div></div>
        </div>
        <div class="url">PHASERUGBYMANAGER.COM</div></div>
        <div class="small">An unofficial, independent game. Not affiliated with, endorsed by or licensed by any player, club, league or governing body. Names in these images are fictional.</div>`
  }
}

function page(c, i) {
  const s = c.slides[i]
  const n = c.slides.length
  const chrome = s.type === 'cta' ? '' : `<div class="top"><div class="brand">${MARK}<div class="wm"><b>PHASE</b> RUGBY MANAGER</div></div>
    </div>`
  const bar = `<div class="bar">${c.slides.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
    <body><div class="slide t-${s.type}">${chrome}${body(s)}${bar}</div></body></html>`
}

const only = process.argv[2]
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
for (const c of CAROUSELS) {
  if (only && !c.id.startsWith(only)) continue
  const dir = resolve(HERE, 'out', c.id)
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < c.slides.length; i++) {
    const file = resolve(HERE, `_slide.html`)
    await import('node:fs').then(fs => fs.writeFileSync(file, page(c, i)))
    await pg.goto(pathToFileURL(file).href)
    await pg.evaluate(() => document.fonts.ready)
    await pg.waitForTimeout(150)
    await pg.screenshot({ path: resolve(dir, `${String(i + 1).padStart(2, '0')}.png`) })
  }
  console.log(c.id, c.slides.length, 'slides')
}
await import('node:fs').then(fs => fs.rmSync(resolve(HERE, '_slide.html'), { force: true }))
await browser.close()
