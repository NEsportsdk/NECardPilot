-- Subscription-shaped AI allowances and atomic usage reservations.
--
-- The application can enforce safe monthly AI limits before a billing
-- provider is connected. Existing active business workspace members are
-- deliberately grandfathered onto the internal plan; future public users
-- fall back to the free plan unless a subscription is assigned explicitly.

create table public.vallective_plans (
  code text primary key,
  display_name text not null,
  monthly_price_dkk_ore integer not null default 0,
  monthly_identification_limit integer,
  monthly_valuation_limit integer,
  storage_card_limit integer,
  is_public boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vallective_plans_code_check
    check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint vallective_plans_display_name_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint vallective_plans_price_check
    check (monthly_price_dkk_ore >= 0),
  constraint vallective_plans_identification_limit_check
    check (monthly_identification_limit is null or monthly_identification_limit >= 0),
  constraint vallective_plans_valuation_limit_check
    check (monthly_valuation_limit is null or monthly_valuation_limit >= 0),
  constraint vallective_plans_storage_limit_check
    check (storage_card_limit is null or storage_card_limit >= 0)
);

insert into public.vallective_plans (
  code,
  display_name,
  monthly_price_dkk_ore,
  monthly_identification_limit,
  monthly_valuation_limit,
  storage_card_limit,
  is_public
)
values
  ('free', 'Free', 0, 5, 2, 100, true),
  ('collector', 'Collector', 9900, 25, 5, 2000, true),
  ('collector_plus', 'Collector Plus', 19900, 60, 15, 10000, true),
  ('internal', 'Vallective Internal', 0, 250, 10, 50000, false);

comment on table public.vallective_plans is
  'Server-authoritative plan catalogue. Null limits remain available only for explicitly administrator-assigned uncapped plans.';

create table public.vallective_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null references public.vallective_plans(code) on delete restrict,
  status text not null default 'active',
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vallective_subscriptions_status_check
    check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  constraint vallective_subscriptions_provider_check
    check (provider in ('manual', 'stripe', 'shopify')),
  constraint vallective_subscriptions_period_check
    check (
      (current_period_start is null and current_period_end is null)
      or (
        current_period_start is not null
        and current_period_end is not null
        and current_period_end > current_period_start
      )
    )
);

create unique index vallective_subscriptions_provider_subscription_idx
  on public.vallective_subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

comment on table public.vallective_subscriptions is
  'Current plan entitlement per user. Provider columns are ready for a later billing integration.';

create table public.vallective_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.vallective_workspaces(id) on delete restrict,
  feature text not null,
  idempotency_key text not null,
  status text not null default 'reserved',
  estimated_cost_usd numeric(12, 6),
  failure_code text,
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vallective_ai_usage_feature_check
    check (feature in ('card_identification', 'market_valuation')),
  constraint vallective_ai_usage_idempotency_key_check
    check (char_length(btrim(idempotency_key)) between 1 and 200),
  constraint vallective_ai_usage_status_check
    check (status in ('reserved', 'completed', 'failed')),
  constraint vallective_ai_usage_cost_check
    check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  unique (user_id, feature, idempotency_key)
);

create index vallective_ai_usage_user_feature_period_idx
  on public.vallective_ai_usage_events (user_id, feature, reserved_at desc)
  where status in ('reserved', 'completed');

create index vallective_ai_usage_workspace_idx
  on public.vallective_ai_usage_events (workspace_id, created_at desc);

comment on table public.vallective_ai_usage_events is
  'Atomic reservations and completed AI usage. Reservations count against quota before an external AI call starts.';

insert into public.vallective_subscriptions (
  user_id,
  plan_code,
  status,
  provider
)
select distinct
  membership.user_id,
  'internal',
  'active',
  'manual'
from public.vallective_workspace_memberships membership
join public.vallective_workspaces workspace
  on workspace.id = membership.workspace_id
where workspace.kind = 'business'
  and workspace.status = 'active'
  and membership.status = 'active'
on conflict (user_id) do nothing;

