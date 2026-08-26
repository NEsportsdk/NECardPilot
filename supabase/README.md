# Supabase workflow

Migrations in this directory are local source control for the NECardPilot
database. They are not applied automatically to the connected live project.

## Current files

- `20260826221238_baseline_remote_schema.sql` is a schema-only snapshot captured
  read-only from project `yglecdgndfctltmuekju`.
- `20260826221502_harden_security_and_rls.sql` contains proposed security and
  performance hardening based on the Supabase advisors. It has not been applied
  to the live project.

The baseline intentionally includes the current schema state before hardening so
a new local database can reproduce both steps in order.

## Local verification

Install and start Docker Desktop, then run from the repository root:

```powershell
npx --yes supabase@latest start
npx --yes supabase@latest db reset
npx --yes supabase@latest db lint
```

Do not run `db push`, `migration up --linked`, or apply the hardening migration
to a remote project without explicit approval and a reviewed backup plan.
