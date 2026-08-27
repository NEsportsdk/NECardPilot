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

Kopiér miljøskabelonen og udfyld værdierne lokalt:

```powershell
cd web
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Appen er derefter tilgængelig på <http://localhost:3000>.

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

Vercel Web Analytics og Speed Insights er indbygget i root-layoutet. Uventede
serverfejl logges som strukturerede JSON-events via Next.js instrumentation, og
appens error boundaries viser en sikker fejlreference til brugeren.

## Deployment

Ved opsætning på Vercel skal Root Directory være `web`. De fire variabler fra
`web/.env.example` skal oprettes i Vercel uden at committe deres værdier.

`NEXT_PUBLIC_SITE_URL` skal være `https://vallective.com` i production.
Supabase Auth skal samtidig tillade `http://localhost:3000/**`, production-
adressen og Vercels preview-domæner som redirect URLs, så konto-, bekræftelses-
og nulstillingsmails kan vende sikkert tilbage til appen.

Supabase-skemaændringer ligger under `supabase/migrations` og skal gennemgås og
godkendes særskilt, før de anvendes på et live-projekt.
