-- Internal Vallective trade-team foundation.
--
-- Existing inventory remains owned by the original user_id. Team membership
-- grants capability-scoped access to that owner's trading data, while personal
-- collections continue to use the member's own user_id.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.vallective_team_members (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'junior_trade_manager',
  display_name text not null,
  preferred_language text not null default 'da',
  status text not null default 'active',
  workspace_name text not null default 'Vallective Business',
  can_manage_inventory boolean not null default true,
  can_manage_sales boolean not null default true,
  can_manage_grading boolean not null default true,
  can_manage_cardshows boolean not null default true,
  can_manage_purchases_within_budget boolean not null default true,
  can_approve_over_budget_purchases boolean not null default false,
  can_manage_team boolean not null default false,
  can_delete_inventory boolean not null default false,
  hourly_rate numeric(10,2) not null default 70,
  weekly_hours_target numeric(5,2) not null default 5,
  existing_inventory_commission_rate numeric(6,5) not null default 0.05,
  sourced_profit_commission_rate numeric(6,5) not null default 0.25,
  monthly_purchase_budget numeric(12,2) not null default 3000,
  first_mission_target integer not null default 50,
  joined_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (owner_user_id, member_user_id),
  constraint vallective_team_members_distinct_users_check
    check (owner_user_id <> member_user_id),
  constraint vallective_team_members_role_check
    check (role in ('junior_trade_manager', 'trade_manager', 'administrator')),
  constraint vallective_team_members_language_check
    check (preferred_language in ('da', 'en')),
  constraint vallective_team_members_status_check
    check (status in ('active', 'paused')),
  constraint vallective_team_members_display_name_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint vallective_team_members_workspace_name_check
    check (char_length(btrim(workspace_name)) between 1 and 120),
  constraint vallective_team_members_hourly_rate_check
    check (hourly_rate >= 0),
  constraint vallective_team_members_weekly_hours_check
    check (weekly_hours_target >= 0 and weekly_hours_target <= 168),
  constraint vallective_team_members_existing_commission_check
    check (
      existing_inventory_commission_rate >= 0
      and existing_inventory_commission_rate <= 1
    ),
  constraint vallective_team_members_sourced_commission_check
    check (
      sourced_profit_commission_rate >= 0
      and sourced_profit_commission_rate <= 1
    ),
  constraint vallective_team_members_purchase_budget_check
    check (monthly_purchase_budget >= 0),
  constraint vallective_team_members_first_mission_check
    check (first_mission_target between 1 and 10000)
);

comment on table public.vallective_team_members is
  'Private Vallective staff membership and agreed trade compensation terms.';

create index vallective_team_members_member_status_idx
  on public.vallective_team_members (member_user_id, status);

create index vallective_team_members_owner_status_idx
  on public.vallective_team_members (owner_user_id, status);

create table public.vallective_team_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'junior_trade_manager',
  workspace_name text not null default 'Vallective Business',
  status text not null default 'pending',
  can_manage_inventory boolean not null default true,
  can_manage_sales boolean not null default true,
  can_manage_grading boolean not null default true,
  can_manage_cardshows boolean not null default true,
  can_manage_purchases_within_budget boolean not null default true,
  can_approve_over_budget_purchases boolean not null default false,
  can_manage_team boolean not null default false,
  can_delete_inventory boolean not null default false,
  hourly_rate numeric(10,2) not null default 70,
  weekly_hours_target numeric(5,2) not null default 5,
  existing_inventory_commission_rate numeric(6,5) not null default 0.05,
  sourced_profit_commission_rate numeric(6,5) not null default 0.25,
  monthly_purchase_budget numeric(12,2) not null default 3000,
  first_mission_target integer not null default 50,
  send_attempts smallint not null default 1,
  resend_email_id text,
  last_error_code text,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  sent_at timestamp with time zone,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (owner_user_id, email),
  constraint vallective_team_invitations_email_check
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
      and email !~ '[[:space:]]'
    ),
  constraint vallective_team_invitations_display_name_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint vallective_team_invitations_role_check
    check (role in ('junior_trade_manager', 'trade_manager', 'administrator')),
  constraint vallective_team_invitations_status_check
    check (status in ('pending', 'sent', 'failed', 'accepted', 'revoked')),
  constraint vallective_team_invitations_send_attempts_check
    check (send_attempts between 1 and 20),
  constraint vallective_team_invitations_terms_check
    check (
      hourly_rate >= 0
      and weekly_hours_target between 0 and 168
      and existing_inventory_commission_rate between 0 and 1
      and sourced_profit_commission_rate between 0 and 1
      and monthly_purchase_budget >= 0
      and first_mission_target between 1 and 10000
    )
);

