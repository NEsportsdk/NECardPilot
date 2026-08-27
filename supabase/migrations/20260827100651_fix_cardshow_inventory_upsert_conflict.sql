begin;

do $migration$
declare
  v_signature regprocedure :=
    'public.upsert_cardshow_inventory_items(uuid,jsonb)'::regprocedure;
  v_original_definition text;
  v_fixed_definition text;
begin
  select pg_get_functiondef(v_signature)
  into v_original_definition;

  v_fixed_definition := regexp_replace(
    v_original_definition,
    'on conflict\s*\(\s*event_id\s*,\s*card_id\s*\)',
    'on conflict on constraint cardshow_inventory_items_event_id_card_id_key',
    'i'
  );

  if v_fixed_definition = v_original_definition then
    if position(
      'ON CONFLICT ON CONSTRAINT CARDSHOW_INVENTORY_ITEMS_EVENT_ID_CARD_ID_KEY'
      in upper(v_original_definition)
    ) = 0 then
      raise exception
        'The Cardshow inventory upsert conflict target was not found.';
    end if;
  else
    execute v_fixed_definition;
  end if;
end
$migration$;

revoke execute on function public.upsert_cardshow_inventory_items(uuid, jsonb)
from public, anon;

grant execute on function public.upsert_cardshow_inventory_items(uuid, jsonb)
to authenticated;

commit;
