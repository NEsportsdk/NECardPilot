# Vallective V2 integration status

Status: implemented, validated and approved for production release.

## Integrated surfaces

- Shared React `VallectiveMark` component.
- Login, signup and account-recovery shell.
- Welcome, loading and change-password screens.
- Application sidebar and PWA installation card.
- Next.js browser icon, Apple icon and favicon.
- PWA 192, 512 and maskable icon assets.
- Open Graph and Twitter fallback artwork.
- React Email private-beta invitation and its hosted PNG mark.
- Geist is now the explicit primary application font via the existing
  `next/font` variables.

## Social launch package

Three 1080×1350 brand-led Instagram posts and matching English captions are in
`docs/brand/social/instagram-launch/`. They do not publish anything and do not
move the existing Valerie portrait into source control.

## Validation

- TypeScript: passed.
- ESLint: passed.
- Vitest: 17 files and 86 tests passed.
- Next.js production build: passed, 42 routes generated.
- Local browser check: login loaded with meaningful content and no framework
  error overlay.
- Open Graph artwork: visually checked.
- React Email HTML: rendered with the 128 px PNG mark, visually checked and
  verified without an error overlay.
- SVG and PNG brand masters: validated separately in the brand package.

## Deployment boundary

The production email points to
`https://vallective.com/icons/vallective-email-mark.png`. The hosted asset and
the email template must ship in the same release. Git and Vercel retain the
deployment record.
