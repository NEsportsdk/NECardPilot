-- First-class workspace foundation for personal collections and business trade.
--
-- This migration is deliberately backwards compatible with the currently
-- deployed application. Existing user_id ownership remains the data-custody
-- anchor while workspace_id becomes the explicit collaboration boundary.

create table public.vallective_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  name text not null,
  base_currency text not null default 'DKK',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vallective_workspaces_kind_check
    check (kind in ('personal', 'business')),
  constraint vallective_workspaces_name_check
    check (char_length(btrim(name)) between 1 and 120),
  constraint vallective_workspaces_currency_check
    check (base_currency ~ '^[A-Z]{3}$'),
  constraint vallective_workspaces_status_check
    check (status in ('active', 'archived')),
  unique (owner_user_id, kind)
);

comment on table public.vallective_workspaces is
  'First-class personal and business workspaces. Operational rows remain custodially owned by owner_user_id while access is granted through memberships.';

create index vallective_workspaces_owner_status_idx
  on public.vallective_workspaces (owner_user_id, status, kind);

create table public.vallective_workspace_memberships (
  workspace_id uuid not null references public.vallective_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  can_manage_inventory boolean not null default false,
  can_manage_sales boolean not null default false,
  can_manage_grading boolean not null default false,
  can_manage_cardshows boolean not null default false,
  can_manage_purchases_within_budget boolean not null default false,
  can_approve_over_budget_purchases boolean not null default false,
  can_manage_team boolean not null default false,
  can_delete_inventory boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint vallective_workspace_memberships_role_check
    check (role in ('owner', 'administrator', 'trade_manager', 'junior_trade_manager', 'collector')),
  constraint vallective_workspace_memberships_status_check
    check (status in ('active', 'paused'))
);

comment on table public.vallective_workspace_memberships is
  'Workspace-scoped roles and capabilities. Employment and commission terms remain in vallective_team_members.';

create index vallective_workspace_memberships_user_status_idx
  on public.vallective_workspace_memberships (user_id, status, workspace_id);

