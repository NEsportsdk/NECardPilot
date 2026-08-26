-- Security and RLS hardening prepared from the live advisor findings.
-- This migration is intentionally NOT applied to the existing live project by M1.

begin;

-- NECardPilot requires authentication for all application data.
revoke all privileges on all tables in schema public from anon;

revoke execute on function public.activate_card_market_estimate(p_estimate_id uuid) from public, anon;
grant execute on function public.activate_card_market_estimate(p_estimate_id uuid) to authenticated;

revoke execute on function public.create_cardshow_event(p_name text, p_venue text, p_city text, p_address text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_currency text, p_payment_methods text[], p_booth_fee numeric, p_travel_cost numeric, p_accommodation_cost numeric, p_food_cost numeric, p_other_event_costs numeric, p_notes text) from public, anon;
grant execute on function public.create_cardshow_event(p_name text, p_venue text, p_city text, p_address text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_currency text, p_payment_methods text[], p_booth_fee numeric, p_travel_cost numeric, p_accommodation_cost numeric, p_food_cost numeric, p_other_event_costs numeric, p_notes text) to authenticated;

revoke execute on function public.create_grading_submission(p_name text, p_grading_company text, p_service_level text, p_currency text, p_submission_number text, p_estimated_turnaround_days integer, p_submission_fee numeric, p_outbound_shipping_cost numeric, p_return_shipping_cost numeric, p_insurance_cost numeric, p_other_shared_costs numeric, p_notes text, p_cards jsonb) from public, anon;
grant execute on function public.create_grading_submission(p_name text, p_grading_company text, p_service_level text, p_currency text, p_submission_number text, p_estimated_turnaround_days integer, p_submission_fee numeric, p_outbound_shipping_cost numeric, p_return_shipping_cost numeric, p_insurance_cost numeric, p_other_shared_costs numeric, p_notes text, p_cards jsonb) to authenticated;

revoke execute on function public.create_purchase_lot(p_name text, p_allocation_method text, p_source text, p_seller text, p_purchase_reference text, p_purchased_at timestamp with time zone, p_currency text, p_purchase_amount numeric, p_buyer_fee numeric, p_shipping_cost numeric, p_taxes numeric, p_other_costs numeric, p_notes text, p_cards jsonb, p_lock boolean, p_overwrite_existing_purchase_price boolean) from public, anon;
grant execute on function public.create_purchase_lot(p_name text, p_allocation_method text, p_source text, p_seller text, p_purchase_reference text, p_purchased_at timestamp with time zone, p_currency text, p_purchase_amount numeric, p_buyer_fee numeric, p_shipping_cost numeric, p_taxes numeric, p_other_costs numeric, p_notes text, p_cards jsonb, p_lock boolean, p_overwrite_existing_purchase_price boolean) to authenticated;

revoke execute on function public.lock_purchase_lot(p_lot_id uuid, p_overwrite_existing_purchase_price boolean) from public, anon;
grant execute on function public.lock_purchase_lot(p_lot_id uuid, p_overwrite_existing_purchase_price boolean) to authenticated;

revoke execute on function public.record_card_sale(p_card_id uuid, p_sale_price numeric, p_shipping_income numeric, p_platform_fee numeric, p_payment_fee numeric, p_shipping_cost numeric, p_other_costs numeric, p_platform text, p_buyer text, p_reference text, p_notes text, p_sold_at timestamp with time zone) from public, anon;
grant execute on function public.record_card_sale(p_card_id uuid, p_sale_price numeric, p_shipping_income numeric, p_platform_fee numeric, p_payment_fee numeric, p_shipping_cost numeric, p_other_costs numeric, p_platform text, p_buyer text, p_reference text, p_notes text, p_sold_at timestamp with time zone) to authenticated;

revoke execute on function public.record_grading_card_result(p_submission_card_id uuid, p_result_grade text, p_certification_number text, p_result_qualifier text, p_result_subgrades jsonb, p_result_market_value numeric, p_result_notes text, p_graded_at timestamp with time zone) from public, anon;
grant execute on function public.record_grading_card_result(p_submission_card_id uuid, p_result_grade text, p_certification_number text, p_result_qualifier text, p_result_subgrades jsonb, p_result_market_value numeric, p_result_notes text, p_graded_at timestamp with time zone) to authenticated;

