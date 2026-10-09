// Recovering the key from a press item that was saved before there were keys.
//
// The whole press room used to be built from English sentences and SAVED that
// way. A career started before that changed carries answered questions in its
// coverage list - "Three options are circled on the staff-room whiteboard" -
// and they are history, so the room never sweeps them: they sit there in
// English until forty newer questions have pushed them out, which is seasons.
//
// The stored sentence is the English template with its variables filled in, so
// the template can be matched back out of it. Every press.* entry becomes a
// regex with a capture where each {hole} was; the first one that matches a
// stored line gives back both the key and the values that were poured into it.
// A player name goes in and comes out unchanged, which is the point - the
// French sentence needs the same name in a different place.
//
// Anything that does not match is left exactly as it was. A wrong guess here
// would put the wrong words in a manager's mouth, so no match means no change.
import EN from '../locales/en.json'
import type { PressItem, PressOption } from './model'
import type { Vars } from './i18n'

type Pattern = { k: string; names: string[]; rx: RegExp; literal: number }

let INDEX: Pattern[] | null = null
/** [key, the English it was saved under before its wording changed] */
const LEGACY_EN: ReadonlyArray<readonly [string, string]> = [
  ['press.campHeat', 'Warm-weather camp ({cost})'],
  // these stopped calling every club's home "the town" (owner: language
  // relevant to location)
  ['press.campQ2', "Three options are circled on the staff-room whiteboard for the spare pre-season week: the heat camp, the town, or the sponsor's roadshow. The department heads are waiting on you."],
  ['press.campHomeR', 'Schools, junior clubs, open training. Costs nothing, and the town will remember it all season.'],
  ['press.silverFansR', 'The town takes it personally, in the best way. Season-ticket renewals do not need a letter this year.'],
  ['press.raceQ3', 'Two horses left in this race, and the other one is {club}. They are talking a big game across town. Anything to send back?'],
  ['press.runInPrivilegeR', 'Instant back-page headline. The town believes.'],
  ['press.unbeatenSayItR', 'The town roars. The board swallows hard - that quote will follow you into every ground.'],
  ['press.derbyWonCity', 'This club owns this city'],
  ['press.derbyLostQ2', 'They will paint the town their colours tonight. A derby lost - how long does this one hurt?'],
  // 1.8.16 voice pass: the press room reworded against the broadcast transcripts
  ["press.campTourR", "Three airports, two black-tie functions, one glossy cheque. The accountants beam. The players' legs file a formal complaint."],
  ["press.stanceQ1", "Season launch day, and the room wants a number. {pred_k} Where are you telling this club it is going?"],
  ["press.stanceQ2", "The chairman, the sponsors and the season-ticket renewal letter all want the same sentence from you. {pred_k} How do you pitch the year?"],
  ["press.stanceHighR", "The headline writes itself and the board puts {fund} behind it - beat the pundits' number or that money comes back out of next summer's budget, with interest. {room_k} From here every win is proof and every defeat is a broken promise: the boardroom needle will swing hard, both ways, all season."],
  ["press.stanceHighExpected", "The dressing room nods along - a club this size expects the talk."],
  ["press.stanceSafeR", "You talk the year down to take the heat off the group. The boardroom needle is muted both ways: defeats cost less, but so does winning - credit is thin for a man who promised nothing.{tail_k}"],
  ["press.stanceSafeFancied", " And at a club the pundits fancy, the squad hears something else in it: a manager who does not believe in them."],
  ["press.silverDoubleQ1", "The table in front of you has {n} trophies on it. {what_cl}, in one weekend. The room is on its feet before the first question: how does a season like this happen?"],
  ["press.silverAgain", "We go again - this is a beginning"],
  ["press.courtQ3", "{poss} interest in you is on every back page this morning. The room leans forward as one. What is your answer?"],
  ["press.courtWorkR", "Measured, professional, just short of a promise. The story cools without quite dying."],
  ["press.courtNeverR", "A stonewall the whole room hears as a maybe. The chairman's silence is loud, and the dressing room wonders if the gaffer is half out the door."],
  ["press.banQ1", "The citing commissioner has upheld {player}'s red card: a {n}-match ban. The club has 48 hours to appeal. Do you?"],
  ["press.banQ2", "{player}'s suspension is confirmed this morning - {n} match. Half your inbox is lawyers who fancy the footage. Appeal it?"],
  ["press.banQ2", "{player}'s suspension is confirmed this morning - {n} matches. Half your inbox is lawyers who fancy the footage. Appeal it?"],
  ["press.finalQ1", "Finals week. The room is three deep, half of them faces you have never seen. {comp}, {where}, {opp} on the other side. The first question is the only one they all came for: can you win it?"],
  ["press.finalQ2", "The camera count has tripled and there is a national broadcaster's anchor in the front row. One game, at {where}, against {opp}, for the {comp}. How do you handle a week like this?"],
  ["press.finalQ3", "Every seat taken, standing at the back - finals week does this. {opp} at {where} for the {comp}. They want a headline. What do you give them?"],
  ["press.finalWin", "We are ready. We will win it"],
  ["press.finalWinR", "The back pages have their headline and the dressing room walks taller all week. If Saturday goes wrong, that sentence will be read back to you for years."],
  ["press.finalRespectR", "Measured and confident. The board approves, the players nod along, and nobody has been handed a team-talk quote."],
  ["press.finalTrap", "The occasion is the trap - it is just rugby"],
  ["press.finalTrapR", "You talk the week down to protect the group. Sensible - though one or two of the younger lads wanted to hear the fire."],
  ["press.hotQ1", "{player} has been in scintillating form - some are calling him the best {pos_k} in the competition. Do you agree?"],
  ["press.hotQ3", "{player} again at the weekend. The pundits have run out of superlatives - have you?"],
  ["press.hotPraiseR", "{player} is reportedly delighted with your public backing."],
  ["press.hotFeetR", "A measured response. {player} knows there is more to do."],
  ["press.missedR", "The moment passed. The outlet ran the piece without you, and next week brings new questions."],
  ["press.coldBackR", "{player} appreciates the show of faith and vows to repay it."],
  ["press.coldAdmit", "Admit he must improve"],
  ["press.coldAdmitR", "Honest, but {player} is stung by the criticism."],
  ["press.coldBlameR", "“If he is short of form, look at how I am using him.” The room did not expect that. {player} did not either, and he trains like a man with a debt to repay."],
  ["press.rumourAsk", "Ask him - he is happy here"],
  ["press.rumourAskR", "You hand the question to the player, publicly and warmly. {player} obliges with a straight answer about loving the club, which buries the story better than any denial of yours could."],
  ["press.derbyFanR", "The back pages love it. The supporters are at boiling point - your players will feel ten feet tall, or feel the heat."],
  ["press.kidQ1", "Everyone is talking about {player} - {age} years old and lighting up the league. Is he the future of the club?"],
  ["press.kidCrownR", "{player} floats out of the press room - and every scout in the hemisphere just circled his name."],
  ["press.racePressureR", "“{short} have everything to lose - we're loving this.” The squad walks taller; the run-in just got personal."],
  ["press.raceOurselvesR", "Calm, professional, forgettable. The dressing room stays level."],
  ["press.unveilMarquee", "A marquee moment"],
  ["press.unveilMarqueeR", "“He changes everything for us.” {player} beams - and every match report this season will measure him against that sentence."],
  ["press.unveilSettleR", "Sensible. The pressure valve stays closed while he learns the calls."],
  ["press.crisisQ1", "{n} defeats in the last {of}. Supporters are restless. How do you respond to talk of a crisis?"],
  ["press.crisisOwnR", "The dressing room respects your honesty."],
  ["press.crisisMarginsR", "The board is unimpressed with excuses."],
  ["press.crisisAttackR", "The clip goes viral for the wrong reasons."],
  ["press.cardsAddress", "Promise it will be addressed"],
  ["press.ownerRugbyR", "Confident, direct - owners like a man who volunteers for the scoreboard."],
  ["press.vultureTrophiesR", "Defiant. The players walk a little taller - now you have to deliver."],
  ["press.vultureBoardR", "The vacuum fills with more speculation."],
  ["press.runInQ3", "Every week from now is a final. {who_k} always claim to enjoy it - do you, actually?"],
  ["press.runInPrivilegeR", "Instant back-page headline. The supporters believe."],
  ["press.intlProudR", "Gracious - and the academy parents noticed."],
  ["press.intlMoney", "We want compensation money"],
  ["press.intlDepthR", "Confident. The pundits write it down for later, which is how promises work."],
  ["press.intlClub", "I pick clubs over country, always"],
  ["press.intlHurtsR", "Candid, and the room respects it - but the headline writes itself: COACH ADMITS CRISIS."],
  ["press.natWinLotR", "The union loves it - and has written it down. Deliver, or this window becomes the stick they beat you with."],
  ["press.natClubPaysR", "Your dressing room walks taller. In the federation offices, someone underlines a clause."],
  ["press.unbeatenQ1", "{n} league games, {n} wins. Nobody has laid a glove on you. Go on - say the word."],
  ["press.unbeatenQ2", "Still unbeaten in the league. What is the secret, and when does the weight of the run start to tell?"],
  ["press.unbeatenNothing", "We have won nothing yet"],
  ["press.unbeatenSayItR", "The terraces roar. The board swallows hard - that quote will follow you into every ground."],
  ["press.plansQ1", "{player} knocks and closes the door behind him. “Boss, I have barely played all season. Tell me straight - am I in your plans or not?”"],
  ["press.plansQ2", "{player} has been waiting outside since the end of training. “I watch every session from the sidelines, boss. I need to know if there is a future for me here.”"],
  ["press.plansQ3", "{player} does not sit down. “I am not here to argue. One question: do you see me in this team? Because right now I cannot.”"],
  ["press.plansIn", "You are in my plans - stay ready"],
  ["press.plansInR2", "The tension goes out of his shoulders. A promise in this office is a promise on the team sheet, he will be counting the weeks."],
  ["press.plansOut", "Honestly? He can find a new club"],
  ["press.plansEarnR1", "He nods, jaw tight, and heads back to training. The squad hears about it, the honest ones respect it."],
  ["press.plansEarnR2", "“Fine. Then I will take one.” He trains like a man possessed all week. That answer either made him or lost him."],
  ["press.loanQ1", "{player}, {age}, is waiting by your office after training. “I am not learning anything carrying tackle bags, boss. Send me on loan - I need real minutes.”"],
  ["press.loanQ2", "{player} catches you in the corridor, all nerves and rehearsed lines. “Boss, my mates from the age-groups are playing senior rugby every week. I am standing still here. Let me go and prove it somewhere.”"],
  ["press.loanQ3", "The academy coach sends {player} up to see you. The lad gets it out in one breath: “Loan me out, boss. I will come back better - or I will come back and you can tell me I was wrong.”"],
  ["press.loanMinutesR2", "He floats out of the office. A first-team promise at his age is rocket fuel - but it burns fast if the team sheet never shows it."],
  ["press.loanAgree", "Agree - a loan makes sense"],
  ["press.loanAgreeR1", "A smart development call. The loan is agreed the same afternoon, and the reports will come back to you every few weeks."],
  ["press.loanAgreeR2", "He grins and shakes your hand twice, and the academy coach makes the calls before you have changed your mind: minutes make players, benches make excuses."],
  ["press.loanStay", "He is not ready to leave"],
  ["press.dealQ1", "{player}, {age} now, sits down across from you. “My deal is up this summer. I am not asking for promises, boss - I just need to know if I should be planning a life after this place.”"],
  ["press.dealQ2", "{player} waits until the room is empty. “Twelve years a professional, boss, and this is the conversation you never get used to. My contract is up. Where do I stand?”"],
  ["press.dealQ3", "{player} brings two coffees in and sets one down in front of you. “No agents, no lawyers, just us. My deal ends this summer. Tell me what you are thinking.”"],
  ["press.dealYear", "There is another year in you"],
  ["press.dealLastR1", "He takes it with dignity. He will finish the job properly - and the young players just saw how endings are handled here."],
  ["press.dealLastR2", "A long exhale, a nod, a handshake. “Then let us win something on the way out.” Class to the end."],
  ["press.routQ1", "{us}-{them}. A statement performance - the best this team can play, or is there more?"],
  ["press.routQ2", "{us}-{them}, and it barely flattered you. Where does that rank among performances in your time here?"],
  ["press.routMoveOn", "We move on immediately"],
  ["press.thrashOneDayR", "Calm - but the phone-ins want blood, not calm."],
  ["press.derbyWonQ1", "Derby day belongs to you. The fans are singing your name outside - a message for them?"],
  ["press.derbyWonEnjoyR", "The clip of your grin does big numbers. Bragging rights secured."],
  ["press.derbyWonFour", "It is only worth four points"],
  ["press.derbyWonCityR", "Front page. Their fans will keep the receipt - mind the return fixture."],
  ["press.derbyLostFace", "We will not hide from this"],
  ["press.derbyLostFaceR", "Straight talk. The fans respect honesty more than excuses."],
  ["press.derbyLostStats", "The performance was actually good"],
  ["press.derbyLostReturnR", "A promise. It will be remembered - deliver or else."],
  ["press.discTraining", "The assistant closes the door: {player} skipped Monday's recovery session and did not think it worth an excuse. The squad knows, and the squad is watching what you do about it."],
  ["press.discForm", "The assistant closes the door: {player} has been well below his own standard, and the coaches say the effort in review meetings matches the ratings. The squad knows, and the squad is watching what you do about it."],
  ["press.slotQ", "The {slot_k} is on a stopgap arrangement at {weekly} a week - under the going rate. The commercial director has three offers on the desk. Which way do we go?"],
  ["press.slotLongR", "Signed. Safe money for {n} year - a touch under market, because the sponsor is buying certainty off you."],
  ["press.slotLongR", "Signed. Safe money for {n} years - a touch under market, because the sponsor is buying certainty off you."],
  ["press.slotShortR", "Signed. Over the market rate, and you are back at this desk in {n} year - which is the bet: your reputation will have grown by then."],
  ["press.slotShortR", "Signed. Over the market rate, and you are back at this desk in {n} years - which is the bet: your reputation will have grown by then."],
  ["press.kidstartFirstR", "Warm, and true, and he plays like it - like a man having a first game."],
  ["press.comebackQ1", "Down by {n} at the break. What on earth did you say at half time?"],
  ["press.comebackQ2", "Fifteen behind and out. Then not. Talk us through the dressing room at half time."],
  ["press.homeSettle", "We will help him build a life here"],
  ["press.homeSeniorR", "The room likes that answer. {player} has somewhere to be on a Sunday now, which is worth more than a team talk."],
  ["press.weightRest", "He will get a week out of the firing line"],
  ["press.baroDealPrivate", "Talks are private, and they are going well"],
  ["press.baroDealPrivateR", "The room wanted a crack and you gave them a closed door. {player} appreciates it, and the pack leave with nothing."],
  ["press.baroDealPriceR", "Tomorrow's headline writes itself. The pack are delighted with you; the dressing room reads it as a For Sale sign."],
  ["press.baroBiteR", "The supporters love it and the squad laugh along. The pack do not, and they will remember who made them look silly."],
  ["press.baroDealSaturday", "I will talk about Saturday, not contracts"],
  ["press.baroDealSaturdayR", "Nothing to write and nothing to regret. The pack move on to the next question."],
  ["press.baroSuitorNoR", "A clear answer. {player} hears it, the supporters cheer it, and the pack have to find their story somewhere else."],
  ["press.baroSuitorListen", "If the offer is right, we will always listen"],
  ["press.baroRowNoneR", "You close it down without shutting anyone out. The squad like that, and the pack find little to chew on."],
  ["press.baroRowTrainR", "The pack have their line. {player} has just been told off in public, and will not forget it quickly."],
  ["press.baroRowGuessR", "A shot back at the room, and the supporters enjoy it. The pack take it personally."],
  ["press.baroRowPrivateR", "Fair enough, the pack concede. The story goes no further this week."],
  ["press.baroSmugHungryR", "The squad hear their manager backing them and walk a little taller. The pack wanted a worry and did not get one."],
  ["press.baroSmugNothing", "We have won nothing yet"],
  ["press.baroSmugNothingR", "Grounded and sensible. The board like it, the pack respect it, and one or two in the squad wish you had enjoyed it more."],
  ["press.baroAllTheWayR", "The headline writes itself and the supporters buy every word. The pack will write the other story just as happily if it goes wrong, and now they will be looking for it."],
  ["press.baroSmugMayR", "A smile and a shrug. The pack get a quote and the supporters get a line to repeat."],
  ["press.baroDefend", "They are giving everything. Judge me, not them"],
  ["press.baroDefendR", "The dressing room hears it. The pack wanted someone to blame and you did not give them anyone, which they do not enjoy."],
  ["press.baroOnMe", "The results are not good enough, and that is on me"],
  ["press.baroOnMeR", "Honest, and the room respects honesty. The pack ease off, for a week at least."],
  ["press.baroNextGame", "I am only thinking about the next game"],
  ["press.baroWroteOffR", "The terraces love it and the clip is everywhere by lunchtime. The pack do not forgive being made to look foolish."],
  ["press.baroBlameR", "The pack have their headline. The dressing room has a manager who went public on them, and that is hard to take back."],
  ["press.baroWarmPlayersR", "Generous, and the squad notice. The pack like a manager who shares it round."],
  ["press.baroWarmFansR", "The terraces hear it and sing it back on Saturday. The pack print it gladly."],
  ["press.baroWarmFeet", "Feet on the ground. We have won nothing"],
  ["press.baroWarmFeetR", "Sensible, and a little dull for the back pages. The board like it; the pack were hoping for more."],
  ["press.finalTrapR_f", "You talk the week down to protect the group. Sensible - though one or two of the younger players wanted to hear the fire."],
  ["press.hotQ1_f", "{player} has been in scintillating form - some are calling her the best {pos_k} in the competition. Do you agree?"],
  ["press.coldAdmit_f", "Admit she must improve"],
  ["press.coldBlameR_f", "“If she is short of form, look at how I am using her.” The room did not expect that. {player} did not either, and she trains like a woman with a debt to repay."],
  ["press.rumourAsk_f", "Ask her - she is happy here"],
  ["press.kidQ1_f", "Everyone is talking about {player} - {age} years old and lighting up the league. Is she the future of the club?"],
  ["press.kidCrownR_f", "{player} floats out of the press room - and every scout in the hemisphere just circled her name."],
  ["press.unveilMarqueeR_f", "“She changes everything for us.” {player} beams - and every match report this season will measure her against that sentence."],
  ["press.unveilSettleR_f", "Sensible. The pressure valve stays closed while she learns the calls."],
  ["press.plansQ1_f", "{player} knocks and closes the door behind her. “Boss, I have barely played all season. Tell me straight - am I in your plans or not?”"],
  ["press.plansInR2_f", "The tension goes out of her shoulders. A promise in this office is a promise on the team sheet, she will be counting the weeks."],
  ["press.plansOut_f", "Honestly? She can find a new club"],
  ["press.plansEarnR1_f", "She nods, jaw tight, and heads back to training. The squad hears about it, the honest ones respect it."],
  ["press.plansEarnR2_f", "“Fine. Then I will take one.” She trains like a woman possessed all week. That answer either made her or lost her."],
  ["press.loanQ3_f", "The academy coach sends {player} up to see you. The kid gets it out in one breath: “Loan me out, boss. I will come back better - or I will come back and you can tell me I was wrong.”"],
  ["press.loanMinutesR2_f", "She floats out of the office. A first-team promise at her age is rocket fuel - but it burns fast if the team sheet never shows it."],
  ["press.loanAgreeR2_f", "She grins and shakes your hand twice, and the academy coach makes the calls before you have changed your mind: minutes make players, benches make excuses."],
  ["press.loanStay_f", "She is not ready to leave"],
  ["press.dealLastR1_f", "She takes it with dignity. She will finish the job properly - and the young players just saw how endings are handled here."],
  ["press.discForm_f", "The assistant closes the door: {player} has been well below her own standard, and the coaches say the effort in review meetings matches the ratings. The squad knows, and the squad is watching what you do about it."],
  ["press.kidstartFirstR_f", "Warm, and true, and she plays like it - like a woman having a first game."],
  ["press.stanceSafeR_w", "You talk the year down to take the heat off the group. The boardroom needle is muted both ways: defeats cost less, but so does winning - credit is thin for a woman who promised nothing.{tail_k}"],
  ["press.ownerRugbyR_w", "Confident, direct - owners like a woman who volunteers for the scoreboard."],
]
/** any one quote mark or apostrophe, straight or curly */
const Q = `["“”‘’'«»]`

