create table public.beta_pilot_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending',
  send_attempts smallint not null default 1,
  resend_email_id text,
  last_error_code text,
  consent_confirmed_at timestamp with time zone not null,
  invited_by uuid references auth.users(id) on delete set null,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint beta_pilot_invitations_email_check
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
      and email !~ '[[:space:]]'
    ),
  constraint beta_pilot_invitations_status_check
    check (status in ('pending', 'sent', 'failed')),
  constraint beta_pilot_invitations_send_attempts_check
    check (send_attempts between 1 and 20),
  constraint beta_pilot_invitations_resend_email_id_check
    check (
      resend_email_id is null
      or char_length(resend_email_id) between 1 and 128
    ),
  constraint beta_pilot_invitations_last_error_code_check
    check (
      last_error_code is null
      or char_length(last_error_code) between 1 and 128
    ),
  constraint beta_pilot_invitations_delivery_state_check
    check (
      (
        status = 'pending'
        and resend_email_id is null
        and last_error_code is null
        and sent_at is null
      )
      or (
        status = 'sent'
        and resend_email_id is not null
        and last_error_code is null
        and sent_at is not null
      )
      or (
        status = 'failed'
        and resend_email_id is null
        and last_error_code is not null
        and sent_at is null
      )
    )
);

comment on table public.beta_pilot_invitations is
  'Admin-only audit trail for consented, one-to-one Vallective private beta invitations.';

comment on column public.beta_pilot_invitations.email is
  'Normalized invitation recipient address. This is restricted pilot operations data.';

comment on column public.beta_pilot_invitations.status is
  'Sending state only. Sent means the email provider accepted the request, not that the recipient opened it.';

alter table public.beta_pilot_invitations enable row level security;

revoke all on table public.beta_pilot_invitations from anon, authenticated;

grant select (
  id,
  email,
  status,
  send_attempts,
  resend_email_id,
  last_error_code,
  consent_confirmed_at,
  invited_by,
  sent_at,
  created_at,
  updated_at
) on table public.beta_pilot_invitations to authenticated;

grant insert (
  email,
  consent_confirmed_at,
  invited_by,
  send_attempts
) on table public.beta_pilot_invitations to authenticated;

grant update (
  status,
  send_attempts,
  resend_email_id,
  last_error_code,
  sent_at,
  updated_at
) on table public.beta_pilot_invitations to authenticated;

create policy "Beta admins can read pilot invitations"
on public.beta_pilot_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);

create policy "Beta admins can create consented pilot invitations"
on public.beta_pilot_invitations
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and status = 'pending'
  and send_attempts = 1
  and resend_email_id is null
  and last_error_code is null
  and sent_at is null
  and consent_confirmed_at <= now()
  and consent_confirmed_at >= now() - interval '15 minutes'
  and exists (
    select 1
    from public.beta_feedback_admins
    where beta_feedback_admins.user_id = (select auth.uid())
  )
);

create policy "Beta admins can update pilot invitation delivery"
on public.beta_pilot_invitations
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

create index beta_pilot_invitations_created_at_idx
  on public.beta_pilot_invitations (created_at desc, id desc);

create index beta_pilot_invitations_invited_by_idx
  on public.beta_pilot_invitations (invited_by)
  where invited_by is not null;
