create table public.beta_pilot_coverage_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_device text not null,
  browser text not null,
  install_mode text not null,
  first_verified_at timestamp with time zone not null default now(),
  last_verified_at timestamp with time zone not null default now(),
  primary key (user_id, primary_device, browser, install_mode),
  constraint beta_pilot_coverage_primary_device_check
    check (primary_device in ('iphone', 'android', 'desktop')),
  constraint beta_pilot_coverage_browser_check
    check (browser in ('safari', 'chrome', 'edge', 'other')),
  constraint beta_pilot_coverage_install_mode_check
    check (install_mode in ('browser', 'standalone')),
  constraint beta_pilot_coverage_verified_at_check
    check (last_verified_at >= first_verified_at)
);

comment on table public.beta_pilot_coverage_checks is
  'Minimal, privacy-conscious evidence of completed real-device beta journeys. One account can preserve several verified device contexts.';

alter table public.beta_pilot_coverage_checks enable row level security;

revoke all on table public.beta_pilot_coverage_checks from anon, authenticated;

grant select (
  user_id,
  primary_device,
  browser,
  install_mode,
  first_verified_at,
  last_verified_at
) on table public.beta_pilot_coverage_checks to authenticated;

grant insert (
  user_id,
  primary_device,
  browser,
  install_mode,
  first_verified_at,
  last_verified_at
) on table public.beta_pilot_coverage_checks to authenticated;

grant update (last_verified_at)
on table public.beta_pilot_coverage_checks to authenticated;

create policy "Users can read own beta pilot coverage"
on public.beta_pilot_coverage_checks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Beta feedback admins can read pilot coverage"
on public.beta_pilot_coverage_checks
for select
to authenticated
using (
  exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);

create policy "Users can insert own beta pilot coverage"
on public.beta_pilot_coverage_checks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can refresh own beta pilot coverage"
on public.beta_pilot_coverage_checks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index beta_pilot_coverage_checks_last_verified_at_idx
  on public.beta_pilot_coverage_checks (last_verified_at desc, user_id);

create or replace function public.capture_beta_pilot_coverage_check()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if cardinality(new.completed_steps) = 10 then
    insert into public.beta_pilot_coverage_checks (
      user_id,
      primary_device,
      browser,
      install_mode,
      first_verified_at,
      last_verified_at
    )
    values (
      new.user_id,
      new.primary_device,
      new.browser,
      new.install_mode,
      new.updated_at,
      new.updated_at
    )
    on conflict (user_id, primary_device, browser, install_mode)
    do update set
      last_verified_at = excluded.last_verified_at;
  end if;

  return new;
end;
$function$;

revoke execute on function public.capture_beta_pilot_coverage_check()
from public, anon, authenticated;

create trigger capture_beta_pilot_coverage_check
after insert or update of completed_steps, primary_device, browser, install_mode
on public.beta_pilot_participants
for each row
execute function public.capture_beta_pilot_coverage_check();

insert into public.beta_pilot_coverage_checks (
  user_id,
  primary_device,
  browser,
  install_mode,
  first_verified_at,
  last_verified_at
)
select
  user_id,
  primary_device,
  browser,
  install_mode,
  updated_at,
  updated_at
from public.beta_pilot_participants
where cardinality(completed_steps) = 10
on conflict (user_id, primary_device, browser, install_mode)
do nothing;
