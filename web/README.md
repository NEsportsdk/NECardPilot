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
