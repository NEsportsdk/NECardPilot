# Vallective web app

Vallective is a mobile-first workspace for scanning, organizing, valuing, grading, buying, and selling sports cards. The web app uses Next.js App Router, Supabase Auth and Postgres, OpenAI-assisted card identification, and Vercel hosting.

## Local development

Requirements:

- Node.js 24
- A Supabase project and an OpenAI API key

Copy `.env.example` to `.env.local`, provide the required values, then run:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route is protected, so signed-out sessions are redirected to `/login`.

## Quality gates

Run the complete static and build gate:

```bash
npm run check
```

After starting the app, run the repeatable beta smoke gate against it:

```bash
npm run smoke
```

The smoke gate validates the international account-entry surfaces, protected-route redirects, PWA manifest and icons, and social preview images. It also runs in GitHub Actions against a production build.

To verify the currently deployed public app:

```bash
npm run smoke:production
```

These smoke checks deliberately use signed-out requests and never create, edit, or delete user data.

## Authenticated journey assurance

The Playwright journey signs in through the real Supabase Auth form and checks
the core workspace in desktop and mobile Chromium profiles. It is read-only: it
visits Home, Cards, Scanner, Grading, Cardshow, Transactions, Analytics and
Settings, then verifies that both card sides expose rear-camera and photo-library
inputs. It never creates, edits, identifies, uploads or deletes card data.

Use a dedicated, confirmed Supabase test account with one empty test collection
and no production collection data. Keep its credentials outside the repository:

```powershell
$env:E2E_EMAIL="test-account@example.com"
$env:E2E_PASSWORD="use-a-secret-password"
npm run e2e:install
npm run e2e:local
```

Run the same journey against the deployed app with:

```powershell
npm run e2e:production
```

GitHub's manually triggered `Authenticated journey` workflow uses repository
secrets named `E2E_EMAIL` and `E2E_PASSWORD`. Missing credentials fail clearly;
the suite never silently skips authentication.
