-- Retire the owner-only RPC entry points after the application has moved to
-- their capability-checked workspace wrappers.

create index purchase_lots_created_by_user_idx
  on public.purchase_lots (created_by_user_id);

revoke execute on function public.create_cardshow_event(
  text, text, text, text, timestamptz, timestamptz, text, text[],
  numeric, numeric, numeric, numeric, numeric, text
) from public, anon, authenticated;

revoke execute on function public.upsert_cardshow_inventory_items(uuid, jsonb)
  from public, anon, authenticated;

revoke execute on function public.create_purchase_lot(
  text, text, text, text, text, timestamptz, text, numeric, numeric,
  numeric, numeric, numeric, text, jsonb, boolean, boolean
) from public, anon, authenticated;

revoke execute on function public.lock_purchase_lot(uuid, boolean)
  from public, anon, authenticated;

revoke execute on function public.create_grading_submission(
  text, text, text, text, text, integer, numeric, numeric, numeric,
  numeric, numeric, text, jsonb
) from public, anon, authenticated;

revoke execute on function public.transition_grading_submission(
  uuid, text, timestamptz, text, text, text, text
) from public, anon, authenticated;

revoke execute on function public.record_grading_card_result(
  uuid, text, text, text, jsonb, numeric, text, timestamptz
) from public, anon, authenticated;