comment on table public.vallective_team_invitations is
  'Audited, email-bound invitations to Vallective internal business workspaces.';

create index vallective_team_invitations_email_status_idx
  on public.vallective_team_invitations (email, status);

create index vallective_team_invitations_owner_status_idx
  on public.vallective_team_invitations (owner_user_id, status, created_at desc);

create or replace function private.can_access_vallective_trade_workspace(
  workspace_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspace_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = workspace_owner_user_id
        and membership.member_user_id = (select auth.uid())
        and membership.status = 'active'
    );
$$;

revoke all on function private.can_access_vallective_trade_workspace(uuid)
  from public, anon, authenticated;
grant execute on function private.can_access_vallective_trade_workspace(uuid)
  to authenticated;

create or replace function private.can_manage_vallective_inventory(
  workspace_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspace_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = workspace_owner_user_id
        and membership.member_user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.can_manage_inventory
    );
$$;

create or replace function private.can_manage_vallective_sales(
  workspace_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspace_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = workspace_owner_user_id
        and membership.member_user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.can_manage_sales
    );
$$;

create or replace function private.can_manage_vallective_grading(
  workspace_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspace_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = workspace_owner_user_id
        and membership.member_user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.can_manage_grading
    );
$$;

create or replace function private.can_manage_vallective_cardshows(
  workspace_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspace_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = workspace_owner_user_id
        and membership.member_user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.can_manage_cardshows
    );
$$;

create or replace function private.can_manage_vallective_purchases(
  workspace_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    workspace_owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = workspace_owner_user_id
        and membership.member_user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.can_manage_purchases_within_budget
    );
$$;

revoke all on function private.can_manage_vallective_inventory(uuid)
  from public, anon, authenticated;
revoke all on function private.can_manage_vallective_sales(uuid)
  from public, anon, authenticated;
revoke all on function private.can_manage_vallective_grading(uuid)
  from public, anon, authenticated;
revoke all on function private.can_manage_vallective_cardshows(uuid)
  from public, anon, authenticated;
revoke all on function private.can_manage_vallective_purchases(uuid)
  from public, anon, authenticated;

grant execute on function private.can_manage_vallective_inventory(uuid)
  to authenticated;
grant execute on function private.can_manage_vallective_sales(uuid)
  to authenticated;
grant execute on function private.can_manage_vallective_grading(uuid)
  to authenticated;
grant execute on function private.can_manage_vallective_cardshows(uuid)
  to authenticated;
grant execute on function private.can_manage_vallective_purchases(uuid)
  to authenticated;

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
  on conflict (owner_user_id, member_user_id) do update
  set
    role = excluded.role,
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

  update public.vallective_team_invitations accepted_invitation
  set
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = coalesce(accepted_invitation.accepted_at, now()),
    updated_at = now()
  where accepted_invitation.id = invitation.id;

  return query
  select
    invitation.owner_user_id,
    invitation.role,
    invitation.workspace_name;
end;
$$;

revoke all on function public.accept_vallective_team_invitation()
  from public, anon, authenticated;
grant execute on function public.accept_vallective_team_invitation()
  to authenticated;

