#!/usr/bin/env python3
"""Generate the feminine siblings (`key_f`) the women's game reads - see i18n.ts.

    python3 scripts/tools/feminise.py                # dry run, all four languages
    python3 scripts/tools/feminise.py fr --apply     # write fr.json
    python3 scripts/tools/feminise.py --apply --fresh  # drop every sibling and rebuild

Two axes come out of it: `_f` (the players are women) and `_w` / `_fw` (the
string's subject - the manager or a named member of staff - is a woman). See
i18n.ts for how t() reads them.

Two steps, always in this order. First the RULES below rewrite every string
that carries a masculine marker. Then feminise-corrections.json, beside this
file, is applied on top: a full string where the rules could not get there, a
null where the rules flipped something that was never a player (a postman, a
streaker, the rival manager), or a list of [old, new] substitutions. The
corrections are the hand pass - every generated string was read by a person
before it shipped - and they are kept so that --fresh can rebuild from the
rules and land on the same text. Add a correction rather than editing an `_f`
value in the locale file by hand, or the next --fresh will lose it.

scripts/womensvoice.ts plays a women's career in each language and counts
what still reaches the screen masculine; run it after this.

THE POLICY, because a rule that flips the wrong word is worse than no rule:

  1. THE PLAYER NOUN AND WHAT AGREES WITH IT ALWAYS FLIPS. A player in a
     women's world is a woman. joueur -> joueuse, and the article and the
     adjective attached to it go with it.
  2. A SUBJECT PRONOUN FLIPS ONLY WHEN THE STRING IS ABOUT A PLAYER - it names
     a player placeholder or the player noun - AND NAMES NO STAFF. The game
     genders its staff fifty-fifty in a women's world (gender.ts staffGender),
     so a coach may be a man and "il" about him is not wrong; a string about
     the manager is left alone and reported as a design gap.
  3. IMPERSONAL "IL" NEVER FLIPS. "il y a", "il faut", "il s'agit", "il reste"
     - the guard list is explicit and the validator checks the output for the
     breakage that would result if one were missed.
  4. NOTHING IS GENERATED THAT DOES NOT CHANGE. A sibling identical to its base
     is a key with no purpose.

Everything else - adjective agreement two clauses away, an object clitic that
is also an article - is left for a person, which is what the corrections file
is for.
"""
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import json, re, sys, collections

PLAYER_PH = re.compile(r'\{(player|players|names|pos|senior|kid|kidLast|propLast|men_l|star|kid|prop|nine|target|name|a|b|worst|poty|captain|keeper|winner|scorer|kicker|prospect|signing|veteran|leader|out|back|who|rookie|newbie|him_k|he_k|his_k|come_k|is_k|subj_k)\}')
# ONLY the people who are the SUBJECT of their own sentence. "Les entraîneurs
# disent qu'il a gagné en finition" is about the player; excluding every string
# that mentions a coach or an agent left half the player stories masculine and
# put the French count UP. A referee, a groundsman and a postman are the
# subject of the sentences they appear in, and their gender is not the player's.
STAFF_WORD = re.compile(r"\b(arbitre|árbitro|arbitro|intendant|groundsman|jardinero|giardiniere|facteur|cartero|postino|speaker|historien|historiador|storico)\b", re.I)
STAFF_WORD_JA = re.compile(r"主審|審判|レフェリー|グラウンドキーパー|郵便配達|歴史家|コラムニスト|運転手|場内アナウンス|ストリーカー|バスローブ|投資家|金主|市長")
STAFF_WORD_AF = re.compile(r"\b(skeidsregter|veldopsigter|posbode|posman|historikus|rubriekskrywer|kelner|kroegman|melkman|dominee|predikant|burgemeester|beleggers?|geldmanne|voorsitter|huisbaas|klerekamerman|sjef)\b", re.I)
STAFF_WORD_EN = re.compile(r"\b(referee|groundsman|postman|historian|columnist|steward|streaker|kit man|chef|investors?|money men|numbers men|chairman|landlord|milkman|vicar|mayor)\b", re.I)
STAFF_PH  = re.compile(r'\{(boss|coach|asst|asst_k|scout|mgrName|mgr|manager|physio|ref|chair|owner|chairman|director|analyst|doctor|agent|journalist|pundit|officer)\}')
STAFF_KEY = re.compile(r'^(fan|stance|momMgr|press\.(boss|mgr|you)|bossPressure|hire|sack|resign|appoint|interview|assistant|staff|coach|profile\.)')

# ---------------------------------------------------------------- FRENCH
FR_NOUN = [
 (r"\bl'homme du match\b", "la femme du match"),
 (r"\bhomme du match\b", "femme du match"),
 (r"\ble meilleur joueur\b", "la meilleure joueuse"), (r"\bmeilleur joueur\b", "meilleure joueuse"),
 (r"\ble nouveau joueur\b", "la nouvelle joueuse"), (r"\bnouveau joueur\b", "nouvelle joueuse"),
 (r"\bl'ancien joueur\b", "l'ancienne joueuse"), (r"\bancien joueur\b", "ancienne joueuse"),
 (r"\bun jeune joueur\b", "une jeune joueuse"), (r"\ble jeune joueur\b", "la jeune joueuse"),
 (r"\bchaque joueur\b", "chaque joueuse"), (r"\btout joueur\b", "toute joueuse"),
 (r"\baucun joueur\b", "aucune joueuse"), (r"\bun seul joueur\b", "une seule joueuse"),
 (r"\bce joueur\b", "cette joueuse"), (r"\bcet joueur\b", "cette joueuse"),
 (r"\bdu joueur\b", "de la joueuse"), (r"\bau joueur\b", "à la joueuse"),
 (r"\ble joueur\b", "la joueuse"), (r"\bun joueur\b", "une joueuse"),
 (r"\bles meilleurs joueurs\b", "les meilleures joueuses"), (r"\bmeilleurs joueurs\b", "meilleures joueuses"),
 (r"\bles joueurs\b", "les joueuses"), (r"\bdes joueurs\b", "des joueuses"), (r"\baux joueurs\b", "aux joueuses"),
 (r"\bces joueurs\b", "ces joueuses"), (r"\btous les joueurs\b", "toutes les joueuses"),
 (r"\bjoueurs professionnels\b", "joueuses professionnelles"),
 (r"\bjoueurs\b", "joueuses"), (r"\bjoueur\b", "joueuse"),
 (r"\bles deux hommes\b", "les deux femmes"), (r"\bl'homme\b", "la femme"), (r"\bun homme\b", "une femme"),
 (r"\bhommes\b", "femmes"), (r"\bhomme\b", "femme"),
 (r"\bjeune garçon\b", "jeune fille"), (r"\bgarçons\b", "filles"), (r"\bgarçon\b", "fille"),
 (r"\bles gars\b", "les filles"), (r"\ble capitaine\b", "la capitaine"), (r"\bun capitaine\b", "une capitaine"),
 (r"\ble titulaire\b", "la titulaire"),
 (r"\b[Aa]ucun blessé\b", lambda m: m.group(0)[0] + "ucune blessée"),
 (r"\b[Aa]ucun joueur\b", lambda m: m.group(0)[0] + "ucune joueuse"),
 (r"(?<!de )(?<!d')\bblessés\b", "blessées"), (r"(?<!de )(?<!d')\bblessé\b", "blessée"),
 (r"\bce dernier\b", "cette dernière"), (r"\bl'intéressé\b", "l'intéressée"),
 (r"\bson client\b", "sa cliente"), (r"\bmon client\b", "ma cliente"), (r"\bnotre client\b", "notre cliente"),
 (r"\bson fils\b", "sa fille"), (r"\bun fils\b", "une fille"),
 (r"\bMonsieur\b", "Madame"), (r"\bmonsieur\b", "madame"),

 (r"\bgamins\b", "gamines"), (r"\bgamin\b", "gamine"), (r"\ble vice-capitaine\b", "la vice-capitaine"),
 (r"\bd'femmes\b", "de femmes"), (r"\bd'filles\b", "de filles"),
 (r"\bjoueuse mondial\b", "joueuse mondiale"), (r"\bjoueuses mondial\b", "joueuses mondiales"),
 (r"\bl'un des\b(?= joueuses| meilleures)", "l'une des"),
]
FR_PRON = [
 # stress pronoun after a preposition
 (r"\b(pour|avec|sur|chez|à|de|autour de|contre|sans|derrière|devant|après|vers|selon|comme|entre|parmi) lui\b", r"\1 elle"),
 (r"\blui-même\b", "elle-même"),
 # imperatives with an enclitic object
 (r"\b([A-Za-zéèêàç]+ez)-le\b", r"\1-la"), (r"\b([A-Za-zéèêàç]+ez)-les\b", r"\1-les"),
 (r"\b([A-Za-zéèêàç]+e)-le\b", r"\1-la"), (r"\bs'est mis à\b", "s'est mise à"),
 # participles / adjectives after être, when the subject is the player
 (r"\bs'est mis d'accord\b", "s'est mise d'accord"), (r"\bs'est blessé\b", "s'est blessée"),
 (r"\bs'est entraîné\b", "s'est entraînée"), (r"\bs'est présenté\b", "s'est présentée"),




 (r"\best prêt\b", "est prête"), (r"\best content\b", "est contente"), (r"\best heureux\b", "est heureuse"),
 (r"\best déçu\b", "est déçue"), (r"\best fatigué\b", "est fatiguée"), (r"\best convoqué\b", "est convoquée"),
 (r"\best suspendu\b", "est suspendue"), (r"\best sanctionné\b", "est sanctionnée"), (r"\best titularisé\b", "est titularisée"),
 (r"\bsont partis\b", "sont parties"), (r"\bsont revenus\b", "sont revenues"), (r"\bsont convoqués\b", "sont convoquées"),
 (r"\bsont prêts\b", "sont prêtes"), (r"\bsont contents\b", "sont contentes"), (r"\bsont fatigués\b", "sont fatiguées"),
]
# impersonal il: never flipped. Checked as "il <word>".
FR_IMPERSONAL = r"(y|n'y|y avait|n'y avait|y aura|ait été|a filtré|me faut|te faut|lui faut|nous faut|vous faut|leur faut|en faut|n'est|ne faut|ne reste|ne s'agit|n'existe|ne manque|ne suffit|ne semble|ne vaut|faut|faudra|faudrait|fallait|s'agit|s'agissait|reste|restera|restait|semble|semblait|paraît|paraissait|vaut|vaudra|vaudrait|pleut|suffit|suffira|convient|importe|manque|existe|arrive|se peut|se pourrait|fait|était une fois|est (?:temps|possible|impossible|clair|vrai|rare|difficile|facile|probable|question|tard|tôt|encore|midi|minuit|peu|trop|bon|important|essentiel|inutile|normal|évident|certain))"
FR_IL = [
 (rf"\b[Qq]u'il (?!{FR_IMPERSONAL}\b)", lambda m: m.group(0)[0] + "u'elle "),
 (rf"\b[Ss]'il (?!{FR_IMPERSONAL}\b)", lambda m: m.group(0)[0] + "i elle "),
 (rf"\b[Pp]uisqu'il (?!{FR_IMPERSONAL}\b)", lambda m: m.group(0)[0] + "uisqu'elle "),
 (rf"\b[Ll]orsqu'il (?!{FR_IMPERSONAL}\b)", lambda m: m.group(0)[0] + "orsqu'elle "),
 (rf"(?<!-)\bIl (?!{FR_IMPERSONAL}\b)", "Elle "), (rf"(?<!-)(?<!t-)\bil (?!{FR_IMPERSONAL}\b)", "elle "),
 (r"\bqu'ils\b", "qu'elles"), (r"\bs'ils\b", "si elles"), (r"\bIls\b", "Elles"), (r"\bils\b", "elles"),
]

