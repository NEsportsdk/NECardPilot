create table public.beta_pilot_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_device text not null,
  browser text not null,
  install_mode text not null,
  completed_steps smallint[] not null default '{}'::smallint[],
  joined_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint beta_pilot_primary_device_check
    check (primary_device in ('iphone', 'android', 'desktop')),
  constraint beta_pilot_browser_check
    check (browser in ('safari', 'chrome', 'edge', 'other')),
  constraint beta_pilot_install_mode_check
    check (install_mode in ('browser', 'standalone')),
  constraint beta_pilot_completed_steps_count_check
    check (cardinality(completed_steps) <= 10),
  constraint beta_pilot_completed_steps_values_check
    check (
      completed_steps <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::smallint[]
    )
);

comment on table public.beta_pilot_participants is
  'Privacy-conscious device coverage and journey progress for the Vallective private beta pilot.';

alter table public.beta_pilot_participants enable row level security;

revoke all on table public.beta_pilot_participants from anon, authenticated;

grant select (
  user_id,
  primary_device,
  browser,
  install_mode,
  completed_steps,
  joined_at,
  updated_at
) on table public.beta_pilot_participants to authenticated;

grant insert (
  user_id,
  primary_device,
  browser,
  install_mode,
  completed_steps,
  updated_at
) on table public.beta_pilot_participants to authenticated;

grant update (
  primary_device,
  browser,
  install_mode,
  completed_steps,
  updated_at
) on table public.beta_pilot_participants to authenticated;

create policy "Users can read own beta pilot progress"
on public.beta_pilot_participants
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Beta admins can read pilot progress"
on public.beta_pilot_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);

create policy "Users can join the beta pilot"
on public.beta_pilot_participants
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own beta pilot progress"
on public.beta_pilot_participants
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index beta_pilot_participants_updated_at_idx
  on public.beta_pilot_participants (updated_at desc, user_id);
