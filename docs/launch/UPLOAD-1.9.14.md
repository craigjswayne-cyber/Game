# Uploading 1.9.14, step by step

Version **1.9.14**. Play version code **77** (76 was refused over the portrait screen, see Step 3). iPhone build number: **one more than the 1.9.13 build**.

Do the steps in order. Each step says what you should see before you move on. If you see something different, stop and send me a screenshot.

---

## Step 0. Check the computer is happy (I do this part)

- [x] **Gate is green on main** (commit `ca56461`, 19 Nov 2026). Done.
- [x] **Release check is green on the same commit** (`ca56461`, 19 Nov 2026, all 11 jobs). Done. This is the commit to build.
- [x] **The website has updated** (it published on 18 Nov at 19:32 UTC). Check it yourself once: open https://phaserugbymanager.com/privacy.html on your phone. You should see the adverts list: advertising ID, IP address, ad and app interactions, device and performance data. If you see the old page, wait 10 minutes and refresh.

---

## Step 1. Check the numbers in the stores

**Google Play**
1. Open **play.google.com/console** and tap **PHASE: Rugby Manager**.
2. In the left menu, open **App bundle explorer** (it is under Test and release; if you cannot see it, type "App bundle explorer" in the search box at the top).
3. Look at the biggest version code in the list. It should say **75** (that was 1.9.13).
   - If it says **75**: good, go on.
   - If it says something bigger: stop and tell me the number.

**App Store**
1. Open **appstoreconnect.apple.com > Apps > PHASE: Rugby Manager > TestFlight**.
2. Write down the biggest **build number** you see for 1.9.13. Your new build number is that number **plus one**.
3. Check 1.9.13 is not still "Waiting for Review". If it is, 1.9.14 goes in after it.

---

## Step 2. Build for Android

On your computer, open the Terminal in the game folder and paste these lines one at a time. Press Enter after each one and wait for it to finish:

```
git checkout main
```
```
git pull
```
```
npm ci
```
```
cd packaging/android
```
```
npm install
```
```
./scaffold.sh
```

- [ ] At the end, `scaffold.sh` prints the version code. It must say **77**, and it must print `portrait screen optional`.

Then in **Android Studio**:
1. Menu: **Build > Generate Signed App Bundle / APK**.
2. Pick **Android App Bundle**, then **Next**.
3. Pick your keystore. The alias is `phase`. Type your password. (Never send me the keystore or the password.)
4. Pick **release**, then **Create**.
5. The file appears at `android/app/release/app-release.aab`.

---

## Step 3. Put it on Google Play

1. Play Console > **Test and release > Testing > Internal testing > Create new release**.
2. Drag in `app-release.aab`.
3. **Release name**, copy this:

```
1.9.14 (77)
```

4. **Release notes**: Play wants one block for each language. Copy everything in the grey box below and paste it in as it is (the language tags are part of it):

```
<en-GB>
New: a Season plan tab on Training & Staff. Negotiate with free agents: a wage and a deal of one to three seasons. The international game is rebuilt: union targets for every window, squad announcements, camp decisions, a Test captain and game plan, the walk-out and anthems, and your era as national coach. Out-of-contract players warn you before they leave. Swap marquee players in one tap. Pro Manager adds three challenge careers: Academy Only, Shoestring and Fire Sale. A new PHASE Discord link.
</en-GB>
<fr-FR>
Nouveau : un onglet Plan de saison. Négociez avec les agents libres : salaire et contrat d'une à trois saisons. Le jeu international est repensé : objectifs de la fédération, annonce du groupe, décisions au rassemblement, capitaine et plan de jeu, entrée des équipes et hymnes, et votre ère de sélectionneur. Défis Pro : Centre de formation, Budget serré, Grande braderie. Joueurs hors plafond échangeables d'un geste. Les fins de contrat vous préviennent. Nouveau lien Discord PHASE.
</fr-FR>
<es-ES>
Nuevo: una pestaña Plan de temporada. Negocia con agentes libres: salario y contrato de una a tres temporadas. El juego internacional se renueva: objetivos de la federación, anuncio de la convocatoria, decisiones en la concentración, capitán y plan de juego, salida al campo e himnos, y tu etapa como seleccionador. Retos Pro: Solo cantera, Presupuesto mínimo, Liquidación total. Jugadores franquicia: cambia uno con un toque. Los que acaban contrato avisan antes. Nuevo enlace al Discord de PHASE.
</es-ES>
<it-IT>
Novità: una scheda Piano della stagione. Tratta con gli svincolati: ingaggio e contratto da una a tre stagioni. Il gioco internazionale è rinnovato: obiettivi della federazione, annuncio del gruppo, scelte al raduno, capitano e piano di gioco, ingresso in campo e inni, e la tua era da CT. Nuove sfide Pro: Solo accademia, Budget ridotto, Svendita totale. Giocatori marquee: scambiane uno con un tocco. I giocatori in scadenza avvisano prima di partire. Nuovo link al Discord di PHASE.
</it-IT>
<ja-JP>
新機能：トレーニングとスタッフに「シーズンプラン」タブ。フリーエージェントと週給・1〜3シーズンの契約で交渉可能に。代表戦を一新：ウィンドウごとの協会の目標、スコッド発表、合宿での決断、テストマッチのキャプテンとゲームプラン、入場と国歌、代表監督としてのあなたの時代。Proチャレンジ3種（アカデミーのみ、切り詰め予算、大放出）を追加。マーキー選手はワンタップで入れ替え。契約満了が近い選手は退団前に予告するように。PHASEのDiscordへの新しいリンクも。
</ja-JP>
<af>
Nuut: 'n Seisoensplan-oortjie. Onderhandel met vrye agente: 'n loon en 'n kontrak van een tot drie seisoene. Die internasionale spel is herbou: die unie se doelwitte vir elke venster, groepaankondigings, kampbesluite, 'n toetskaptein en spelplan, die uitloop en volksliedere, en jou era as nasionale afrigter. Pro-uitdagings: Net die akademie, Skraal begroting, Uitverkoping. Ruil hoofspelers met een tik. Spelers met uitlopende kontrakte waarsku jou vooraf. 'n Nuwe skakel na die PHASE-Discord.
</af>
```