# ---------------------------------------------------------------- SPANISH
ES_NOUN = [
 (r"\bmejor jugador\b", "mejor jugadora"), (r"\bnuevo jugador\b", "nueva jugadora"),
 (r"\bel jugador\b", "la jugadora"), (r"\bun jugador\b", "una jugadora"), (r"\bdel jugador\b", "de la jugadora"),
 (r"\bal jugador\b", "a la jugadora"), (r"\beste jugador\b", "esta jugadora"), (r"\bese jugador\b", "esa jugadora"),
 (r"\bcada jugador\b", "cada jugadora"), (r"\bningún jugador\b", "ninguna jugadora"), (r"\btodo jugador\b", "toda jugadora"),
 (r"\blos mejores jugadores\b", "las mejores jugadoras"), (r"\bmejores jugadores\b", "mejores jugadoras"),
 (r"\blos jugadores\b", "las jugadoras"), (r"\bunos jugadores\b", "unas jugadoras"), (r"\bestos jugadores\b", "estas jugadoras"),
 (r"\btodos los jugadores\b", "todas las jugadoras"), (r"\bjugadores\b", "jugadoras"), (r"\bjugador\b", "jugadora"),
 (r"\bel hombre\b", "la mujer"), (r"\bun hombre\b", "una mujer"), (r"\bhombres\b", "mujeres"), (r"\bhombre\b", "mujer"),
 (r"\bchicos\b", "chicas"), (r"\bchico\b", "chica"), (r"\bmuchachos\b", "muchachas"), (r"\bmuchacho\b", "muchacha"),
 (r"\blesionados\b", "lesionadas"), (r"\blesionado\b", "lesionada"),
 (r"\bel capitán\b", "la capitana"), (r"\bcapitán\b", "capitana"), (r"\bel cliente\b", "la cliente"),
 (r"\bsu hijo\b", "su hija"), (r"\bseñor\b", "señora"), (r"\bSeñor\b", "Señora"),
]
ES_PRON = [
 (r"\bél mismo\b", "ella misma"), (r"\bde él\b", "de ella"), (r"\bcon él\b", "con ella"), (r"\bpara él\b", "para ella"),
 (r"\ba él\b", "a ella"), (r"\bpor él\b", "por ella"), (r"\bsin él\b", "sin ella"), (r"\bsobre él\b", "sobre ella"),
 (r"\bÉl\b", "Ella"), (r"\bél\b", "ella"), (r"\bEllos\b", "Ellas"), (r"\bellos\b", "ellas"),
 (r"\bestá listo\b", "está lista"), (r"\bestá contento\b", "está contenta"), (r"\bestá cansado\b", "está cansada"),
 (r"\bestá preparado\b", "está preparada"), (r"\bestá descansado\b", "está descansada"), (r"\bestá apto\b", "está apta"),
 (r"\bestán listos\b", "están listas"), (r"\bestán cansados\b", "están cansadas"), (r"\bestán preparados\b", "están preparadas"),
 (r"\bdosifícalo\b", "dosifícala"), (r"\bdéjalo\b", "déjala"), (r"\bponlo\b", "ponla"), (r"\bvéndelo\b", "véndela"),
 (r"\brenuévalo\b", "renuévala"), (r"\basciéndelo\b", "asciéndela"), (r"\bfíchalo\b", "fíchala"), (r"\bcédelo\b", "cédela"),
 (r"\bconvócalo\b", "convócala"), (r"\bdescártalo\b", "descártala"), (r"\bmantenlo\b", "mantenla"), (r"\bcuídalo\b", "cuídala"),
 (r"\bmándalo\b", "mándala"), (r"\bsácalo\b", "sácala"), (r"\bmételo\b", "métela"), (r"\bdescánsalo\b", "descánsala"),
 (r"\bmotívalo\b", "motívala"), (r"\bpromociónalo\b", "promociónala"), (r"\bprémialo\b", "prémiala"),
 (r"\bllámalo\b", "llámala"), (r"\bhazlo\b(?= (jugar|entrenar|descansar|esperar))", "hazla"),
 (r"\bpierdelo\b", "piérdela"), (r"\bpiérdelo\b", "piérdela"), (r"\bsustitúyelo\b", "sustitúyela"),
 (r"\btenerlo\b", "tenerla"), (r"\bvenderlo\b", "venderla"), (r"\bficharlo\b", "ficharla"), (r"\bcederlo\b", "cederla"),
 (r"\brenovarlo\b", "renovarla"), (r"\bconvocarlo\b", "convocarla"), (r"\bretenerlo\b", "retenerla"), (r"\bperderlo\b", "perderla"),
 (r"\bdejarlo\b", "dejarla"), (r"\bponerlo\b", "ponerla"), (r"\bsacarlo\b", "sacarla"), (r"\bmantenerlo\b", "mantenerla"),
 (r"\bverlo\b", "verla"), (r"\bcuidarlo\b", "cuidarla"), (r"\bconocerlo\b", "conocerla"), (r"\bpagarlo\b", "pagarla"),
 (r"\bsustituirlo\b", "sustituirla"), (r"\bproteger[l]o\b", "protegerla"), (r"\bpromocionarlo\b", "promocionarla"),
 (r"\bquedárselo\b", "quedársela"), (r"\bllevárselo\b", "llevársela"), (r"\bquitárselo\b", "quitársela"),
 (r"\bes suyo\b", "es suya"), (r"\bes tuyo\b", "es tuya"), (r"\bes nuestro\b", "es nuestra"),
]
ES_IL = [
 # Spanish drops subject pronouns; the ones present are already in ES_PRON.
]

# ---------------------------------------------------------------- ITALIAN
IT_NOUN = [
 (r"\bl'uomo in più\b", "la giocatrice in più"), (r"\buomo in più\b", "giocatrice in più"),
 (r"\bmiglior giocatore\b", "miglior giocatrice"), (r"\bil miglior giocatore\b", "la miglior giocatrice"),
 (r"\bnuovo giocatore\b", "nuova giocatrice"), (r"\bil giocatore\b", "la giocatrice"), (r"\bun giocatore\b", "una giocatrice"),
 (r"\bdel giocatore\b", "della giocatrice"), (r"\bal giocatore\b", "alla giocatrice"), (r"\bdal giocatore\b", "dalla giocatrice"),
 (r"\bsul giocatore\b", "sulla giocatrice"), (r"\bnel giocatore\b", "nella giocatrice"),
 (r"\bquesto giocatore\b", "questa giocatrice"), (r"\bquel giocatore\b", "quella giocatrice"), (r"\bogni giocatore\b", "ogni giocatrice"),
 (r"\bnessun giocatore\b", "nessuna giocatrice"), (r"\bi migliori giocatori\b", "le migliori giocatrici"),
 (r"\bi giocatori\b", "le giocatrici"), (r"\bdei giocatori\b", "delle giocatrici"), (r"\bai giocatori\b", "alle giocatrici"),
 (r"\bquesti giocatori\b", "queste giocatrici"), (r"\btutti i giocatori\b", "tutte le giocatrici"),
 (r"\bgiocatori\b", "giocatrici"), (r"\bgiocatore\b", "giocatrice"),
 (r"\bl'uomo\b", "la donna"), (r"\bun uomo\b", "una donna"), (r"\buomini\b", "donne"), (r"\buomo\b", "donna"),
 (r"\bragazzi\b", "ragazze"), (r"\bragazzo\b", "ragazza"), (r"\binfortunati\b", "infortunate"), (r"\binfortunato\b", "infortunata"),
 (r"\bil capitano\b", "la capitana"), (r"\bcapitano\b", "capitana"), (r"\bil titolare\b", "la titolare"),
 (r"\bil suo assistito\b", "la sua assistita"), (r"\bsuo figlio\b", "sua figlia"), (r"\bsignor\b", "signora"), (r"\bSignor\b", "Signora"),
 (r"\bognuno di loro\b", "ognuna di loro"), (r"\buno di loro\b", "una di loro"), (r"\bciascuno di loro\b", "ciascuna di loro"),
]
IT_PRON = [
 (r"\bLui\b", "Lei"), (r"\blui\b", "lei"), (r"\bEgli\b", "Ella"), (r"\begli\b", "ella"),
 (r"\bse stesso\b", "se stessa"), (r"\blui stesso\b", "lei stessa"),
 (r"\b([a-z]+r)gli\b", r"\1le"),
 (r"\bgli (resta|restano|cadrà|cadranno|ha|hanno|è|era|va|serve|servono|piace|manca|mancano|conviene|spetta|tocca|basta|costa|pesa|dà|danno|chiede|chiedono|offre|offrono|permette|consente|capita|succede|riesce|sta|stanno|farà|faranno|dice|dicono|parla|parlano)\b", r"le \1"),
 (r"\bè arrivato\b", "è arrivata"), (r"\bè partito\b", "è partita"),
 (r"\bè tornato\b", "è tornata"), (r"\bè rimasto\b", "è rimasta"), (r"\bè andato\b", "è andata"), (r"\bè uscito\b", "è uscita"),
 (r"\bè entrato\b", "è entrata"), (r"\bè nato\b", "è nata"), (r"\bè diventato\b", "è diventata"), (r"\bsi è infortunato\b", "si è infortunata"),
 (r"\bsi è allenato\b", "si è allenata"), (r"\bsi è presentato\b", "si è presentata"), (r"\bsi è fermato\b", "si è fermata"),
 (r"\bè pronto\b", "è pronta"), (r"\bè contento\b", "è contenta"), (r"\bè stanco\b", "è stanca"), (r"\bè deluso\b", "è delusa"),
 (r"\bsono pronti\b", "sono pronte"), (r"\bsono stanchi\b", "sono stanche"), (r"\bsono contenti\b", "sono contente"),
 (r"\bè stata (convocato|squalificato|ceduto|venduto|promosso|rinnovato|espulso|ammonito|sospeso|rilasciato|richiamato|inserito|escluso|tagliato|ingaggiato|acquistato|schierato|lasciato|messo|ritenuto|considerato|visto|notato|premiato|nominato|eletto|scelto|fermato|operato)\b", lambda m: "è stata " + m.group(1)[:-1] + "a"),
 (r"\bsono state (convocati|squalificati|ceduti|venduti|promossi|rinnovati|espulsi|ammoniti|sospesi|inseriti|esclusi|ingaggiati|acquistati|schierati|lasciati|messi|premiati|nominati|scelti)\b", lambda m: "sono state " + m.group(1)[:-1] + "e"),
 (r"\breinseriscilo\b", "reinseriscila"), (r"\bschieralo\b", "schierala"), (r"\bvendilo\b", "vendila"), (r"\brinnovalo\b", "rinnovala"),
 (r"\bpromuovilo\b", "promuovila"), (r"\bcedilo\b", "cedila"), (r"\blascialo\b", "lasciala"), (r"\btienilo\b", "tienila"),
 (r"\bmettilo\b", "mettila"), (r"\bconvocalo\b", "convocala"), (r"\bfallo\b(?= (giocare|allenare|riposare|aspettare|crescere))", "falla"),
 (r"\bproteggilo\b", "proteggila"), (r"\bpremialo\b", "premiala"), (r"\bmotivalo\b", "motivala"), (r"\brichiamalo\b", "richiamala"),
 (r"\btenerlo\b", "tenerla"), (r"\bvenderlo\b", "venderla"), (r"\bcederlo\b", "cederla"), (r"\brinnovarlo\b", "rinnovarla"),
 (r"\bconvocarlo\b", "convocarla"), (r"\btrattenerlo\b", "trattenerla"), (r"\bperderlo\b", "perderla"), (r"\blasciarlo\b", "lasciarla"),
 (r"\bmetterlo\b", "metterla"), (r"\bschierarlo\b", "schierarla"), (r"\bvederlo\b", "vederla"), (r"\bproteggerlo\b", "proteggerla"),
 (r"\bpagarlo\b", "pagarla"), (r"\bsostituirlo\b", "sostituirla"), (r"\bpromuoverlo\b", "promuoverla"), (r"\bfarlo\b(?= (giocare|riposare|crescere|allenare))", "farla"),
 (r"\bprenderlo\b", "prenderla"), (r"\bricomprarlo\b", "ricomprarla"), (r"\bacquistarlo\b", "acquistarla"), (r"\bingaggiarlo\b", "ingaggiarla"),
 (r"\bportarlo\b", "portarla"), (r"\bspostarlo\b", "spostarla"), (r"\bfermarlo\b", "fermarla"), (r"\bseguirlo\b", "seguirla"),
 (r"\blo vogliono\b", "la vogliono"), (r"\blo vuole\b", "la vuole"), (r"\blo hanno\b", "la hanno"), (r"\blo ha\b", "la ha"),
 (r"\blo aspetta\b", "la aspetta"), (r"\blo aspettano\b", "la aspettano"), (r"\blo osservano\b", "la osservano"), (r"\blo seguono\b", "la seguono"),
 (r"\blo cercano\b", "la cercano"), (r"\blo tengono\b", "la tengono"), (r"\blo perdi\b", "la perdi"), (r"\blo tieni\b", "la tieni"),
 (r"\blo vendi\b", "la vendi"), (r"\blo rinnovi\b", "la rinnovi"), (r"\blo schieri\b", "la schieri"), (r"\blo convochi\b", "la convochi"),
 (r"\bè suo\b", "è sua"), (r"\bè tuo\b", "è tua"), (r"\bè nostro\b", "è nostra"), (r"\bil migliore\b(?= (della|del|in|tra|fra))", "la migliore"),
]
IT_IL = []


FR_ADJ = {'solide': 'solide', 'bon': 'bonne', 'grand': 'grande', 'jeune': 'jeune', 'nouveau': 'nouvelle', 'vrai': 'vraie', 'petit': 'petite', 'excellent': 'excellente', 'mauvais': 'mauvaise', 'brillant': 'brillante', 'ancien': 'ancienne', 'meilleur': 'meilleure', 'second': 'seconde', 'premier': 'première', 'autre': 'autre', 'seul': 'seule', 'futur': 'future', 'simple': 'simple', 'vieux': 'vieille', 'beau': 'belle', 'gros': 'grosse', 'fin': 'fine', 'pur': 'pure', 'sacré': 'sacrée', 'fameux': 'fameuse', 'honnête': 'honnête', 'discret': 'discrète', 'complet': 'complète'}
FR_ADJP = {'grands': 'grandes', 'bons': 'bonnes', 'meilleurs': 'meilleures', 'jeunes': 'jeunes', 'nouveaux': 'nouvelles', 'vrais': 'vraies', 'anciens': 'anciennes', 'autres': 'autres', 'seuls': 'seules', 'petits': 'petites', 'vieux': 'vieilles', 'beaux': 'belles', 'gros': 'grosses', 'futurs': 'futures', 'excellents': 'excellentes'}

