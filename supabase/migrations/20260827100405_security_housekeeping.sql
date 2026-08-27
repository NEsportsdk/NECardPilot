-- Remove the original connectivity-test surface and ensure future functions
-- never inherit Postgres' default EXECUTE privilege for PUBLIC. Application
-- RPCs must continue to opt authenticated users in explicitly.

begin;

drop table if exists public.test;

alter default privileges for role postgres in schema public
revoke execute on functions from public;

commit;
