# Vallective

Vallective er en Next.js-app til kortsamlinger, scanning, markedsvurdering,
grading, salg og Cardshow-inventory. Applikationen ligger i `web` og bruger
Supabase til database, authentication og storage samt OpenAI til kortgenkendelse
og markedsanalyse.

**Collect what matters. Know what it's worth.**

Det historiske repository, Supabase-projektet og Vercel-projektet beholder
foreløbig deres interne `NECardPilot`/`necardpilot`-identifikatorer. Den
offentlige produktidentitet og primære produktionsadresse er Vallective på
<https://vallective.com>.

## Lokal opstart

Krav:

- Node.js 24 (se `web/.nvmrc`)
- npm
- adgang til det relevante Supabase-projekt
- en OpenAI API-nøgle til AI-funktionerne
- en Resend API-nøgle og verificeret afsender til pilotinvitationer

Kopiér miljøskabelonen og udfyld værdierne lokalt:

```powershell
cd web
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Appen er derefter tilgængelig på <http://localhost:3000>.

## Mobil og installation

På skærme op til 620 px får de autentificerede app-flows en fast,
safe-area-aware bundnavigation med scanner som primær handling. Den sekundære
navigation åbnes som en tastaturvenlig dialog, og en offline-status advarer, når
live-data midlertidigt ikke kan hentes. Vallective udstiller samtidig et web app
manifest med genveje til scanner og kortbibliotek. Appen cacher ikke generelle
private data til offline-brug, men Capture Queue på `/scanner/queue` gemmer
klargjorte for- og bagsidebilleder lokalt i browserens IndexedDB, indtil de er
uploadet sikkert. Brugeren kan derfor fortsætte fotograferingen uden at vente på
upload eller AI og starte den sekventielle identifikation særskilt senere.

## Kvalitetskontrol

Kør kontrollerne enkeltvis:

```powershell
cd web
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Eller samlet:

```powershell
cd web
npm run check
```

`npm run check` er den samme quality gate, som GitHub Actions kører ved pull
requests og pushes til `main`: typecheck, lint, automatiske tests og et fuldt
produktionsbuild.

Den autentificerede Playwright-rejse er en separat, read-only releasekontrol.
Den logger ind med en dedikeret Supabase-testkonto og gennemgår kerneområderne
i både desktop- og mobilprofil uden at oprette, redigere eller slette kortdata.
Opsætning og kommandoer er beskrevet i `web/README.md`; GitHub-workflowet
`Authenticated journey` kan startes manuelt, når secrets `E2E_EMAIL` og
`E2E_PASSWORD` er oprettet.

Vercel Web Analytics og Speed Insights er indbygget i root-layoutet. Uventede
serverfejl logges som strukturerede JSON-events via Next.js instrumentation, og
appens error boundaries viser en sikker fejlreference til brugeren.

Indloggede betatestere kan sende struktureret feedback fra `/feedback`.
Indsendelsen gemmer kategori, oplevelsesscore, besked og en begrænset teknisk
kontekst uden kortdata, browserhistorik eller URL-queryparametre. Tabellen er
beskyttet med RLS og giver kun brugeren adgang til at indsende egne rapporter.
Udpegede betaadministratorer kan behandle rapporterne på
`/feedback/manage`; medlemskabet ligger i `beta_feedback_admins` som
miljødata og må ikke hardcodes med mail eller bruger-id i repositoryet.
Real-device-pilotens testmatrix og exitkriterier ligger i
[`docs/beta-pilot.md`](docs/beta-pilot.md).

Den kontrollerede pilot styres fra `/beta`. Her vælger testeren en bred
enheds- og browsertype, mens appen automatisk registrerer, om det aktuelle
vindue kører i browseren eller fra hjemmeskærmen. Fremdriften gemmes gennem den
guidede 10-punkts brugerrejse. Betaadministratoren ser kun denne begrænsede
dækning og fremdrift sammen med beslutningskøen på `/feedback/manage`; der
indsamles ingen hardware-id'er eller fulde user agents.

Når alle ti trin er gennemført, bevarer Vallective et minimalt coverage check
for kombinationen af enhedsgruppe, browsergruppe og installationstype. Senere
tests overskriver derfor ikke tidligere iPhone-, Android- eller desktopbeviser.
Launch readiness på `/feedback/manage` samler disse beviser med feedbackkøen i
seks automatiske go/hold-kriterier for den offentlige beta.

Vallective har et webmanifest, platformstilpassede installationsinstruktioner
og en service worker med en scriptfri offline-fallback. Service workeren cacher
kun den statiske fallbackside – aldrig autentificerede sider, API-svar,
kortbilleder eller private samlingsdata.

Betaadministratoren kan sende forventede, en-til-en-pilotinvitationer fra
`/feedback/manage`. Modtagerens adresse og samtykkebekræftelse gemmes i den
adminbeskyttede `beta_pilot_invitations`-tabel. Afsendelsen bruger Resend med en
deterministisk idempotency key, så en teknisk retry ikke sender dubletter.
`Sent` betyder, at Resend har accepteret anmodningen; levering eller åbning
antages ikke uden verificerede provider-events.

## Deployment

Ved opsætning på Vercel skal Root Directory være `web`. Variablerne fra
`web/.env.example` skal oprettes i Vercel uden at committe deres værdier.

`RESEND_EMAIL_DOMAIN` skal være et domæne, der er verificeret i Resend; appen
sender som `Vallective <pilot@domænet>`. `RESEND_FROM_EMAIL` kan bruges som en
valgfri, fuld override af afsenderen. `RESEND_REPLY_TO_EMAIL` skal være en
overvåget indbakke og er påkrævet, før en pilotinvitation kan sendes.

`NEXT_PUBLIC_SITE_URL` skal være `https://vallective.com` i production.
Supabase Auth skal samtidig tillade `http://localhost:3000/**`, production-
adressen og Vercels preview-domæner som redirect URLs, så konto-, bekræftelses-
og nulstillingsmails kan vende sikkert tilbage til appen.

Supabase-skemaændringer ligger under `supabase/migrations` og skal gennemgås og
godkendes særskilt, før de anvendes på et live-projekt.