FR_PP = {'affûté': 'affûtée', 'mené': 'menée', 'aimé': 'aimée', 'différent': 'différente', 'décerné': 'décernée', 'concerné': 'concernée', 'ressorti': 'ressortie', 'annoncé': 'annoncée', 'grelottant': 'grelottante', 'venu': 'venue', 'entraîné': 'entraînée', 'ami': 'amie', 'battu': 'battue', 'plaqué': 'plaquée', 'suivant': 'suivante', 'performant': 'performante', 'honnête': 'honnête', 'affamé': 'affamée', 'tutelé': 'tutelée', 'encadré': 'encadrée', 'sorti': 'sortie', 'blessé': 'blessée', 'touché': 'touchée', 'remplacé': 'remplacée', 'exclu': 'exclue', 'désigné': 'désignée', 'mis': 'mise', 'placé': 'placée', 'cité': 'citée', 'choisi': 'choisie', 'élu': 'élue', 'prêté': 'prêtée', 'vendu': 'vendue', 'promu': 'promue', 'retenu': 'retenue', 'sanctionné': 'sanctionnée', 'suspendu': 'suspendue', 'convoqué': 'convoquée', 'sélectionné': 'sélectionnée', 'chipé': 'chipée', 'désiré': 'désirée', 'fatigué': 'fatiguée', 'épuisé': 'épuisée', 'rouillé': 'rouillée', 'cuit': 'cuite', 'fini': 'finie', 'parti': 'partie', 'revenu': 'revenue', 'arrivé': 'arrivée', 'né': 'née', 'mort': 'morte', 'nommé': 'nommée', 'libéré': 'libérée', 'prolongé': 'prolongée', 'titularisé': 'titularisée', 'aligné': 'alignée', 'écarté': 'écartée', 'protégé': 'protégée', 'ménagé': 'ménagée', 'observé': 'observée', 'suivi': 'suivie', 'noté': 'notée', 'repéré': 'repérée', 'surveillé': 'surveillée', 'attendu': 'attendue', 'présenté': 'présentée', 'opéré': 'opérée', 'arrêté': 'arrêtée', 'considéré': 'considérée', 'jugé': 'jugée', 'vu': 'vue', 'connu': 'connue', 'reconnu': 'reconnue', 'apprécié': 'appréciée', 'respecté': 'respectée', 'salué': 'saluée', 'félicité': 'félicitée', 'puni': 'punie', 'averti': 'avertie', 'prévenu': 'prévenue', 'payé': 'payée', 'traité': 'traitée', 'accueilli': 'accueillie', 'rétabli': 'rétablie', 'guéri': 'guérie', 'remis': 'remise', 'reposé': 'reposée', 'formé': 'formée', 'recruté': 'recrutée', 'transféré': 'transférée', 'inscrit': 'inscrite', 'rappelé': 'rappelée', 'remplaçant': 'remplaçante', 'partant': 'partante', 'sortant': 'sortante', 'entrant': 'entrante', 'correspondant': 'correspondante', 'absent': 'absente', 'présent': 'présente', 'content': 'contente', 'déçu': 'déçue', 'inquiet': 'inquiète', 'satisfait': 'satisfaite', 'certain': 'certaine', 'sûr': 'sûre', 'seul': 'seule', 'prêt': 'prête', 'malheureux': 'malheureuse', 'heureux': 'heureuse', 'furieux': 'furieuse', 'nerveux': 'nerveuse', 'sérieux': 'sérieuse', 'ambitieux': 'ambitieuse', 'professionnel': 'professionnelle', 'mercenaire': 'mercenaire', 'caractériel': 'caractérielle', 'nouveau': 'nouvelle', 'ancien': 'ancienne', 'premier': 'première', 'dernier': 'dernière', 'meilleur': 'meilleure', 'bon': 'bonne', 'grand': 'grande', 'petit': 'petite', 'jeune': 'jeune', 'vieux': 'vieille', 'fort': 'forte', 'solide': 'solide', 'frais': 'fraîche', 'apte': 'apte', 'disponible': 'disponible', 'indisponible': 'indisponible', 'titulaire': 'titulaire', 'clé': 'clé', 'cadre': 'cadre', 'vedette': 'vedette', 'professionnelle': 'professionnelle', 'entier': 'entière', 'complet': 'complète', 'discret': 'discrète', 'net': 'nette', 'ponctuel': 'ponctuelle', 'prudent': 'prudente', 'lent': 'lente', 'brillant': 'brillante', 'excellent': 'excellente', 'mauvais': 'mauvaise', 'méchant': 'méchante', 'gentil': 'gentille', 'loyal': 'loyale', 'fidèle': 'fidèle', 'honnête': 'honnête', 'sage': 'sage', 'malin': 'maligne', 'têtu': 'têtue', 'doué': 'douée', 'talentueux': 'talentueuse', 'courageux': 'courageuse', 'généreux': 'généreuse', 'précieux': 'précieuse', 'coûteux': 'coûteuse', 'dangereux': 'dangereuse', 'peureux': 'peureuse', 'déterminé': 'déterminée', 'motivé': 'motivée', 'concentré': 'concentrée', 'usé': 'usée', 'abîmé': 'abîmée', 'cassé': 'cassée', 'diminué': 'diminuée', 'affaibli': 'affaiblie', 'renforcé': 'renforcée', 'amélioré': 'améliorée', 'transformé': 'transformée', 'installé': 'installée', 'intégré': 'intégrée', 'adopté': 'adoptée', 'accepté': 'acceptée', 'refusé': 'refusée', 'oublié': 'oubliée', 'ignoré': 'ignorée', 'écouté': 'écoutée', 'entendu': 'entendue', 'compris': 'comprise', 'soutenu': 'soutenue', 'encadré': 'encadrée', 'coaché': 'coachée', 'testé': 'testée', 'évalué': 'évaluée', 'classé': 'classée', 'recrutable': 'recrutable', 'vendable': 'vendable', 'lié': 'liée', 'engagé': 'engagée', 'embauché': 'embauchée', 'viré': 'virée', 'retraité': 'retraitée'}
FR_PPS = {'affûtés': 'affûtées', 'menés': 'menées', 'aimés': 'aimées', 'différents': 'différentes', 'décernés': 'décernées', 'concernés': 'concernées', 'ressortis': 'ressorties', 'annoncés': 'annoncées', 'grelottants': 'grelottantes', 'venus': 'venues', 'entraînés': 'entraînées', 'amis': 'amies', 'battus': 'battues', 'plaqués': 'plaquées', 'suivants': 'suivantes', 'performants': 'performantes', 'affamés': 'affamées', 'sortis': 'sorties', 'blessés': 'blessées', 'touchés': 'touchées', 'remplacés': 'remplacées', 'exclus': 'exclues', 'désignés': 'désignées', 'mis': 'mises', 'placés': 'placées', 'cités': 'citées', 'choisis': 'choisies', 'élus': 'élues', 'prêtés': 'prêtées', 'vendus': 'vendues', 'promus': 'promues', 'retenus': 'retenues', 'sanctionnés': 'sanctionnées', 'suspendus': 'suspendues', 'convoqués': 'convoquées', 'sélectionnés': 'sélectionnées', 'chipés': 'chipées', 'désirés': 'désirées', 'fatigués': 'fatiguées', 'épuisés': 'épuisées', 'rouillés': 'rouillées', 'cuits': 'cuites', 'finis': 'finies', 'partis': 'parties', 'revenus': 'revenues', 'arrivés': 'arrivées', 'nés': 'nées', 'morts': 'mortes', 'nommés': 'nommées', 'libérés': 'libérées', 'prolongés': 'prolongées', 'titularisés': 'titularisées', 'alignés': 'alignées', 'écartés': 'écartées', 'protégés': 'protégées', 'ménagés': 'ménagées', 'observés': 'observées', 'suivis': 'suivies', 'notés': 'notées', 'repérés': 'repérées', 'surveillés': 'surveillées', 'attendus': 'attendues', 'présentés': 'présentées', 'opérés': 'opérées', 'arrêtés': 'arrêtées', 'considérés': 'considérées', 'jugés': 'jugées', 'vus': 'vues', 'connus': 'connues', 'reconnus': 'reconnues', 'appréciés': 'appréciées', 'respectés': 'respectées', 'salués': 'saluées', 'félicités': 'félicitées', 'punis': 'punies', 'avertis': 'averties', 'prévenus': 'prévenues', 'payés': 'payées', 'traités': 'traitées', 'accueillis': 'accueillies', 'rétablis': 'rétablies', 'guéris': 'guéries', 'remis': 'remises', 'reposés': 'reposées', 'formés': 'formées', 'recrutés': 'recrutées', 'transférés': 'transférées', 'inscrits': 'inscrites', 'rappelés': 'rappelées', 'remplaçants': 'remplaçantes', 'partants': 'partantes', 'sortants': 'sortantes', 'entrants': 'entrantes', 'correspondants': 'correspondantes', 'absents': 'absentes', 'présents': 'présentes', 'contents': 'contentes', 'déçus': 'déçues', 'inquiets': 'inquiètes', 'satisfaits': 'satisfaites', 'certains': 'certaines', 'sûrs': 'sûres', 'seuls': 'seules', 'prêts': 'prêtes', 'malheureux': 'malheureuses', 'heureux': 'heureuses', 'furieux': 'furieuses', 'nerveux': 'nerveuses', 'sérieux': 'sérieuses', 'ambitieux': 'ambitieuses', 'professionnels': 'professionnelles', 'mercenaires': 'mercenaires', 'caractériels': 'caractérielles', 'nouveaus': 'nouvelles', 'anciens': 'anciennes', 'premiers': 'premières', 'derniers': 'dernières', 'meilleurs': 'meilleures', 'bons': 'bonnes', 'grands': 'grandes', 'petits': 'petites', 'jeunes': 'jeunes', 'vieux': 'vieilles', 'forts': 'fortes', 'solides': 'solides', 'frais': 'fraîches', 'aptes': 'aptes', 'disponibles': 'disponibles', 'indisponibles': 'indisponibles', 'titulaires': 'titulaires', 'clés': 'clés', 'cadres': 'cadres', 'vedettes': 'vedettes', 'professionnelles': 'professionnelles', 'entiers': 'entières', 'complets': 'complètes', 'discrets': 'discrètes', 'nets': 'nettes', 'ponctuels': 'ponctuelles', 'prudents': 'prudentes', 'lents': 'lentes', 'brillants': 'brillantes', 'excellents': 'excellentes', 'mauvais': 'mauvaises', 'méchants': 'méchantes', 'gentils': 'gentilles', 'loyals': 'loyales', 'fidèles': 'fidèles', 'honnêtes': 'honnêtes', 'sages': 'sages', 'malins': 'malignes', 'têtus': 'têtues', 'doués': 'douées', 'talentueux': 'talentueuses', 'courageux': 'courageuses', 'généreux': 'généreuses', 'précieux': 'précieuses', 'coûteux': 'coûteuses', 'dangereux': 'dangereuses', 'peureux': 'peureuses', 'déterminés': 'déterminées', 'motivés': 'motivées', 'concentrés': 'concentrées', 'usés': 'usées', 'abîmés': 'abîmées', 'cassés': 'cassées', 'diminués': 'diminuées', 'affaiblis': 'affaiblies', 'renforcés': 'renforcées', 'améliorés': 'améliorées', 'transformés': 'transformées', 'installés': 'installées', 'intégrés': 'intégrées', 'adoptés': 'adoptées', 'acceptés': 'acceptées', 'refusés': 'refusées', 'oubliés': 'oubliées', 'ignorés': 'ignorées', 'écoutés': 'écoutées', 'entendus': 'entendues', 'compris': 'comprises', 'soutenus': 'soutenues', 'encadrés': 'encadrées', 'coachés': 'coachées', 'testés': 'testées', 'évalués': 'évaluées', 'classés': 'classées', 'recrutables': 'recrutables', 'vendables': 'vendables', 'liés': 'liées', 'engagés': 'engagées', 'embauchés': 'embauchées', 'virés': 'virées', 'retraités': 'retraitées', 'nouveaux': 'nouvelles', 'loyaux': 'loyales'}