revoke execute on function public.transition_grading_submission(p_submission_id uuid, p_target_status text, p_occurred_at timestamp with time zone, p_submission_number text, p_outbound_tracking_number text, p_return_tracking_number text, p_notes text) from public, anon;
grant execute on function public.transition_grading_submission(p_submission_id uuid, p_target_status text, p_occurred_at timestamp with time zone, p_submission_number text, p_outbound_tracking_number text, p_return_tracking_number text, p_notes text) to authenticated;

revoke execute on function public.upsert_cardshow_inventory_items(p_event_id uuid, p_items jsonb) from public, anon;
grant execute on function public.upsert_cardshow_inventory_items(p_event_id uuid, p_items jsonb) to authenticated;

revoke execute on function public.record_card_collection_movement() from public, anon, authenticated;

alter function public.set_card_market_estimates_updated_at() set search_path = public, pg_temp;
revoke execute on function public.set_card_market_estimates_updated_at() from public, anon, authenticated;

alter function public.set_card_transactions_updated_at() set search_path = public, pg_temp;
revoke execute on function public.set_card_transactions_updated_at() from public, anon, authenticated;

alter function public.set_cards_updated_at() set search_path = public, pg_temp;
revoke execute on function public.set_cards_updated_at() from public, anon, authenticated;

alter function public.set_cardshow_updated_at() set search_path = public, pg_temp;
revoke execute on function public.set_cardshow_updated_at() from public, anon, authenticated;

alter function public.set_grading_updated_at() set search_path = public, pg_temp;
revoke execute on function public.set_grading_updated_at() from public, anon, authenticated;

drop policy if exists "Users can create own card attributes" on public.card_attributes;
create policy "Users can create own card attributes" on public.card_attributes as permissive for insert to authenticated
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own card attributes" on public.card_attributes;
create policy "Users can delete own card attributes" on public.card_attributes as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own card attributes" on public.card_attributes;
create policy "Users can update own card attributes" on public.card_attributes as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can view own card attributes" on public.card_attributes;
create policy "Users can view own card attributes" on public.card_attributes as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can view own card history" on public.card_collection_history;
create policy "Users can view own card history" on public.card_collection_history as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can create own card images" on public.card_images;
create policy "Users can create own card images" on public.card_images as permissive for insert to authenticated
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own card images" on public.card_images;
create policy "Users can delete own card images" on public.card_images as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own card images" on public.card_images;
create policy "Users can update own card images" on public.card_images as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can view own card images" on public.card_images;
create policy "Users can view own card images" on public.card_images as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can create own market comparables" on public.card_market_comparables;
create policy "Users can create own market comparables" on public.card_market_comparables as permissive for insert to authenticated
with check (((select auth.uid()) = user_id) and exists (
  select 1
  from public.card_market_estimates
  where card_market_estimates.id = card_market_comparables.estimate_id
    and card_market_estimates.user_id = (select auth.uid())
));

drop policy if exists "Users can delete own market comparables" on public.card_market_comparables;
create policy "Users can delete own market comparables" on public.card_market_comparables as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own market comparables" on public.card_market_comparables;
create policy "Users can update own market comparables" on public.card_market_comparables as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can view own market comparables" on public.card_market_comparables;
create policy "Users can view own market comparables" on public.card_market_comparables as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can create own market estimates" on public.card_market_estimates;
create policy "Users can create own market estimates" on public.card_market_estimates as permissive for insert to authenticated
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM cards
  WHERE ((cards.id = card_market_estimates.card_id) AND (cards.user_id = (select auth.uid())))))));

drop policy if exists "Users can delete own market estimates" on public.card_market_estimates;
create policy "Users can delete own market estimates" on public.card_market_estimates as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own market estimates" on public.card_market_estimates;
create policy "Users can update own market estimates" on public.card_market_estimates as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM cards
  WHERE ((cards.id = card_market_estimates.card_id) AND (cards.user_id = (select auth.uid())))))));

drop policy if exists "Users can view own market estimates" on public.card_market_estimates;
create policy "Users can view own market estimates" on public.card_market_estimates as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can view own card transactions" on public.card_transactions;
create policy "Users can view own card transactions" on public.card_transactions as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own cards" on public.cards;
create policy "Users can delete own cards" on public.cards as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert own cards" on public.cards;
create policy "Users can insert own cards" on public.cards as permissive for insert to authenticated
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = cards.current_collection_id) AND (collections.user_id = (select auth.uid())))))));

drop policy if exists "Users can update own cards" on public.cards;
create policy "Users can update own cards" on public.cards as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = cards.current_collection_id) AND (collections.user_id = (select auth.uid())))))));