create table public.trade_card_assignments (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  inventory_origin text not null default 'existing_inventory',
  priority text not null default 'normal',
  assigned_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (owner_user_id, card_id),
  constraint trade_card_assignments_origin_check
    check (inventory_origin in ('existing_inventory', 'member_sourced')),
  constraint trade_card_assignments_priority_check
    check (priority in ('low', 'normal', 'high'))
);

comment on table public.trade_card_assignments is
  'Links owner-held cards to a Vallective trade-team member and commission origin.';

create index trade_card_assignments_assignee_idx
  on public.trade_card_assignments (assigned_to_user_id, assigned_at desc);

create index trade_card_assignments_owner_origin_idx
  on public.trade_card_assignments (owner_user_id, inventory_origin);

create or replace function private.set_vallective_trade_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_vallective_trade_updated_at()
  from public, anon, authenticated;

create or replace function private.prevent_vallective_user_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception
      using message = 'Ejerskabet kan ikke flyttes mellem Vallective-arbejdsrum.',
            errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_vallective_user_id_change()
  from public, anon, authenticated;

create trigger vallective_team_members_set_updated_at
before update on public.vallective_team_members
for each row execute function private.set_vallective_trade_updated_at();

create trigger vallective_team_invitations_set_updated_at
before update on public.vallective_team_invitations
for each row execute function private.set_vallective_trade_updated_at();

create trigger trade_card_assignments_set_updated_at
before update on public.trade_card_assignments
for each row execute function private.set_vallective_trade_updated_at();

create trigger collections_prevent_vallective_user_id_change
before update of user_id on public.collections
for each row execute function private.prevent_vallective_user_id_change();

create trigger cards_prevent_vallective_user_id_change
before update of user_id on public.cards
for each row execute function private.prevent_vallective_user_id_change();

create trigger card_attributes_prevent_vallective_user_id_change
before update of user_id on public.card_attributes
for each row execute function private.prevent_vallective_user_id_change();

create trigger card_market_estimates_prevent_vallective_user_id_change
before update of user_id on public.card_market_estimates
for each row execute function private.prevent_vallective_user_id_change();

alter table public.vallective_team_members enable row level security;
alter table public.vallective_team_invitations enable row level security;
alter table public.trade_card_assignments enable row level security;

revoke all on table public.vallective_team_members from public, anon, authenticated;
revoke all on table public.vallective_team_invitations from public, anon, authenticated;
revoke all on table public.trade_card_assignments from public, anon, authenticated;

grant select, insert, update, delete on table public.vallective_team_members
  to authenticated;
grant select, insert, update, delete on table public.vallective_team_invitations
  to authenticated;
grant select, insert, update, delete on table public.trade_card_assignments
  to authenticated;

create policy "Owners can view Vallective team invitations"
on public.vallective_team_invitations
for select
to authenticated
using (owner_user_id = (select auth.uid()));

create policy "Owners can create Vallective team invitations"
on public.vallective_team_invitations
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and invited_by = (select auth.uid())
);

create policy "Owners can update Vallective team invitations"
on public.vallective_team_invitations
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy "Owners can remove Vallective team invitations"
on public.vallective_team_invitations
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

create policy "Owners can view Vallective team members"
on public.vallective_team_members
for select
to authenticated
using (owner_user_id = (select auth.uid()));

create policy "Members can view their Vallective membership"
on public.vallective_team_members
for select
to authenticated
using (
  member_user_id = (select auth.uid())
  and status = 'active'
);

create policy "Owners can add Vallective team members"
on public.vallective_team_members
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "Owners can update Vallective team members"
on public.vallective_team_members
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy "Owners can remove Vallective team members"
on public.vallective_team_members
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

create policy "Trade workspace can view card assignments"
on public.trade_card_assignments
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(owner_user_id))
);