# ---- THE AGREEMENT CHAIN ----
# Once the noun is feminine, the adjectives strung after it have to follow:
# "blessées, suspendus, rouillés" is worse than either all-masculine or
# all-feminine, because it reads as a mistake rather than a policy. Applied
# only in strings that are about a player, so "match suspendu" survives.
CHAIN = {
 'fr': [
  (r"\bde elle\b", "d'elle"), (r"\bde elles\b", "d'elles"), (r"\bde eux\b", "d'eux"), (r"\bd'(femme|femmes|fille|filles|joueuse|joueuses)\b", r"de \1"),
  (r"\b(sont|se sont|ont été|étaient|restent) tous (\w+?)és\b", lambda m: m.group(1)+" toutes "+m.group(2)+"ées"), (r"\btous les (joueuses|femmes|filles|gamines)\b", r"toutes les \1"),
  (r"\bun de ces (filles|joueuses|gamines)\b", r"une de ces \1"), (r"\bchacun d'eux\b", "chacune d'elles"), (r"\bl'un des leurs\b", "l'une des leurs"),
  (r"\bl'un de vos\b(?= \{n\} joueuses)", "l'une de vos"), (r"\bqu'un dépasse\b", "qu'une dépasse"), (r"\ben fait grandir un\b", "en fait grandir une"),
  (r"\bConfiez-en un à un autre\b", "Confiez-en une à une autre"), (r"\b(le|Le) gamine\b", lambda m: ("La" if m.group(1)=="Le" else "la")+" gamine"),
  (r"\b(la joueuse|la femme|la fille) le plus\b", r"\1 la plus"), (r"\bnon décerné\b", "non décernée"), (r"\baplatit son (homme|femme)\b", "aplatit son vis-à-vis"),
  (r"\bsaute trois (hommes|femmes)\b", "saute trois adversaires"), (r"\bconsidéré parmi vos meilleurs\b", "considérée parmi vos meilleures"), (r"\bcelui qu'elle remplace\b", "celle qu'elle remplace"),
  (r"\bses anciens copains\b", "ses anciennes coéquipières"), (r"\bSeul une joueuse\b", "Seule une joueuse"), (r"\bl'un de vos (\{n\}) joueuses\b", r"l'une de vos \1 joueuses"),
  (r"\bd'un tournéiste\b", "d'une tournéiste"), (r"\bla femme qu'(ils|elles) observent\b", "la joueuse qu'ils observent"),
  # "un très bon joueuse" -> "une très bonne joueuse": the article and the adjective agree with the noun they precede
  (r"\b(un|Un) ((?:très |assez |plutôt |vraiment )?)(%s) joueuse\b" % "|".join(FR_ADJ), lambda m: ("Une" if m.group(1)[0]=="U" else "une") + " " + m.group(2) + FR_ADJ[m.group(3)] + " joueuse"),
  (r"\b(les|des|ces|Les|Des|Ces|nos|vos|ses|leurs|deux|trois) (%s) joueuses\b" % "|".join(FR_ADJP), lambda m: m.group(1) + " " + FR_ADJP[m.group(2)] + " joueuses"),
  (r"\b(un|Un) second joueuse\b", lambda m: m.group(1)[0].lower().replace("u","une") + " seconde joueuse" if False else ("Une" if m.group(1)[0]=="U" else "une") + " seconde joueuse"),
  (r"\bjoueuse, puis un autre\b", "joueuse, puis une autre"),
  # participles after être, when the subject is the player
  (r"\b(est|a été|sera|serait|était|fut|reste) (désigné|nommé|libéré|prolongé|convoqué|sélectionné|suspendu|sanctionné|promu|prêté|vendu|transféré|recruté|retenu|écarté|titularisé|remplacé|élu|choisi|cité|placé|inscrit|rappelé|exclu|protégé|ménagé|observé|suivi|aligné|noté|repéré|surveillé|attendu|présenté|opéré|arrêté|forfait|parti|revenu|considéré|jugé|vu|connu|apprécié|respecté|reconnu|salué|félicité|puni|averti|prévenu|payé|traité|accueilli|blessé|touché|fatigué|épuisé|reposé|rétabli|guéri|remis|disponible|indisponible|absent|présent|content|déçu|inquiet|prêt)\b(?!e)", lambda m: m.group(1)+" "+m.group(2)+("e" if not m.group(2).endswith("e") else "")),
  (r"\bmon (meilleure|nouvelle|jeune|première|seule|propre|dernière|grande|petite|vraie) (joueuse|capitaine|titulaire)\b", r"ma \1 \2"),
  (r"\bton (meilleure|nouvelle|jeune|première|seule|propre|dernière) (joueuse|capitaine|titulaire)\b", r"ta \1 \2"),
  (r"\bson (meilleure|nouvelle|jeune|première|seule|propre|dernière) (joueuse|capitaine|titulaire)\b", r"sa \1 \2"),
  (r"\bmon joueuse\b", "ma joueuse"), (r"\bton joueuse\b", "ta joueuse"), (r"\bson joueuse\b", "sa joueuse"),
  (r"\bquel (jeune |autre |seul |bon |grand )?(joueuse|capitaine|titulaire|femme|fille)\b", r"quelle \1\2"),
  (r"\bun piètre pédagogue\b", "une piètre pédagogue"), (r"\bun professionnel\b", "une professionnelle"), (r"\bun mercenaire\b", "une mercenaire"),
  (r"\bun caractériel\b", "une caractérielle"), (r"\bun Ambitieux\b", "une Ambitieuse"), (r"\bun Caractériel\b", "une Caractérielle"),
  (r"\bun Mercenaire\b", "une Mercenaire"), (r"\bun Leader\b", "une Leader"), (r"\bun Professionnel\b", "une Professionnelle"), (r"\bdeux Caractériels\b", "deux Caractérielles"),
  (r"\bun bon capitaine\b", "une bonne capitaine"), (r"\bUn bon capitaine\b", "Une bonne capitaine"), (r"\bun vice-capitaine\b", "une vice-capitaine"),
  (r"\bn'importe quel joueuse\b", "n'importe quelle joueuse"), (r"\bla personne au sifflet\b", "la personne au sifflet"), (r"\bla femme au sifflet\b", "la personne au sifflet"),
  # the adjective or participle RIGHT AFTER the feminised noun agrees with it
  (r"\b(joueuse|femme|fille|capitaine|titulaire|blessée|remplaçante|gamine) ((?:très |assez |plutôt |vraiment |déjà |encore |non |mal |bien |tout juste )?)(%s)\b" % "|".join(FR_PP), lambda m: m.group(1)+" "+m.group(2)+FR_PP[m.group(3)]),
  (r"\b(joueuses|femmes|filles|capitaines|titulaires|blessées|remplaçantes|gamines) ((?:très |assez |plutôt |déjà |encore |non |mal |bien )?)(%s)\b" % "|".join(FR_PPS), lambda m: m.group(1)+" "+m.group(2)+FR_PPS[m.group(3)]),
  (r"\b(elle|Elle) (est|était|sera|serait|semble|paraît|reste|restera) ((?:très |assez |plutôt |déjà |encore |non |mal |bien |tout juste )?)(%s)\b" % "|".join(FR_PP), lambda m: m.group(1)+" "+m.group(2)+" "+m.group(3)+FR_PP[m.group(4)]),
  (r"\b(elles|Elles) (sont|étaient|seront|restent) ((?:très |assez |plutôt |déjà |encore |non |mal |bien )?)(%s)\b" % "|".join(FR_PPS), lambda m: m.group(1)+" "+m.group(2)+" "+m.group(3)+FR_PPS[m.group(4)]),
  (r"\b(joueuses|blessées|femmes|filles|capitaines|titulaires|remplaçantes) (sont|seront|étaient|restent|ont été) (\w+?)(és|us|is)\b", lambda m: m.group(1)+" "+m.group(2)+" "+m.group(3)+{"és":"ées","us":"ues","is":"ies"}[m.group(4)]),
  (r"\b(sont|ont été|seront|étaient|restent) (désignés|nommés|libérés|prolongés|convoqués|sélectionnés|suspendus|sanctionnés|promus|prêtés|vendus|transférés|recrutés|retenus|écartés|titularisés|remplacés|élus|choisis|cités|placés|inscrits|rappelés|exclus|protégés|ménagés|observés|suivis|alignés|notés|repérés|surveillés|attendus|présentés|considérés|jugés|vus|connus|appréciés|respectés|reconnus|salués|félicités|punis|avertis|prévenus|payés|traités|accueillis|blessés|touchés|fatigués|épuisés|reposés|rétablis|guéris|remis|absents|présents|contents|déçus|inquiets|prêts)\b", lambda m: m.group(1)+" "+re.sub(r"(is|us|és|s)$", lambda x: {"is":"ies","us":"ues","és":"ées","s":"es"}[x.group(1)], m.group(2))),
  (r"\bnon (prolongé|convoqué|sélectionné|retenu|utilisé|aligné|titularisé|remplacé|inscrit|protégé)\b", lambda m: "non "+m.group(1)+"e"),
  (r"\bjoueuses (sont|seront|étaient|restent) (\w+?)(és|us|is)\b", lambda m: "joueuses "+m.group(1)+" "+m.group(2)+{"és":"ées","us":"ues","is":"ies"}[m.group(3)]),
  (r"\b(Le|le) (signer|libérer|prêter|recruter|convoquer|sélectionner|titulariser|ménager|rappeler|remplacer|laisser|mettre|sortir|protéger|prolonger|vendre|céder|aligner|reposer|placer|inscrire|voir|retenir|écarter|payer|former|faire jouer|faire entrer|promouvoir|nommer|désigner|saluer|recadrer|féliciter|punir|avertir|traiter|accueillir|surveiller|suivre|observer|noter|repérer)\b", lambda m: ("La" if m.group(1)=="Le" else "la")+" "+m.group(2)),
  (r"\bceux qui\b", "celles qui"), (r"\bautour d'eux\b", "autour d'elles"), (r"\bentre eux\b", "entre elles"), (r"\bl'un d'eux\b", "l'une d'elles"), (r"\beux-mêmes\b", "elles-mêmes"),
  (r"\bseuls les titulaires\b", "seules les titulaires"), (r"\bun vrai leader\b", "une vraie leader"), (r"\bun leader\b", "une leader"),
  (r"\bquinze femmes valides\b", "quinze joueuses valides"), (r"\bTouchez la femme\b", "Touchez la joueuse"), (r"\bla femme à surveiller\b", "la joueuse à surveiller"),
  (r"\b(retraité|libéré) ou (libéré|retraité)\b", lambda m: m.group(1)+"e ou "+m.group(2)+"e"),
  (r"\bsuspendus\b", "suspendues"), (r"\bsuspendu\b", "suspendue"), (r"\brouillés\b", "rouillées"), (r"\brouillé\b", "rouillée"),
  (r"\bconvoqués\b", "convoquées"), (r"\bconvoqué\b", "convoquée"), (r"\bsélectionnés\b", "sélectionnées"), (r"\bsélectionné\b", "sélectionnée"),
  (r"\bprêtés\b", "prêtées"), (r"\bprêté\b", "prêtée"), (r"\bménagés\b", "ménagées"), (r"\bménagé\b", "ménagée"),
  (r"\bcorrespondants\b", "correspondantes"), (r"\bcorrespondant\b", "correspondante"), (r"\babsents\b", "absentes"), (r"\babsent\b", "absente"),
  (r"\bfatigués\b", "fatiguées"), (r"\bfatigué\b", "fatiguée"), (r"\bépuisés\b", "épuisées"), (r"\bépuisé\b", "épuisée"),
  (r"\bremplaçants\b", "remplaçantes"), (r"\bremplaçant\b", "remplaçante"), (r"\bpartants\b", "partantes"), (r"\bpartant\b", "partante"),
  (r"\btitularisés\b", "titularisées"), (r"\btitularisé\b", "titularisée"), (r"\bnouveau venu\b", "nouvelle venue"), (r"\bnouveaux venus\b", "nouvelles venues"),
  (r"\ble sien\b", "la sienne"), (r"\bles siens\b", "les siennes"), (r"\bcelui-ci\b", "celle-ci"), (r"\bcelui-là\b", "celle-là"),
  (r"\bseul\b(?= joueuse| à| dans| sur| face| contre)", "seule"),
  (r"\bsatisfait\b", "satisfaite"), (r"\bdéçus\b", "déçues"), (r"\bdéçu\b", "déçue"), (r"\bheureux\b", "heureuse"), (r"\bmalheureux\b", "malheureuse"),
  (r"\bfurieux\b", "furieuse"), (r"\binquiet\b", "inquiète"), (r"\bcertain\b(?= de| que)", "certaine"), (r"\bsûr\b(?= de| que)", "sûre"),
  (r"\bpremier\b(?= à| de la| à être)", "première"), (r"\bdernier\b(?= à| de la)", "dernière"), (r"\bmeilleur\b(?= de la| du championnat| sur)", "meilleure"),
 ],
 'es': [
  # the article, possessive and adjective in front of the noun agree with it
  (r"\b(un|Un) ((?:muy |bastante |gran )?)(buen|nuevo|mejor|primer|segundo|otro|único|viejo|joven|excelente|solvente|veterano|mismo|gran|auténtico|verdadero|futuro|posible|mal|pobre)? ?(jugadora|mujer|chica|chavala|capitana|veterana|canterana|compañera|sustituta|suplente|titular|líder|profesional|mercenaria)\b", lambda m: ("Una" if m.group(1)=="Un" else "una")+" "+m.group(2)+({"buen":"buena","nuevo":"nueva","mejor":"mejor","primer":"primera","segundo":"segunda","otro":"otra","único":"única","viejo":"vieja","joven":"joven","excelente":"excelente","solvente":"solvente","veterano":"veterana","mismo":"misma","gran":"gran","auténtico":"auténtica","verdadero":"verdadera","futuro":"futura","posible":"posible","mal":"mala","pobre":"pobre",None:""}[m.group(3)]+" " if m.group(3) else "")+m.group(4)),
  (r"\b(el|El) ((?:mismo |mejor |nuevo |primer |otro |viejo |único |gran |joven |propio |último )?)(jugadora|mujer|chica|chavala|capitana|veterana|canterana|compañera|sustituta|suplente|titular|líder)\b", lambda m: ("La" if m.group(1)[0]=="E" else "la")+" "+m.group(2).replace("mismo","misma").replace("nuevo","nueva").replace("primer","primera").replace("otro","otra").replace("viejo","vieja").replace("único","única").replace("propio","propia").replace("último","última")+m.group(3)),
  (r"\b(los|Los|unos|estos|esos|aquellos|mis|tus|sus|nuestros|vuestros|dos|tres|cuatro|cinco|ocho|diez|quince|veinte|muchos|pocos|todos los|algunos|otros|varios|demás) ((?:mejores |nuevos |primeros |otros |viejos |grandes |jóvenes |propios |últimos |buenos |mismos )?)(jugadoras|mujeres|chicas|chavalas|capitanas|veteranas|canteranas|compañeras|suplentes|titulares)\b", lambda m: {"los":"las","Los":"Las","unos":"unas","estos":"estas","esos":"esas","aquellos":"aquellas","mis":"mis","tus":"tus","sus":"sus","nuestros":"nuestras","vuestros":"vuestras","dos":"dos","tres":"tres","cuatro":"cuatro","cinco":"cinco","ocho":"ocho","diez":"diez","quince":"quince","veinte":"veinte","muchos":"muchas","pocos":"pocas","todos los":"todas las","algunos":"algunas","otros":"otras","varios":"varias","demás":"demás"}[m.group(1).lower()]+" "+m.group(2).replace("nuevos","nuevas").replace("primeros","primeras").replace("otros","otras").replace("viejos","viejas").replace("propios","propias").replace("últimos","últimas").replace("buenos","buenas").replace("mismos","mismas")+m.group(3)),
  (r"\bal (mujer|jugadora|chica|chavala|capitana|veterana|compañera|sustituta)\b", r"a la \1"), (r"\bdel (mujer|jugadora|chica|chavala|capitana|veterana|compañera)\b", r"de la \1"),
  (r"\bel chaval\b", "la chavala"), (r"\bun chaval\b", "una chavala"), (r"\bal chaval\b", "a la chavala"), (r"\bchavales\b", "chavalas"), (r"\bchaval\b", "chavala"),
  (r"\bel vicecapitán\b", "la vicecapitana"), (r"\bvicecapitán\b", "vicecapitana"), (r"\bun líder\b", "una líder"), (r"\bun Líder\b", "una Líder"),
  (r"\bun profesional\b", "una profesional"), (r"\bun mercenario\b", "una mercenaria"), (r"\bun Mercenario\b", "una Mercenaria"),
  (r"\bsu sustituto\b", "su sustituta"), (r"\bun compañero\b", "una compañera"), (r"\bcompañeros\b", "compañeras"), (r"\bun segundo (mujer|jugadora)\b", r"una segunda \1"),
  (r"\bEl mayor\b(?= transmite)", "La mayor"), (r"\bel hombre del silbato\b", "quien lleva el silbato"), (r"\bla mujer del silbato\b", "quien lleva el silbato"),
  (r"\bNadie (lesionada|sancionada)\b", r"Ninguna \1"), (r"\bel portador\b", "la portadora"), (r"\bEl jugador placado\b", "La jugadora placada"),
  # the participle or adjective right after the noun agrees with it - but NEVER after haber, which does not agree
  (r"(?<!haya )(?<!ha )(?<!han )(?<!había )(?<!habían )(?<!habrá )(?<!hubiera )(?<!hubieran )\b(jugadora|mujer|chica|chavala|capitana|veterana|canterana|compañera|sustituta) ((?:muy |bastante |ya |no |mal |bien |recién )?)([a-záéíóúñ]+?)(ad|id|ct|st|rt|ert|nt|ert|iert|uest|ech|ic|und|ín|es|os)o\b", lambda m: m.group(1)+" "+m.group(2)+m.group(3)+m.group(4)+"a"),
  (r"(?<!haya )(?<!ha )(?<!han )(?<!había )\b(jugadoras|mujeres|chicas|chavalas|capitanas|veteranas|canteranas|compañeras) ((?:muy |bastante |ya |no |mal |bien )?)([a-záéíóúñ]+?)(ad|id|ct|st|rt|nt|ech|ic|und|es)os\b", lambda m: m.group(1)+" "+m.group(2)+m.group(3)+m.group(4)+"as"),
  (r"\b(jugadora|mujer|chica|chavala|capitana) (distinto|listo|contento|cansado|preparado|apto|sano|fresco|fundido|oxidado|falto|descontento|solo|seguro|dispuesto|harto|molesto|enfadado|decepcionado|nuevo|viejo|joven|bueno|malo|mismo|propio|único|serio|tranquilo|nervioso|ambicioso|temperamental|mercenario|profesional)\b", lambda m: m.group(1)+" "+re.sub(r"o$","a",m.group(2)) if m.group(2)!="joven" else m.group(0)),
  (r"\b(jugadoras|mujeres|chicas|chavalas) (distintos|listos|contentos|cansados|preparados|aptos|sanos|frescos|fundidos|oxidados|faltos|descontentos|solos|seguros|dispuestos|hartos|nuevos|viejos|buenos|malos|mismos|propios|serios|tranquilos|nerviosos|ambiciosos|agresivos|mercenarios|profesionales)\b", lambda m: m.group(1)+" "+re.sub(r"os$","as",m.group(2))),
  (r"\b(está|estará|estaba|queda|sigue|sale|entra|vuelve|acaba|termina|es|será|era) ((?:muy |bastante |ya |no |mal |bien |recién )?)(listo|contento|cansado|preparado|apto|sano|fresco|fundido|oxidado|descontento|solo|seguro|dispuesto|harto|molesto|enfadado|decepcionado|lesionado|sancionado|suspendido|cedido|expulsado|sustituido|revisado|retirado|convocado|descartado|renovado|vendido|traspasado|ascendido|fichado|placado|robado|pretendido|ninguneado|congelado|habilitado|designado|destacado|observado|vigilado|nuevo|libre)\b", lambda m: m.group(1)+" "+m.group(2)+re.sub(r"o$","a",m.group(3))),
  (r"\b(están|estarán|estaban|quedan|siguen|salen|son|serán|eran) ((?:muy |bastante |ya |no |mal |bien )?)(listos|contentos|cansados|preparados|aptos|sanos|frescos|fundidos|oxidados|descontentos|solos|seguros|dispuestos|hartos|lesionados|sancionados|suspendidos|cedidos|expulsados|convocados|descartados|renovados|vendidos|designados|destacados|observados|vigilados|habilitados)\b", lambda m: m.group(1)+" "+m.group(2)+re.sub(r"os$","as",m.group(3))),
  (r"\b(los|a los) (que|cuales)\b(?= (dijiste|no están|no juegan|dejaste|no entran|temen|siguen|habla|hablan))", lambda m: ("las" if m.group(1)=="los" else "a las")+" "+m.group(2)),
  (r"\buno de ellas\b", "una de ellas"), (r"\bcada uno\b(?= de ellas| aprende)", "cada una"), (r"\buno descontento\b", "una descontenta"), (r"\botro para intercambiarlos\b", "otra para intercambiarlas"),
  (r"\bintercambiarlos\b", "intercambiarlas"), (r"\ba usar a los ocho\b", "a usar a las ocho"), (r"\bde los chavalas\b", "de las chavalas"), (r"\bde los ochos\b", "de las ocho"),
  (r"\bquien entra por él\b", "quien entra por ella"), (r"\ba través de él\b", "a través de ella"), (r"\bMantenlo callado\b", "Mantenla callada"), (r"\bmantenlo\b", "mantenla"),
  (r"\b([a-záéíóúñ]{3,}(?:ar|er|ir))lo\b", r"\1la"), (r"\b([a-záéíóúñ]{3,}(?:ar|er|ir))los\b", r"\1las"),
  (r"\b(La roja|la roja) lo (expulsa|manda)\b", r"\1 la \2"), (r"\bno lo (conoces|conocen|observan)\b", r"no la \1"), (r"\blo (perderían|perderán|observan|ojean|siguen|vigilan|buscan|quieren|esperan|fichan|venden|ceden|renuevan|convocan|alinean|protegen|premian|castigan|elogian|sustituyen|expulsan|retiran|conocen|tienen|dejan|mandan|meten|sacan|llevan|paran)\b", r"la \1"),
  (r"\bsuspendidos\b", "suspendidas"), (r"\bsuspendido\b", "suspendida"), (r"\bsancionados\b", "sancionadas"), (r"\bsancionado\b", "sancionada"),
  (r"\bcedidos\b", "cedidas"), (r"\bcedido\b", "cedida"), (r"\bconvocados\b", "convocadas"), (r"\bconvocado\b", "convocada"),
  (r"\bexpulsados\b", "expulsadas"), (r"\bexpulsado\b", "expulsada"), (r"\bamonestados\b", "amonestadas"), (r"\bamonestado\b", "amonestada"),
  (r"\bcansados\b", "cansadas"), (r"\bcansado\b", "cansada"), (r"\bpreparados\b", "preparadas"), (r"\bpreparado\b", "preparada"),
  (r"\blistos\b", "listas"), (r"\blisto\b", "lista"), (r"\bcontentos\b", "contentas"), (r"\bcontento\b", "contenta"),
  (r"\bdescartados\b", "descartadas"), (r"\bdescartado\b", "descartada"), (r"\brenovados\b", "renovadas"), (r"\brenovado\b", "renovada"),
  (r"\bvendidos\b", "vendidas"), (r"\bvendido\b", "vendida"), (r"\btraspasado\b", "traspasada"), (r"\bascendidos\b", "ascendidas"), (r"\bascendido\b", "ascendida"),
  (r"\bveteranos\b", "veteranas"), (r"\bveterano\b", "veterana"), (r"\bcanteranos\b", "canteranas"), (r"\bcanterano\b", "canterana"),
  (r"\bnovatos\b", "novatas"), (r"\bnovato\b", "novata"), (r"\bel mismo\b(?= que| de| jugadora)", "la misma"), 
  (r"\bseguro\b(?= de| que)", "segura"), (r"\bel primero\b(?= en| de| que)", "la primera"), (r"\bel último\b(?= en| de| que)", "la última"),
  (r"\bdispuesto\b(?= a)", "dispuesta"), (r"\bharto\b", "harta"), (r"\bmolesto\b", "molesta"), (r"\benfadado\b", "enfadada"), (r"\bdecepcionado\b", "decepcionada"),
  (r"\bfichado\b(?= por| del| de)", "fichada"), (r"\bel nuevo\b(?= fichaje)", "la nueva"), (r"\bnuestro\b(?= jugadora)", "nuestra"),
 ],
 'it': [
  # article, possessive and adjective before the noun
  (r"\b(un|Un) ((?:molto |davvero |gran )?)(ottimo|buon|bravo|nuovo|primo|secondo|altro|unico|vecchio|giovane|solido|vero|grande|futuro|possibile|cattivo|povero|miglior|ottimo|caro|onesto|serio)? ?(giocatrice|donna|ragazza|capitana|veterana|compagna|riserva|titolare|leader|professionista|mercenaria)\b", lambda m: (("Un'" if m.group(1)=="Un" else "un'") if (m.group(3) is None and m.group(4)[0] in "aeiou") or (m.group(3) in ("ottimo","altro","unico") ) else ("Una" if m.group(1)=="Un" else "una")+" ")+m.group(2)+({"ottimo":"ottima ","buon":"buona ","bravo":"brava ","nuovo":"nuova ","primo":"prima ","secondo":"seconda ","altro":"altra ","unico":"unica ","vecchio":"vecchia ","giovane":"giovane ","solido":"solida ","vero":"vera ","grande":"grande ","futuro":"futura ","possibile":"possibile ","cattivo":"cattiva ","povero":"povera ","miglior":"miglior ","caro":"cara ","onesto":"onesta ","serio":"seria ",None:""}[m.group(3)])+m.group(4)),
  (r"\b(il|Il|lo|Lo) ((?:miglior |nuovo |primo |altro |vecchio |unico |giovane |proprio |ultimo |solito |stesso |mio |tuo |suo |nostro |vostro |loro )*)(giocatrice|donna|ragazza|capitana|veterana|compagna|riserva|titolare|leader)\b", lambda m: ("La" if m.group(1)[0]=="I" or m.group(1)[0]=="L" and m.group(1)[1]=="o" and m.group(1)=="Lo" else "la")+" "+m.group(2).replace("nuovo","nuova").replace("primo","prima").replace("altro","altra").replace("vecchio","vecchia").replace("unico","unica").replace("proprio","propria").replace("ultimo","ultima").replace("solito","solita").replace("stesso","stessa").replace("mio","mia").replace("tuo","tua").replace("suo","sua").replace("nostro","nostra").replace("vostro","vostra")+m.group(3)),
  (r"\b(i|I|gli|Gli|dei|degli|ai|agli|nei|negli|sui|dai|quei|quegli|questi|miei|tuoi|suoi|nostri|vostri|loro|due|tre|quattro|cinque|otto|dieci|quindici|venti|molti|pochi|tutti i|tutti gli|alcuni|altri|parecchi|certi|primi tre|primi) ((?:migliori |nuovi |primi |altri |vecchi |grandi |giovani |propri |ultimi |buoni |stessi |tuoi |suoi |miei |nostri |vostri )?)(giocatrici|donne|ragazze|capitane|veterane|compagne|riserve|titolari)\b", lambda m: {"i":"le","I":"Le","gli":"le","Gli":"Le","dei":"delle","degli":"delle","ai":"alle","agli":"alle","nei":"nelle","negli":"nelle","sui":"sulle","dai":"dalle","quei":"quelle","quegli":"quelle","questi":"queste","miei":"mie","tuoi":"tue","suoi":"sue","nostri":"nostre","vostri":"vostre","loro":"loro","due":"due","tre":"tre","quattro":"quattro","cinque":"cinque","otto":"otto","dieci":"dieci","quindici":"quindici","venti":"venti","molti":"molte","pochi":"poche","tutti i":"tutte le","tutti gli":"tutte le","alcuni":"alcune","altri":"altre","parecchi":"parecchie","certi":"certe","primi tre":"prime tre","primi":"prime"}[m.group(1).lower()]+" "+m.group(2).replace("nuovi","nuove").replace("primi","prime").replace("altri","altre").replace("vecchi","vecchie").replace("propri","proprie").replace("ultimi","ultime").replace("buoni","buone").replace("stessi","stesse").replace("tuoi","tue").replace("suoi","sue").replace("miei","mie").replace("nostri","nostre").replace("vostri","vostre")+m.group(3)),
  (r"\bil (mio|tuo|suo|nostro|vostro) (miglior |nuovo |primo |giovane |vecchio )?(giocatrice|donna|ragazza|capitana)\b", lambda m: "la "+{"mio":"mia","tuo":"tua","suo":"sua","nostro":"nostra","vostro":"vostra"}[m.group(1).lower()]+" "+(m.group(2) or "").replace("nuovo","nuova").replace("primo","prima").replace("vecchio","vecchia")+m.group(3)),
  (r"\bun compagno\b", "una compagna"), (r"\bcompagni\b", "compagne"), (r"\bun secondo (donna|giocatrice)\b", r"una seconda \1"), (r"\bun vicecapitano\b", "una vicecapitana"), (r"\bvicecapitano\b", "vicecapitana"),
  (r"\bun vero leader\b", "una vera leader"), (r"\bun Leader\b", "una Leader"), (r"\bun mercenario\b", "una mercenaria"), (r"\bun Mercenario\b", "una Mercenaria"), (r"\bdue Lunatici\b", "due Lunatiche"),
  (r"\b(ragazza|giocatrice) (Ambizioso|Lunatico|Ambizioso o Lunatico)\b", lambda m: m.group(1)+" "+m.group(2).replace("Ambizioso","Ambiziosa").replace("Lunatico","Lunatica")),
  (r"\bIl più anziano\b", "La più anziana"), (r"\bil più anziano\b", "la più anziana"), (r"\bl'uomo col fischietto\b", "chi ha il fischietto"), (r"\bla donna col fischietto\b", "chi ha il fischietto"),
  (r"\bNessuno (infortunata|squalificata|arrugginita)\b", r"Nessuna \1"), (r"\bIl placcato\b", "La placcata"), (r"\bil portatore\b", "la portatrice"), (r"\bChi è uscito\b", "Chi è uscita"),
  (r"\bquelli in più\b", "quelle in più"), (r"\busarli tutti e otto\b", "usarle tutte e otto"), (r"\btrasformarne uno\b", "trasformarne una"), (r"\buno scontento\b", "una scontenta"),
  (r"\bpoi un altro\b(?= per scambiar)", "poi un'altra"), (r"\btoccane un altro\b", "toccane un'altra"), (r"\bscambiarli\b", "scambiarle"), (r"\bda soli\b(?=\.| -)", "da sole"),
  (r"\bpassa da lui\b", "passa da lei"), (r"\bTienilo a secco\b", "Tienila a secco"), (r"\bchi lo sostituisce\b", "chi la sostituisce"), (r"\bnon lo (conosci|farà rientrare)\b", r"non la \1"),
  (r"\bgli (indebolisce|fa|fanno|dice|dicono|manca|mancano|serve|servono|resta|restano|cadrà|piace|conviene|spetta|tocca|basta)\b", r"le \1"),
  (r"\b([a-zàèéìòù]{3,}(?:are|ere|ire))lo\b", r"\1la"), (r"\b([a-zàèéìòù]{3,}(?:are|ere|ire))li\b", r"\1le"), (r"\b([a-zàèéìòù]{3,}(?:ar|er|ir))gli\b", r"\1le"),
  (r"\b(Il rosso|il rosso|Il giallo|il giallo) lo (espelle|manda)\b", r"\1 la \2"), (r"\blo (perderebbero|guardano|offende|vogliono|vuole|aspettano|seguono|cercano|tengono|mandano|mettono|lasciano|pagano|chiamano|prendono|portano|fermano|schierano|convocano|rinnovano|vendono|cedono|promuovono|proteggono|premiano|richiamano|puniscono|elogiano|sostituiscono|espellono)\b", r"la \1"),
  # the participle or adjective right after the noun agrees - never after avere, which does not agree
  (r"(?<!ha )(?<!hanno )(?<!aveva )(?<!avevano )(?<!avrà )(?<!abbia )(?<!abbiano )\b(giocatrice|donna|ragazza|capitana|veterana|compagna|riserva) ((?:molto |davvero |già |non |mal |ben |appena )?)([a-zàèéìòù]+?)(at|ut|it|ett|ott|es|s)o\b", lambda m: m.group(1)+" "+m.group(2)+m.group(3)+m.group(4)+"a"),
  (r"(?<!ha )(?<!hanno )(?<!aveva )\b(giocatrici|donne|ragazze|capitane|veterane|compagne|riserve) ((?:molto |davvero |già |non |mal |ben )?)([a-zàèéìòù]+?)(at|ut|it|ett|ott|es|s)i\b", lambda m: m.group(1)+" "+m.group(2)+m.group(3)+m.group(4)+"e"),
  (r"\b(giocatrice|donna|ragazza|capitana) (giusto|pericoloso|integro|pronto|contento|stanco|fresco|sano|arrugginito|infortunato|libero|nuovo|vecchio|solo|sicuro|deluso|stufo|arrabbiato|soddisfatto|irrequieto|scontento|conteso|aggressivo|forte|serio|tranquillo|nervoso|ambizioso|lunatico|mercenario|congelato|soffiato|colpito|placcato)\b", lambda m: m.group(1)+" "+re.sub(r"o$","a",m.group(2)) if m.group(2)!="forte" else m.group(0)),
  (r"\b(giocatrici|donne|ragazze|capitane) (giusti|pericolosi|integri|pronti|contenti|stanchi|freschi|sani|arrugginiti|infortunati|liberi|nuovi|vecchi|soli|sicuri|delusi|stufi|arrabbiati|soddisfatti|irrequieti|scontenti|contesi|aggressivi|seri|tranquilli|nervosi|ambiziosi|lunatici|mercenari|istruiti|scelti|noti|evidenziati|seguiti|monitorati|designati|ammoniti|convocati|squalificati|sospesi|ceduti|espulsi|esclusi|svincolati|promossi|rinnovati|venduti)\b", lambda m: m.group(1)+" "+re.sub(r"(chi|ghi)$", lambda x: {"chi":"che","ghi":"ghe"}[x.group(1)], re.sub(r"i$","e",m.group(2)))),
  (r"\b(è|era|sarà|sembra|resta|rimane|diventa|torna|esce|entra) ((?:molto |davvero |già |non |mal |ben |appena )?)(pronto|contento|stanco|fresco|sano|arrugginito|infortunato|libero|nuovo|solo|sicuro|deluso|stufo|arrabbiato|soddisfatto|irrequieto|scontento|conteso|integro|congelato|colpito|placcato|sparito|uscito|entrato|tornato|partito|arrivato|rimasto|andato|nato|diventato|svincolato|ceduto|venduto|promosso|rinnovato|convocato|squalificato|sospeso|espulso|escluso|ammonito|ritirato|libero)\b", lambda m: m.group(1)+" "+m.group(2)+re.sub(r"o$","a",m.group(3))),
  (r"\b(sono|erano|saranno|sembrano|restano|rimangono) ((?:molto |davvero |già |non |mal |ben )?)(pronti|contenti|stanchi|freschi|sani|arrugginiti|infortunati|liberi|nuovi|soli|sicuri|delusi|noti|istruiti|scelti|evidenziati|seguiti|monitorati|designati|ammoniti|convocati|squalificati|sospesi|ceduti|espulsi|esclusi|svincolati|promossi|rinnovati|venduti|usciti|entrati|tornati|partiti|arrivati|rimasti)\b", lambda m: m.group(1)+" "+m.group(2)+re.sub(r"(chi|ghi)$", lambda x: {"chi":"che","ghi":"ghe"}[x.group(1)], re.sub(r"i$","e",m.group(3)))),
  (r"\bvengono (seguiti|monitorati|ammoniti|convocati|schierati|ceduti|venduti|espulsi|esclusi|premiati|puniti|elogiati|richiamati)\b", lambda m: "vengono "+re.sub(r"i$","e",m.group(1))),
  (r"\bè stata (detto|fatto|deciso|scritto|chiesto|promesso|dato)\b", r"è stato \1"),
  (r"\bsospesi\b", "sospese"), (r"\bsospeso\b", "sospesa"), (r"\bsqualificati\b", "squalificate"), (r"\bsqualificato\b", "squalificata"),
  (r"\bconvocati\b", "convocate"), (r"\bconvocato\b", "convocata"), (r"\bceduti\b", "cedute"), (r"\bceduto\b", "ceduta"),
  (r"\bespulsi\b", "espulse"), (r"\bespulso\b", "espulsa"), (r"\bammoniti\b", "ammonite"), (r"\bammonito\b", "ammonita"),
  (r"\bstanchi\b", "stanche"), (r"\bstanco\b", "stanca"), (r"\bpronti\b", "pronte"), (r"\bpronto\b(?! soccorso)", "pronta"),
  (r"\bcontenti\b", "contente"), (r"\bcontento\b", "contenta"), (r"\bdelusi\b", "deluse"), (r"\bdeluso\b", "delusa"),
  (r"\bsvincolati\b", "svincolate"), (r"\bsvincolato\b", "svincolata"), (r"\brinnovati\b", "rinnovate"), (r"\brinnovato\b", "rinnovata"),
  (r"\bvenduti\b", "vendute"), (r"\bvenduto\b", "venduta"), (r"\bpromossi\b", "promosse"), (r"\bpromosso\b", "promossa"),
  (r"\barrugginiti\b", "arrugginite"), (r"\barrugginito\b", "arrugginita"), (r"\bveterani\b", "veterane"), (r"\bveterano\b", "veterana"),
  (r"\besclusi\b", "escluse"), (r"\bescluso\b", "esclusa"), (r"\bindisponibili\b", "indisponibili"), (r"\bfermo\b(?= per| ai| in)", "ferma"),
  (r"\blo stesso\b(?= che| di| giocatrice)", "la stessa"), (r"\bsicuro\b(?= di| che)", "sicura"), (r"\bil primo\b(?= a| della| che)", "la prima"),
  (r"\bl'ultimo\b(?= a| della| che)", "l'ultima"), (r"\bdisposto\b(?= a)", "disposta"), (r"\bstufo\b", "stufa"), (r"\barrabbiato\b", "arrabbiata"),
  (r"\bsoddisfatto\b", "soddisfatta"), (r"\bnuovo arrivato\b", "nuova arrivata"), (r"\bil nuovo\b(?= acquisto)", "la nuova"), (r"\bnostro\b(?= giocatrice)", "nostra"),
 ],
}

