# Vallective real-device beta pilot

M17-piloten skal bevise, at de vigtigste samlerflows fungerer på rigtige
enheder, og at hver observation ender som en prioriteret beslutning. Testerne
registrerer enhed og fremdrift i `/beta`; betaadministratoren følger dækning og
feedback i `/feedback/manage`.

## Pilotgruppe

- 3–5 kortsamlere med forskellige erfaringer og samlingstyper.
- Hver tester bruger sin egen bekræftede Vallective-konto.
- Testdata må gerne være realistiske, men aldrig indeholde adgangskoder,
  betalingsoplysninger eller andre personers private data.
- Feedback med opfølgning må kun kontaktes, når samtykket er markeret.
- Pilotinvitationer sendes én ad gangen fra `/feedback/manage` og kun til en
  samler, der forventer invitationen. Admin bekræfter dette før hver afsendelse.
- En fejlet invitation må genforsøges fra samme auditpost; en allerede afsendt
  adresse inviteres ikke automatisk igen.

## Enhedsmatrix

| Profil | Minimum | Installation |
| --- | --- | --- |
| iPhone | Seneste iOS Safari | Browser og hjemmeskærm/PWA |
| Android | Seneste Chrome | Browser og installeret PWA |
| Desktop | Chrome eller Edge | Normal browser |
| Robusthed | Langsom eller ustabil forbindelse | Online → offline → online |

Notér enhedsmodel, OS/browser-version, skærmprofil og om appen var installeret.
Vallective registrerer selv kun den begrænsede kontekst, der beskrives på
feedbacksiden.

### Verificér installation og offline-fallback

1. Åbn **Settings** i Vallective og følg den viste installationsvejledning.
2. På iPhone bruges Safari: **Del** → **Føj til hjemmeskærm** → **Tilføj**.
3. På Android bruges Chrome: browsermenuen → **Installér app** eller
   **Føj til startskærm** → bekræft.
4. Luk browserfanen, start Vallective fra det nye ikon og åbn `/beta`.
5. Kontrollér, at **Launch mode** automatisk viser **Installed on home screen**,
   før pilotfremdriften gemmes igen.
6. Efter mindst én online-indlæsning slås forbindelsen fra, og testeren
   navigerer i appen. Vallective skal vise den brandede **You are offline**-side
   uden private samlingsdata. Forbind igen og vælg **Try again**.

Hvis launch mode fortsat viser browser, skal testeren kontrollere, at appen blev
åbnet fra hjemmeskærmsikonet og ikke fra en eksisterende browserfane.

## Guidet brugerrejse

1. Opret konto, bekræft mail og log ind igen.
2. Opret en personlig samling og en inventory-samling.
3. Scan for- og bagside fra kamera samt vælg et eksisterende billede.
4. Kontrollér AI-forslaget, ret mindst ét felt og gem kortet.
5. Find kortet igen via søgning og filtre.
6. Flyt et kort mellem samlinger og registrér et salg.
7. Opret eller gennemgå et grading-flow.
8. Gennemgå analytics og Cardshow på en smal mobilskærm.
9. Installer appen, luk den helt og åbn den igen fra hjemmeskærmen.
10. Send mindst én konkret rapport fra den side, hvor friktionen opstod.

Hvert punkt markeres i `/beta` og gemmes på testerens egen konto. Pilotsporet
gemmer kun en bred enhedsgruppe, browsergruppe, browser/installeret tilstand og
de gennemførte punktnumre. Når alle ti trin er gennemført, bevares et minimalt
coverage check for den testede kombination. Det gør, at en senere test på en ny
platform ikke overskriver tidligere verifikation. Sporet gemmer ikke
hardware-id, fuld user agent, kortdata eller browserhistorik.

## Capture Queue endurance run

Android- og iPhone-piloten skal desuden gennemføre mindst ét kontrolleret run
fra `/scanner/queue`:

1. Vælg **10 cards** og start endurance-runnet. Det opretter en ny, isoleret
   capture-session; eksisterende kø og kort bevares.
2. Tag for- og bagside af ti kort uden at starte AI-identifikation.
3. Genindlæs siden eller luk og genåbn den installerede app. Runnet skal fortsat
   være aktivt med samme tællinger.
4. Slå forbindelsen fra, tag mindst ét kort, og slå forbindelsen til igen.
5. Vent til alle ti kort viser som uploadet, og at ingen transportfejl står
   tilbage.
6. Vælg **Save passed run**. Kun sessionens samlede tællinger, bred enheds- og
   browserklasse samt ja/nej-checks for genåbning og netværksrecovery gemmes.

Testen starter ikke AI og skaber derfor ingen identifikationsudgift. Kortene
bliver stående i den normale review-kø og kan identificeres senere under det
separate USD-budgetværn.

## Prioritering

| Prioritet | Betydning | Reaktion |
| --- | --- | --- |
| Critical | Datatab, sikkerhedsproblem eller kerneflow blokeret | Stop pilot og undersøg straks |
| High | Vigtigt flow kan ikke gennemføres på en understøttet enhed | Planlægges før næste pilotrunde |
| Normal | Tydelig friktion eller værdifuld forbedring | Triageres til kommende milestone |
| Low | Kosmetik eller mindre produktidé | Gemmes uden at blokere betaen |

Status bruges konsekvent: `New` → `Reviewing` → `Planned` → `Resolved` eller
`Closed`. Den interne note skal beskrive beslutning, reproduktion og næste
handling – ikke kopiere private brugerdata.

## Exitkriterier

Launch readiness på `/feedback/manage` viser **Hold**, indtil alle syv
automatiske gates er grønne:

1. Mindst én komplet 10-punkts rejse er bevaret.
2. Mindst ét 10+-korts endurance run har bevist genåbning, offline recovery og
   fuld upload uden transportfejl.
3. En installeret iPhone-rejse er gennemført.
4. En installeret Android-rejse er gennemført.
5. En desktop-browserrejse er gennemført.
6. Alle rapporter er flyttet ud af `New`.
7. Ingen uafsluttede High- eller Critical-rapporter er tilbage.

De automatiske gates suppleres af følgende manuelle drifts- og
kvalitetskontroller:

- Ingen åbne Critical-rapporter.
- Alle High-rapporter har en ejer eller en dokumenteret produktbeslutning.
- Konto, scanning, lagring, søgning og salg er gennemført på både iPhone og
  Android.
- PWA'en kan installeres og genåbnes på begge mobilplatforme.
- Ingen ukontrollerede 5xx-fejl i Vercel under pilotperioden.
- Mindst 80 % af pilottestene vurderer kerneoplevelsen til 4 eller 5.
- Hver rapport i køen har en status, prioritet og – når nødvendig – intern note.
- Pilotoversigten viser mindst én gennemført mobilrejse i installeret tilstand.

Når kriterierne er opfyldt, kan Vallective gå fra kontrolleret pilot til en
større invitation-only beta.