create policy "Owners can add trade card assignments"
on public.trade_card_assignments
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.cards card
    where card.id = trade_card_assignments.card_id
      and card.user_id = (select auth.uid())
  )
  and (
    assigned_to_user_id is null
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = (select auth.uid())
        and membership.member_user_id = assigned_to_user_id
        and membership.status = 'active'
    )
  )
);

create policy "Owners can update trade card assignments"
on public.trade_card_assignments
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.cards card
    where card.id = trade_card_assignments.card_id
      and card.user_id = (select auth.uid())
  )
  and (
    assigned_to_user_id is null
    or exists (
      select 1
      from public.vallective_team_members membership
      where membership.owner_user_id = (select auth.uid())
        and membership.member_user_id = assigned_to_user_id
        and membership.status = 'active'
    )
  )
);

create policy "Owners can remove trade card assignments"
on public.trade_card_assignments
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

-- Team reads span the operational surfaces Noah needs. Mutations are enabled
-- per capability below; destructive deletes and team administration stay with
-- the owner.
create policy "Vallective team can view workspace collections"
on public.collections
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace cards"
on public.cards
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace transactions"
on public.card_transactions
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace purchase lots"
on public.purchase_lots
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace card attributes"
on public.card_attributes
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace card images"
on public.card_images
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace market estimates"
on public.card_market_estimates
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace market comparables"
on public.card_market_comparables
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace grading submissions"
on public.grading_submissions
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace grading cards"
on public.grading_submission_cards
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace grading events"
on public.grading_submission_events
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace cardshows"
on public.cardshow_events
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace cardshow inventory"
on public.cardshow_inventory_items
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace purchase lot cards"
on public.purchase_lot_cards
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can view workspace capture queue"
on public.scan_capture_items
for select
to authenticated
using (
  (select private.can_access_vallective_trade_workspace(user_id))
);

create policy "Vallective team can add workspace collections"
on public.collections
for insert
to authenticated
with check (
  (select private.can_manage_vallective_inventory(user_id))
);

create policy "Vallective team can update workspace collections"
on public.collections
for update
to authenticated
using (
  (select private.can_manage_vallective_inventory(user_id))
)
with check (
  (select private.can_manage_vallective_inventory(user_id))
);

create policy "Vallective team can add workspace cards"
on public.cards
for insert
to authenticated
with check (
  (select private.can_manage_vallective_inventory(user_id))
  and exists (
    select 1
    from public.collections collection
    where collection.id = cards.current_collection_id
      and collection.user_id = cards.user_id
  )
);

create policy "Vallective team can update workspace cards"
on public.cards
for update
to authenticated
using (
  (select private.can_manage_vallective_inventory(user_id))
)
with check (
  (select private.can_manage_vallective_inventory(user_id))
  and exists (
    select 1
    from public.collections collection
    where collection.id = cards.current_collection_id
      and collection.user_id = cards.user_id
  )
);

create policy "Vallective team can add workspace card attributes"
on public.card_attributes
for insert
to authenticated
with check (
  (select private.can_manage_vallective_inventory(user_id))
  and exists (
    select 1
    from public.cards card
    where card.id = card_attributes.card_id
      and card.user_id = card_attributes.user_id
  )
);

create policy "Vallective team can update workspace card attributes"
on public.card_attributes
for update
to authenticated
using (
  (select private.can_manage_vallective_inventory(user_id))
)
with check (
  (select private.can_manage_vallective_inventory(user_id))
);

create policy "Vallective team can add workspace market estimates"
on public.card_market_estimates
for insert
to authenticated
with check (
  (select private.can_manage_vallective_inventory(user_id))
  and exists (
    select 1
    from public.cards card
    where card.id = card_market_estimates.card_id
      and card.user_id = card_market_estimates.user_id
  )
);

create policy "Vallective team can update workspace market estimates"
on public.card_market_estimates
for update
to authenticated
using (
  (select private.can_manage_vallective_inventory(user_id))
)
with check (
  (select private.can_manage_vallective_inventory(user_id))
);
