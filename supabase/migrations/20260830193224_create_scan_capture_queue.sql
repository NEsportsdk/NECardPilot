create table public.scan_capture_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  capture_session_id uuid not null,
  status text not null default 'uploaded',
  front_image_path text not null,
  back_image_path text not null,
  front_original_name text not null,
  back_original_name text not null,
  front_mime_type text not null,
  back_mime_type text not null,
  front_size_bytes integer not null,
  back_size_bytes integer not null,
  identification_result jsonb,
  identification_usage jsonb,
  attempt_count smallint not null default 0,
  failure_stage text,
  error_message text,
  card_id uuid references public.cards(id) on delete cascade,
  captured_at timestamp with time zone not null default now(),
  identification_started_at timestamp with time zone,
  identified_at timestamp with time zone,
  saved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint scan_capture_items_status_check
    check (
      status in (
        'uploaded',
        'identifying',
        'identified',
        'needs_review',
        'saved',
        'failed'
      )
    ),
  constraint scan_capture_items_failure_stage_check
    check (
      failure_stage is null
      or failure_stage in ('upload', 'identification', 'review')
    ),
  constraint scan_capture_items_paths_check
    check (
      char_length(front_image_path) between 3 and 1000
      and char_length(back_image_path) between 3 and 1000
      and front_image_path <> back_image_path
    ),
  constraint scan_capture_items_names_check
    check (
      char_length(front_original_name) between 1 and 255
      and char_length(back_original_name) between 1 and 255
    ),
  constraint scan_capture_items_mime_types_check
    check (
      front_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
      and back_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    ),
  constraint scan_capture_items_sizes_check
    check (
      front_size_bytes between 1 and 15728640
      and back_size_bytes between 1 and 15728640
    ),
  constraint scan_capture_items_attempt_count_check
    check (attempt_count between 0 and 20),
  constraint scan_capture_items_error_length_check
    check (error_message is null or char_length(error_message) <= 2000),
  constraint scan_capture_items_identification_state_check
    check (
      status not in ('identified', 'needs_review', 'saved')
      or identification_result is not null
    ),
  constraint scan_capture_items_saved_state_check
    check (
      (status = 'saved' and card_id is not null and saved_at is not null)
      or (status <> 'saved' and card_id is null and saved_at is null)
    )
);

comment on table public.scan_capture_items is
  'Durable user-owned capture queue for front/back card images before identification, review, and valuation.';

create unique index scan_capture_items_user_front_path_idx
  on public.scan_capture_items (user_id, front_image_path);

create unique index scan_capture_items_user_back_path_idx
  on public.scan_capture_items (user_id, back_image_path);

create index scan_capture_items_user_created_idx
  on public.scan_capture_items (user_id, created_at);

create index scan_capture_items_collection_created_idx
  on public.scan_capture_items (collection_id, created_at desc);

create index scan_capture_items_card_id_idx
  on public.scan_capture_items (card_id)
  where card_id is not null;

create or replace function public.set_scan_capture_items_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke execute on function public.set_scan_capture_items_updated_at()
from public, anon, authenticated;

create trigger scan_capture_items_set_updated_at
before update on public.scan_capture_items
for each row
execute function public.set_scan_capture_items_updated_at();

alter table public.scan_capture_items enable row level security;

revoke all on table public.scan_capture_items from anon, authenticated;

grant select on table public.scan_capture_items to authenticated;

grant insert (
  id,
  user_id,
  collection_id,
  capture_session_id,
  status,
  front_image_path,
  back_image_path,
  front_original_name,
  back_original_name,
  front_mime_type,
  back_mime_type,
  front_size_bytes,
  back_size_bytes,
  captured_at
) on table public.scan_capture_items to authenticated;

grant update (
  status,
  identification_result,
  identification_usage,
  attempt_count,
  failure_stage,
  error_message,
  card_id,
  identification_started_at,
  identified_at,
  saved_at
) on table public.scan_capture_items to authenticated;

grant delete on table public.scan_capture_items to authenticated;

create policy "Users can read own capture queue"
on public.scan_capture_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add own captured cards"
on public.scan_capture_items
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'uploaded'
  and identification_result is null
  and identification_usage is null
  and attempt_count = 0
  and failure_stage is null
  and error_message is null
  and card_id is null
  and identification_started_at is null
  and identified_at is null
  and saved_at is null
  and front_image_path like user_id::text || '/%'
  and back_image_path like user_id::text || '/%'
  and exists (
    select 1
    from public.collections
    where collections.id = scan_capture_items.collection_id
      and collections.user_id = (select auth.uid())
  )
);

create policy "Users can update own capture queue"
on public.scan_capture_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.collections
    where collections.id = scan_capture_items.collection_id
      and collections.user_id = (select auth.uid())
  )
  and (
    card_id is null
    or exists (
      select 1
      from public.cards
      where cards.id = scan_capture_items.card_id
        and cards.user_id = (select auth.uid())
    )
  )
);

create policy "Users can remove own capture queue"
on public.scan_capture_items
for delete
to authenticated
using ((select auth.uid()) = user_id);
