create table public.beta_capture_endurance_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capture_session_id uuid not null,
  primary_device text not null,
  browser text not null,
  install_mode text not null,
  target_count smallint not null,
  captured_count smallint not null,
  uploaded_count smallint not null,
  failed_count smallint not null default 0,
  reload_verified boolean not null default false,
  offline_recovery_verified boolean not null default false,
  started_at timestamp with time zone not null,
  completed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint beta_capture_endurance_runs_user_session_key
    unique (user_id, capture_session_id),
  constraint beta_capture_endurance_runs_primary_device_check
    check (primary_device in ('iphone', 'android', 'desktop')),
  constraint beta_capture_endurance_runs_browser_check
    check (browser in ('safari', 'chrome', 'edge', 'other')),
  constraint beta_capture_endurance_runs_install_mode_check
    check (install_mode in ('browser', 'standalone')),
  constraint beta_capture_endurance_runs_target_count_check
    check (target_count in (10, 25, 50)),
  constraint beta_capture_endurance_runs_counts_check
    check (
      captured_count between target_count and 500
      and uploaded_count between target_count and captured_count
      and failed_count = 0
    ),
  constraint beta_capture_endurance_runs_recovery_check
    check (reload_verified and offline_recovery_verified),
  constraint beta_capture_endurance_runs_timeline_check
    check (completed_at >= started_at)
);

comment on table public.beta_capture_endurance_runs is
  'Privacy-conscious aggregate evidence that a real-device capture queue survived reload and offline recovery. No card data or device identifier is stored.';

alter table public.beta_capture_endurance_runs enable row level security;

revoke all on table public.beta_capture_endurance_runs from anon, authenticated;

grant select (
  id,
  user_id,
  capture_session_id,
  primary_device,
  browser,
  install_mode,
  target_count,
  captured_count,
  uploaded_count,
  failed_count,
  reload_verified,
  offline_recovery_verified,
  started_at,
  completed_at,
  created_at
) on table public.beta_capture_endurance_runs to authenticated;

grant insert (
  user_id,
  capture_session_id,
  primary_device,
  browser,
  install_mode,
  target_count,
  captured_count,
  uploaded_count,
  failed_count,
  reload_verified,
  offline_recovery_verified,
  started_at,
  completed_at
) on table public.beta_capture_endurance_runs to authenticated;

create policy "Users and beta admins can read capture endurance evidence"
on public.beta_capture_endurance_runs
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
      select 1
      from public.beta_feedback_admins
      where beta_feedback_admins.user_id = (select auth.uid())
  )
);

create policy "Users can add own capture endurance evidence"
on public.beta_capture_endurance_runs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create index beta_capture_endurance_runs_completed_at_idx
  on public.beta_capture_endurance_runs (completed_at desc, user_id);
