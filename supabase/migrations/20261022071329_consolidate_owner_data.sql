begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create index if not exists card_images_storage_path_idx
  on public.card_images (storage_path);
create index if not exists scan_capture_items_front_image_path_idx
  on public.scan_capture_items (front_image_path);
create index if not exists scan_capture_items_back_image_path_idx
  on public.scan_capture_items (back_image_path);

-- Existing card images can outlive the account-folder prefix they were uploaded
-- under. Keep workspace access tied to the referenced database row so an
-- intentional ownership consolidation does not orphan the binary object.
drop policy if exists "Workspace members can view referenced card images"
on storage.objects;

create policy "Workspace members can view referenced card images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'card-images'
  and (
    exists (
      select 1
      from public.card_images image
      join public.cards card on card.id = image.card_id
      where image.storage_path = objects.name
        and (
          select private.can_access_vallective_workspace(card.workspace_id)
        )
    )
    or exists (
      select 1
      from public.scan_capture_items capture_item
      where (
          capture_item.front_image_path = objects.name
          or capture_item.back_image_path = objects.name
        )
        and (
          select private.can_access_vallective_workspace(
            capture_item.workspace_id
          )
        )
    )
  )
);

drop policy if exists "Workspace inventory managers can update referenced card images"
on storage.objects;

create policy "Workspace inventory managers can update referenced card images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'card-images'
  and (
    exists (
      select 1
      from public.card_images image
      join public.cards card on card.id = image.card_id
      where image.storage_path = objects.name
        and (
          select private.can_manage_vallective_workspace_capability(
            card.workspace_id,
            'inventory'
          )
        )
    )
    or exists (
      select 1
      from public.scan_capture_items capture_item
      where (
          capture_item.front_image_path = objects.name
          or capture_item.back_image_path = objects.name
        )
        and (
          select private.can_manage_vallective_workspace_capability(
            capture_item.workspace_id,
            'inventory'
          )
        )
    )
  )
)
with check (
  bucket_id = 'card-images'
  and (
    exists (
      select 1
      from public.card_images image
      join public.cards card on card.id = image.card_id
      where image.storage_path = objects.name
        and (
          select private.can_manage_vallective_workspace_capability(
            card.workspace_id,
            'inventory'
          )
        )
    )
    or exists (
      select 1
      from public.scan_capture_items capture_item
      where (
          capture_item.front_image_path = objects.name
          or capture_item.back_image_path = objects.name
        )
        and (
          select private.can_manage_vallective_workspace_capability(
            capture_item.workspace_id,
            'inventory'
          )
        )
    )
  )
);

drop policy if exists "Workspace inventory managers can delete referenced card images"
on storage.objects;

create policy "Workspace inventory managers can delete referenced card images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'card-images'
  and (
    exists (
      select 1
      from public.card_images image
      join public.cards card on card.id = image.card_id
      where image.storage_path = objects.name
        and (
          select private.can_manage_vallective_workspace_capability(
            card.workspace_id,
            'inventory'
          )
        )
    )
    or exists (
      select 1
      from public.scan_capture_items capture_item
      where (
          capture_item.front_image_path = objects.name
          or capture_item.back_image_path = objects.name
        )
        and (
          select private.can_manage_vallective_workspace_capability(
            capture_item.workspace_id,
            'inventory'
          )
        )
    )
  )
);

-- Ownership is immutable during normal product use. Disable only the four
-- guard triggers needed by this audited, one-time consolidation transaction.
alter table public.collections
  disable trigger collections_prevent_vallective_user_id_change;
alter table public.cards
  disable trigger cards_prevent_vallective_user_id_change;
alter table public.card_attributes
  disable trigger card_attributes_prevent_vallective_user_id_change;
alter table public.card_market_estimates
  disable trigger card_market_estimates_prevent_vallective_user_id_change;

do $$
declare
  source_user_id uuid;
  target_user_id uuid;
  source_business_workspace_id uuid;
  source_personal_workspace_id uuid;
  target_business_workspace_id uuid;
  target_personal_workspace_id uuid;
  noah_invitation_id uuid;
  affected_rows integer;
