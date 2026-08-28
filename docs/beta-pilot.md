# Vallective real-device beta pilot

M16-piloten skal bevise, at de vigtigste samlerflows fungerer på rigtige
enheder, og at hver observation ender som en prioriteret beslutning. Testerne
registrerer enhed og fremdrift i `/beta`; betaadministratoren følger dækning og
feedback i `/feedback/manage`.

## Pilotgruppe

- 3–5 kortsamlere med forskellige erfaringer og samlingstyper.
- Hver tester bruger sin egen bekræftede Vallective-konto.
- Testdata må gerne være realistiske, men aldrig indeholde adgangskoder,
  betalingsoplysninger eller andre personers private data.
- Feedback med opfølgning må kun kontaktes, når samtykket er markeret.

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
de gennemførte punktnumre. Det gemmer ikke hardware-id, fuld user agent,
kortdata eller browserhistorik.

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