5. Tap **Next**, then **Save and publish** (for internal testing).
6. On your phone, install it from the internal testing link and do **Step 7** below.
7. If Step 7 is fine: go back to the release and tap **Promote release > Production**, then **Save and publish**.

---

## Step 4. Update Google Play's privacy form (Data safety)

Do this the same day as Step 3.

1. Play Console > **Policy and programs > App content**, find **Data safety**, tap **Manage** (or **Start**).
2. "Does your app collect or share any of the required user data types?" **Yes**.
3. "Is all of the user data collected by your app encrypted in transit?" **Yes**.
4. Tick these data types. For each one, choose **Collected: Yes**, **Shared: Yes**, and the reasons in the right-hand column:

| Data type | Reasons to tick |
|---|---|
| Location > Approximate location | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App activity > App interactions | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App info and performance > Crash logs | Analytics; Fraud prevention, security and compliance |
| App info and performance > Diagnostics | Analytics; Fraud prevention, security and compliance |
| Device or other IDs | Advertising or marketing; Analytics; Fraud prevention, security and compliance |

5. "Is this data required or optional?" **Required** (adverts need it; personalised adverts are a choice in the consent form).
6. Deletion: point to the privacy page link below.

```
https://phaserugbymanager.com/privacy.html#delete
```

7. **Save**, then **Submit**.

Before you submit, check each answer against Google's AdMob help page "Prepare your app for Google Play's Data safety section".

---

## Step 5. Build for iPhone (on the Mac)

Open the Terminal in the game folder and paste these one at a time:

```
git checkout main
```
```
git pull
```
```
npm ci
```
```
npm run build
```
```
cd packaging/ios
```
```
npm install
```
```
./scaffold.sh
```

Always use `./scaffold.sh`, never `npx cap sync ios` on its own: the scaffold puts the advert and purchase bridges back.

Then in **Xcode**:
1. On the left, open **Assets**. The icon must be the **green ball**, not a blue X.
2. Click the **App** target > **General**.
   - **Version**: `1.9.14`
   - **Build**: the number from Step 1 **plus one**.
3. At the top, pick the device **Any iOS Device (arm64)**.
4. Menu: **Product > Archive**. Wait.
5. In the Organizer window: **Distribute App > App Store Connect > Upload**.
6. Encryption question: **No**.

---

## Step 6. Put it on the App Store

1. App Store Connect > **PHASE: Rugby Manager**. Tap the **+** next to iOS App, and type `1.9.14`.
2. Scroll to **Build** and pick the one you just uploaded (it can take 10 to 30 minutes to appear).
3. Install it from **TestFlight** on your iPhone and do **Step 7** below first.
4. For each language, pick it from the **language menu at the top right**, then paste its two boxes below. Leave the description and keywords as they are.
5. Apple has **no Afrikaans**, so there is nothing to paste for Afrikaans here.

### English (U.K.)

What's New:
```
New: a Season plan tab on Training & Staff. Negotiate with free agents: a wage and a deal of one to three seasons. The international game is rebuilt: union targets for every window, squad announcements, camp decisions, a Test captain and game plan, the walk-out and anthems, and your era as national coach. Out-of-contract players warn you before they leave. Swap marquee players in one tap. Pro Manager adds three challenge careers: Academy Only, Shoestring and Fire Sale. A new PHASE Discord link.
```
Promotional text:
```
New: the international game rebuilt, free-agent wage talks, a Season plan, and three Pro Manager challenge careers: Academy Only, Shoestring and Fire Sale.
```

### French

What's New:
```
Nouveau : un onglet Plan de saison. Négociez avec les agents libres : salaire et contrat d'une à trois saisons. Le jeu international est repensé : objectifs de la fédération, annonce du groupe, décisions au rassemblement, capitaine et plan de jeu, entrée des équipes et hymnes, et votre ère de sélectionneur. Défis Pro : Centre de formation, Budget serré, Grande braderie. Joueurs hors plafond échangeables d'un geste. Les fins de contrat vous préviennent. Nouveau lien Discord PHASE.
```
Promotional text:
```
Nouveau : le jeu international repensé, la négociation avec les agents libres, un Plan de saison et trois défis Pro : Centre de formation, Budget serré, Grande braderie.
```

