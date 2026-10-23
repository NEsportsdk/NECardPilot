-- Stripe subscription reconciliation and replay-safe webhook processing.
--
-- The application handles Stripe signatures before it reaches Supabase. These
-- tables and the invoker function are only available to service_role, keeping
-- provider writes outside the public/authenticated Data API surface.

alter table public.vallective_subscriptions
  add column provider_price_id text,
  add column cancel_at_period_end boolean not null default false,
  add column canceled_at timestamptz,
  add column latest_invoice_status text,
  add column last_provider_event_created_at timestamptz;

create unique index vallective_subscriptions_provider_customer_idx
  on public.vallective_subscriptions (provider, provider_customer_id)
  where provider_customer_id is not null;

create index vallective_subscriptions_plan_code_idx
  on public.vallective_subscriptions (plan_code);

create table public.vallective_billing_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  livemode boolean not null,
  status text not null default 'processing',
  attempt_count integer not null default 1,
  provider_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  primary key (provider, event_id),
  constraint vallective_billing_events_provider_check
    check (provider in ('stripe')),
  constraint vallective_billing_events_status_check
    check (status in ('processing', 'processed', 'failed', 'ignored')),
  constraint vallective_billing_events_attempt_count_check
    check (attempt_count > 0),
  constraint vallective_billing_events_error_check
    check (last_error is null or char_length(last_error) <= 500)
);

create index vallective_billing_events_status_received_idx
  on public.vallective_billing_events (status, received_at desc);

comment on table public.vallective_billing_events is
  'Replay protection and operational status for verified billing-provider webhook events.';

alter table public.vallective_billing_events enable row level security;

revoke all on table public.vallective_billing_events
  from public, anon, authenticated;

create or replace function public.sync_vallective_stripe_subscription(
  requested_user_id uuid,
  requested_plan_code text,
  requested_status text,
  requested_customer_id text,
  requested_subscription_id text,
  requested_price_id text,
  requested_period_start timestamptz,
  requested_period_end timestamptz,
  requested_cancel_at_period_end boolean,
  requested_canceled_at timestamptz,
  requested_invoice_status text,
  requested_event_created_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_subscription public.vallective_subscriptions%rowtype;
begin
  if requested_user_id is null
     or requested_plan_code not in ('collector', 'collector_plus')
     or requested_status not in ('active', 'trialing', 'past_due', 'paused', 'canceled')
     or nullif(btrim(requested_customer_id), '') is null
     or nullif(btrim(requested_subscription_id), '') is null
     or nullif(btrim(requested_price_id), '') is null
     or requested_period_start is null
     or requested_period_end is null
     or requested_period_end <= requested_period_start
     or requested_event_created_at is null then
    raise exception using
      message = 'Invalid Stripe subscription sync payload.',
      errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.vallective_plans plan
    where plan.code = requested_plan_code
      and plan.is_active
      and plan.is_public
      and plan.monthly_price_dkk_ore > 0
  ) then
    raise exception using
      message = 'Stripe plan is not available.',
      errcode = '22023';
  end if;

  select subscription.*
  into existing_subscription
  from public.vallective_subscriptions subscription
  where subscription.user_id = requested_user_id
  for update;

  if existing_subscription.user_id is not null
     and existing_subscription.provider = 'manual'
     and existing_subscription.plan_code = 'internal' then
    return 'ignored_internal';
  end if;

  if existing_subscription.user_id is not null
     and existing_subscription.provider = 'stripe'
     and existing_subscription.last_provider_event_created_at is not null
     and existing_subscription.last_provider_event_created_at > requested_event_created_at then
    return 'ignored_stale';
  end if;

  insert into public.vallective_subscriptions (
    user_id,
    plan_code,
    status,
    provider,
    provider_customer_id,
    provider_subscription_id,
    provider_price_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    canceled_at,
    latest_invoice_status,
    last_provider_event_created_at,
    updated_at
  )
  values (
    requested_user_id,
    requested_plan_code,
    requested_status,
    'stripe',
    btrim(requested_customer_id),
    btrim(requested_subscription_id),
    btrim(requested_price_id),
    requested_period_start,
    requested_period_end,
    coalesce(requested_cancel_at_period_end, false),
    requested_canceled_at,
    nullif(btrim(requested_invoice_status), ''),
    requested_event_created_at,
    now()
  )
  on conflict (user_id) do update
  set plan_code = excluded.plan_code,
      status = excluded.status,
      provider = excluded.provider,
      provider_customer_id = excluded.provider_customer_id,
      provider_subscription_id = excluded.provider_subscription_id,
      provider_price_id = excluded.provider_price_id,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      canceled_at = excluded.canceled_at,
      latest_invoice_status = excluded.latest_invoice_status,
      last_provider_event_created_at = excluded.last_provider_event_created_at,
      updated_at = now();

  return 'applied';
end;
$$;

revoke all on function public.sync_vallective_stripe_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.sync_vallective_stripe_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  text,
  timestamptz
) to service_role;
