/**
 * SENSITIVITY GATE: nothing in any dictionary may carry a slur, an ethnic,
 * religious or sexual-orientation label used as a jibe, a disability slur,
 * a reference to self-harm or hard drugs, or a real political figure - in
 * any language the game ships. The copy is written in the voice of a press
 * box, and a press box gets a laugh from a dog on the pitch and a tea hut
 * gone quiet, never from who somebody is.
 *
 * Two lists per language. HARD terms fail the build: there is no rugby
 * sentence that needs them. WATCH terms are counted and printed for the
 * audit (docs/sensitivity-audit.md): alcohol, betting, body words, the
 * idioms that mean something else in a stadium ("blind side", "hot head",
 * "humour noir"). A watch term is not a fault; a new one is a prompt to
 * read the line. The 1.5.1 deep-dive read every one of them and the
 * verdicts are in the doc. ALLOW carries the handful of phrases a hard
 * pattern would otherwise trip on ("Grand Slam" in Japanese contains the
 * katakana for slum).
 */
import fs from 'node:fs'

type Lists = { hard: RegExp; watch: RegExp; allow?: RegExp }
const L: Record<string, Lists> = {
  en: {
    hard: /\b(retard(ed|s)?|spastic|spaz|midget|cripple[ds]?|tranny|faggot|fags?|dyke|paki|chink|gyppo|gypsy|gypsies|pikey|coon|nigg\w*|kike|wog|jap|towelhead|raghead|redskin|savages?|half-caste|coloureds?|kaffir|hottentot|eskimo|oriental|jihad|nazis?|hitler|holocaust|lynch\w*|rap(e|ed|ist)|suicid\w*|kill (him|her|your)self|apartheid|cocaine|heroin|steroids?|doping|brexit|trump|scalp\w*|handbags|like a girl|grow a pair|sissy|chinese whispers|indian summer|dutch courage|mexican standoff|spirit animal|powwow|pow-wow|blacklist|whitelist|grandfathered|muslims?|christians?|jews?|jewish|hindus?|catholics?|protestants?|mosque|allah|jesus)\b/gi,
    watch: /\b(man up|queer|gay|lesbian|church|christ|bet|bets|betting|bookies|bookmaker|odds|wager|punt|gamble|gambling|drunk|pints?|beer|wine|whisky|pub|fat|obese|skinny|bald|ugly|blind|lame|dumb|crazy|insane|mental|deaf|psycho|nuts|mad|madness|tribe|tribal|natives?|exotic|voodoo|ghetto|thug|guru|cakewalk|master|slave|hot head|dark arts|mercenary|girls?|ladies)\b/gi,
  },
  fr: {
    hard: /\b(nègre|négro|bougnoule|bicot|youpin|chinetoque|niakoué|pédé|tapette|gouine|tafiole|mongol(ien)?|attardé|bamboula|raton|crouille|nazis?|hitler|shoah|viol(é|ée|és|eur|euse|s)?|suicid\w*|apartheid|cocaïne|héroïne|dopage|stéroïdes?|scalp\w*|juifs?|juives?|musulmans?|musulmanes?|chrétiens?|chrétiennes?|catholiques?|protestants?|mosquée|allah|jésus)\b/gi,
    watch: /\b(débile|handicapé|église|dieu|paris?|pariera|bookmakers?|cote|ivre|bière|pinte|vin|gros|grosse|obèse|chauve|moche|aveugle|boiteux|fou|folle|dingue|taré|sourd|tribu|indigène|exotique|sauvage|primitif|ghetto|violent|mercenaire|filles?)\b/gi,
  },
  es: {
    hard: /\b(sudaca|maric[oó]n|maricas?|bollera|panchito|gitan[oa]s?|moros?|negratas?|retrasad[oa]s?|subnormal(es)?|mong[oó]lic[oa]s?|mongolos?|nazis?|hitler|violaci[oó]n|violad[oa]s?|violador(es)?|suicid\w*|apartheid|cocaína|heroína|dopaje|esteroides?|jud[ií][oa]s?|musulm[aá]n|musulmanes|musulmanas?|cristian[oa]s?|cat[oó]lic[oa]s?|protestantes?|mezquita|jes[uú]s)\b/gi,
    watch: /\b(iglesia|dios|apuestas?|apostar|casa de apuestas|cuotas?|borrach[oa]s?|cerveza|pinta|vino|gord[oa]s?|obes[oa]s?|calvo|feo|ciego|cojo|tonto|loc[oa]s?|demente|discapacitad[oa]s?|sordo|tribu|ind[ií]gena|ex[oó]tico|salvaje|primitivo|gueto|negr[oa]|mercenari[oa]|chicas?)\b/gi,
  },
  it: {
    hard: /\b(negr[oaie]|frocio|ricchione|finocchio|terrone|zingar[oaie]|mongoloide|ritardat[oaie]|handicappat[oaie]|nazist[aie]|nazi|hitler|stupr\w*|suicid\w*|apartheid|cocaina|eroina|doping|steroid\w*|scalp[oi]|ebre[oiae]|musulman[oaie]|cristian[oaie]|cattolic[oaie]|protestant[ei]|moschea|allah|gesù)\b/gi,
    watch: /\b(chiesa|dio|scommess\w*|scommett\w*|quot[ae]|ubriac[oa]|birra|pinta|vino|grass[oaie]|obes[oa]|calvo|brutt[oaie]|ciec[oa]|zopp[oa]|stupid[oa]|pazz[oaie]|matt[oaie]|folle|demente|disabil[ei]|sord[oa]|tribù|indigen[oa]|esotic[oa]|selvaggi[oa]|primitiv[oa]|ghetto|mercenari[oa]|ragazze)\b/gi,
  },
  ja: {
    hard: /(チョン|シナ人|土人|外人|部落民|キチガイ|気違い|池沼|ホモ|オカマ|レズ|自殺|強姦|レイプ|ナチス|ヒトラー|コカイン|ヘロイン|ドーピング|アパルトヘイト|イスラム教徒|キリスト教徒|ユダヤ人|モスク|アッラー)/g,
    watch: /((?<!スクラム|フライ)ハーフ(?!タイム|ウェイ|バック|ライン|団)|障害者|教会|神様|賭け|賭博|ブックメーカー|オッズ|酔っ|ビール|ワイン|パイント|デブ|太っ|ハゲタカ|禿|盲|バカ|馬鹿|アホ|狂っ|狂気|部族|原住民|野蛮|未開|エキゾチック|スラム(?!の)|女の子|少女)/g,
    allow: /グランドスラム|ハゲタカ/g,
  },
  af: {
    hard: /\b(kaffer|kaffers|kaffir|hotnot|hotnots|meid|meide|boesman|boesmans|koelie|koelies|moffie|moffies|houtkop|houtkoppe|soutpiel|soutpiele|rooinek|rooinekke|bantoe|swartes|swartmense|bruinmense|kleurling|kleurlinge|apartheid|nazi|nazis|hitler|verkrag\w*|selfmoord|kokaïen|heroïen|dwelms?|steroïed\w*|moslem|moslems|christen|christene|jood|jode|joods|katoliek\w*|protestant\w*|moskee|allah|jesus)\b/gi,
    watch: /\b(kerk|god|weddenskap\w*|wed|wedde|beroepswedder\w*|kanse|dronk|bier|biere|pint|wyn|vet|vetsug|kaal|lelik|blind|mank|dom|mal|gek|kranksinnig|doof|stam|stamme|inheems\w*|eksoties\w*|barbaar\w*|primitief|ghetto|huursoldaat|huursoldate|meisies?|dames)\b/gi,
  },
}

