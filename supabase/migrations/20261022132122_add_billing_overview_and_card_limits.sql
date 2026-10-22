-- Expose one safe, authenticated billing overview and enforce the card
-- capacity attached to the effective Vallective plan at the database layer.

create or replace function public.get_vallective_billing_overview()
returns table (
  plan_code text,
  plan_name text,
  monthly_price_dkk_ore integer,
  subscription_status text,
  subscription_provider text,
  storage_card_limit integer,
  stored_card_count integer,
  identification_limit integer,
  identification_used integer,
  identification_remaining integer,
  valuation_limit integer,
  valuation_used integer,
  valuation_remaining integer,
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
  selected_monthly_price_dkk_ore integer;
  selected_subscription_status text;
  selected_subscription_provider text;
  selected_storage_card_limit integer;
  selected_identification_limit integer;
  selected_valuation_limit integer;
  selected_period_start timestamptz;
  selected_period_end timestamptz;
  selected_stored_card_count integer;
  selected_stored_image_count integer;
  selected_identification_used integer;
  selected_valuation_used integer;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  select
    plan.code,
    plan.display_name,
    plan.monthly_price_dkk_ore,
    subscription.status,
    subscription.provider,
    plan.storage_card_limit,
    plan.monthly_identification_limit,
    plan.monthly_valuation_limit,
    coalesce(subscription.current_period_start, date_trunc('month', now())),
    coalesce(subscription.current_period_end, date_trunc('month', now()) + interval '1 month')
  into
    selected_plan_code,
    selected_plan_name,
    selected_monthly_price_dkk_ore,
    selected_subscription_status,
    selected_subscription_provider,
    selected_storage_card_limit,
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
      plan.monthly_price_dkk_ore,
      'active'::text,
      null::text,
      plan.storage_card_limit,
      plan.monthly_identification_limit,
      plan.monthly_valuation_limit,
      date_trunc('month', now()),
      date_trunc('month', now()) + interval '1 month'
    into
      selected_plan_code,
      selected_plan_name,
      selected_monthly_price_dkk_ore,
      selected_subscription_status,
      selected_subscription_provider,
      selected_storage_card_limit,
      selected_identification_limit,
      selected_valuation_limit,
      selected_period_start,
      selected_period_end
    from public.vallective_plans plan
    where plan.code = 'free'
      and plan.is_active;
  end if;

  if selected_plan_code is null then
    raise exception using
      message = 'No active Vallective plan is available.',
      errcode = '55000';
  end if;

  select (
    (select count(*) from public.cards card where card.user_id = current_user_id)
    +
    (
      select count(*)
      from public.scan_capture_items capture
      where capture.user_id = current_user_id
        and capture.status <> 'saved'
    )
  )::integer
  into selected_stored_card_count
  ;

  select count(*)::integer
  into selected_stored_image_count
  from storage.objects object
  where object.bucket_id = 'card-images'
    and (storage.foldername(object.name))[1] = current_user_id::text;

  selected_stored_card_count := greatest(
    coalesce(selected_stored_card_count, 0),
    ceiling(coalesce(selected_stored_image_count, 0)::numeric / 2)::integer
  );

  select
    count(*) filter (
      where event.feature = 'card_identification'
    )::integer,
    count(*) filter (
      where event.feature = 'market_valuation'
    )::integer
  into
    selected_identification_used,
    selected_valuation_used
  from public.vallective_ai_usage_events event
  where event.user_id = current_user_id
    and event.status in ('reserved', 'completed')
    and event.reserved_at >= selected_period_start
    and event.reserved_at < selected_period_end;

  return query
  select
    selected_plan_code,
    selected_plan_name,
    selected_monthly_price_dkk_ore,
    selected_subscription_status,
    selected_subscription_provider,
    selected_storage_card_limit,
    coalesce(selected_stored_card_count, 0),
    selected_identification_limit,
    coalesce(selected_identification_used, 0),
    case
      when selected_identification_limit is null then null
      else greatest(
        selected_identification_limit - coalesce(selected_identification_used, 0),
        0
      )
    end,
    selected_valuation_limit,
    coalesce(selected_valuation_used, 0),
    case
      when selected_valuation_limit is null then null
      else greatest(
        selected_valuation_limit - coalesce(selected_valuation_used, 0),
        0
      )
    end,
    selected_period_start,
    selected_period_end;
end;
$$;

revoke all on function public.get_vallective_billing_overview()
  from public, anon, authenticated;

grant execute on function public.get_vallective_billing_overview()
  to authenticated;

create or replace function private.enforce_vallective_card_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_plan_code text;
  selected_storage_card_limit integer;
  stored_card_count integer;
begin
  if new.user_id is null then
    raise exception using
      message = 'A card owner is required.',
      errcode = '23502';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vallective-card-limit:' || new.user_id::text, 0)
  );

  select
    plan.code,
    plan.storage_card_limit
  into
    selected_plan_code,
    selected_storage_card_limit
  from public.vallective_subscriptions subscription
  join public.vallective_plans plan
    on plan.code = subscription.plan_code
   and plan.is_active
  where subscription.user_id = new.user_id
    and subscription.status in ('active', 'trialing')
  limit 1;

  if selected_plan_code is null then
    select
      plan.code,
      plan.storage_card_limit
    into
      selected_plan_code,
      selected_storage_card_limit
    from public.vallective_plans plan
    where plan.code = 'free'
      and plan.is_active;
  end if;

  if selected_plan_code is null then
    raise exception using
      message = 'No active Vallective plan is available.',
      errcode = '55000';
  end if;

  if selected_storage_card_limit is null then
    return new;
  end if;

  select count(*)::integer
  into stored_card_count
  from public.cards card
  where card.user_id = new.user_id;

  if stored_card_count >= selected_storage_card_limit then
    raise exception using
      message = 'VALLECTIVE_CARD_LIMIT_REACHED',
      detail = pg_catalog.format(
        'Plan %s allows %s stored cards.',
        selected_plan_code,
        selected_storage_card_limit
      ),
      hint = 'Upgrade the Vallective plan or remove an existing card before adding another.',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_vallective_card_limit()
  from public, anon, authenticated;