# ---------------------------------------------------------------- ENGLISH
# The player noun in English is already neutral ("player"), so the work is the
# pronoun and the handful of nouns the copy uses for a player: man, men, lad,
# boy. "Kit man", "money men", "ten-man rugby" and "man-marking" are idioms
# about something other than a player and are fenced off by lookbehind.
EN_NOUN = [
 (r"\bman of the match\b", "player of the match"), (r"\bmen of the match\b", "players of the match"),
 (r"\bold boys\b", "old girls"), (r"\bold boy\b", "old girl"),
 (r"\bnext man up\b", "next woman up"), (r"\bevery man\b", "every woman"),
 (r"(?<!kit )(?<!ten-)(?<!one-)(?<!two-)(?<!link )\bman\b(?!-)(?!chester)", "woman"),
 (r"(?<!money )(?<!numbers )\bmen\b(?!'s)(?!-)", "women"),
 (r"\bboys\b", "girls"), (r"\bboy\b", "girl"), (r"\blads\b", "girls"), (r"\blad\b", "girl"),
]
EN_PRON = [
 (r"\bhimself\b", "herself"), (r"\bHimself\b", "Herself"), (r"\bHIMSELF\b", "HERSELF"),
 (r"\bhe\b", "she"), (r"\bHe\b", "She"), (r"\bHE\b", "SHE"),
 (r"\bhim\b", "her"), (r"\bHim\b", "Her"), (r"\bHIM\b", "HER"),
 (r"\bhis\b", "her"), (r"\bHis\b", "Her"), (r"\bHIS\b", "HER"),
]
EN_IL = []