create or replace function public.get_vallective_ai_allowance()
returns table (
  feature text,
  plan_code text,
  plan_name text,
  monthly_limit integer,
  used integer,
  remaining integer,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_plan_code text;
  selected_plan_name text;
  selected_identification_limit integer;
  selected_valuation_limit integer;
  selected_period_start timestamptz;
  selected_period_end timestamptz;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  select plan.code,
         plan.display_name,
         plan.monthly_identification_limit,
         plan.monthly_valuation_limit,
         coalesce(subscription.current_period_start, date_trunc('month', now())),
         coalesce(subscription.current_period_end, date_trunc('month', now()) + interval '1 month')
  into selected_plan_code,
       selected_plan_name,
       selected_identification_limit,
       selected_valuation_limit,
       selected_period_start,
       selected_period_end
  from public.vallective_subscriptions subscription
  join public.vallective_plans plan
    on plan.code = subscription.plan_code
   and plan.is_active
  where subscription.user_id = current_user_id
    and subscription.status in ('active', 'trialing')
  limit 1;

  if selected_plan_code is null then
    select
      plan.code,
      plan.display_name,
      plan.monthly_identification_limit,
      plan.monthly_valuation_limit
    into
      selected_plan_code,
      selected_plan_name,
      selected_identification_limit,
      selected_valuation_limit
    from public.vallective_plans plan
    where plan.code = 'free'
      and plan.is_active;

    selected_period_start := date_trunc('month', now());
    selected_period_end := selected_period_start + interval '1 month';
  end if;

  return query
  with features as (
    select
      'card_identification'::text as feature_name,
      selected_identification_limit as feature_limit
    union all
    select
      'market_valuation'::text,
      selected_valuation_limit
  ), usage_counts as (
    select
      event.feature as feature_name,
      count(*)::integer as used_count
    from public.vallective_ai_usage_events event
    where event.user_id = current_user_id
      and event.status in ('reserved', 'completed')
      and event.reserved_at >= selected_period_start
      and event.reserved_at < selected_period_end
    group by event.feature
  )
  select
    features.feature_name,
    selected_plan_code,
    selected_plan_name,
    features.feature_limit,
    coalesce(usage_counts.used_count, 0),
    case
      when features.feature_limit is null then null
      else greatest(features.feature_limit - coalesce(usage_counts.used_count, 0), 0)
    end,
    selected_period_start,
    selected_period_end
  from features
  left join usage_counts
    on usage_counts.feature_name = features.feature_name;
end;
$$;

create or replace function public.reserve_vallective_ai_usage(
  requested_feature text,
  requested_workspace_id uuid,
  requested_idempotency_key text
)
returns table (
  reservation_id uuid,
  allowed boolean,
  reason text,
  reservation_state text,
  plan_code text,
  plan_name text,
  monthly_limit integer,
  used integer,
  remaining integer,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_plan_code text;
  selected_plan_name text;
  selected_identification_limit integer;
  selected_valuation_limit integer;
  selected_period_start timestamptz;
  selected_period_end timestamptz;
  selected_limit integer;
  current_used integer;
  existing_event public.vallective_ai_usage_events%rowtype;
  next_reservation_id uuid;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  if requested_feature not in ('card_identification', 'market_valuation') then
    raise exception using message = 'Unsupported AI feature.', errcode = '22023';
  end if;

  if requested_workspace_id is null
     or not private.can_access_vallective_workspace(requested_workspace_id) then
    raise exception using message = 'Workspace not found or access denied.', errcode = '42501';
  end if;

  if requested_idempotency_key is null
     or char_length(btrim(requested_idempotency_key)) not between 1 and 200 then
    raise exception using message = 'A valid idempotency key is required.', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  update public.vallective_ai_usage_events event
  set status = 'failed',
      failure_code = 'reservation_timeout',
      failed_at = now(),
      updated_at = now()
  where event.user_id = current_user_id
    and event.status = 'reserved'
    and event.reserved_at < now() - interval '15 minutes';

  select event.*
  into existing_event
  from public.vallective_ai_usage_events event
  where event.user_id = current_user_id
    and event.feature = requested_feature
    and event.idempotency_key = btrim(requested_idempotency_key)
  for update;

  if existing_event.id is not null and existing_event.status = 'reserved' then
    return query
    select
      existing_event.id,
      false,
      'in_progress'::text,
      'existing_reserved'::text,
      null::text,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  if existing_event.id is not null and existing_event.status = 'completed' then
    return query
    select
      existing_event.id,
      false,
      'already_completed'::text,
      'existing_completed'::text,
      null::text,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  select plan.code,
         plan.display_name,
         plan.monthly_identification_limit,
         plan.monthly_valuation_limit,
         coalesce(subscription.current_period_start, date_trunc('month', now())),
         coalesce(subscription.current_period_end, date_trunc('month', now()) + interval '1 month')
  into selected_plan_code,
       selected_plan_name,
       selected_identification_limit,
       selected_valuation_limit,
       selected_period_start,
       selected_period_end
  from public.vallective_subscriptions subscription
  join public.vallective_plans plan
    on plan.code = subscription.plan_code
   and plan.is_active
  where subscription.user_id = current_user_id
    and subscription.status in ('active', 'trialing')
  limit 1;

  if selected_plan_code is null then
    select
      plan.code,
      plan.display_name,
      plan.monthly_identification_limit,
      plan.monthly_valuation_limit
    into
      selected_plan_code,
      selected_plan_name,
      selected_identification_limit,
      selected_valuation_limit
    from public.vallective_plans plan
    where plan.code = 'free'
      and plan.is_active;

    selected_period_start := date_trunc('month', now());
    selected_period_end := selected_period_start + interval '1 month';
  end if;

  selected_limit := case requested_feature
    when 'card_identification' then selected_identification_limit
    when 'market_valuation' then selected_valuation_limit
  end;

  select count(*)::integer
  into current_used
  from public.vallective_ai_usage_events event
  where event.user_id = current_user_id
    and event.feature = requested_feature
    and event.status in ('reserved', 'completed')
    and event.reserved_at >= selected_period_start
    and event.reserved_at < selected_period_end;

  if selected_limit is not null and current_used >= selected_limit then
    return query
    select
      null::uuid,
      false,
      'limit_reached'::text,
      'not_created'::text,
      selected_plan_code,
      selected_plan_name,
      selected_limit,
      current_used,
      0,
      selected_period_start,
      selected_period_end;
    return;
  end if;

  if existing_event.id is not null then
    update public.vallective_ai_usage_events event
    set workspace_id = requested_workspace_id,
        status = 'reserved',
        estimated_cost_usd = null,
        failure_code = null,
        reserved_at = now(),
        completed_at = null,
        failed_at = null,
        updated_at = now()
    where event.id = existing_event.id
    returning event.id into next_reservation_id;
  else
    insert into public.vallective_ai_usage_events (
      user_id,
      workspace_id,
      feature,
      idempotency_key
    )
    values (
      current_user_id,
      requested_workspace_id,
      requested_feature,
      btrim(requested_idempotency_key)
    )
    returning id into next_reservation_id;
  end if;

  return query
  select
    next_reservation_id,
    true,
    'reserved'::text,
    'created'::text,
    selected_plan_code,
    selected_plan_name,
    selected_limit,
    current_used + 1,
    case
      when selected_limit is null then null
      else greatest(selected_limit - current_used - 1, 0)
    end,
    selected_period_start,
    selected_period_end;
end;
$$;

create or replace function public.complete_vallective_ai_usage(
  requested_reservation_id uuid,
  requested_estimated_cost_usd numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  if requested_estimated_cost_usd is not null and requested_estimated_cost_usd < 0 then
    raise exception using message = 'Estimated cost cannot be negative.', errcode = '22023';
  end if;

  update public.vallective_ai_usage_events event
  set status = 'completed',
      estimated_cost_usd = requested_estimated_cost_usd,
      failure_code = null,
      completed_at = now(),
      failed_at = null,
      updated_at = now()
  where event.id = requested_reservation_id
    and event.user_id = current_user_id
    and event.status = 'reserved';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function public.fail_vallective_ai_usage(
  requested_reservation_id uuid,
  requested_failure_code text default 'request_failed'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  update public.vallective_ai_usage_events event
  set status = 'failed',
      failure_code = left(coalesce(nullif(btrim(requested_failure_code), ''), 'request_failed'), 120),
      failed_at = now(),
      completed_at = null,
      updated_at = now()
  where event.id = requested_reservation_id
    and event.user_id = current_user_id
    and event.status = 'reserved';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

alter table public.vallective_plans enable row level security;
alter table public.vallective_subscriptions enable row level security;
alter table public.vallective_ai_usage_events enable row level security;

revoke all on table public.vallective_plans from public, anon, authenticated;
revoke all on table public.vallective_subscriptions from public, anon, authenticated;
revoke all on table public.vallective_ai_usage_events from public, anon, authenticated;

grant select on table public.vallective_plans to authenticated;
grant select on table public.vallective_subscriptions to authenticated;
grant select on table public.vallective_ai_usage_events to authenticated;

create policy "Authenticated users can view active public plans"
on public.vallective_plans
for select
to authenticated
using (is_active and is_public);

create policy "Users can view own subscription"
on public.vallective_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can view own AI usage"
on public.vallective_ai_usage_events
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on function public.get_vallective_ai_allowance()
  from public, anon, authenticated;
revoke all on function public.reserve_vallective_ai_usage(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_vallective_ai_usage(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.fail_vallective_ai_usage(uuid, text)
  from public, anon, authenticated;

grant execute on function public.get_vallective_ai_allowance()
  to authenticated;
grant execute on function public.reserve_vallective_ai_usage(text, uuid, text)
  to authenticated;
grant execute on function public.complete_vallective_ai_usage(uuid, numeric)
  to authenticated;
grant execute on function public.fail_vallective_ai_usage(uuid, text)
  to authenticated;