create table public.vallective_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_workspace_id uuid not null references public.vallective_workspaces(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vallective_workspace_preferences_active_idx
  on public.vallective_workspace_preferences (active_workspace_id);

create table public.vallective_workspace_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.vallective_workspaces(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint vallective_workspace_audit_action_check
    check (char_length(btrim(action)) between 1 and 120),
  constraint vallective_workspace_audit_entity_type_check
    check (entity_type is null or char_length(btrim(entity_type)) between 1 and 80),
  constraint vallective_workspace_audit_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.vallective_workspace_audit_events is
  'Append-only security and business audit trail for workspace-scoped actions.';

create index vallective_workspace_audit_workspace_created_idx
  on public.vallective_workspace_audit_events (workspace_id, created_at desc);

create index vallective_workspace_audit_actor_created_idx
  on public.vallective_workspace_audit_events (actor_user_id, created_at desc);

alter table public.collections add column workspace_id uuid;
alter table public.cards add column workspace_id uuid;
alter table public.card_transactions add column workspace_id uuid;
alter table public.purchase_lots add column workspace_id uuid;
alter table public.cardshow_events add column workspace_id uuid;
alter table public.grading_submissions add column workspace_id uuid;
alter table public.scan_capture_items add column workspace_id uuid;
alter table public.trade_card_assignments add column workspace_id uuid;
alter table public.vallective_team_members add column workspace_id uuid;
alter table public.vallective_team_invitations add column workspace_id uuid;

insert into public.vallective_workspaces (
  owner_user_id,
  kind,
  name,
  base_currency
)
select
  auth_user.id,
  'personal',
  'My collection',
  coalesce(
    (
      select upper(collection.currency)
      from public.collections collection
      where collection.user_id = auth_user.id
        and collection.type = 'pc'
      order by collection.created_at
      limit 1
    ),
    'DKK'
  )
from auth.users auth_user
on conflict (owner_user_id, kind) do nothing;

with business_owners as (
  select collection.user_id as owner_user_id
  from public.collections collection
  where collection.type = 'inventory'
  union
  select invitation.owner_user_id
  from public.vallective_team_invitations invitation
  union
  select membership.owner_user_id
  from public.vallective_team_members membership
)
insert into public.vallective_workspaces (
  owner_user_id,
  kind,
  name,
  base_currency
)
select
  business_owner.owner_user_id,
  'business',
  coalesce(
    (
      select btrim(invitation.workspace_name)
      from public.vallective_team_invitations invitation
      where invitation.owner_user_id = business_owner.owner_user_id
      order by invitation.created_at desc
      limit 1
    ),
    'Business inventory'
  ),
  coalesce(
    (
      select upper(collection.currency)
      from public.collections collection
      where collection.user_id = business_owner.owner_user_id
        and collection.type = 'inventory'
      order by collection.created_at
      limit 1
    ),
    'DKK'
  )
from business_owners business_owner
on conflict (owner_user_id, kind) do update
set name = excluded.name,
    updated_at = now();

insert into public.vallective_workspace_memberships (
  workspace_id,
  user_id,
  role,
  status,
  can_manage_inventory,
  can_manage_sales,
  can_manage_grading,
  can_manage_cardshows,
  can_manage_purchases_within_budget,
  can_approve_over_budget_purchases,
  can_manage_team,
  can_delete_inventory
)
select
  workspace.id,
  workspace.owner_user_id,
  'owner',
  'active',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
from public.vallective_workspaces workspace
on conflict (workspace_id, user_id) do update
set role = 'owner',
    status = 'active',
    can_manage_inventory = true,
    can_manage_sales = true,
    can_manage_grading = true,
    can_manage_cardshows = true,
    can_manage_purchases_within_budget = true,
    can_approve_over_budget_purchases = true,
    can_manage_team = true,
    can_delete_inventory = true,
    updated_at = now();

update public.vallective_team_invitations invitation
set workspace_id = workspace.id
from public.vallective_workspaces workspace
where workspace.owner_user_id = invitation.owner_user_id
  and workspace.kind = 'business';

update public.vallective_team_members team_member
set workspace_id = workspace.id
from public.vallective_workspaces workspace
where workspace.owner_user_id = team_member.owner_user_id
  and workspace.kind = 'business';

insert into public.vallective_workspace_memberships (
  workspace_id,
  user_id,
  role,
  status,
  can_manage_inventory,
  can_manage_sales,
  can_manage_grading,
  can_manage_cardshows,
  can_manage_purchases_within_budget,
  can_approve_over_budget_purchases,
  can_manage_team,
  can_delete_inventory,
  joined_at
)
select
  team_member.workspace_id,
  team_member.member_user_id,
  team_member.role,
  team_member.status,
  team_member.can_manage_inventory,
  team_member.can_manage_sales,
  team_member.can_manage_grading,
  team_member.can_manage_cardshows,
  team_member.can_manage_purchases_within_budget,
  team_member.can_approve_over_budget_purchases,
  team_member.can_manage_team,
  team_member.can_delete_inventory,
  team_member.joined_at
from public.vallective_team_members team_member
where team_member.workspace_id is not null
on conflict (workspace_id, user_id) do update
set role = excluded.role,
    status = excluded.status,
    can_manage_inventory = excluded.can_manage_inventory,
    can_manage_sales = excluded.can_manage_sales,
    can_manage_grading = excluded.can_manage_grading,
    can_manage_cardshows = excluded.can_manage_cardshows,
    can_manage_purchases_within_budget = excluded.can_manage_purchases_within_budget,
    can_approve_over_budget_purchases = excluded.can_approve_over_budget_purchases,
    can_manage_team = excluded.can_manage_team,
    can_delete_inventory = excluded.can_delete_inventory,
    updated_at = now();

update public.collections collection
set workspace_id = workspace.id
from public.vallective_workspaces workspace
where workspace.owner_user_id = collection.user_id
  and workspace.kind = case
    when collection.type = 'inventory' then 'business'
    else 'personal'
  end;

update public.cards card
set workspace_id = collection.workspace_id
from public.collections collection
where collection.id = card.current_collection_id;

update public.card_transactions transaction
set workspace_id = card.workspace_id
from public.cards card
where card.id = transaction.card_id;

update public.scan_capture_items capture_item
set workspace_id = collection.workspace_id
from public.collections collection
where collection.id = capture_item.collection_id;

update public.purchase_lots purchase_lot
set workspace_id = coalesce(
  (
    select card.workspace_id
    from public.purchase_lot_cards lot_card
    join public.cards card on card.id = lot_card.card_id
    where lot_card.lot_id = purchase_lot.id
    order by lot_card.position
    limit 1
  ),
  (
    select workspace.id
    from public.vallective_workspaces workspace
    where workspace.owner_user_id = purchase_lot.user_id
    order by case when workspace.kind = 'business' then 0 else 1 end
    limit 1
  )
);

update public.cardshow_events event
set workspace_id = workspace.id
from public.vallective_workspaces workspace
where workspace.owner_user_id = event.user_id
  and workspace.kind = case
    when exists (
      select 1
      from public.cardshow_inventory_items inventory
      join public.cards card on card.id = inventory.card_id
      where inventory.event_id = event.id
        and card.workspace_id in (
          select business_workspace.id
          from public.vallective_workspaces business_workspace
          where business_workspace.owner_user_id = event.user_id
            and business_workspace.kind = 'business'
        )
    ) then 'business'
    else 'personal'
  end;

update public.grading_submissions submission
set workspace_id = coalesce(
  (
    select card.workspace_id
    from public.grading_submission_cards submission_card
    join public.cards card on card.id = submission_card.card_id
    where submission_card.submission_id = submission.id
    order by submission_card.position
    limit 1
  ),
  (
    select workspace.id
    from public.vallective_workspaces workspace
    where workspace.owner_user_id = submission.user_id
      and workspace.kind = 'personal'
    limit 1
  )
);

update public.trade_card_assignments assignment
set workspace_id = workspace.id
from public.vallective_workspaces workspace
where workspace.owner_user_id = assignment.owner_user_id
  and workspace.kind = 'business';

insert into public.vallective_workspace_preferences (
  user_id,
  active_workspace_id
)
select
  auth_user.id,
  workspace.id
from auth.users auth_user
join public.vallective_workspaces workspace
  on workspace.owner_user_id = auth_user.id
 and workspace.kind = 'personal'
on conflict (user_id) do nothing;

alter table public.collections alter column workspace_id set not null;
alter table public.cards alter column workspace_id set not null;
alter table public.card_transactions alter column workspace_id set not null;
alter table public.purchase_lots alter column workspace_id set not null;
alter table public.cardshow_events alter column workspace_id set not null;
alter table public.grading_submissions alter column workspace_id set not null;
alter table public.scan_capture_items alter column workspace_id set not null;
alter table public.trade_card_assignments alter column workspace_id set not null;
alter table public.vallective_team_members alter column workspace_id set not null;
alter table public.vallective_team_invitations alter column workspace_id set not null;

alter table public.collections
  add constraint collections_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.cards
  add constraint cards_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.card_transactions
  add constraint card_transactions_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.purchase_lots
  add constraint purchase_lots_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.cardshow_events
  add constraint cardshow_events_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.grading_submissions
  add constraint grading_submissions_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.scan_capture_items
  add constraint scan_capture_items_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.trade_card_assignments
  add constraint trade_card_assignments_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.vallective_team_members
  add constraint vallective_team_members_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;
alter table public.vallective_team_invitations
  add constraint vallective_team_invitations_workspace_id_fkey
  foreign key (workspace_id) references public.vallective_workspaces(id) on delete restrict;

create index collections_workspace_created_idx
  on public.collections (workspace_id, created_at);
create index cards_workspace_created_idx
  on public.cards (workspace_id, created_at desc);
create index card_transactions_workspace_occurred_idx
  on public.card_transactions (workspace_id, occurred_at desc);
create index purchase_lots_workspace_purchased_idx
  on public.purchase_lots (workspace_id, purchased_at desc);
create index cardshow_events_workspace_starts_idx
  on public.cardshow_events (workspace_id, starts_at desc);
create index grading_submissions_workspace_created_idx
  on public.grading_submissions (workspace_id, created_at desc);
create index scan_capture_items_workspace_created_idx
  on public.scan_capture_items (workspace_id, created_at);
create index trade_card_assignments_workspace_assignee_idx
  on public.trade_card_assignments (workspace_id, assigned_to_user_id, assigned_at desc);
create index vallective_team_members_workspace_status_idx
  on public.vallective_team_members (workspace_id, status);
create index vallective_team_invitations_workspace_status_idx
  on public.vallective_team_invitations (workspace_id, status, created_at desc);

create or replace function private.can_access_vallective_workspace(
  requested_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.vallective_workspace_memberships membership
      join public.vallective_workspaces workspace
        on workspace.id = membership.workspace_id
      where membership.workspace_id = requested_workspace_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and workspace.status = 'active'
    );
$$;

create or replace function private.can_manage_vallective_workspace_capability(
  requested_workspace_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.vallective_workspace_memberships membership
      join public.vallective_workspaces workspace
        on workspace.id = membership.workspace_id
      where membership.workspace_id = requested_workspace_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and workspace.status = 'active'
        and case requested_capability
          when 'inventory' then membership.can_manage_inventory
          when 'sales' then membership.can_manage_sales
          when 'grading' then membership.can_manage_grading
          when 'cardshows' then membership.can_manage_cardshows
          when 'purchases' then membership.can_manage_purchases_within_budget
          when 'team' then membership.can_manage_team
          when 'delete_inventory' then membership.can_delete_inventory
          else false
        end
    );
$$;

revoke all on function private.can_access_vallective_workspace(uuid)
  from public, anon, authenticated;
revoke all on function private.can_manage_vallective_workspace_capability(uuid, text)
  from public, anon, authenticated;
grant execute on function private.can_access_vallective_workspace(uuid)
  to authenticated;
grant execute on function private.can_manage_vallective_workspace_capability(uuid, text)
  to authenticated;

create or replace function private.ensure_current_user_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  personal_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  insert into public.vallective_workspaces (
    owner_user_id,
    kind,
    name,
    base_currency
  )
  values (
    current_user_id,
    'personal',
    'My collection',
    'DKK'
  )
  on conflict (owner_user_id, kind) do update
  set updated_at = public.vallective_workspaces.updated_at
  returning id into personal_workspace_id;

  insert into public.vallective_workspace_memberships (
    workspace_id,
    user_id,
    role,
    status,
    can_manage_inventory,
    can_manage_sales,
    can_manage_grading,
    can_manage_cardshows,
    can_manage_purchases_within_budget,
    can_approve_over_budget_purchases,
    can_manage_team,
    can_delete_inventory
  )
  values (
    personal_workspace_id,
    current_user_id,
    'owner',
    'active',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true
  )
  on conflict (workspace_id, user_id) do update
  set role = 'owner',
      status = 'active',
      updated_at = now();

  insert into public.vallective_workspace_preferences (
    user_id,
    active_workspace_id
  )
  values (
    current_user_id,
    personal_workspace_id
  )
  on conflict (user_id) do nothing;

  return personal_workspace_id;
end;
$$;

revoke all on function private.ensure_current_user_personal_workspace()
  from public, anon, authenticated;
grant execute on function private.ensure_current_user_personal_workspace()
  to authenticated;

create or replace function public.list_vallective_workspaces()
returns table (
  workspace_id uuid,
  workspace_kind text,
  workspace_name text,
  base_currency text,
  data_owner_user_id uuid,
  member_role text,
  can_manage_inventory boolean,
  can_manage_sales boolean,
  can_manage_grading boolean,
  can_manage_cardshows boolean,
  can_manage_purchases_within_budget boolean,
  can_approve_over_budget_purchases boolean,
  can_manage_team boolean,
  can_delete_inventory boolean,
  is_active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  personal_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  personal_workspace_id := private.ensure_current_user_personal_workspace();

  if not exists (
    select 1
    from public.vallective_workspace_preferences preference
    join public.vallective_workspace_memberships membership
      on membership.workspace_id = preference.active_workspace_id
     and membership.user_id = current_user_id
     and membership.status = 'active'
    where preference.user_id = current_user_id
  ) then
    insert into public.vallective_workspace_preferences (
      user_id,
      active_workspace_id
    )
    values (
      current_user_id,
      personal_workspace_id
    )
    on conflict (user_id) do update
    set active_workspace_id = excluded.active_workspace_id,
        updated_at = now();
  end if;

  return query
  select
    workspace.id,
    workspace.kind,
    workspace.name,
    workspace.base_currency,
    workspace.owner_user_id,
    membership.role,
    membership.can_manage_inventory,
    membership.can_manage_sales,
    membership.can_manage_grading,
    membership.can_manage_cardshows,
    membership.can_manage_purchases_within_budget,
    membership.can_approve_over_budget_purchases,
    membership.can_manage_team,
    membership.can_delete_inventory,
    preference.active_workspace_id = workspace.id
  from public.vallective_workspace_memberships membership
  join public.vallective_workspaces workspace
    on workspace.id = membership.workspace_id
   and workspace.status = 'active'
  join public.vallective_workspace_preferences preference
    on preference.user_id = current_user_id
  where membership.user_id = current_user_id
    and membership.status = 'active'
  order by
    case when preference.active_workspace_id = workspace.id then 0 else 1 end,
    case when workspace.kind = 'personal' then 0 else 1 end,
    workspace.created_at;
end;
$$;

revoke all on function public.list_vallective_workspaces()
  from public, anon, authenticated;
grant execute on function public.list_vallective_workspaces()
  to authenticated;

create or replace function public.set_active_vallective_workspace(
  requested_workspace_id uuid
)
returns table (
  workspace_id uuid,
  workspace_kind text,
  workspace_name text,
  base_currency text,
  data_owner_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  if requested_workspace_id is null or not exists (
    select 1
    from public.vallective_workspace_memberships membership
    join public.vallective_workspaces workspace
      on workspace.id = membership.workspace_id
    where membership.workspace_id = requested_workspace_id
      and membership.user_id = current_user_id
      and membership.status = 'active'
      and workspace.status = 'active'
  ) then
    raise exception
      using message = 'Workspace not found or access denied.', errcode = '42501';
  end if;

  insert into public.vallective_workspace_preferences (
    user_id,
    active_workspace_id
  )
  values (
    current_user_id,
    requested_workspace_id
  )
  on conflict (user_id) do update
  set active_workspace_id = excluded.active_workspace_id,
      updated_at = now();

  insert into public.vallective_workspace_audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id
  )
  values (
    requested_workspace_id,
    current_user_id,
    'workspace.activated',
    'workspace',
    requested_workspace_id
  );

  return query
  select
    workspace.id,
    workspace.kind,
    workspace.name,
    workspace.base_currency,
    workspace.owner_user_id
  from public.vallective_workspaces workspace
  where workspace.id = requested_workspace_id;
end;
$$;

revoke all on function public.set_active_vallective_workspace(uuid)
  from public, anon, authenticated;
grant execute on function public.set_active_vallective_workspace(uuid)
  to authenticated;

create or replace function private.set_vallective_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_vallective_workspace_updated_at()
  from public, anon, authenticated;

create trigger vallective_workspaces_set_updated_at
before update on public.vallective_workspaces
for each row execute function private.set_vallective_workspace_updated_at();

create trigger vallective_workspace_memberships_set_updated_at
before update on public.vallective_workspace_memberships
for each row execute function private.set_vallective_workspace_updated_at();

create trigger vallective_workspace_preferences_set_updated_at
before update on public.vallective_workspace_preferences
for each row execute function private.set_vallective_workspace_updated_at();

create or replace function private.assign_vallective_collection_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_kind text := case when new.type = 'inventory' then 'business' else 'personal' end;
begin
  if new.workspace_id is null then
    select workspace.id
    into new.workspace_id
    from public.vallective_workspaces workspace
    where workspace.owner_user_id = new.user_id
      and workspace.kind = workspace_kind
      and workspace.status = 'active'
    limit 1;
  end if;

  if new.workspace_id is null then
    raise exception using message = 'A valid workspace is required.', errcode = '23502';
  end if;

  if not exists (
    select 1
    from public.vallective_workspaces workspace
    where workspace.id = new.workspace_id
      and workspace.owner_user_id = new.user_id
      and workspace.status = 'active'
  ) then
    raise exception using message = 'Collection workspace and data owner do not match.', errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.assign_vallective_card_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  collection_row public.collections%rowtype;
begin
  select * into collection_row
  from public.collections collection
  where collection.id = new.current_collection_id;

  if not found then
    raise exception using message = 'Card collection was not found.', errcode = '23503';
  end if;

  new.workspace_id := collection_row.workspace_id;
  new.user_id := collection_row.user_id;
  return new;
end;
$$;

create or replace function private.assign_vallective_transaction_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  card_row public.cards%rowtype;
begin
  select * into card_row
  from public.cards card
  where card.id = new.card_id;

  if not found then
    raise exception using message = 'Transaction card was not found.', errcode = '23503';
  end if;

  new.workspace_id := card_row.workspace_id;
  new.user_id := card_row.user_id;
  return new;
end;
$$;

create or replace function private.assign_vallective_capture_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  collection_row public.collections%rowtype;
begin
  select * into collection_row
  from public.collections collection
  where collection.id = new.collection_id;

  if not found then
    raise exception using message = 'Capture collection was not found.', errcode = '23503';
  end if;

  new.workspace_id := collection_row.workspace_id;
  new.user_id := collection_row.user_id;
  return new;
end;
$$;

revoke all on function private.assign_vallective_collection_workspace()
  from public, anon, authenticated;
revoke all on function private.assign_vallective_card_workspace()
  from public, anon, authenticated;
revoke all on function private.assign_vallective_transaction_workspace()
  from public, anon, authenticated;
revoke all on function private.assign_vallective_capture_workspace()
  from public, anon, authenticated;

create trigger collections_assign_vallective_workspace
before insert or update of user_id, type, workspace_id on public.collections
for each row execute function private.assign_vallective_collection_workspace();

create trigger cards_assign_vallective_workspace
before insert or update of user_id, current_collection_id, workspace_id on public.cards
for each row execute function private.assign_vallective_card_workspace();

create trigger card_transactions_assign_vallective_workspace
before insert or update of user_id, card_id, workspace_id on public.card_transactions
for each row execute function private.assign_vallective_transaction_workspace();

create trigger scan_capture_items_assign_vallective_workspace
before insert or update of user_id, collection_id, workspace_id on public.scan_capture_items
for each row execute function private.assign_vallective_capture_workspace();

alter table public.vallective_workspaces enable row level security;
alter table public.vallective_workspace_memberships enable row level security;
alter table public.vallective_workspace_preferences enable row level security;
alter table public.vallective_workspace_audit_events enable row level security;

revoke all on table public.vallective_workspaces from public, anon, authenticated;
revoke all on table public.vallective_workspace_memberships from public, anon, authenticated;
revoke all on table public.vallective_workspace_preferences from public, anon, authenticated;
revoke all on table public.vallective_workspace_audit_events from public, anon, authenticated;

grant select on table public.vallective_workspaces to authenticated;
grant select on table public.vallective_workspace_memberships to authenticated;
grant select on table public.vallective_workspace_preferences to authenticated;
grant select on table public.vallective_workspace_audit_events to authenticated;

create policy "Members can view accessible workspaces"
on public.vallective_workspaces
for select
to authenticated
using ((select private.can_access_vallective_workspace(id)));

create policy "Members can view workspace membership"
on public.vallective_workspace_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    (select private.can_manage_vallective_workspace_capability(workspace_id, 'team'))
  )
);

create policy "Users can view workspace preference"
on public.vallective_workspace_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Members can view permitted workspace audit"
on public.vallective_workspace_audit_events
for select
to authenticated
using (
  actor_user_id = (select auth.uid())
  or (
    (select private.can_manage_vallective_workspace_capability(workspace_id, 'team'))
  )
);

drop policy if exists "Vallective team can view workspace collections" on public.collections;
drop policy if exists "Vallective team can view workspace cards" on public.cards;
drop policy if exists "Vallective team can view workspace transactions" on public.card_transactions;
drop policy if exists "Vallective team can view workspace purchase lots" on public.purchase_lots;
drop policy if exists "Vallective team can view workspace card attributes" on public.card_attributes;
drop policy if exists "Vallective team can view workspace card images" on public.card_images;
drop policy if exists "Vallective team can view workspace market estimates" on public.card_market_estimates;
drop policy if exists "Vallective team can view workspace market comparables" on public.card_market_comparables;
drop policy if exists "Vallective team can view workspace grading submissions" on public.grading_submissions;
drop policy if exists "Vallective team can view workspace grading cards" on public.grading_submission_cards;
drop policy if exists "Vallective team can view workspace grading events" on public.grading_submission_events;
drop policy if exists "Vallective team can view workspace cardshows" on public.cardshow_events;
drop policy if exists "Vallective team can view workspace cardshow inventory" on public.cardshow_inventory_items;
drop policy if exists "Vallective team can view workspace purchase lot cards" on public.purchase_lot_cards;
drop policy if exists "Vallective team can view workspace capture queue" on public.scan_capture_items;
drop policy if exists "Vallective team can add workspace collections" on public.collections;
drop policy if exists "Vallective team can update workspace collections" on public.collections;
drop policy if exists "Vallective team can add workspace cards" on public.cards;
drop policy if exists "Vallective team can update workspace cards" on public.cards;
drop policy if exists "Vallective team can add workspace card attributes" on public.card_attributes;
drop policy if exists "Vallective team can update workspace card attributes" on public.card_attributes;
drop policy if exists "Vallective team can add workspace market estimates" on public.card_market_estimates;
drop policy if exists "Vallective team can update workspace market estimates" on public.card_market_estimates;

create policy "Workspace members can view collections"
on public.collections for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace inventory managers can add collections"
on public.collections for insert to authenticated
with check ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')));

create policy "Workspace inventory managers can update collections"
on public.collections for update to authenticated
using ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')))
with check ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')));

create policy "Workspace members can view cards"
on public.cards for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace inventory managers can add cards"
on public.cards for insert to authenticated
with check (
  (select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory'))
  and exists (
    select 1 from public.collections collection
    where collection.id = cards.current_collection_id
      and collection.workspace_id = cards.workspace_id
      and collection.user_id = cards.user_id
  )
);

create policy "Workspace inventory managers can update cards"
on public.cards for update to authenticated
using ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')))
with check (
  (select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory'))
  and exists (
    select 1 from public.collections collection
    where collection.id = cards.current_collection_id
      and collection.workspace_id = cards.workspace_id
      and collection.user_id = cards.user_id
  )
);

create policy "Workspace members can view transactions"
on public.card_transactions for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace members can view purchase lots"
on public.purchase_lots for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace members can view grading submissions"
on public.grading_submissions for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace members can view cardshows"
on public.cardshow_events for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace members can view capture queue"
on public.scan_capture_items for select to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace inventory managers can add capture queue"
on public.scan_capture_items for insert to authenticated
with check ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')));

create policy "Workspace inventory managers can update capture queue"
on public.scan_capture_items for update to authenticated
using ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')))
with check ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')));

create policy "Workspace inventory managers can remove capture queue"
on public.scan_capture_items for delete to authenticated
using ((select private.can_manage_vallective_workspace_capability(workspace_id, 'inventory')));

create policy "Workspace members can view card attributes"
on public.card_attributes for select to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_attributes.card_id
      and (select private.can_access_vallective_workspace(card.workspace_id))
  )
);

create policy "Workspace inventory managers can add card attributes"
on public.card_attributes for insert to authenticated
with check (
  exists (
    select 1 from public.cards card
    where card.id = card_attributes.card_id
      and card.user_id = card_attributes.user_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace inventory managers can update card attributes"
on public.card_attributes for update to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_attributes.card_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
)
with check (
  exists (
    select 1 from public.cards card
    where card.id = card_attributes.card_id
      and card.user_id = card_attributes.user_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace members can view card images"
on public.card_images for select to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_images.card_id
      and (select private.can_access_vallective_workspace(card.workspace_id))
  )
);

create policy "Workspace members can view market estimates"
on public.card_market_estimates for select to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_market_estimates.card_id
      and (select private.can_access_vallective_workspace(card.workspace_id))
  )
);