# ---------------------------------------------------------------- JAPANESE
# 選手 (player) is neutral; the copy says 彼 (he) and 男 (man). 彼 -> 彼女 is the
# pronoun. 男 becomes 選手 rather than 女: "the man in form" is 好調の選手, and
# 好調の女 would read as a stranger, not a player. Rules apply only to keys the
# key policy calls a player's (the same lists as English - keys are shared).
JA_NOUN = [
 ("大男たち", "大柄な選手たち"), ("男たち", "選手たち"), ("少年を男にする", "少女を一人前にする"),
 ("少年", "少女"), ("男", "選手"),
]
JA_PRON = [("彼ら", "彼女ら"), (r"彼(?!女)", "彼女")]
JA_IL = []
# never inside a {placeholder}: {men} is a variable name, not a noun
EN_NOUN = [(pat + r'(?![^{}]*\})', rep) for pat, rep in EN_NOUN]
EN_PRON = [(pat + r'(?![^{}]*\})', rep) for pat, rep in EN_PRON]

# ---------------------------------------------------------------- AFRIKAANS
# "speler" is neutral, like "player". The work is the pronoun and the handful of
# nouns: hy/hom/sy -> sy/haar/haar, man/manne -> vrou/vroue, seun -> meisie.
# ORDER MATTERS: "sy" is both "his" and "she", so the possessive goes to "haar"
# BEFORE "hy" becomes "sy", or the new "sy" would be flipped again. No
# agreement chain: Afrikaans adjectives do not decline.
AF_NOUN = [
 (r"\bmanne\b", "vroue"), (r"\bmans\b", "vroue"), (r"(?<!span)(?<!lyn)\bman\b(?!-)", "vrou"),
 (r"\bseuns\b", "meisies"), (r"\bseun\b", "meisie"), (r"\bkêrels\b", "meisies"), (r"\bkêrel\b", "meisie"),
 (r"\blaaities\b", "meisies"), (r"\blaaitie\b", "meisie"),
]
AF_PRON = [
 (r"\bhomself\b", "haarself"), (r"\bHomself\b", "Haarself"),
 (r"\bsyne\b", "hare"), (r"\bSyne\b", "Hare"),
 (r"\bsy\b", "haar"), (r"\bSy\b", "Haar"), (r"\bSY\b", "HAAR"),
 (r"\bhy\b", "sy"), (r"\bHy\b", "Sy"), (r"\bHY\b", "SY"),
 (r"\bhom\b", "haar"), (r"\bHom\b", "Haar"), (r"\bHOM\b", "HAAR"),
]
AF_IL = []
AF_NOUN = [(pat + r'(?![^{}]*\})', rep) for pat, rep in AF_NOUN]
AF_PRON = [(pat + r'(?![^{}]*\})', rep) for pat, rep in AF_PRON]