begin
  select id
  into strict source_user_id
  from auth.users
  where lower(email) = 'nesportsdk@gmail.com';

  select id
  into strict target_user_id
  from auth.users
  where lower(email) = 'ne@eeckhardt.dk';

  if source_user_id = target_user_id then
    raise exception 'Source and target Vallective accounts must be different.';
  end if;

  select id
  into strict source_business_workspace_id
  from public.vallective_workspaces
  where owner_user_id = source_user_id
    and kind = 'business'
    and status = 'active';

  select id
  into strict source_personal_workspace_id
  from public.vallective_workspaces
  where owner_user_id = source_user_id
    and kind = 'personal'
    and status = 'active';

  select id
  into strict target_business_workspace_id
  from public.vallective_workspaces
  where owner_user_id = target_user_id
    and kind = 'business'
    and status = 'active';

  select id
  into strict target_personal_workspace_id
  from public.vallective_workspaces
  where owner_user_id = target_user_id
    and kind = 'personal'
    and status = 'active';

  -- Deterministic locking prevents new rows from being attached to any of the
  -- four workspaces while their contents are being reconciled.
  perform id
  from public.vallective_workspaces
  where id in (
    source_business_workspace_id,
    source_personal_workspace_id,
    target_business_workspace_id,
    target_personal_workspace_id
  )
  order by id
  for update;

  select id
  into strict noah_invitation_id
  from public.vallective_team_invitations
  where owner_user_id = source_user_id
    and workspace_id = source_business_workspace_id
    and email = 'noaheckhardt22@gmail.com'
    and display_name = 'Noah'
    and status = 'pending'
    and sent_at is null
  for update;

  if (select count(*) from public.collections where user_id = source_user_id) <> 2
    or (select count(*) from public.cards where user_id = source_user_id) <> 3
    or (select count(*) from public.card_transactions where user_id = source_user_id) <> 1
    or (select count(*) from public.cardshow_events where user_id = source_user_id) <> 1
    or (select count(*) from public.scan_capture_items where user_id = source_user_id) <> 11
    or (select count(*) from public.card_images where user_id = source_user_id) <> 6
    or (select count(*) from public.card_attributes where user_id = source_user_id) <> 57
    or (select count(*) from public.card_collection_history where user_id = source_user_id) <> 3
    or (select count(*) from public.card_market_estimates where user_id = source_user_id) <> 3
    or (select count(*) from public.card_market_comparables where user_id = source_user_id) <> 22
    or (select count(*) from public.beta_feedback where user_id = source_user_id) <> 1
    or (select count(*) from public.beta_pilot_participants where user_id = source_user_id) <> 1
    or (select count(*) from public.beta_pilot_coverage_checks where user_id = source_user_id) <> 1
  then
    raise exception 'Vallective source data changed after the ownership audit.';
  end if;

  if exists (
      select 1 from public.purchase_lots where user_id = source_user_id
    )
    or exists (
      select 1 from public.grading_submissions where user_id = source_user_id
    )
    or exists (
      select 1 from public.cardshow_inventory_items where user_id = source_user_id
    )
    or exists (
      select 1 from public.grading_submission_cards where user_id = source_user_id
    )
    or exists (
      select 1 from public.grading_submission_events where user_id = source_user_id
    )
    or exists (
      select 1 from public.purchase_lot_cards where user_id = source_user_id
    )
    or exists (
      select 1 from public.storefront_listings
      where data_owner_user_id = source_user_id
         or created_by_user_id = source_user_id
         or updated_by_user_id = source_user_id
    )
    or exists (
      select 1 from public.trade_card_assignments
      where owner_user_id = source_user_id
         or assigned_to_user_id = source_user_id
    )
    or exists (
      select 1 from public.vallective_team_members
      where owner_user_id = source_user_id
         or member_user_id = source_user_id
    )
    or exists (
      select 1 from public.vallective_workspace_audit_events
      where actor_user_id = source_user_id
         or workspace_id in (
           source_business_workspace_id,
           source_personal_workspace_id
         )
    )
  then
    raise exception 'Unexpected Vallective source references were found.';
  end if;

  if exists (
      select 1 from public.beta_pilot_participants
      where user_id = target_user_id
    )
    or exists (
      select 1 from public.beta_pilot_coverage_checks
      where user_id = target_user_id
    )
  then
    raise exception 'Target pilot records would conflict with the source records.';
  end if;

  if (
      select count(*)
      from storage.objects
      where bucket_id = 'card-images'
        and name like source_user_id::text || '/%'
    ) <> 26
  then
    raise exception 'The audited set of 26 source image objects is incomplete.';
  end if;

  if exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'card-images'
      and object.name like source_user_id::text || '/%'
      and not exists (
        select 1
        from public.card_images image
        where image.storage_path = object.name
      )
      and not exists (
        select 1
        from public.scan_capture_items capture_item
        where capture_item.front_image_path = object.name
           or capture_item.back_image_path = object.name
      )
  ) then
    raise exception 'An unreferenced source image object was found.';
  end if;

  update public.collections
  set user_id = target_user_id,
      workspace_id = case
        when type = 'inventory' then target_business_workspace_id
        else target_personal_workspace_id
      end
  where user_id = source_user_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 2 then
    raise exception 'Expected to move 2 collections, moved %.', affected_rows;
  end if;

  update public.cards
  set user_id = target_user_id
  where user_id = source_user_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 3 then
    raise exception 'Expected to move 3 cards, moved %.', affected_rows;
  end if;

  update public.card_attributes
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.card_collection_history
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.card_images
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.card_market_estimates
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.card_market_comparables
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.card_transactions
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.scan_capture_items
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.cardshow_events
  set user_id = target_user_id,
      workspace_id = case workspace_id
        when source_business_workspace_id then target_business_workspace_id
        else target_personal_workspace_id
      end
  where user_id = source_user_id;

  update public.beta_feedback
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.beta_pilot_participants
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.beta_pilot_coverage_checks
  set user_id = target_user_id
  where user_id = source_user_id;

  update public.vallective_team_invitations
  set owner_user_id = target_user_id,
      workspace_id = target_business_workspace_id,
      invited_by = target_user_id,
      workspace_name = 'Vallective Business'
  where id = noah_invitation_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to rebind 1 Noah invitation, rebound %.', affected_rows;
  end if;

  update public.vallective_workspaces
  set name = 'Vallective Business'
  where id = target_business_workspace_id;

  insert into public.vallective_workspace_audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    metadata
  )
  values
    (
      target_personal_workspace_id,
      target_user_id,
      'account_data_consolidated',
      'workspace',
      jsonb_build_object(
        'source_account', 'nesportsdk@gmail.com',
        'target_account', 'ne@eeckhardt.dk',
        'source_workspace_kind', 'personal',
        'collections', 1,
        'cards', 2,
        'transactions', 1,
        'cardshow_events', 1,
        'storage_objects_retained_at_audited_paths', 4
      )
    ),
    (
      target_business_workspace_id,
      target_user_id,
      'account_data_consolidated',
      'workspace',
      jsonb_build_object(
        'source_account', 'nesportsdk@gmail.com',
        'target_account', 'ne@eeckhardt.dk',
        'source_workspace_kind', 'business',
        'collections', 1,
        'cards', 1,
        'scan_capture_items', 11,
        'storage_objects_retained_at_audited_paths', 22,
        'invitation_rebound', true,
        'invitation_email_unchanged', true
      )
    );

  if exists (select 1 from public.collections where user_id = source_user_id)
    or exists (select 1 from public.cards where user_id = source_user_id)
    or exists (select 1 from public.card_attributes where user_id = source_user_id)
    or exists (select 1 from public.card_collection_history where user_id = source_user_id)
    or exists (select 1 from public.card_images where user_id = source_user_id)
    or exists (select 1 from public.card_market_estimates where user_id = source_user_id)
    or exists (select 1 from public.card_market_comparables where user_id = source_user_id)
    or exists (select 1 from public.card_transactions where user_id = source_user_id)
    or exists (select 1 from public.cardshow_events where user_id = source_user_id)
    or exists (select 1 from public.scan_capture_items where user_id = source_user_id)
    or exists (select 1 from public.beta_feedback where user_id = source_user_id)
    or exists (select 1 from public.beta_pilot_participants where user_id = source_user_id)
    or exists (select 1 from public.beta_pilot_coverage_checks where user_id = source_user_id)
    or exists (
      select 1
      from public.vallective_team_invitations
      where owner_user_id = source_user_id
    )
  then
    raise exception 'Source ownership references remain after consolidation.';
  end if;
end;
$$;

alter table public.collections
  enable trigger collections_prevent_vallective_user_id_change;
alter table public.cards
  enable trigger cards_prevent_vallective_user_id_change;
alter table public.card_attributes
  enable trigger card_attributes_prevent_vallective_user_id_change;
alter table public.card_market_estimates
  enable trigger card_market_estimates_prevent_vallective_user_id_change;

commit;
