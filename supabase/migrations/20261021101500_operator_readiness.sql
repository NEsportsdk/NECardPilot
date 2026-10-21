-- Workspace-safe operator flows for Vallective purchases, grading and cardshows.
--
-- Existing operational functions contain the mature validation and accounting
-- logic. The workspace wrappers below add capability checks, tenant boundaries,
-- audit events and a concurrency-safe monthly purchase budget before delegating
-- to those functions.

alter table public.purchase_lots
  add column created_by_user_id uuid references auth.users(id) on delete restrict;

update public.purchase_lots
set created_by_user_id = user_id
where created_by_user_id is null;

alter table public.purchase_lots
  alter column created_by_user_id set not null;

create index purchase_lots_workspace_actor_month_idx
  on public.purchase_lots (workspace_id, created_by_user_id, purchased_at desc)
  where status <> 'cancelled';

comment on column public.purchase_lots.created_by_user_id is
  'Authenticated operator who created the purchase lot. Used for member budget enforcement and auditability.';

create or replace function private.activate_vallective_operation_context(
  requested_workspace_id uuid,
  requested_capability text
)
returns table (
  actor_user_id uuid,
  data_owner_user_id uuid,
  base_currency text,
  can_approve_over_budget_purchases boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor_user_id uuid := auth.uid();
  original_claims text := current_setting('request.jwt.claims', true);
  original_sub text := current_setting('request.jwt.claim.sub', true);
  delegated_claims jsonb;
begin
  if current_actor_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  if requested_workspace_id is null then
    raise exception using message = 'Workspace is required.', errcode = '42501';
  end if;

  return query
  select
    current_actor_user_id,
    workspace.owner_user_id,
    workspace.base_currency,
    membership.can_approve_over_budget_purchases
  from public.vallective_workspace_memberships membership
  join public.vallective_workspaces workspace
    on workspace.id = membership.workspace_id
   and workspace.status = 'active'
  where membership.workspace_id = requested_workspace_id
    and membership.user_id = current_actor_user_id
    and membership.status = 'active'
    and case requested_capability
      when 'inventory' then membership.can_manage_inventory
      when 'sales' then membership.can_manage_sales
      when 'grading' then membership.can_manage_grading
      when 'cardshows' then membership.can_manage_cardshows
      when 'purchases' then membership.can_manage_purchases_within_budget
      when 'team' then membership.can_manage_team
      when 'delete_inventory' then membership.can_delete_inventory
      else false
    end;

  if not found then
    raise exception
      using message = 'You do not have permission for this workspace operation.',
            errcode = '42501';
  end if;

  perform set_config(
    'vallective.original_request_jwt_claims',
    coalesce(original_claims, ''),
    true
  );
  perform set_config(
    'vallective.original_request_jwt_sub',
    coalesce(original_sub, ''),
    true
  );
  perform set_config(
    'vallective.workspace_id',
    requested_workspace_id::text,
    true
  );
  perform set_config(
    'vallective.actor_user_id',
    current_actor_user_id::text,
    true
  );

  begin
    delegated_claims := coalesce(nullif(original_claims, ''), '{}')::jsonb;
  exception
    when invalid_text_representation then
      delegated_claims := '{}'::jsonb;
  end;

  select jsonb_set(
    delegated_claims,
    '{sub}',
    to_jsonb(workspace.owner_user_id::text),
    true
  )
  into delegated_claims
  from public.vallective_workspaces workspace
  where workspace.id = requested_workspace_id;

  perform set_config('request.jwt.claims', delegated_claims::text, true);
  perform set_config(
    'request.jwt.claim.sub',
    (delegated_claims ->> 'sub'),
    true
  );
end;
$$;

create or replace function private.restore_vallective_operation_context()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config(
    'request.jwt.claims',
    coalesce(
      current_setting('vallective.original_request_jwt_claims', true),
      ''
    ),
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    coalesce(
      current_setting('vallective.original_request_jwt_sub', true),
      ''
    ),
    true
  );
  perform set_config('vallective.workspace_id', '', true);
  perform set_config('vallective.actor_user_id', '', true);
end;
$$;

revoke all on function private.activate_vallective_operation_context(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.restore_vallective_operation_context()
  from public, anon, authenticated, service_role;

create or replace function private.assign_vallective_operation_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_workspace_id uuid;
  context_actor_user_id uuid;
begin
  begin
    context_workspace_id := nullif(
      current_setting('vallective.workspace_id', true),
      ''
    )::uuid;
    context_actor_user_id := nullif(
      current_setting('vallective.actor_user_id', true),
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      raise exception using message = 'Invalid workspace operation context.', errcode = '42501';
  end;

  if context_workspace_id is null then
    select preference.active_workspace_id
    into context_workspace_id
    from public.vallective_workspace_preferences preference
    join public.vallective_workspaces workspace
      on workspace.id = preference.active_workspace_id
     and workspace.owner_user_id = new.user_id
     and workspace.status = 'active'
    where preference.user_id = auth.uid();

    context_actor_user_id := auth.uid();
  end if;

  if context_workspace_id is null then
    raise exception using message = 'A valid workspace is required.', errcode = '42501';
  end if;

  if new.workspace_id is not null and new.workspace_id <> context_workspace_id then
    raise exception using message = 'Workspace operation context does not match the row.', errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.vallective_workspaces workspace
    where workspace.id = context_workspace_id
      and workspace.owner_user_id = new.user_id
      and workspace.status = 'active'
  ) then
    raise exception using message = 'Workspace and data owner do not match.', errcode = '42501';
  end if;

  new.workspace_id := context_workspace_id;

  if tg_table_name = 'purchase_lots' then
    if context_actor_user_id is null then
      raise exception using message = 'Purchase operator is required.', errcode = '42501';
    end if;
    new.created_by_user_id := context_actor_user_id;
  end if;

  return new;
end;
$$;

revoke all on function private.assign_vallective_operation_workspace()
  from public, anon, authenticated, service_role;

create trigger purchase_lots_assign_vallective_workspace
before insert on public.purchase_lots
for each row execute function private.assign_vallective_operation_workspace();

create trigger cardshow_events_assign_vallective_workspace
before insert on public.cardshow_events
for each row execute function private.assign_vallective_operation_workspace();

create trigger grading_submissions_assign_vallective_workspace
before insert on public.grading_submissions
for each row execute function private.assign_vallective_operation_workspace();

create or replace function private.enforce_vallective_operation_card_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_workspace_id uuid;
  parent_owner_user_id uuid;
  card_workspace_id uuid;
  card_owner_user_id uuid;
begin
  if tg_table_name = 'purchase_lot_cards' then
    select lot.workspace_id, lot.user_id
    into parent_workspace_id, parent_owner_user_id
    from public.purchase_lots lot
    where lot.id = new.lot_id;
  elsif tg_table_name = 'grading_submission_cards' then
    select submission.workspace_id, submission.user_id
    into parent_workspace_id, parent_owner_user_id
    from public.grading_submissions submission
    where submission.id = new.submission_id;
  elsif tg_table_name = 'cardshow_inventory_items' then
    select event.workspace_id, event.user_id
    into parent_workspace_id, parent_owner_user_id
    from public.cardshow_events event
    where event.id = new.event_id;
  else
    raise exception using message = 'Unsupported workspace card relation.', errcode = '42501';
  end if;

  if parent_workspace_id is null then
    raise exception using message = 'The parent workspace was not found.', errcode = '23503';
  end if;

  select card.workspace_id, card.user_id
  into card_workspace_id, card_owner_user_id
  from public.cards card
  where card.id = new.card_id;

  if card_workspace_id is null then
    raise exception using message = 'The card workspace was not found.', errcode = '23503';
  end if;

  if card_workspace_id <> parent_workspace_id
    or card_owner_user_id <> parent_owner_user_id then
    raise exception
      using message = 'Cards cannot be moved across workspace boundaries.',
            errcode = '42501';
  end if;

  new.user_id := parent_owner_user_id;
  return new;
end;
$$;

revoke all on function private.enforce_vallective_operation_card_workspace()
  from public, anon, authenticated, service_role;

create trigger purchase_lot_cards_enforce_vallective_workspace
before insert or update of lot_id, card_id on public.purchase_lot_cards
for each row execute function private.enforce_vallective_operation_card_workspace();

create trigger grading_submission_cards_enforce_vallective_workspace
before insert or update of submission_id, card_id on public.grading_submission_cards
for each row execute function private.enforce_vallective_operation_card_workspace();

create trigger cardshow_inventory_enforce_vallective_workspace
before insert or update of event_id, card_id on public.cardshow_inventory_items
for each row execute function private.enforce_vallective_operation_card_workspace();

create or replace function public.create_workspace_purchase_lot(
  p_workspace_id uuid,
  p_name text,
  p_allocation_method text default 'proportional',
  p_source text default null,
  p_seller text default null,
  p_purchase_reference text default null,
  p_purchased_at timestamptz default now(),
  p_currency text default 'DKK',
  p_purchase_amount numeric default 0,
  p_buyer_fee numeric default 0,
  p_shipping_cost numeric default 0,
  p_taxes numeric default 0,
  p_other_costs numeric default 0,
  p_notes text default null,
  p_cards jsonb default '[]'::jsonb,
  p_lock boolean default true,
  p_overwrite_existing_purchase_price boolean default false
)
returns table (
  lot_id uuid,
  lot_status text,
  card_count integer,
  total_cost numeric,
  allocated_total numeric,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
  purchase_total numeric := round((
    coalesce(p_purchase_amount, 0)
    + coalesce(p_buyer_fee, 0)
    + coalesce(p_shipping_cost, 0)
    + coalesce(p_taxes, 0)
    + coalesce(p_other_costs, 0)
  )::numeric, 2);
  monthly_budget numeric;
  monthly_spend numeric;
  month_start timestamptz;
  month_end timestamptz;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'purchases');

  if not operation_context.can_approve_over_budget_purchases then
    if upper(coalesce(nullif(btrim(p_currency), ''), 'DKK'))
      <> operation_context.base_currency then
      raise exception
        using message = 'Purchases within a member budget must use the workspace currency.',
              errcode = 'P0001';
    end if;

    if purchase_total < 0 then
      raise exception using message = 'Purchase costs cannot be negative.', errcode = 'P0001';
    end if;

    select team_member.monthly_purchase_budget
    into monthly_budget
    from public.vallective_team_members team_member
    where team_member.workspace_id = p_workspace_id
      and team_member.member_user_id = operation_context.actor_user_id
      and team_member.status = 'active'
      and team_member.can_manage_purchases_within_budget
    for update;

    if not found then
      raise exception
        using message = 'No active purchase budget is configured for this operator.',
              errcode = '42501';
    end if;

    month_start := date_trunc(
      'month',
      coalesce(p_purchased_at, now()) at time zone 'Europe/Copenhagen'
    ) at time zone 'Europe/Copenhagen';
    month_end := month_start + interval '1 month';

    select coalesce(sum(lot.total_cost), 0)
    into monthly_spend
    from public.purchase_lots lot
    where lot.workspace_id = p_workspace_id
      and lot.created_by_user_id = operation_context.actor_user_id
      and lot.status <> 'cancelled'
      and lot.purchased_at >= month_start
      and lot.purchased_at < month_end;

    if monthly_spend + purchase_total > monthly_budget then
      raise exception
        using message = format(
          'Purchase exceeds the monthly budget. Remaining budget: %s %s.',
          greatest(monthly_budget - monthly_spend, 0),
          operation_context.base_currency
        ),
        errcode = 'P0001';
    end if;
  end if;

  select * into result_row
  from public.create_purchase_lot(
    p_name => p_name,
    p_allocation_method => p_allocation_method,
    p_source => p_source,
    p_seller => p_seller,
    p_purchase_reference => p_purchase_reference,
    p_purchased_at => p_purchased_at,
    p_currency => p_currency,
    p_purchase_amount => p_purchase_amount,
    p_buyer_fee => p_buyer_fee,
    p_shipping_cost => p_shipping_cost,
    p_taxes => p_taxes,
    p_other_costs => p_other_costs,
    p_notes => p_notes,
    p_cards => p_cards,
    p_lock => p_lock,
    p_overwrite_existing_purchase_price => p_overwrite_existing_purchase_price
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'purchase_lot.created',
    'purchase_lot',
    result_row.lot_id,
    jsonb_build_object(
      'currency', upper(coalesce(p_currency, 'DKK')),
      'total_cost', result_row.total_cost,
      'status', result_row.lot_status
    )
  );

  return query select
    result_row.lot_id::uuid,
    result_row.lot_status::text,
    result_row.card_count::integer,
    result_row.total_cost::numeric,
    result_row.allocated_total::numeric,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

create or replace function public.lock_workspace_purchase_lot(
  p_workspace_id uuid,
  p_lot_id uuid,
  p_overwrite_existing_purchase_price boolean default false
)
returns table (
  lot_id uuid,
  lot_status text,
  card_count integer,
  total_cost numeric,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'purchases');

  if not exists (
    select 1 from public.purchase_lots lot
    where lot.id = p_lot_id and lot.workspace_id = p_workspace_id
  ) then
    raise exception using message = 'Purchase lot not found in this workspace.', errcode = 'P0001';
  end if;

  select * into result_row
  from public.lock_purchase_lot(
    p_lot_id => p_lot_id,
    p_overwrite_existing_purchase_price => p_overwrite_existing_purchase_price
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'purchase_lot.locked',
    'purchase_lot',
    result_row.lot_id,
    jsonb_build_object('status', result_row.lot_status)
  );

  return query select
    result_row.lot_id::uuid,
    result_row.lot_status::text,
    result_row.card_count::integer,
    result_row.total_cost::numeric,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

create or replace function public.create_workspace_cardshow_event(
  p_workspace_id uuid,
  p_name text,
  p_venue text default null,
  p_city text default null,
  p_address text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_currency text default 'DKK',
  p_payment_methods text[] default array['cash', 'mobilepay', 'card', 'other']::text[],
  p_booth_fee numeric default 0,
  p_travel_cost numeric default 0,
  p_accommodation_cost numeric default 0,
  p_food_cost numeric default 0,
  p_other_event_costs numeric default 0,
  p_notes text default null
)
returns table (
  event_id uuid,
  event_status text,
  event_cost_total numeric,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'cardshows');

  select * into result_row
  from public.create_cardshow_event(
    p_name => p_name,
    p_venue => p_venue,
    p_city => p_city,
    p_address => p_address,
    p_starts_at => p_starts_at,
    p_ends_at => p_ends_at,
    p_currency => p_currency,
    p_payment_methods => p_payment_methods,
    p_booth_fee => p_booth_fee,
    p_travel_cost => p_travel_cost,
    p_accommodation_cost => p_accommodation_cost,
    p_food_cost => p_food_cost,
    p_other_event_costs => p_other_event_costs,
    p_notes => p_notes
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'cardshow.created',
    'cardshow_event',
    result_row.event_id,
    jsonb_build_object('status', result_row.event_status)
  );

  return query select
    result_row.event_id::uuid,
    result_row.event_status::text,
    result_row.event_cost_total::numeric,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

create or replace function public.upsert_workspace_cardshow_inventory_items(
  p_workspace_id uuid,
  p_event_id uuid,
  p_items jsonb default '[]'::jsonb
)
returns table (
  event_id uuid,
  added_count integer,
  updated_count integer,
  item_count integer,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'cardshows');

  if not exists (
    select 1 from public.cardshow_events event
    where event.id = p_event_id and event.workspace_id = p_workspace_id
  ) then
    raise exception using message = 'Cardshow not found in this workspace.', errcode = 'P0001';
  end if;

  select * into result_row
  from public.upsert_cardshow_inventory_items(
    p_event_id => p_event_id,
    p_items => p_items
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'cardshow.inventory_updated',
    'cardshow_event',
    result_row.event_id,
    jsonb_build_object(
      'added_count', result_row.added_count,
      'updated_count', result_row.updated_count
    )
  );

  return query select
    result_row.event_id::uuid,
    result_row.added_count::integer,
    result_row.updated_count::integer,
    result_row.item_count::integer,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

create or replace function public.create_workspace_grading_submission(
  p_workspace_id uuid,
  p_name text,
  p_grading_company text,
  p_service_level text default null,
  p_currency text default 'DKK',
  p_submission_number text default null,
  p_estimated_turnaround_days integer default null,
  p_submission_fee numeric default 0,
  p_outbound_shipping_cost numeric default 0,
  p_return_shipping_cost numeric default 0,
  p_insurance_cost numeric default 0,
  p_other_shared_costs numeric default 0,
  p_notes text default null,
  p_cards jsonb default '[]'::jsonb
)
returns table (
  submission_id uuid,
  card_count integer,
  shared_cost_total numeric,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'grading');

  select * into result_row
  from public.create_grading_submission(
    p_name => p_name,
    p_grading_company => p_grading_company,
    p_service_level => p_service_level,
    p_currency => p_currency,
    p_submission_number => p_submission_number,
    p_estimated_turnaround_days => p_estimated_turnaround_days,
    p_submission_fee => p_submission_fee,
    p_outbound_shipping_cost => p_outbound_shipping_cost,
    p_return_shipping_cost => p_return_shipping_cost,
    p_insurance_cost => p_insurance_cost,
    p_other_shared_costs => p_other_shared_costs,
    p_notes => p_notes,
    p_cards => p_cards
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'grading_submission.created',
    'grading_submission',
    result_row.submission_id,
    jsonb_build_object('card_count', result_row.card_count)
  );

  return query select
    result_row.submission_id::uuid,
    result_row.card_count::integer,
    result_row.shared_cost_total::numeric,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

create or replace function public.transition_workspace_grading_submission(
  p_workspace_id uuid,
  p_submission_id uuid,
  p_target_status text,
  p_occurred_at timestamptz default now(),
  p_submission_number text default null,
  p_outbound_tracking_number text default null,
  p_return_tracking_number text default null,
  p_notes text default null
)
returns table (
  submission_id uuid,
  previous_status text,
  new_status text,
  card_count integer,
  updated_card_count integer,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'grading');

  if not exists (
    select 1 from public.grading_submissions submission
    where submission.id = p_submission_id and submission.workspace_id = p_workspace_id
  ) then
    raise exception using message = 'Grading submission not found in this workspace.', errcode = 'P0001';
  end if;

  select * into result_row
  from public.transition_grading_submission(
    p_submission_id => p_submission_id,
    p_target_status => p_target_status,
    p_occurred_at => p_occurred_at,
    p_submission_number => p_submission_number,
    p_outbound_tracking_number => p_outbound_tracking_number,
    p_return_tracking_number => p_return_tracking_number,
    p_notes => p_notes
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'grading_submission.transitioned',
    'grading_submission',
    result_row.submission_id,
    jsonb_build_object(
      'previous_status', result_row.previous_status,
      'new_status', result_row.new_status
    )
  );

  return query select
    result_row.submission_id::uuid,
    result_row.previous_status::text,
    result_row.new_status::text,
    result_row.card_count::integer,
    result_row.updated_card_count::integer,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

create or replace function public.record_workspace_grading_card_result(
  p_workspace_id uuid,
  p_submission_card_id uuid,
  p_result_grade text,
  p_certification_number text default null,
  p_result_qualifier text default null,
  p_result_subgrades jsonb default '{}'::jsonb,
  p_result_market_value numeric default null,
  p_result_notes text default null,
  p_graded_at timestamptz default now()
)
returns table (
  submission_id uuid,
  submission_card_id uuid,
  card_id uuid,
  grading_company text,
  result_grade text,
  certification_number text,
  result_market_value numeric,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_context record;
  result_row record;
begin
  select * into operation_context
  from private.activate_vallective_operation_context(p_workspace_id, 'grading');

  if not exists (
    select 1
    from public.grading_submission_cards submission_card
    join public.grading_submissions submission
      on submission.id = submission_card.submission_id
    where submission_card.id = p_submission_card_id
      and submission.workspace_id = p_workspace_id
  ) then
    raise exception using message = 'Grading card not found in this workspace.', errcode = 'P0001';
  end if;

  select * into result_row
  from public.record_grading_card_result(
    p_submission_card_id => p_submission_card_id,
    p_result_grade => p_result_grade,
    p_certification_number => p_certification_number,
    p_result_qualifier => p_result_qualifier,
    p_result_subgrades => p_result_subgrades,
    p_result_market_value => p_result_market_value,
    p_result_notes => p_result_notes,
    p_graded_at => p_graded_at
  );

  perform private.restore_vallective_operation_context();

  insert into public.vallective_workspace_audit_events (
    workspace_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_workspace_id,
    operation_context.actor_user_id,
    'grading_card.result_recorded',
    'grading_submission_card',
    result_row.submission_card_id,
    jsonb_build_object(
      'card_id', result_row.card_id,
      'grade', result_row.result_grade
    )
  );

  return query select
    result_row.submission_id::uuid,
    result_row.submission_card_id::uuid,
    result_row.card_id::uuid,
    result_row.grading_company::text,
    result_row.result_grade::text,
    result_row.certification_number::text,
    result_row.result_market_value::numeric,
    result_row.result_message::text;
exception
  when others then
    perform private.restore_vallective_operation_context();
    raise;
end;
$$;

revoke all on function public.create_workspace_purchase_lot(
  uuid, text, text, text, text, text, timestamptz, text, numeric, numeric,
  numeric, numeric, numeric, text, jsonb, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.create_workspace_purchase_lot(
  uuid, text, text, text, text, text, timestamptz, text, numeric, numeric,
  numeric, numeric, numeric, text, jsonb, boolean, boolean
) to authenticated;

revoke all on function public.lock_workspace_purchase_lot(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.lock_workspace_purchase_lot(uuid, uuid, boolean)
  to authenticated;

revoke all on function public.create_workspace_cardshow_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, text[],
  numeric, numeric, numeric, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_workspace_cardshow_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, text[],
  numeric, numeric, numeric, numeric, numeric, text
) to authenticated;

revoke all on function public.upsert_workspace_cardshow_inventory_items(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_workspace_cardshow_inventory_items(uuid, uuid, jsonb)
  to authenticated;

revoke all on function public.create_workspace_grading_submission(
  uuid, text, text, text, text, text, integer, numeric, numeric, numeric,
  numeric, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_workspace_grading_submission(
  uuid, text, text, text, text, text, integer, numeric, numeric, numeric,
  numeric, numeric, text, jsonb
) to authenticated;

revoke all on function public.transition_workspace_grading_submission(
  uuid, uuid, text, timestamptz, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.transition_workspace_grading_submission(
  uuid, uuid, text, timestamptz, text, text, text, text
) to authenticated;

revoke all on function public.record_workspace_grading_card_result(
  uuid, uuid, text, text, text, jsonb, numeric, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_workspace_grading_card_result(
  uuid, uuid, text, text, text, jsonb, numeric, text, timestamptz
) to authenticated;