RULES = {'en': (EN_NOUN, EN_PRON, EN_IL), 'ja': (JA_NOUN, JA_PRON, JA_IL), 'af': (AF_NOUN, AF_PRON, AF_IL), 'fr': (FR_NOUN, FR_PRON, FR_IL), 'es': (ES_NOUN, ES_PRON, ES_IL), 'it': (IT_NOUN, IT_PRON, IT_IL)}
MARK = {
 'ja': re.compile(r"彼(?!女)|男|少年"),
 'af': re.compile(r"\b(hy|hom|sy|homself|man|mans|manne|seun|seuns|kêrel|kêrels|laaitie|laaities)\b", re.I),
 'en': re.compile(r"\b(he|him|his|himself|man|men|lad|lads|boy|boys)\b", re.I),
 'fr': re.compile(r"\b(il|ils|joueur|joueurs|homme|hommes|garçon|garçons|celui|monsieur|blessé|blessés|fils|ce dernier|lui-même|capitaine|titulaire|intéressé|client)\b", re.I),
 'es': re.compile(r"\b(él|ellos|jugador|jugadores|hombre|hombres|chico|chicos|muchacho|muchachos|lesionado|lesionados|hijo|hijos|señor|capitán|convocados?|listo|contento|cansado)\b", re.I),
 'it': re.compile(r"\b(lui|egli|esso|giocatore|giocatori|uomo|uomini|ragazzo|ragazzi|infortunato|infortunati|figlio|figli|signor|capitano|convocat[oi]|pronto|stanco|assistito|è stato|sono stati)\b", re.I),
}
# things that must never appear in a generated string
BROKEN = {
 'ja': re.compile(r"彼女女|選手選手"),
 'af': re.compile(r"\b(spanvrou|lynvrou|vrou van die wedstryd|haar sy|sy haar het)\b", re.I),
 'en': re.compile(r"\b(kit woman|money women|numbers women|ten-woman|woman-mark|Isle of Woman|women's game|linkwoman)\b", re.I),
 'fr': re.compile(r"\b(elle|elles) (y a|y avait|y aura|faut|faudra|s'agit|semble que|paraît que|vaut mieux|pleut|suffit|est (temps|possible|impossible|clair|vrai|rare|question|tard|tôt|midi))\b", re.I),
 'es': re.compile(r"\bella (hay|hace falta)\b", re.I),
 'it': re.compile(r"\blei (piove|bisogna|occorre)\b", re.I),
}

def _keepcase(rep):
    def f(m):
        r = rep(m) if callable(rep) else m.expand(rep)
        src = m.group(0)
        return (r[0].upper() + r[1:]) if src[:1].isupper() and r[:1].islower() else r
    return f

def apply(rules, s, ci=False):
    for pat, rep in rules:
        s = re.sub(pat, _keepcase(rep) if ci else rep, s, flags=re.I if ci else 0)
    return s

# ENGLISH IS PRONOUN-ONLY MOST OF THE TIME. "He is not injured." names no player
# and no noun, so the generic test above cannot tell it from "He reports back in
# two weeks" about a scout. The copy is organised by screen, and a screen knows
# who it is about: everything under player.*, squad.*, touch.* and the office
# replies is the player; analyst.*, staff.* and the scout's postcards are staff.
EN_PLAYER_KEYS = re.compile(r"^(news\.(heMany|himMany|comeMany|runThem)|matchday\.(rotFlagged|rotSummary|happyRest)|press\.(plansEarnR2|oppThey|oppTheir)|profile\.natOfferBody|squad\.|selection\.(pickAnybody|leadershipNote)|medical\.nothingOnHim|roles\.\w+Desc$|bench\.|matchday\.(brink|ms|cw|farewell|inj|letHim|prob)|tacticsScreen\.(roleSheetSub|rolesNote)|training\.(twoKids|reasonBest)|transfers\.loan(Share|CostLine)|traits\.|player\.|dayroom\.|world\.(agFoot|ofTheValuation)|legacy\.lgOwnTerms|news\.(heOne|himOne|comesOne|hisMentor|mentorLostSubj|becomesMentorSubj|wRumour2|chTale1|hisClub|wMerc|capJob|capQuiet|ddRoundupFlop|guardTail300|bigOneStarB|loanLevel|loanStar|loanSteady|potyPodium|hofYoursOne|totsHere|totsGone|transferRequest|mentAged|slListed|slExpiring|slForm|postcard|grade3|noteA1|noteA2|noteD2|noteSome|testimonialScored|debutScored|debutMotm|scoutMeeting|appealFreeToPlay|fanRivalNamed|fanRivalNone|grounds6)|comm\.(oldBoyKnowsThem|injuryRushedBack|brief)|touch\.|reply\.(tooSoonToSell|notFreeAgent|wageDemandsExceed|underContractBeyond|onLoanParent|termsBreakBudget|biggerStage|retiringMindMadeUp|bidRejected|chat|notInSquad|notInjured|alreadySawSpecialist|tooCloseToReturn|noWrapNeeded|alreadyLeftClub|parentWontLoan|capRefusal|loanCounter|loanRefused|loanBuyTooSoon)|press\.(hotFeet|coldBack|coldAdmit|rumourNever|rumourAsk|kidCrown|kidProtectR|kidEarn|unveilSettleR|unveilFight|plansInR2|plansOut|plansEarnR1|loanMinutes|loanAgreeR2|loanStay|dealYearR2|dealLast|dealWait|discFine|standoffLoved|standoffBiggerR|oldboy|kidstart|leakStarts|century|benchDoor|benchBuilding|benchNextWeek))")
EN_STAFF_KEYS = re.compile(r"^(analyst\.|staff\.|transfers\.(nobodyToSend|reportsBack|longerTrip|scoutsReportSub)|matchday\.(planLenient|ref|vm|warnScrum|assistantTakes)|club\.arch|profile\.|legacy\.cvTitle|news\.(fan(Sceptic|Hopeful|Patient)|wGround1|wTakeover|intakeGrade|loanOne|loanMany|assHand|boss|rivalBelowYou|rivalAboveYou|briefSent|scoutReportSubj|aWonLine|aLostLine|upDinner|grounds4|staffClick|staffClash|grCat|grAnnouncer|grPodcastKebab|chTale7|chTale8)|comm\.(oppCoach|flavGrass7)|dec\.analyst|reply\.scoutAlreadyOut|press\.(raceQ|ownerQ|refereeOurs)|till\.watchAnalyst|sack\.ownedReply)")

def feminise(lang, key, s):
    noun, pron, il = RULES[lang]
    out = apply(noun, s, ci=True)
    noun_hit = bool(re.search(r"\b(joueur|joueuse|jugador|jugadora|giocat|homme|hombre|uomo|garçon|chico|ragazz|capitaine|capitán|capitano|blessé|lesionad|infortunat)", s, re.I)) \
        or (lang == 'af' and bool(re.search(r"\b(speler|man|mans|manne|seun|seuns|kaptein|laaitie|veteraan|nuweling|belofte|stut|haker|slot|flank|agtsteman|vleuel|senter|losskakel|skrumskakel|heelagter|voorspeler|skopper)\b", s, re.I))) \
        or (lang == 'en' and bool(re.search(r"\b(player|man|men|lads?|boys?|captain|kid|youngster|prospect|veteran|starter|scorer|kicker|prop|hooker|lock|flanker|winger|centre|fly-half|scrum-half|full-back|forward|skipper)\b", s, re.I))) \
        or (lang == 'ja' and bool(re.search(r"選手|男|少年|キャプテン|若手", s)))
    has_ph = bool(PLAYER_PH.search(s))
    about_player = has_ph or noun_hit \
        or bool(re.search(r"(One|Many|Him|He|His)$", key.split('.')[-1]) and len(s) < 40)
    # A LONG PARAGRAPH THAT MERELY MENTIONS A PLAYER IS NOT ABOUT ONE. The
    # handbook explains the game in 400-character answers that name "the player"
    # once and then say "it" about a button, a screen or the game itself for
    # three sentences; flipping every "il" in those turned "Il ne collecte rien"
    # (the game) into "Elle". Pronouns flip on a placeholder, or on a short
    # string; a long noun-only string gets its nouns and adjacent agreement.
    flip_pronouns = has_ph or (noun_hit and len(s) < 220)
    # and a string whose subject is the assistant, with no player named, keeps
    # its pronoun: the assistant is fifty-fifty in a women's world
    weak_staff_ja = lang == 'ja' and bool(re.search(r"アシスタント|スカウト|代理人|コーチ|アナリスト|フィジオ|会長|オーナー|経営陣|監督", s)) and not has_ph
    weak_staff = (bool(re.search(r"\b(adjoint|ayudante|asistente|assistente|vice|recruteur|ojeador|osservatore)\b", s, re.I))
                  or (lang == 'en' and bool(re.search(r"\b(assistant|scout|agent|physio|coach|analyst|doctor|chairman|owner|board)\b", s, re.I)))
                  or (lang == 'af' and bool(re.search(r"\b(assistent|talentsoeker|agent|fisio|afrigter|ontleder|dokter|voorsitter|eienaar|direksie)\b", s, re.I)))) and not has_ph
    if weak_staff: flip_pronouns = False
    about_staff = bool(STAFF_PH.search(s)) or bool(STAFF_KEY.search(key)) or bool(STAFF_WORD.search(s))
    if lang in ('en', 'ja', 'af'):
        if (STAFF_WORD_EN if lang == 'en' else STAFF_WORD_AF if lang == 'af' else STAFF_WORD_JA).search(s): about_staff = True
        if EN_STAFF_KEYS.search(key): about_staff = True
        elif EN_PLAYER_KEYS.search(key): about_player, flip_pronouns, about_staff = True, True, False
        elif lang == 'ja' and (has_ph or noun_hit) and not weak_staff_ja: flip_pronouns = True
        elif lang == 'af' and (has_ph or noun_hit) and not weak_staff: flip_pronouns = True
    if about_player and not about_staff and flip_pronouns:
        out = apply(pron, out)
        out = apply(il, out)
    # the agreement chain follows a feminised noun whether or not the string
    # names a player: "blessées, suspendus" is wrong in a squad-screen legend too
    if out != s and not about_staff:
        out = apply(CHAIN.get(lang, []), out, ci=True)
    return out