### Spanish

What's New:
```
Nuevo: una pestaña Plan de temporada. Negocia con agentes libres: salario y contrato de una a tres temporadas. El juego internacional se renueva: objetivos de la federación, anuncio de la convocatoria, decisiones en la concentración, capitán y plan de juego, salida al campo e himnos, y tu etapa como seleccionador. Retos Pro: Solo cantera, Presupuesto mínimo, Liquidación total. Jugadores franquicia: cambia uno con un toque. Los que acaban contrato avisan antes. Nuevo enlace al Discord de PHASE.
```
Promotional text:
```
Nuevo: el juego internacional renovado, negociación con agentes libres, un Plan de temporada y tres retos Pro: Solo cantera, Presupuesto mínimo, Liquidación total.
```

### Italian

What's New:
```
Novità: una scheda Piano della stagione. Tratta con gli svincolati: ingaggio e contratto da una a tre stagioni. Il gioco internazionale è rinnovato: obiettivi della federazione, annuncio del gruppo, scelte al raduno, capitano e piano di gioco, ingresso in campo e inni, e la tua era da CT. Nuove sfide Pro: Solo accademia, Budget ridotto, Svendita totale. Giocatori marquee: scambiane uno con un tocco. I giocatori in scadenza avvisano prima di partire. Nuovo link al Discord di PHASE.
```
Promotional text:
```
Novità: il gioco internazionale rinnovato, trattative con gli svincolati, un Piano della stagione e tre sfide Pro: Solo accademia, Budget ridotto, Svendita totale.
```

### Japanese

What's New:
```
新機能：トレーニングとスタッフに「シーズンプラン」タブ。フリーエージェントと週給・1〜3シーズンの契約で交渉可能に。代表戦を一新：ウィンドウごとの協会の目標、スコッド発表、合宿での決断、テストマッチのキャプテンとゲームプラン、入場と国歌、代表監督としてのあなたの時代。Proチャレンジ3種（アカデミーのみ、切り詰め予算、大放出）を追加。マーキー選手はワンタップで入れ替え。契約満了が近い選手は退団前に予告するように。PHASEのDiscordへの新しいリンクも。
```
Promotional text:
```
新機能：代表戦を一新、フリーエージェントとの契約交渉、シーズンプラン、Proチャレンジ3種（アカデミーのみ、切り詰め予算、大放出）。
```

6. Update **App Privacy** (in the left menu of your app; Apple sometimes moves it, so use the page's search if needed) the same day. Edit it so the types match this table:

| Data type | Used for | Used for tracking |
|---|---|---|
| Location > Coarse Location | Third-Party Advertising; Analytics | Check Google's page |
| Identifiers > Device ID | Third-Party Advertising; Analytics | Yes |
| Usage Data > Product Interaction | Third-Party Advertising; Analytics | Check Google's page |
| Usage Data > Advertising Data | Third-Party Advertising; Analytics | Yes |
| Diagnostics > Crash Data | Analytics | No |
| Diagnostics > Performance Data | Analytics | No |
| Diagnostics > Other Diagnostic Data | Analytics | No |

"Linked to the user" for the advert rows: follow Google's page "Prepare for Apple's App Store data disclosure requirements". The three Diagnostics rows are **not** linked.

7. Back on the version page: **Add for Review**, then **Submit to App Review**.

---

## Step 7. Ten minutes of playing before you go live

Do this on the internal-testing (Android) and TestFlight (iPhone) builds.

1. **Pro challenges**: New Career. Scroll to the Pro section. You see Academy Only, Shoestring and Fire Sale. If you own Pro, pick **Fire Sale** and start: the inbox says five players were sold. On a phone without Pro, tapping a challenge opens the Pro purchase; press Cancel and nothing starts.
2. **Academy Only**: start one, go to Transfers and try to sign anyone. It says no, politely.
3. **International**: take a national job (or load a career that has one). Play to a Test. You see the walk-out, the anthems and the challenge (for New Zealand, Fiji, Samoa or Tonga). The players are **circles with numbers**, like in a match.
4. **Free agents**: Transfers > search, set the club box to **Free agents**, open one and make an offer. You can choose one, two or three seasons and a wage.
5. **Season plan**: in a new career, week 1, Training & Staff has a Season plan tab.
6. **Italian and Afrikaans**: Settings > Language > Italiano. Squad > Game Time: the column heading says **Att** and fits. Do the same in Afrikaans (**Verw**). Switch back.
7. **An old career**: open a career saved on 1.9.13. It loads.

If anything looks wrong, stop and send me a screenshot. Do not promote.

---

## Step 8. After it is live

- [ ] Tell me it is live, and I will update `docs/launch/LAUNCH-PROGRAMME.md` (current version 1.9.14, Play code 77, the App Store status).
