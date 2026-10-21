-- Internal publication queue for single-card Shopify listings.
--
-- Shopify remains the public catalogue and checkout system. This table only
-- records which business-workspace cards are approved for publication and
-- stores the identifiers needed to reconcile them with Shopify later.

create table public.storefront_listings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.vallective_workspaces(id) on delete restrict,
  card_id uuid not null references public.cards(id) on delete restrict,
  data_owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'ready_for_shopify',
  title text not null,
  description text,
  condition_label text,
  price_amount numeric(12, 2) not null,
  currency text not null default 'DKK',
  quantity smallint not null default 1,
  shopify_product_id text,
  shopify_variant_id text,
  shopify_handle text,
  sync_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storefront_listings_card_unique unique (card_id),
  constraint storefront_listings_status_check check (
    status in (
      'ready_for_shopify',
      'synced',
      'published',
      'paused',
      'sold',
      'error'
    )
  ),
  constraint storefront_listings_title_check
    check (char_length(btrim(title)) between 1 and 180),
  constraint storefront_listings_description_check
    check (description is null or char_length(description) <= 5000),
  constraint storefront_listings_condition_check
    check (condition_label is null or char_length(btrim(condition_label)) between 1 and 80),
  constraint storefront_listings_price_check check (price_amount > 0),
  constraint storefront_listings_currency_check check (currency in ('DKK', 'EUR')),
  constraint storefront_listings_quantity_check check (quantity between 0 and 1),
  constraint storefront_listings_shopify_identity_check check (
    status not in ('synced', 'published', 'sold')
    or (
      shopify_product_id is not null
      and shopify_variant_id is not null
      and shopify_handle is not null
    )
  )
);

comment on table public.storefront_listings is
  'Private business-workspace publication queue and reconciliation metadata for the public Shopify catalogue.';

create index storefront_listings_workspace_status_updated_idx
  on public.storefront_listings (workspace_id, status, updated_at desc);
create index storefront_listings_data_owner_idx
  on public.storefront_listings (data_owner_user_id);
create index storefront_listings_created_by_idx
  on public.storefront_listings (created_by_user_id);
create index storefront_listings_updated_by_idx
  on public.storefront_listings (updated_by_user_id);
create unique index storefront_listings_shopify_product_unique_idx
  on public.storefront_listings (shopify_product_id)
  where shopify_product_id is not null;
create unique index storefront_listings_shopify_variant_unique_idx
  on public.storefront_listings (shopify_variant_id)
  where shopify_variant_id is not null;
create unique index storefront_listings_shopify_handle_unique_idx
  on public.storefront_listings (shopify_handle)
  where shopify_handle is not null;

create or replace function private.prepare_storefront_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  card_owner_user_id uuid;
begin
  if actor_user_id is null then
    raise exception using message = 'Authentication required.', errcode = '42501';
  end if;

  if not private.can_manage_vallective_workspace_capability(new.workspace_id, 'sales') then
    raise exception using message = 'Sales access is required for this workspace.', errcode = '42501';
  end if;

  select card.user_id
  into card_owner_user_id
  from public.cards card
  join public.vallective_workspaces workspace
    on workspace.id = card.workspace_id
  where card.id = new.card_id
    and card.workspace_id = new.workspace_id
    and workspace.kind = 'business'
    and workspace.status = 'active';

  if card_owner_user_id is null then
    raise exception using message = 'The card must belong to an active business workspace.', errcode = '23503';
  end if;

  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
      or new.card_id is distinct from old.card_id
      or new.data_owner_user_id is distinct from old.data_owner_user_id
      or new.created_by_user_id is distinct from old.created_by_user_id then
      raise exception using message = 'Storefront listing ownership cannot be changed.', errcode = '42501';
    end if;

    new.updated_by_user_id = actor_user_id;
    new.updated_at = now();
  else
    new.data_owner_user_id = card_owner_user_id;
    new.created_by_user_id = actor_user_id;
    new.updated_by_user_id = actor_user_id;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  elsif new.status <> 'published' then
    new.published_at = null;
  end if;

  if new.status <> 'error' then
    new.sync_error = null;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_storefront_listing()
  from public, anon, authenticated, service_role;

create trigger storefront_listings_prepare
before insert or update on public.storefront_listings
for each row execute function private.prepare_storefront_listing();

create or replace function private.audit_storefront_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.vallective_workspace_audit_events (
    workspace_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    new.workspace_id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'storefront_listing.created' else 'storefront_listing.updated' end,
    'storefront_listing',
    new.id,
    jsonb_build_object(
      'card_id', new.card_id,
      'status', new.status,
      'price_amount', new.price_amount,
      'currency', new.currency,
      'shopify_product_id', new.shopify_product_id
    )
  );

  return new;
end;
$$;

revoke all on function private.audit_storefront_listing()
  from public, anon, authenticated, service_role;

create trigger storefront_listings_audit
after insert or update on public.storefront_listings
for each row execute function private.audit_storefront_listing();

alter table public.storefront_listings enable row level security;

revoke all on table public.storefront_listings from public, anon, authenticated;
grant select, insert, update on table public.storefront_listings to authenticated;

create policy "Workspace members can view storefront listings"
on public.storefront_listings
for select
to authenticated
using ((select private.can_access_vallective_workspace(workspace_id)));

create policy "Workspace sales managers can add storefront listings"
on public.storefront_listings
for insert
to authenticated
with check ((select private.can_manage_vallective_workspace_capability(workspace_id, 'sales')));

create policy "Workspace sales managers can update storefront listings"
on public.storefront_listings
for update
to authenticated
using ((select private.can_manage_vallective_workspace_capability(workspace_id, 'sales')))
with check ((select private.can_manage_vallective_workspace_capability(workspace_id, 'sales')));