def walk(node, path=''):
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if SIBLING.search(k): continue
            yield from walk(v, f'{path}{k}.')
    elif isinstance(node, str):
        yield (path[:-1], node)

SECTIONS = None  # all
def strip_f(node):
    if isinstance(node, dict):
        for k in [k for k in node if SIBLING.search(k)]: del node[k]
        for v in node.values(): strip_f(v)

def run(lang, dry):
    p = f'src/locales/{lang}.json'
    d = json.load(open(p, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    if '--fresh' in sys.argv: strip_f(d)
    made = 0; broken = []; sample = []
    def visit(node, path=''):
        nonlocal made
        if not isinstance(node, dict): return
        for k in list(node.keys()):
            if SIBLING.search(k): continue
            v = node[k]
            full = f'{path}{k}'
            if isinstance(v, dict) and 'other' in v and all(isinstance(x, str) for x in v.values()):
                # plural: feminise each form
                if not any(MARK[lang].search(x) for x in v.values()): continue
                nf = collections.OrderedDict((form, feminise(lang, full, txt)) for form, txt in v.items())
                if nf == v: continue
                for form, txt in nf.items():
                    if BROKEN[lang].search(txt): broken.append((full + '.' + form, txt))
                if not dry: node[k + '_f'] = nf
                made += 1
                if len(sample) < 40: sample.append((full, v['other'], nf['other']))
            elif isinstance(v, dict):
                visit(v, full + '.')
            elif isinstance(v, str):
                if not MARK[lang].search(v): continue
                nf = feminise(lang, full, v)
                if nf == v: continue
                if BROKEN[lang].search(nf): broken.append((full, nf))
                if not dry: node[k + '_f'] = nf
                made += 1
                if len(sample) < 40: sample.append((full, v, nf))
    visit(d)
    if not dry:
        raw = open(p, encoding='utf-8').read(); ind = len(raw.split('\n')[1]) - len(raw.split('\n')[1].lstrip(' '))
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=ind)
        open(p, 'a', encoding='utf-8').write('\n')
    return made, broken, sample


# ---------------------------------------------------------------- THE SUBJECT AXIS
# `_w`: the string's SUBJECT is a woman - the manager, by the choice at career
# start, or a member of staff, by the coin on the person (gender.ts). Only the
# pronoun flips, plus "their man" for the handful of keys that call the person
# one; a player named in the same string is left to the `_f` axis, and `_fw`
# is the two together, made from the `_f` sibling. i18n.ts reads them in that
# order. The keys are named, not detected: a string is about the manager or a
# member of staff because the code that files it says so (subjectVar).
SIBLING = re.compile(r'_(f|w|fw)$')
MGR_KEYS = re.compile(r"^(news\.fan(Sceptic|Hopeful|Patient)|legacy\.cvTitle|press\.(stanceSafeR|ownerRugbyR|discWord)|profile\.spec\w+Desc|club\.arch\w+Desc|news\.staffHired)")
STAFF_W_KEYS = re.compile(r"^(analyst\.|till\.watchAnalyst|dec\.analyst\w+|news\.(staffSacked|staffOut|badge\w+|staffClick|staffClash|briefSent|scoutReport|scoutReportSubj|scoutNamed|loanOne|loanOneMore|loanMany|loanManyMore|intakeGrade\w|intakePreview|aWonLine\d|aLostLine\d|aCoachNamed|aCoachAnon|assHand\w+|assistantRan|boss\w*|rivalAboveYou|rivalBelowYou)|dec\.badge\w+|reply\.(badge\w+|scoutAlreadyOut)|staff\.(block\w+Long|sackNoMoney|sacked|course\w+Long\w*)|transfers\.(longerTrip|scoutsReportSub)|matchday\.assistantTakes|selection\.untouched|training\.failedRetake\w*|comm\.oppCoach\w*|press\.(raceQ\d|coachNamed))")
W_NOUN = {
 'en': [(r"\btheir man\b", "their woman"), (r"\bNew man\b", "New woman"), (r"\ba man who\b", "a woman who"), (r"\bman to man\b", "woman to woman"), (r"\bkids into men\b", "kids into women")],
 'fr': [(r"\bleur homme\b", "leur femme"), (r"\bNouvel homme\b", "Nouvelle femme"), (r"\bun homme qui\b", "une femme qui"), (r"\bd'homme à homme\b", "de femme à femme"), (r"\bl'homme\b", "la femme"), (r"\bnouvel entraîneur\b", "nouvelle entraîneuse"), (r"\bl'entraîneur\b(?= qui| a | est | n')", "l'entraîneuse")],
 'es': [(r"\bsu hombre\b", "su mujer"), (r"\bHombre nuevo\b", "Mujer nueva"), (r"\bun hombre que\b", "una mujer que"), (r"\bde hombre a hombre\b", "de mujer a mujer"), (r"\bel hombre\b", "la mujer"), (r"\bnuevo entrenador\b", "nueva entrenadora"), (r"\bel entrenador\b", "la entrenadora"), (r"\bun entrenador\b", "una entrenadora")],
 'it': [(r"\bil suo uomo\b", "la sua donna"), (r"\bla sua uomo\b", "la sua donna"), (r"\bUomo nuovo\b", "Donna nuova"), (r"\bun uomo che\b", "una donna che"), (r"\bda uomo a uomo\b", "da donna a donna"), (r"\bl'uomo\b", "la donna"), (r"\bnuovo allenatore\b", "nuova allenatrice"), (r"\bl'allenatore\b", "l'allenatrice"), (r"\bun allenatore\b", "un'allenatrice")],
 'ja': [("望みの男", "望みの人材"), ("新しい男", "新しい女性"), ("男", "女性")],
 'af': [(r"\bhulle man\b", "hulle vrou"), (r"\bNuwe man\b", "Nuwe vrou"), (r"\b'n man wat\b", "'n vrou wat"), (r"\bman tot man\b", "vrou tot vrou"), (r"\bkinders in mans\b", "kinders in vroue"), (r"\bdie man\b", "die vrou")],
}
def feminise_subject(lang, key, s):
    noun, pron, il = RULES[lang]
    out = s
    if MGR_KEYS.search(key): out = apply(W_NOUN.get(lang, []), out, ci=True)
    out = apply(pron, out)
    out = apply(il, out)
    if out != s: out = apply(CHAIN.get(lang, []), out, ci=True)
    return out

def run_subject(lang, dry):
    p = f'src/locales/{lang}.json'
    d = json.load(open(p, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    made = 0; sample = []
    def visit(node, path=''):
        nonlocal made
        if not isinstance(node, dict): return
        for k in list(node.keys()):
            if SIBLING.search(k): continue
            v = node[k]; full = f'{path}{k}'
            plural = isinstance(v, dict) and 'other' in v and all(isinstance(x, str) for x in v.values())
            if isinstance(v, dict) and not plural: visit(v, full + '.'); continue
            if not (MGR_KEYS.search(full) or STAFF_W_KEYS.search(full)): continue
            for src_suffix, dst_suffix in (('', '_w'), ('_f', '_fw')):
                src = node.get(k + src_suffix) if src_suffix else v
                if src is None: continue
                if isinstance(src, dict):
                    nf = collections.OrderedDict((form, feminise_subject(lang, full, txt)) for form, txt in src.items())
                    if nf == src: continue
                else:
                    nf = feminise_subject(lang, full, src)
                    if nf == src: continue
                if not dry: node[k + dst_suffix] = nf
                made += 1
                if len(sample) < 30: sample.append((full + dst_suffix, src if isinstance(src, str) else src['other'], nf if isinstance(nf, str) else nf['other']))
    visit(d)
    if not dry:
        raw = open(p, encoding='utf-8').read(); ind = len(raw.split('\n')[1]) - len(raw.split('\n')[1].lstrip(' '))
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=ind)
        open(p, 'a', encoding='utf-8').write('\n')
    return made, sample

# ---------------------------------------------------------------- CORRECTIONS
CORR_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'feminise-corrections.json')
C = json.load(open(CORR_PATH, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
NB = ' '
def fr_typo(s):
    if not isinstance(s, str): return s
    s = re.sub(r'(?<=[^\s {])\s*([:;!?])(?![^{]*})', NB + r'\1', s)  # NBSP before : ; ! ? (not inside {…})
    s = re.sub(r'«\s*', '«' + NB, s); s = re.sub(r'\s*»', NB + '»', s)
    s = s.replace(' ' + NB, NB).replace(NB + ' ', NB)
    return s
def walk_to(doc, key):
    parts = key.split('.'); node = doc
    for p in parts[:-1]: node = node[p]
    return node, parts[-1]
def correct(lang, phase='all'):
    is_w = lambda key: bool(re.search(r'_(w|fw)$', key))
    keep = (lambda key: True) if phase == 'all' else (lambda key: is_w(key) == (phase == 'w'))
    p = f'src/locales/{lang}.json'
    doc = json.load(open(p, encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    nset = ndel = nsub = 0; missing = []
    for key, val in C.get(lang, {}).items():
        if not keep(key): continue
        node, leaf = walk_to(doc, key)
        if val is None:
            if leaf in node: del node[leaf]; ndel += 1
        else:
            node[leaf] = fr_typo(val) if lang == 'fr' else val; nset += 1
    for key, pairs in C.get('subs', {}).get(lang, {}).items():
        if not keep(key): continue
        node, leaf = walk_to(doc, key)
        # subs on a key with no sibling yet start from the base string: a hand-made sibling
        if leaf not in node:
            base = SIBLING.sub('', leaf)
            if base not in node: missing.append(key); continue
            node[leaf] = node[base]
        cur = node[leaf]
        for old, new in pairs:
            if isinstance(cur, dict):
                if not any(old in v for v in cur.values()): missing.append(f'{key}: {old!r}'); continue
                cur = collections.OrderedDict((k, v.replace(old, new)) for k, v in cur.items())
            else:
                if old not in cur: missing.append(f'{key}: {old!r}'); continue
                cur = cur.replace(old, new)
            nsub += 1
        node[leaf] = cur
    if lang == 'fr':
        def tidy(n):
            for k, v in n.items():
                if isinstance(v, dict): tidy(v)
                elif k.endswith('_f') and isinstance(v, str): n[k] = fr_typo(v)
        tidy(doc)
    json.dump(doc, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2 if lang == 'fr' else 1)
    open(p, 'a', encoding='utf-8').write('\n')
    print(f'{lang}: set {nset}, withdrew {ndel}, subs {nsub}, missing {len(missing)}')
    for m in missing: print('   MISSING', m)

if __name__ == '__main__':
    dry = '--apply' not in sys.argv
    langs = [a for a in sys.argv[1:] if a in RULES] or ['en', 'fr', 'es', 'it', 'ja', 'af']
    for lang in langs:
        made, broken, sample = run(lang, dry)
        print(f'\n===== {lang}: {"would generate" if dry else "generated"} {made} feminine siblings; {len(broken)} broken =====')
        for k, t in broken[:10]: print(f'  BROKEN {k}: {t[:140]!r}')
        if dry:
            for k, a, b in sample[:14]:
                print(f'  {k}\n     - {a[:150]!r}\n     + {b[:150]!r}')
        # the hand pass on the player axis lands BEFORE the subject pass reads
        # `_f`, so `_fw` is built from the corrected text; then its own pass
        if not dry and '--no-corrections' not in sys.argv: correct(lang, 'f')
        made_w, sample_w = run_subject(lang, dry)
        print(f'===== {lang}: {"would generate" if dry else "generated"} {made_w} subject siblings (_w, _fw) =====')
        if dry:
            for k, a, b in sample_w[:10]:
                print(f'  {k}\n     - {a[:150]!r}\n     + {b[:150]!r}')
        elif '--no-corrections' not in sys.argv:
            correct(lang, 'w')