drop trigger if exists enforce_vallective_card_limit
on public.cards;

create trigger enforce_vallective_card_limit
before insert on public.cards
for each row
execute function private.enforce_vallective_card_limit();

create or replace function private.enforce_vallective_capture_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_plan_code text;
  selected_storage_card_limit integer;
  occupied_card_slots integer;
begin
  if new.user_id is null then
    raise exception using
      message = 'A capture owner is required.',
      errcode = '23502';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vallective-card-limit:' || new.user_id::text, 0)
  );

  select
    plan.code,
    plan.storage_card_limit
  into
    selected_plan_code,
    selected_storage_card_limit
  from public.vallective_subscriptions subscription
  join public.vallective_plans plan
    on plan.code = subscription.plan_code
   and plan.is_active
  where subscription.user_id = new.user_id
    and subscription.status in ('active', 'trialing')
  limit 1;

  if selected_plan_code is null then
    select
      plan.code,
      plan.storage_card_limit
    into
      selected_plan_code,
      selected_storage_card_limit
    from public.vallective_plans plan
    where plan.code = 'free'
      and plan.is_active;
  end if;

  if selected_plan_code is null then
    raise exception using
      message = 'No active Vallective plan is available.',
      errcode = '55000';
  end if;

  if selected_storage_card_limit is null then
    return new;
  end if;

  select (
    (select count(*) from public.cards card where card.user_id = new.user_id)
    +
    (
      select count(*)
      from public.scan_capture_items capture
      where capture.user_id = new.user_id
        and capture.status <> 'saved'
    )
  )::integer
  into occupied_card_slots;

  if occupied_card_slots >= selected_storage_card_limit then
    raise exception using
      message = 'VALLECTIVE_CARD_LIMIT_REACHED',
      detail = pg_catalog.format(
        'Plan %s allows %s stored or queued cards.',
        selected_plan_code,
        selected_storage_card_limit
      ),
      hint = 'Upgrade the Vallective plan or remove an existing card or queued capture before adding another.',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_vallective_capture_limit()
  from public, anon, authenticated;

drop trigger if exists enforce_vallective_capture_limit
on public.scan_capture_items;

create trigger enforce_vallective_capture_limit
before insert on public.scan_capture_items
for each row
execute function private.enforce_vallective_capture_limit();

create or replace function private.vallective_card_image_capacity_available(
  requested_owner_id_text text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  requested_owner_id uuid;
  selected_plan_code text;
  selected_storage_card_limit integer;
  stored_image_count integer;
begin
  if current_user_id is null
     or requested_owner_id_text is null
     or requested_owner_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  requested_owner_id := requested_owner_id_text::uuid;

  if requested_owner_id <> current_user_id
     and not exists (
       select 1
       from public.vallective_workspaces workspace
       where workspace.owner_user_id = requested_owner_id
         and workspace.status = 'active'
         and private.can_manage_vallective_workspace_capability(
           workspace.id,
           'inventory'
         )
     ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'vallective-card-images:' || requested_owner_id::text,
      0
    )
  );

  select
    plan.code,
    plan.storage_card_limit
  into
    selected_plan_code,
    selected_storage_card_limit
  from public.vallective_subscriptions subscription
  join public.vallective_plans plan
    on plan.code = subscription.plan_code
   and plan.is_active
  where subscription.user_id = requested_owner_id
    and subscription.status in ('active', 'trialing')
  limit 1;

  if selected_plan_code is null then
    select
      plan.code,
      plan.storage_card_limit
    into
      selected_plan_code,
      selected_storage_card_limit
    from public.vallective_plans plan
    where plan.code = 'free'
      and plan.is_active;
  end if;

  if selected_plan_code is null then
    return false;
  end if;

  if selected_storage_card_limit is null then
    return true;
  end if;

  select count(*)::integer
  into stored_image_count
  from storage.objects object
  where object.bucket_id = 'card-images'
    and (storage.foldername(object.name))[1] = requested_owner_id_text;

  return stored_image_count < (selected_storage_card_limit * 2);
end;
$$;

revoke all on function private.vallective_card_image_capacity_available(text)
  from public, anon, authenticated;

grant execute on function private.vallective_card_image_capacity_available(text)
  to authenticated;

drop policy if exists "Vallective plan limits stored card images"
on storage.objects;

create policy "Vallective plan limits stored card images"
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'card-images'
  or private.vallective_card_image_capacity_available(
    (storage.foldername(name))[1]
  )
);