create policy "Workspace inventory managers can add market estimates"
on public.card_market_estimates for insert to authenticated
with check (
  exists (
    select 1 from public.cards card
    where card.id = card_market_estimates.card_id
      and card.user_id = card_market_estimates.user_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace inventory managers can update market estimates"
on public.card_market_estimates for update to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_market_estimates.card_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
)
with check (
  exists (
    select 1 from public.cards card
    where card.id = card_market_estimates.card_id
      and card.user_id = card_market_estimates.user_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace members can view market comparables"
on public.card_market_comparables for select to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_market_comparables.card_id
      and (select private.can_access_vallective_workspace(card.workspace_id))
  )
);

create policy "Workspace members can view grading cards"
on public.grading_submission_cards for select to authenticated
using (
  exists (
    select 1 from public.grading_submissions submission
    where submission.id = grading_submission_cards.submission_id
      and (select private.can_access_vallective_workspace(submission.workspace_id))
  )
);

create policy "Workspace members can view grading events"
on public.grading_submission_events for select to authenticated
using (
  exists (
    select 1 from public.grading_submissions submission
    where submission.id = grading_submission_events.submission_id
      and (select private.can_access_vallective_workspace(submission.workspace_id))
  )
);

create policy "Workspace members can view cardshow inventory"
on public.cardshow_inventory_items for select to authenticated
using (
  exists (
    select 1 from public.cardshow_events event
    where event.id = cardshow_inventory_items.event_id
      and (select private.can_access_vallective_workspace(event.workspace_id))
  )
);

create policy "Workspace members can view purchase lot cards"
on public.purchase_lot_cards for select to authenticated
using (
  exists (
    select 1 from public.purchase_lots lot
    where lot.id = purchase_lot_cards.lot_id
      and (select private.can_access_vallective_workspace(lot.workspace_id))
  )
);

alter table public.vallective_team_members
  drop constraint vallective_team_members_pkey;
alter table public.vallective_team_members
  add constraint vallective_team_members_pkey
  primary key (workspace_id, member_user_id);

alter table public.vallective_team_invitations
  drop constraint vallective_team_invitations_owner_user_id_email_key;
alter table public.vallective_team_invitations
  add constraint vallective_team_invitations_workspace_email_key
  unique (workspace_id, email);

create or replace function public.accept_vallective_team_invitation()
returns table (
  owner_user_id uuid,
  member_role text,
  workspace_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  confirmed_email text;
  invitation public.vallective_team_invitations%rowtype;
begin
  if current_user_id is null then
    raise exception
      using message = 'Du skal være logget ind for at acceptere invitationen.',
            errcode = 'P0001';
  end if;

  select lower(btrim(auth_user.email))
  into confirmed_email
  from auth.users auth_user
  where auth_user.id = current_user_id
    and auth_user.email_confirmed_at is not null;

  if confirmed_email is null then
    return;
  end if;

  select pending_invitation.*
  into invitation
  from public.vallective_team_invitations pending_invitation
  where pending_invitation.email = confirmed_email
    and pending_invitation.status in ('pending', 'sent', 'accepted')
    and (
      pending_invitation.accepted_by is null
      or pending_invitation.accepted_by = current_user_id
    )
  order by pending_invitation.created_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  insert into public.vallective_team_members (
    workspace_id,
    owner_user_id,
    member_user_id,
    role,
    display_name,
    preferred_language,
    status,
    workspace_name,
    can_manage_inventory,
    can_manage_sales,
    can_manage_grading,
    can_manage_cardshows,
    can_manage_purchases_within_budget,
    can_approve_over_budget_purchases,
    can_manage_team,
    can_delete_inventory,
    hourly_rate,
    weekly_hours_target,
    existing_inventory_commission_rate,
    sourced_profit_commission_rate,
    monthly_purchase_budget,
    first_mission_target
  )
  values (
    invitation.workspace_id,
    invitation.owner_user_id,
    current_user_id,
    invitation.role,
    invitation.display_name,
    'da',
    'active',
    invitation.workspace_name,
    invitation.can_manage_inventory,
    invitation.can_manage_sales,
    invitation.can_manage_grading,
    invitation.can_manage_cardshows,
    invitation.can_manage_purchases_within_budget,
    invitation.can_approve_over_budget_purchases,
    invitation.can_manage_team,
    invitation.can_delete_inventory,
    invitation.hourly_rate,
    invitation.weekly_hours_target,
    invitation.existing_inventory_commission_rate,
    invitation.sourced_profit_commission_rate,
    invitation.monthly_purchase_budget,
    invitation.first_mission_target
  )
  on conflict (workspace_id, member_user_id) do update
  set role = excluded.role,
      display_name = excluded.display_name,
      preferred_language = excluded.preferred_language,
      status = excluded.status,
      workspace_name = excluded.workspace_name,
      can_manage_inventory = excluded.can_manage_inventory,
      can_manage_sales = excluded.can_manage_sales,
      can_manage_grading = excluded.can_manage_grading,
      can_manage_cardshows = excluded.can_manage_cardshows,
      can_manage_purchases_within_budget = excluded.can_manage_purchases_within_budget,
      can_approve_over_budget_purchases = excluded.can_approve_over_budget_purchases,
      can_manage_team = excluded.can_manage_team,
      can_delete_inventory = excluded.can_delete_inventory,
      hourly_rate = excluded.hourly_rate,
      weekly_hours_target = excluded.weekly_hours_target,
      existing_inventory_commission_rate = excluded.existing_inventory_commission_rate,
      sourced_profit_commission_rate = excluded.sourced_profit_commission_rate,
      monthly_purchase_budget = excluded.monthly_purchase_budget,
      first_mission_target = excluded.first_mission_target,
      updated_at = now();

  insert into public.vallective_workspace_memberships (
    workspace_id,
    user_id,
    role,
    status,
    can_manage_inventory,
    can_manage_sales,
    can_manage_grading,
    can_manage_cardshows,
    can_manage_purchases_within_budget,
    can_approve_over_budget_purchases,
    can_manage_team,
    can_delete_inventory
  )
  values (
    invitation.workspace_id,
    current_user_id,
    invitation.role,
    'active',
    invitation.can_manage_inventory,
    invitation.can_manage_sales,
    invitation.can_manage_grading,
    invitation.can_manage_cardshows,
    invitation.can_manage_purchases_within_budget,
    invitation.can_approve_over_budget_purchases,
    invitation.can_manage_team,
    invitation.can_delete_inventory
  )
  on conflict (workspace_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      can_manage_inventory = excluded.can_manage_inventory,
      can_manage_sales = excluded.can_manage_sales,
      can_manage_grading = excluded.can_manage_grading,
      can_manage_cardshows = excluded.can_manage_cardshows,
      can_manage_purchases_within_budget = excluded.can_manage_purchases_within_budget,
      can_approve_over_budget_purchases = excluded.can_approve_over_budget_purchases,
      can_manage_team = excluded.can_manage_team,
      can_delete_inventory = excluded.can_delete_inventory,
      updated_at = now();

  insert into public.vallective_workspace_preferences (
    user_id,
    active_workspace_id
  )
  values (
    current_user_id,
    invitation.workspace_id
  )
  on conflict (user_id) do update
  set active_workspace_id = excluded.active_workspace_id,
      updated_at = now();

  update public.vallective_team_invitations accepted_invitation
  set status = 'accepted',
      accepted_by = current_user_id,
      accepted_at = coalesce(accepted_invitation.accepted_at, now()),
      updated_at = now()
  where accepted_invitation.id = invitation.id;

  insert into public.vallective_workspace_audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    invitation.workspace_id,
    current_user_id,
    'member.invitation_accepted',
    'user',
    current_user_id,
    jsonb_build_object('role', invitation.role)
  );

  return query
  select invitation.owner_user_id, invitation.role, invitation.workspace_name;
end;
$$;

revoke all on function public.accept_vallective_team_invitation()
  from public, anon, authenticated;
grant execute on function public.accept_vallective_team_invitation()
  to authenticated;

create policy "Workspace inventory managers can add card images"
on public.card_images for insert to authenticated
with check (
  exists (
    select 1 from public.cards card
    where card.id = card_images.card_id
      and card.user_id = card_images.user_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace inventory managers can update card images"
on public.card_images for update to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_images.card_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
)
with check (
  exists (
    select 1 from public.cards card
    where card.id = card_images.card_id
      and card.user_id = card_images.user_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace inventory managers can delete card images"
on public.card_images for delete to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_images.card_id
      and (select private.can_manage_vallective_workspace_capability(card.workspace_id, 'inventory'))
  )
);

create policy "Workspace members can view stored card images"
on storage.objects for select to authenticated
using (
  bucket_id = 'card-images'
  and exists (
    select 1
    from public.collections collection
    where collection.user_id::text = (storage.foldername(name))[1]
      and collection.id::text = (storage.foldername(name))[2]
      and (select private.can_access_vallective_workspace(collection.workspace_id))
  )
);

create policy "Workspace inventory managers can upload stored card images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'card-images'
  and exists (
    select 1
    from public.collections collection
    where collection.user_id::text = (storage.foldername(name))[1]
      and collection.id::text = (storage.foldername(name))[2]
      and (select private.can_manage_vallective_workspace_capability(collection.workspace_id, 'inventory'))
  )
);

create policy "Workspace inventory managers can update stored card images"
on storage.objects for update to authenticated
using (
  bucket_id = 'card-images'
  and exists (
    select 1
    from public.collections collection
    where collection.user_id::text = (storage.foldername(name))[1]
      and collection.id::text = (storage.foldername(name))[2]
      and (select private.can_manage_vallective_workspace_capability(collection.workspace_id, 'inventory'))
  )
)
with check (
  bucket_id = 'card-images'
  and exists (
    select 1
    from public.collections collection
    where collection.user_id::text = (storage.foldername(name))[1]
      and collection.id::text = (storage.foldername(name))[2]
      and (select private.can_manage_vallective_workspace_capability(collection.workspace_id, 'inventory'))
  )
);

create policy "Workspace inventory managers can delete stored card images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'card-images'
  and exists (
    select 1
    from public.collections collection
    where collection.user_id::text = (storage.foldername(name))[1]
      and collection.id::text = (storage.foldername(name))[2]
      and (select private.can_manage_vallective_workspace_capability(collection.workspace_id, 'inventory'))
  )
);

create or replace function public.record_workspace_card_sale(
  p_workspace_id uuid,
  p_card_id uuid,
  p_sale_price numeric,
  p_shipping_income numeric default 0,
  p_platform_fee numeric default 0,
  p_payment_fee numeric default 0,
  p_shipping_cost numeric default 0,
  p_other_costs numeric default 0,
  p_platform text default null,
  p_buyer text default null,
  p_reference text default null,
  p_notes text default null,
  p_sold_at timestamptz default now()
)
returns table (
  transaction_id uuid,
  sold_card_id uuid,
  new_state text,
  transaction_currency text,
  gross_amount numeric,
  net_proceeds numeric,
  cost_basis numeric,
  realized_profit numeric,
  result_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  card_row public.cards%rowtype;
  collection_row public.collections%rowtype;
  transaction_row public.card_transactions%rowtype;
  normalized_shipping_income numeric := coalesce(p_shipping_income, 0);
  normalized_platform_fee numeric := coalesce(p_platform_fee, 0);
  normalized_payment_fee numeric := coalesce(p_payment_fee, 0);
  normalized_shipping_cost numeric := coalesce(p_shipping_cost, 0);
  normalized_other_costs numeric := coalesce(p_other_costs, 0);
  card_cost_basis numeric;
begin
  if actor_user_id is null then
    raise exception using message = 'Du skal være logget ind for at registrere et salg.', errcode = 'P0001';
  end if;

  if p_workspace_id is null
    or not private.can_manage_vallective_workspace_capability(p_workspace_id, 'sales') then
    raise exception using message = 'Du har ikke adgang til at registrere salg i dette workspace.', errcode = '42501';
  end if;

  if p_card_id is null then
    raise exception using message = 'Kort-ID mangler.', errcode = 'P0001';
  end if;

  if p_sale_price is null or p_sale_price <= 0 then
    raise exception using message = 'Salgsprisen skal være større end 0.', errcode = 'P0001';
  end if;

  if normalized_shipping_income < 0
    or normalized_platform_fee < 0
    or normalized_payment_fee < 0
    or normalized_shipping_cost < 0
    or normalized_other_costs < 0 then
    raise exception using message = 'Salgsbeløb og omkostninger kan ikke være negative.', errcode = 'P0001';
  end if;

  select card.*
  into card_row
  from public.cards card
  where card.id = p_card_id
    and card.workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception using message = 'Kortet blev ikke fundet, eller du har ikke adgang til det.', errcode = 'P0001';
  end if;

  if card_row.state = 'sold' then
    raise exception using message = 'Kortet er allerede registreret som solgt.', errcode = 'P0001';
  end if;

  if card_row.state = 'archived' then
    raise exception using message = 'Et arkiveret kort skal genåbnes, før det kan sælges.', errcode = 'P0001';
  end if;

  select collection.*
  into collection_row
  from public.collections collection
  where collection.id = card_row.current_collection_id
    and collection.workspace_id = p_workspace_id
    and collection.user_id = card_row.user_id;

  if not found then
    raise exception using message = 'Kortets nuværende collection blev ikke fundet.', errcode = 'P0001';
  end if;

  card_cost_basis := coalesce(card_row.purchase_price, 0);

  insert into public.card_transactions (
    user_id,
    workspace_id,
    card_id,
    collection_id,
    transaction_type,
    status,
    occurred_at,
    currency,
    item_amount,
    shipping_income,
    platform_fee,
    payment_fee,
    shipping_cost,
    other_costs,
    cost_basis,
    platform,
    counterparty,
    reference,
    notes,
    card_state_before
  )
  values (
    card_row.user_id,
    p_workspace_id,
    card_row.id,
    collection_row.id,
    'sale',
    'completed',
    coalesce(p_sold_at, now()),
    coalesce(collection_row.currency, 'DKK'),
    p_sale_price,
    normalized_shipping_income,
    normalized_platform_fee,
    normalized_payment_fee,
    normalized_shipping_cost,
    normalized_other_costs,
    card_cost_basis,
    nullif(btrim(p_platform), ''),
    nullif(btrim(p_buyer), ''),
    nullif(btrim(p_reference), ''),
    nullif(btrim(p_notes), ''),
    card_row.state
  )
  returning * into transaction_row;

  update public.cards
  set state = 'sold'
  where id = card_row.id
    and workspace_id = p_workspace_id;

  insert into public.vallective_workspace_audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_workspace_id,
    actor_user_id,
    'card.sale_recorded',
    'card_transaction',
    transaction_row.id,
    jsonb_build_object(
      'card_id', card_row.id,
      'currency', transaction_row.currency,
      'gross_amount', transaction_row.item_amount
    )
  );

  return query
  select
    transaction_row.id,
    card_row.id,
    'sold'::text,
    transaction_row.currency,
    transaction_row.item_amount,
    transaction_row.net_amount,
    transaction_row.cost_basis,
    transaction_row.realized_profit,
    (card_row.player_name || ' er registreret som solgt.')::text;
end;
$$;

revoke all on function public.record_workspace_card_sale(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric,
  text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_workspace_card_sale(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric,
  text, text, text, text, timestamptz
) to authenticated;