drop policy if exists "Users can view own cards" on public.cards;
create policy "Users can view own cards" on public.cards as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can view own cardshow events" on public.cardshow_events;
create policy "Users can view own cardshow events" on public.cardshow_events as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can view own cardshow inventory" on public.cardshow_inventory_items;
create policy "Users can view own cardshow inventory" on public.cardshow_inventory_items as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own collections" on public.collections;
create policy "Users can delete own collections" on public.collections as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert own collections" on public.collections;
create policy "Users can insert own collections" on public.collections as permissive for insert to authenticated
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can update own collections" on public.collections;
create policy "Users can update own collections" on public.collections as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can view own collections" on public.collections;
create policy "Users can view own collections" on public.collections as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can create own grading submission cards" on public.grading_submission_cards;
create policy "Users can create own grading submission cards" on public.grading_submission_cards as permissive for insert to authenticated
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM grading_submissions submission
  WHERE ((submission.id = grading_submission_cards.submission_id) AND (submission.user_id = (select auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM cards card
  WHERE ((card.id = grading_submission_cards.card_id) AND (card.user_id = (select auth.uid())))))));

drop policy if exists "Users can delete own grading submission cards" on public.grading_submission_cards;
create policy "Users can delete own grading submission cards" on public.grading_submission_cards as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own grading submission cards" on public.grading_submission_cards;
create policy "Users can update own grading submission cards" on public.grading_submission_cards as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM grading_submissions submission
  WHERE ((submission.id = grading_submission_cards.submission_id) AND (submission.user_id = (select auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM cards card
  WHERE ((card.id = grading_submission_cards.card_id) AND (card.user_id = (select auth.uid())))))));

drop policy if exists "Users can view own grading submission cards" on public.grading_submission_cards;
create policy "Users can view own grading submission cards" on public.grading_submission_cards as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can create own grading events" on public.grading_submission_events;
create policy "Users can create own grading events" on public.grading_submission_events as permissive for insert to authenticated
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM grading_submissions submission
  WHERE ((submission.id = grading_submission_events.submission_id) AND (submission.user_id = (select auth.uid())))))));

drop policy if exists "Users can delete own grading events" on public.grading_submission_events;
create policy "Users can delete own grading events" on public.grading_submission_events as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own grading events" on public.grading_submission_events;
create policy "Users can update own grading events" on public.grading_submission_events as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can view own grading events" on public.grading_submission_events;
create policy "Users can view own grading events" on public.grading_submission_events as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can create own grading submissions" on public.grading_submissions;
create policy "Users can create own grading submissions" on public.grading_submissions as permissive for insert to authenticated
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own grading submissions" on public.grading_submissions;
create policy "Users can delete own grading submissions" on public.grading_submissions as permissive for delete to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own grading submissions" on public.grading_submissions;
create policy "Users can update own grading submissions" on public.grading_submissions as permissive for update to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

drop policy if exists "Users can view own grading submissions" on public.grading_submissions;
create policy "Users can view own grading submissions" on public.grading_submissions as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can view own purchase lot cards" on public.purchase_lot_cards;
create policy "Users can view own purchase lot cards" on public.purchase_lot_cards as permissive for select to authenticated
using (((select auth.uid()) = user_id));

drop policy if exists "Users can view own purchase lots" on public.purchase_lots;
create policy "Users can view own purchase lots" on public.purchase_lots as permissive for select to authenticated
using (((select auth.uid()) = user_id));

-- Cover foreign-key columns reported by the performance advisor.
create index if not exists idx_card_collection_history_card_id on public.card_collection_history (card_id);
create index if not exists idx_card_collection_history_from_collection_id on public.card_collection_history (from_collection_id);
create index if not exists idx_card_collection_history_to_collection_id on public.card_collection_history (to_collection_id);
create index if not exists idx_card_collection_history_user_id on public.card_collection_history (user_id);
create index if not exists idx_card_market_comparables_user_id on public.card_market_comparables (user_id);
create index if not exists idx_card_transactions_collection_id on public.card_transactions (collection_id);
create index if not exists idx_cards_current_collection_id on public.cards (current_collection_id);
create index if not exists idx_cards_user_id on public.cards (user_id);
create index if not exists idx_collections_user_id on public.collections (user_id);
create index if not exists idx_grading_submission_events_submission_card_id on public.grading_submission_events (submission_card_id);

commit;