/** Every press.* entry as a pattern that can be matched backwards. Plural
 *  entries contribute both forms; the key is the same either way.
 *
 *  A template that is NOTHING BUT A HOLE - press.oppNamed is "{opp}", and there
 *  are half a dozen like it - matches every string ever written, so it is not a
 *  candidate at all. The probe caught it claiming a sentence the game has never
 *  written. What is left is ranked by how much literal text it has to match on,
 *  most first, so the most specific template wins rather than the shortest. */
function index(): Pattern[] {
  if (INDEX) return INDEX
  const out: Pattern[] = []
  const add = (k: string, text: string) => {
    const literal = text.replace(/\{\w+\}/g, '').trim()
    if (!literal) return
    const names: string[] = []
    // QUOTE MARKS ARE NOT EVIDENCE. The dictionary's quotes were reset to one
    // rule (game/quotes.ts): straight quotes curled, and the outer quotes on
    // the manager's own answers dropped, because the screen adds them. A line
    // saved before that still carries the old marks, so any quote mark matches
    // any other, and an answer may still wear the pair it was saved in -
    // round the whole line, or round the words before a (+£400k) note.
    const rx = text
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/["“”‘’'«»]/g, Q)
      .replace(/ \\\(/g, `${Q}? \\(`)
      .replace(/\\\{(\w+)\\\}/g, (_m, n: string) => { names.push(n); return '([\\s\\S]*?)' })
    out.push({ k, names, rx: new RegExp(`^${Q}?${rx}${Q}?$`), literal: literal.length })
  }
  const press = (EN as Record<string, unknown>).press as Record<string, unknown>
  for (const [k, v] of Object.entries(press ?? {})) {
    if (typeof v === 'string') add(`press.${k}`, v)
    else if (v && typeof v === 'object') {
      for (const form of Object.values(v as Record<string, string>)) {
        if (typeof form === 'string') add(`press.${k}`, form)
      }
    }
  }
  // English that a key used to have and no longer does: a line saved under
  // the old wording must still find its key (1.8.2 put a minus on the camp's
  // cost, owner: costs read as costs)
  for (const [k, old] of LEGACY_EN) add(k, old)
  out.sort((a, b) => b.literal - a.literal)
  INDEX = out
  return out
}

/** The key and vars behind one stored English line, or null if nothing fits. */
export function recover(text: string): { k: string; v: Vars } | null {
  if (!text) return null
  for (const p of index()) {
    const m = p.rx.exec(text)
    if (!m) continue
    const v: Vars = {}
    p.names.forEach((n, i) => { v[n] = m[i + 1] })
    return { k: p.k, v }
  }
  return null
}

/** Back-fill keys onto press items written before the press room had any.
 *  Returns how many lines were recovered, for the probe to assert on. */
export function migratePress(press: PressItem[]): number {
  let n = 0
  for (const item of press) {
    if (!item.qk) {
      const q = recover(item.question)
      if (q) { item.qk = q.k; item.qv = q.v; n++ }
    }
    for (const o of item.options as PressOption[]) {
      if (!o.lk) {
        const l = recover(o.label)
        if (l) { o.lk = l.k; o.lv = l.v; n++ }
      }
      if (!o.rk && o.reaction) {
        const r = recover(o.reaction)
        if (r) { o.rk = r.k; o.rv = r.v; n++ }
      }
    }
    if (!item.alk && item.answerLabel) {
      const a = recover(item.answerLabel)
      if (a) { item.alk = a.k; item.alv = a.v; n++ }
    }
    if (!item.rk && item.reaction) {
      const r = recover(item.reaction)
      if (r) { item.rk = r.k; item.rv = r.v; n++ }
    }
  }
  return n
}
