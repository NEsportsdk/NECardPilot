# NECardPilot

NECardPilot er en Next.js-app til kortsamlinger, scanning, markedsvurdering,
grading, salg og Cardshow-inventory. Applikationen ligger i `web` og bruger
Supabase til database, authentication og storage samt OpenAI til kortgenkendelse
og markedsanalyse.

## Lokal opstart

Krav:

- Node.js 22 eller nyere
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
npm run build
```

Eller samlet:

```powershell
cd web
npm run check
```

## Deployment

Ved opsætning på Vercel skal Root Directory være `web`. De tre variabler fra
`web/.env.example` skal oprettes i Vercel uden at committe deres værdier.

Supabase-skemaændringer ligger under `supabase/migrations` og skal gennemgås og
godkendes særskilt, før de anvendes på et live-projekt.