function walk(o: unknown, p: string, acc: [string, string][]) {
  if (!o || typeof o !== 'object') return acc
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'string') acc.push([p + k, v]); else walk(v, p + k + '.', acc)
  }
  return acc
}

let fails = 0
const files = fs.readdirSync('src/locales').filter(f => f.endsWith('.json')).sort()
for (const f of files) {
  const lang = f.replace('.json', '')
  const lists = L[lang]
  if (!lists) { console.log(`  FAIL  ${lang}: a dictionary with no sensitivity lists - add ${lang} to scripts/sensitivityprobe.ts`); fails++; continue }
  const all = walk(JSON.parse(fs.readFileSync(`src/locales/${f}`, 'utf8')), '', [])
  const watch = new Map<string, number>()
  let hard = 0
  for (const [key, raw] of all) {
    if (key.startsWith('_meta')) continue
    const v = lists.allow ? raw.replace(lists.allow, ' ') : raw
    for (const m of v.matchAll(lists.hard)) {
      hard++; fails++
      console.log(`  FAIL  ${lang}.${key}: "${m[0]}" in ${JSON.stringify(raw.slice(0, 110))}`)
    }
    for (const m of v.matchAll(lists.watch)) {
      const w = m[0].toLowerCase()
      watch.set(w, (watch.get(w) ?? 0) + 1)
    }
  }
  const top = [...watch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, n]) => `${w} ${n}`).join(', ')
  console.log(`  ${hard ? 'FAIL' : 'ok  '}  ${lang}: ${all.length} strings, ${hard} hard hits; watch: ${top || 'none'}`)
}
console.log(fails ? `\nSENSITIVITY PROBE FAILED (${fails})` : `\nSENSITIVITY PROBE PASSED: ${files.length} dictionaries, no line gets its laugh from who somebody is`)
process.exit(fails ? 1 : 0)
