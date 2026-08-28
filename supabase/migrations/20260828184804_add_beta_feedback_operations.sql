create table public.beta_feedback_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamp with time zone not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

comment on table public.beta_feedback_admins is
  'Explicit membership for the private Vallective beta feedback operations queue.';

alter table public.beta_feedback_admins enable row level security;

revoke all on table public.beta_feedback_admins from anon, authenticated;

grant select (user_id)
on table public.beta_feedback_admins
to authenticated;

create policy "Admins can verify own beta feedback membership"
on public.beta_feedback_admins
for select
to authenticated
using ((select auth.uid()) = user_id);

alter table public.beta_feedback
  add column contact_email text,
  add column priority text not null default 'normal',
  add column internal_note text,
  add column reviewed_at timestamp with time zone,
  add column updated_at timestamp with time zone not null default now(),
  add constraint beta_feedback_contact_email_length_check
    check (contact_email is null or char_length(contact_email) between 3 and 320),
  add constraint beta_feedback_priority_check
    check (priority in ('low', 'normal', 'high', 'critical')),
  add constraint beta_feedback_internal_note_length_check
    check (internal_note is null or char_length(internal_note) <= 2000);

drop index if exists public.beta_feedback_status_created_at_idx;

create index beta_feedback_status_created_at_idx
  on public.beta_feedback (status, created_at desc, id desc);

create index beta_feedback_priority_created_at_idx
  on public.beta_feedback (priority, created_at desc, id desc);

drop policy if exists "Users can submit own beta feedback"
on public.beta_feedback;

grant insert (contact_email)
on table public.beta_feedback
to authenticated;

grant select (
  id,
  user_id,
  category,
  experience_rating,
  message,
  page_path,
  screen_class,
  language,
  is_online,
  is_standalone,
  allow_follow_up,
  contact_email,
  status,
  priority,
  internal_note,
  reviewed_at,
  created_at,
  updated_at
) on table public.beta_feedback to authenticated;

grant update (
  status,
  priority,
  internal_note,
  reviewed_at,
  updated_at
) on table public.beta_feedback to authenticated;

create policy "Users can submit own beta feedback"
on public.beta_feedback
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'new'
  and priority = 'normal'
  and internal_note is null
  and reviewed_at is null
  and (
    contact_email is null
    or contact_email = nullif((select auth.jwt()) ->> 'email', '')
  )
  and (allow_follow_up or contact_email is null)
);

create policy "Beta feedback admins can read the queue"
on public.beta_feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);

create policy "Beta feedback admins can update workflow fields"
on public.beta_feedback
for update
to authenticated
using (
  exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);
