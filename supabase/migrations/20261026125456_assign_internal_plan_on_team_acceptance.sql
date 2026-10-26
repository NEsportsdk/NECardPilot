-- Provision the internal Vallective plan when a confirmed invitee joins the
-- business workspace. Existing subscriptions are deliberately preserved so a
-- team invitation can never overwrite Stripe billing state.

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

  insert into public.vallective_subscriptions (
    user_id,
    plan_code,
    status,
    provider
  )
  values (
    current_user_id,
    'internal',
    'active',
    'manual'
  )
  on conflict (user_id) do nothing;

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
