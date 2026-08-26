-- Baseline captured read-only from Supabase project yglecdgndfctltmuekju.
-- Generated for local version control only; do not apply to the existing live project.

set check_function_bodies = off;

create table public.card_attributes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  card_id uuid not null,
  attribute_key text not null,
  attribute_value jsonb not null,
  source text default 'manual'::text not null,
  confidence_score numeric(5,2),
  is_verified boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.card_collection_history (
  id uuid default gen_random_uuid() not null,
  card_id uuid not null,
  user_id uuid not null,
  from_collection_id uuid,
  to_collection_id uuid not null,
  reason text,
  moved_at timestamp with time zone default now() not null
);

create table public.card_images (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  card_id uuid not null,
  image_type text not null,
  storage_path text not null,
  public_url text,
  created_at timestamp with time zone default now() not null
);

create table public.card_market_comparables (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  estimate_id uuid not null,
  card_id uuid not null,
  source_name text not null,
  source_domain text,
  source_url text not null,
  external_id text,
  evidence_type text not null,
  title text not null,
  sold_at timestamp with time zone,
  price numeric(12,2) not null,
  shipping_price numeric(12,2) default 0 not null,
  total_price numeric(12,2) generated always as ((price + shipping_price)) stored,
  currency text not null,
  exchange_rate_to_estimate numeric(18,8),
  normalized_total numeric(12,2),
  condition_label text,
  grading_company text,
  grade text,
  serial_number text,
  sale_format text,
  match_score numeric(5,2),
  included boolean default false not null,
  exclusion_reason text,
  match_notes text[] default ARRAY[]::text[] not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.card_market_estimates (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  card_id uuid not null,
  status text default 'pending'::text not null,
  canonical_title text,
  subject_condition text default 'raw'::text not null,
  grading_company text,
  grade text,
  currency text default 'DKK'::text not null,
  estimated_value numeric(12,2),
  low_value numeric(12,2),
  high_value numeric(12,2),
  confidence_score numeric(5,2),
  comparable_count integer default 0 not null,
  included_comparable_count integer default 0 not null,
  source_count integer default 0 not null,
  search_query text,
  methodology_version text default 'market-v1'::text not null,
  valuation_summary text,
  valuation_notes text[] default ARRAY[]::text[] not null,
  warnings text[] default ARRAY[]::text[] not null,
  source_urls text[] default ARRAY[]::text[] not null,
  model_name text,
  response_id text,
  input_tokens integer,
  output_tokens integer,
  web_search_calls integer,
  error_message text,
  data_as_of timestamp with time zone,
  is_current boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.card_transactions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  card_id uuid not null,
  collection_id uuid,
  transaction_type text not null,
  status text default 'completed'::text not null,
  occurred_at timestamp with time zone default now() not null,
  currency text default 'DKK'::text not null,
  item_amount numeric(12,2) default 0 not null,
  shipping_income numeric(12,2) default 0 not null,
  platform_fee numeric(12,2) default 0 not null,
  payment_fee numeric(12,2) default 0 not null,
  shipping_cost numeric(12,2) default 0 not null,
  other_costs numeric(12,2) default 0 not null,
  cost_basis numeric(12,2) default 0 not null,
  net_amount numeric(12,2) generated always as ((((((item_amount + shipping_income) - platform_fee) - payment_fee) - shipping_cost) - other_costs)) stored,
  realized_profit numeric(12,2) generated always as (((((((item_amount + shipping_income) - platform_fee) - payment_fee) - shipping_cost) - other_costs) - cost_basis)) stored,
  platform text,
  counterparty text,
  reference text,
  notes text,
  card_state_before text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.cards (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  current_collection_id uuid not null,
  player_name text not null,
  year text,
  manufacturer text,
  set_name text,
  card_number text,
  parallel_name text,
  serial_number text,
  purchase_price numeric(12,2),
  estimated_value numeric(12,2),
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  state text default 'draft'::text not null,
  market_estimated_value numeric(12,2),
  market_value_low numeric(12,2),
  market_value_high numeric(12,2),
  market_value_currency text,
  market_value_confidence numeric(5,2),
  market_value_updated_at timestamp with time zone,
  current_market_estimate_id uuid
);

create table public.cardshow_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  status text default 'planning'::text not null,
  venue text,
  city text,
  address text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  currency text default 'DKK'::text not null,
  payment_methods text[] default ARRAY['cash'::text, 'mobilepay'::text, 'card'::text, 'other'::text] not null,
  booth_fee numeric(12,2) default 0 not null,
  travel_cost numeric(12,2) default 0 not null,
  accommodation_cost numeric(12,2) default 0 not null,
  food_cost numeric(12,2) default 0 not null,
  other_event_costs numeric(12,2) default 0 not null,
  event_cost_total numeric(12,2) generated always as (((((booth_fee + travel_cost) + accommodation_cost) + food_cost) + other_event_costs)) stored,
  notes text,
  activated_at timestamp with time zone,
  closed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.cardshow_inventory_items (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  event_id uuid not null,
  card_id uuid not null,
  status text default 'available'::text not null,
  asking_price numeric(12,2),
  floor_price numeric(12,2),
  price_source text default 'manual'::text not null,
  price_group_label text,
  price_group_amount numeric(12,2),
  location_label text,
  inventory_code text,
  reference_value numeric(12,2),
  reference_value_source text,
  reference_value_captured_at timestamp with time zone,
  reserved_for text,
  reservation_note text,
  reserved_at timestamp with time zone,
  reserved_until timestamp with time zone,
  sold_at timestamp with time zone,
  withdrawn_at timestamp with time zone,
  notes text,
  added_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.collections (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  type text not null,
  currency text default 'DKK'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.grading_submission_cards (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  submission_id uuid not null,
  card_id uuid not null,
  "position" integer default 1 not null,
  status text default 'queued'::text not null,
  original_card_state text,
  declared_value numeric(12,2),
  grading_fee numeric(12,2) default 0 not null,
  preparation_fee numeric(12,2) default 0 not null,
  allocated_shared_cost numeric(12,2) default 0 not null,
  other_card_costs numeric(12,2) default 0 not null,
  total_grading_cost numeric(12,2) generated always as ((((grading_fee + preparation_fee) + allocated_shared_cost) + other_card_costs)) stored,
  raw_value_snapshot numeric(12,2),
  expected_grade text,
  expected_graded_value numeric(12,2),
  result_grade text,
  result_qualifier text,
  certification_number text,
  result_subgrades jsonb default '{}'::jsonb not null,
  result_market_value numeric(12,2),
  result_notes text,
  submitted_at timestamp with time zone,
  graded_at timestamp with time zone,
  returned_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.grading_submission_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  submission_id uuid not null,
  submission_card_id uuid,
  card_id uuid,
  event_type text not null,
  from_status text,
  to_status text,
  message text,
  metadata jsonb default '{}'::jsonb not null,
  occurred_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table public.grading_submissions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  grading_company text not null,
  service_level text,
  status text default 'draft'::text not null,
  currency text default 'DKK'::text not null,
  submission_number text,
  outbound_tracking_number text,
  return_tracking_number text,
  estimated_turnaround_days integer,
  submission_fee numeric(12,2) default 0 not null,
  outbound_shipping_cost numeric(12,2) default 0 not null,
  return_shipping_cost numeric(12,2) default 0 not null,
  insurance_cost numeric(12,2) default 0 not null,
  other_shared_costs numeric(12,2) default 0 not null,
  shared_cost_total numeric(12,2) generated always as (((((submission_fee + outbound_shipping_cost) + return_shipping_cost) + insurance_cost) + other_shared_costs)) stored,
  notes text,
  ready_at timestamp with time zone,
  shipped_at timestamp with time zone,
  received_by_grader_at timestamp with time zone,
  grading_started_at timestamp with time zone,
  grades_ready_at timestamp with time zone,
  returned_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.purchase_lot_cards (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  lot_id uuid not null,
  card_id uuid not null,
  "position" integer default 1 not null,
  reference_source text default 'equal'::text not null,
  reference_value numeric(12,2),
  allocation_weight numeric(18,12),
  allocated_cost numeric(12,2),
  manual_allocated_cost numeric(12,2),
  allocation_note text,
  allocated_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  previous_purchase_price numeric(12,2),
  cost_locked_at timestamp with time zone
);

create table public.purchase_lots (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  status text default 'draft'::text not null,
  allocation_method text default 'proportional'::text not null,
  source text,
  seller text,
  purchase_reference text,
  purchased_at timestamp with time zone default now() not null,
  currency text default 'DKK'::text not null,
  purchase_amount numeric(12,2) default 0 not null,
  buyer_fee numeric(12,2) default 0 not null,
  shipping_cost numeric(12,2) default 0 not null,
  taxes numeric(12,2) default 0 not null,
  other_costs numeric(12,2) default 0 not null,
  total_cost numeric(12,2) generated always as (((((purchase_amount + buyer_fee) + shipping_cost) + taxes) + other_costs)) stored,
  allocation_reference_total numeric(12,2),
  allocated_total numeric(12,2),
  allocation_notes text,
  notes text,
  allocated_at timestamp with time zone,
  locked_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.test (
  name text not null,
  "Nicky" text
);

alter table only public.card_attributes add constraint card_attributes_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_attributes add constraint card_attributes_confidence_check CHECK (confidence_score IS NULL OR confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

alter table only public.card_attributes add constraint card_attributes_pkey PRIMARY KEY (id);

alter table only public.card_attributes add constraint card_attributes_source_check CHECK (source = ANY (ARRAY['manual'::text, 'ai'::text, 'import'::text, 'marketplace'::text]));

alter table only public.card_attributes add constraint card_attributes_unique_key UNIQUE (card_id, attribute_key);

alter table only public.card_attributes add constraint card_attributes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.card_collection_history add constraint card_collection_history_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_collection_history add constraint card_collection_history_from_collection_id_fkey FOREIGN KEY (from_collection_id) REFERENCES collections(id) ON DELETE SET NULL;

alter table only public.card_collection_history add constraint card_collection_history_pkey PRIMARY KEY (id);

alter table only public.card_collection_history add constraint card_collection_history_to_collection_id_fkey FOREIGN KEY (to_collection_id) REFERENCES collections(id) ON DELETE RESTRICT;

alter table only public.card_collection_history add constraint card_collection_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.card_images add constraint card_images_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_images add constraint card_images_pkey PRIMARY KEY (id);

alter table only public.card_images add constraint card_images_type_check CHECK (image_type = ANY (ARRAY['front'::text, 'back'::text, 'slab'::text, 'detail'::text]));

alter table only public.card_images add constraint card_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.card_market_comparables add constraint card_market_comparables_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_market_comparables add constraint card_market_comparables_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

alter table only public.card_market_comparables add constraint card_market_comparables_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES card_market_estimates(id) ON DELETE CASCADE;

alter table only public.card_market_comparables add constraint card_market_comparables_evidence_type_check CHECK (evidence_type = ANY (ARRAY['sold'::text, 'accepted_offer'::text, 'asking'::text, 'market_index'::text, 'manual'::text]));

alter table only public.card_market_comparables add constraint card_market_comparables_exchange_rate_to_estimate_check CHECK (exchange_rate_to_estimate IS NULL OR exchange_rate_to_estimate > 0::numeric);

alter table only public.card_market_comparables add constraint card_market_comparables_match_score_check CHECK (match_score IS NULL OR match_score >= 0::numeric AND match_score <= 100::numeric);

alter table only public.card_market_comparables add constraint card_market_comparables_normalized_total_check CHECK (normalized_total IS NULL OR normalized_total >= 0::numeric);

alter table only public.card_market_comparables add constraint card_market_comparables_pkey PRIMARY KEY (id);

alter table only public.card_market_comparables add constraint card_market_comparables_price_check CHECK (price >= 0::numeric);

alter table only public.card_market_comparables add constraint card_market_comparables_shipping_price_check CHECK (shipping_price >= 0::numeric);

alter table only public.card_market_comparables add constraint card_market_comparables_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.card_market_estimates add constraint card_market_estimates_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_market_estimates add constraint card_market_estimates_check CHECK (low_value IS NULL OR high_value IS NULL OR low_value <= high_value);

alter table only public.card_market_estimates add constraint card_market_estimates_check1 CHECK (estimated_value IS NULL OR low_value IS NULL OR estimated_value >= low_value);

alter table only public.card_market_estimates add constraint card_market_estimates_check2 CHECK (estimated_value IS NULL OR high_value IS NULL OR estimated_value <= high_value);

alter table only public.card_market_estimates add constraint card_market_estimates_check3 CHECK (included_comparable_count <= comparable_count);

alter table only public.card_market_estimates add constraint card_market_estimates_comparable_count_check CHECK (comparable_count >= 0);

alter table only public.card_market_estimates add constraint card_market_estimates_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

alter table only public.card_market_estimates add constraint card_market_estimates_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

alter table only public.card_market_estimates add constraint card_market_estimates_estimated_value_check CHECK (estimated_value IS NULL OR estimated_value >= 0::numeric);

alter table only public.card_market_estimates add constraint card_market_estimates_high_value_check CHECK (high_value IS NULL OR high_value >= 0::numeric);

alter table only public.card_market_estimates add constraint card_market_estimates_included_comparable_count_check CHECK (included_comparable_count >= 0);

alter table only public.card_market_estimates add constraint card_market_estimates_input_tokens_check CHECK (input_tokens IS NULL OR input_tokens >= 0);

alter table only public.card_market_estimates add constraint card_market_estimates_low_value_check CHECK (low_value IS NULL OR low_value >= 0::numeric);

alter table only public.card_market_estimates add constraint card_market_estimates_output_tokens_check CHECK (output_tokens IS NULL OR output_tokens >= 0);

alter table only public.card_market_estimates add constraint card_market_estimates_pkey PRIMARY KEY (id);

alter table only public.card_market_estimates add constraint card_market_estimates_source_count_check CHECK (source_count >= 0);

alter table only public.card_market_estimates add constraint card_market_estimates_status_check CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'partial'::text, 'failed'::text]));

alter table only public.card_market_estimates add constraint card_market_estimates_subject_condition_check CHECK (subject_condition = ANY (ARRAY['raw'::text, 'graded'::text, 'unknown'::text]));

alter table only public.card_market_estimates add constraint card_market_estimates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.card_market_estimates add constraint card_market_estimates_web_search_calls_check CHECK (web_search_calls IS NULL OR web_search_calls >= 0);

alter table only public.card_transactions add constraint card_transactions_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE RESTRICT;

alter table only public.card_transactions add constraint card_transactions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL;

alter table only public.card_transactions add constraint card_transactions_cost_basis_check CHECK (cost_basis >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

alter table only public.card_transactions add constraint card_transactions_item_amount_check CHECK (item_amount >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_other_costs_check CHECK (other_costs >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_payment_fee_check CHECK (payment_fee >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_pkey PRIMARY KEY (id);

alter table only public.card_transactions add constraint card_transactions_platform_fee_check CHECK (platform_fee >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_shipping_cost_check CHECK (shipping_cost >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_shipping_income_check CHECK (shipping_income >= 0::numeric);

alter table only public.card_transactions add constraint card_transactions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text]));

alter table only public.card_transactions add constraint card_transactions_transaction_type_check CHECK (transaction_type = ANY (ARRAY['purchase'::text, 'sale'::text, 'refund'::text, 'fee'::text, 'adjustment'::text]));

alter table only public.card_transactions add constraint card_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.cards add constraint cards_current_collection_id_fkey FOREIGN KEY (current_collection_id) REFERENCES collections(id) ON DELETE RESTRICT;

alter table only public.cards add constraint cards_current_market_estimate_id_fkey FOREIGN KEY (current_market_estimate_id) REFERENCES card_market_estimates(id) ON DELETE SET NULL;

alter table only public.cards add constraint cards_pkey PRIMARY KEY (id);

alter table only public.cards add constraint cards_state_check CHECK (state = ANY (ARRAY['draft'::text, 'needs_review'::text, 'verified'::text, 'submitted'::text, 'graded'::text, 'listed'::text, 'sold'::text, 'archived'::text]));

alter table only public.cards add constraint cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.cardshow_events add constraint cardshow_events_accommodation_cost_check CHECK (accommodation_cost >= 0::numeric);

alter table only public.cardshow_events add constraint cardshow_events_booth_fee_check CHECK (booth_fee >= 0::numeric);

alter table only public.cardshow_events add constraint cardshow_events_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at);

alter table only public.cardshow_events add constraint cardshow_events_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

alter table only public.cardshow_events add constraint cardshow_events_food_cost_check CHECK (food_cost >= 0::numeric);

alter table only public.cardshow_events add constraint cardshow_events_name_check CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 160);

alter table only public.cardshow_events add constraint cardshow_events_other_event_costs_check CHECK (other_event_costs >= 0::numeric);

alter table only public.cardshow_events add constraint cardshow_events_pkey PRIMARY KEY (id);

alter table only public.cardshow_events add constraint cardshow_events_status_check CHECK (status = ANY (ARRAY['planning'::text, 'active'::text, 'closed'::text, 'cancelled'::text]));

alter table only public.cardshow_events add constraint cardshow_events_travel_cost_check CHECK (travel_cost >= 0::numeric);

alter table only public.cardshow_events add constraint cardshow_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_asking_price_check CHECK (asking_price IS NULL OR asking_price > 0::numeric);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE RESTRICT;

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_check CHECK (floor_price IS NULL OR asking_price IS NULL OR floor_price <= asking_price);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_event_id_card_id_key UNIQUE (event_id, card_id);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES cardshow_events(id) ON DELETE CASCADE;

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_floor_price_check CHECK (floor_price IS NULL OR floor_price >= 0::numeric);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_pkey PRIMARY KEY (id);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_price_group_amount_check CHECK (price_group_amount IS NULL OR price_group_amount > 0::numeric);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_price_source_check CHECK (price_source = ANY (ARRAY['manual'::text, 'market'::text, 'suggested'::text, 'price_group'::text]));

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_reference_value_check CHECK (reference_value IS NULL OR reference_value >= 0::numeric);

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_reference_value_source_check CHECK (reference_value_source IS NULL OR (reference_value_source = ANY (ARRAY['market'::text, 'manual'::text, 'none'::text])));

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_status_check CHECK (status = ANY (ARRAY['available'::text, 'reserved'::text, 'sold'::text, 'withdrawn'::text]));

alter table only public.cardshow_inventory_items add constraint cardshow_inventory_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.collections add constraint collections_pkey PRIMARY KEY (id);

alter table only public.collections add constraint collections_type_check CHECK (type = ANY (ARRAY['pc'::text, 'inventory'::text]));

alter table only public.collections add constraint collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.grading_submission_cards add constraint grading_submission_cards_allocated_shared_cost_check CHECK (allocated_shared_cost >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE RESTRICT;

alter table only public.grading_submission_cards add constraint grading_submission_cards_declared_value_check CHECK (declared_value IS NULL OR declared_value >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_expected_graded_value_check CHECK (expected_graded_value IS NULL OR expected_graded_value >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_grading_fee_check CHECK (grading_fee >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_other_card_costs_check CHECK (other_card_costs >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_pkey PRIMARY KEY (id);

alter table only public.grading_submission_cards add constraint grading_submission_cards_position_check CHECK ("position" > 0);

alter table only public.grading_submission_cards add constraint grading_submission_cards_preparation_fee_check CHECK (preparation_fee >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_raw_value_snapshot_check CHECK (raw_value_snapshot IS NULL OR raw_value_snapshot >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_result_market_value_check CHECK (result_market_value IS NULL OR result_market_value >= 0::numeric);

alter table only public.grading_submission_cards add constraint grading_submission_cards_status_check CHECK (status = ANY (ARRAY['queued'::text, 'submitted'::text, 'grading'::text, 'graded'::text, 'returned'::text, 'cancelled'::text]));

alter table only public.grading_submission_cards add constraint grading_submission_cards_submission_id_card_id_key UNIQUE (submission_id, card_id);

alter table only public.grading_submission_cards add constraint grading_submission_cards_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES grading_submissions(id) ON DELETE CASCADE;

alter table only public.grading_submission_cards add constraint grading_submission_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.grading_submission_events add constraint grading_submission_events_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;

alter table only public.grading_submission_events add constraint grading_submission_events_pkey PRIMARY KEY (id);

alter table only public.grading_submission_events add constraint grading_submission_events_submission_card_id_fkey FOREIGN KEY (submission_card_id) REFERENCES grading_submission_cards(id) ON DELETE SET NULL;

alter table only public.grading_submission_events add constraint grading_submission_events_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES grading_submissions(id) ON DELETE CASCADE;

alter table only public.grading_submission_events add constraint grading_submission_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.grading_submissions add constraint grading_submissions_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

alter table only public.grading_submissions add constraint grading_submissions_estimated_turnaround_days_check CHECK (estimated_turnaround_days IS NULL OR estimated_turnaround_days > 0);

alter table only public.grading_submissions add constraint grading_submissions_insurance_cost_check CHECK (insurance_cost >= 0::numeric);

alter table only public.grading_submissions add constraint grading_submissions_other_shared_costs_check CHECK (other_shared_costs >= 0::numeric);

alter table only public.grading_submissions add constraint grading_submissions_outbound_shipping_cost_check CHECK (outbound_shipping_cost >= 0::numeric);

alter table only public.grading_submissions add constraint grading_submissions_pkey PRIMARY KEY (id);

alter table only public.grading_submissions add constraint grading_submissions_return_shipping_cost_check CHECK (return_shipping_cost >= 0::numeric);

alter table only public.grading_submissions add constraint grading_submissions_status_check CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'shipped'::text, 'received'::text, 'grading'::text, 'grades_ready'::text, 'returned'::text, 'completed'::text, 'cancelled'::text]));

alter table only public.grading_submissions add constraint grading_submissions_submission_fee_check CHECK (submission_fee >= 0::numeric);

alter table only public.grading_submissions add constraint grading_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_allocated_cost_check CHECK (allocated_cost IS NULL OR allocated_cost >= 0::numeric);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_allocation_weight_check CHECK (allocation_weight IS NULL OR allocation_weight >= 0::numeric AND allocation_weight <= 1::numeric);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE RESTRICT;

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_lot_id_card_id_key UNIQUE (lot_id, card_id);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES purchase_lots(id) ON DELETE CASCADE;

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_lot_id_position_key UNIQUE (lot_id, "position");

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_manual_allocated_cost_check CHECK (manual_allocated_cost IS NULL OR manual_allocated_cost >= 0::numeric);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_pkey PRIMARY KEY (id);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_position_check CHECK ("position" > 0);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_previous_purchase_price_check CHECK (previous_purchase_price IS NULL OR previous_purchase_price >= 0::numeric);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_reference_source_check CHECK (reference_source = ANY (ARRAY['market'::text, 'asking'::text, 'manual'::text, 'equal'::text, 'override'::text]));

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_reference_value_check CHECK (reference_value IS NULL OR reference_value >= 0::numeric);

alter table only public.purchase_lot_cards add constraint purchase_lot_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.purchase_lots add constraint purchase_lots_allocated_total_check CHECK (allocated_total IS NULL OR allocated_total >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_allocation_method_check CHECK (allocation_method = ANY (ARRAY['proportional'::text, 'equal'::text, 'manual'::text]));

alter table only public.purchase_lots add constraint purchase_lots_allocation_reference_total_check CHECK (allocation_reference_total IS NULL OR allocation_reference_total >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_buyer_fee_check CHECK (buyer_fee >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

alter table only public.purchase_lots add constraint purchase_lots_name_check CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 160);

alter table only public.purchase_lots add constraint purchase_lots_other_costs_check CHECK (other_costs >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_pkey PRIMARY KEY (id);

alter table only public.purchase_lots add constraint purchase_lots_purchase_amount_check CHECK (purchase_amount >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_shipping_cost_check CHECK (shipping_cost >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_status_check CHECK (status = ANY (ARRAY['draft'::text, 'allocated'::text, 'locked'::text, 'cancelled'::text]));

alter table only public.purchase_lots add constraint purchase_lots_taxes_check CHECK (taxes >= 0::numeric);

alter table only public.purchase_lots add constraint purchase_lots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.test add constraint test_pkey PRIMARY KEY (name);

CREATE INDEX card_attributes_card_id_idx ON public.card_attributes USING btree (card_id);

CREATE INDEX card_attributes_key_idx ON public.card_attributes USING btree (attribute_key);

CREATE INDEX card_attributes_user_id_idx ON public.card_attributes USING btree (user_id);

CREATE INDEX card_images_card_id_idx ON public.card_images USING btree (card_id);

CREATE UNIQUE INDEX card_images_one_back_per_card_idx ON public.card_images USING btree (card_id) WHERE (image_type = 'back'::text);

CREATE UNIQUE INDEX card_images_one_front_per_card_idx ON public.card_images USING btree (card_id) WHERE (image_type = 'front'::text);

CREATE INDEX card_images_user_id_idx ON public.card_images USING btree (user_id);

CREATE INDEX card_market_comparables_card_id_idx ON public.card_market_comparables USING btree (card_id, sold_at DESC);

CREATE INDEX card_market_comparables_estimate_id_idx ON public.card_market_comparables USING btree (estimate_id);

CREATE UNIQUE INDEX card_market_comparables_estimate_url_idx ON public.card_market_comparables USING btree (estimate_id, source_url);

CREATE INDEX card_market_comparables_included_idx ON public.card_market_comparables USING btree (estimate_id, included);

CREATE INDEX card_market_estimates_card_created_idx ON public.card_market_estimates USING btree (card_id, created_at DESC);

CREATE UNIQUE INDEX card_market_estimates_one_current_per_card_idx ON public.card_market_estimates USING btree (card_id) WHERE (is_current = true);

CREATE INDEX card_market_estimates_status_idx ON public.card_market_estimates USING btree (user_id, status);

CREATE INDEX card_market_estimates_user_id_idx ON public.card_market_estimates USING btree (user_id);

CREATE INDEX card_transactions_card_id_idx ON public.card_transactions USING btree (card_id);

CREATE INDEX card_transactions_occurred_at_idx ON public.card_transactions USING btree (user_id, occurred_at DESC);

CREATE UNIQUE INDEX card_transactions_one_completed_sale_per_card_idx ON public.card_transactions USING btree (card_id) WHERE ((transaction_type = 'sale'::text) AND (status = 'completed'::text));

CREATE INDEX card_transactions_user_id_idx ON public.card_transactions USING btree (user_id);

CREATE INDEX cards_current_market_estimate_id_idx ON public.cards USING btree (current_market_estimate_id);

CREATE INDEX cards_state_idx ON public.cards USING btree (state);

CREATE INDEX cardshow_events_user_created_idx ON public.cardshow_events USING btree (user_id, created_at DESC);

CREATE INDEX cardshow_events_user_status_idx ON public.cardshow_events USING btree (user_id, status, starts_at DESC NULLS LAST);

CREATE INDEX cardshow_inventory_card_idx ON public.cardshow_inventory_items USING btree (card_id, created_at DESC);

CREATE UNIQUE INDEX cardshow_inventory_event_code_idx ON public.cardshow_inventory_items USING btree (event_id, inventory_code) WHERE ((inventory_code IS NOT NULL) AND (btrim(inventory_code) <> ''::text));

CREATE INDEX cardshow_inventory_event_status_idx ON public.cardshow_inventory_items USING btree (event_id, status, added_at DESC);

CREATE INDEX cardshow_inventory_location_idx ON public.cardshow_inventory_items USING btree (event_id, location_label);

CREATE INDEX cardshow_inventory_user_status_idx ON public.cardshow_inventory_items USING btree (user_id, status, updated_at DESC);

CREATE INDEX grading_submission_cards_card_idx ON public.grading_submission_cards USING btree (card_id, created_at DESC);

CREATE UNIQUE INDEX grading_submission_cards_one_active_submission_per_card_idx ON public.grading_submission_cards USING btree (card_id) WHERE (status = ANY (ARRAY['queued'::text, 'submitted'::text, 'grading'::text, 'graded'::text]));

CREATE INDEX grading_submission_cards_submission_idx ON public.grading_submission_cards USING btree (submission_id, "position");

CREATE INDEX grading_submission_cards_user_status_idx ON public.grading_submission_cards USING btree (user_id, status, created_at DESC);

CREATE INDEX grading_submission_events_card_idx ON public.grading_submission_events USING btree (card_id, occurred_at DESC);

CREATE INDEX grading_submission_events_submission_idx ON public.grading_submission_events USING btree (submission_id, occurred_at DESC);

CREATE INDEX grading_submission_events_user_idx ON public.grading_submission_events USING btree (user_id, occurred_at DESC);

CREATE INDEX grading_submissions_company_idx ON public.grading_submissions USING btree (user_id, grading_company);

CREATE UNIQUE INDEX grading_submissions_external_number_idx ON public.grading_submissions USING btree (user_id, grading_company, submission_number) WHERE ((submission_number IS NOT NULL) AND (btrim(submission_number) <> ''::text));

CREATE INDEX grading_submissions_user_status_idx ON public.grading_submissions USING btree (user_id, status, created_at DESC);

CREATE INDEX purchase_lot_cards_lot_position_idx ON public.purchase_lot_cards USING btree (lot_id, "position");

CREATE UNIQUE INDEX purchase_lot_cards_one_lot_per_card_idx ON public.purchase_lot_cards USING btree (card_id);

CREATE INDEX purchase_lot_cards_user_idx ON public.purchase_lot_cards USING btree (user_id, created_at DESC);

CREATE INDEX purchase_lots_user_created_idx ON public.purchase_lots USING btree (user_id, created_at DESC);

CREATE INDEX purchase_lots_user_status_idx ON public.purchase_lots USING btree (user_id, status, purchased_at DESC);

alter table public.card_attributes enable row level security;

alter table public.card_collection_history enable row level security;

alter table public.card_images enable row level security;

alter table public.card_market_comparables enable row level security;

alter table public.card_market_estimates enable row level security;

alter table public.card_transactions enable row level security;

alter table public.cards enable row level security;

alter table public.cardshow_events enable row level security;

alter table public.cardshow_inventory_items enable row level security;

alter table public.collections enable row level security;

alter table public.grading_submission_cards enable row level security;

alter table public.grading_submission_events enable row level security;

alter table public.grading_submissions enable row level security;

alter table public.purchase_lot_cards enable row level security;

alter table public.purchase_lots enable row level security;

alter table public.test enable row level security;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_attributes to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_attributes to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_collection_history to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_collection_history to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_images to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_images to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_market_comparables to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_market_estimates to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.card_transactions to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cards to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cards to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.cardshow_events to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.cardshow_inventory_items to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collections to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.collections to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.grading_submission_cards to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.grading_submission_events to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.grading_submissions to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.purchase_lot_cards to authenticated;

grant REFERENCES, SELECT, TRIGGER, TRUNCATE on table public.purchase_lots to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.test to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.test to authenticated;


-- Functions

CREATE OR REPLACE FUNCTION public.activate_card_market_estimate(p_estimate_id uuid)
 RETURNS TABLE(activated_card_id uuid, activated_estimate_id uuid, market_value numeric, market_currency text, market_confidence numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_estimate
    public.card_market_estimates%rowtype;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal være logget ind for at aktivere et markedsestimat.',
        errcode = 'P0001';
  end if;


  select *
  into v_estimate
  from public.card_market_estimates
  where
    id = p_estimate_id
    and user_id = v_user_id
  for update;


  if not found then
    raise exception
      using
        message =
          'Markedsestimatet blev ikke fundet, eller du har ikke adgang til det.',
        errcode = 'P0001';
  end if;


  if v_estimate.status not in (
    'completed',
    'partial'
  ) then
    raise exception
      using
        message =
          'Kun færdige eller delvise markedsestimater kan aktiveres.',
        errcode = 'P0001';
  end if;


  if v_estimate.estimated_value is null then
    raise exception
      using
        message =
          'Markedsestimatet indeholder ingen beregnet værdi.',
        errcode = 'P0001';
  end if;


  update public.card_market_estimates
  set
    is_current = false,
    updated_at = now()
  where
    card_id = v_estimate.card_id
    and user_id = v_user_id
    and id <> v_estimate.id
    and is_current = true;


  update public.card_market_estimates
  set
    is_current = true,
    updated_at = now()
  where
    id = v_estimate.id
    and user_id = v_user_id;


  update public.cards
  set
    market_estimated_value =
      v_estimate.estimated_value,

    market_value_low =
      v_estimate.low_value,

    market_value_high =
      v_estimate.high_value,

    market_value_currency =
      v_estimate.currency,

    market_value_confidence =
      v_estimate.confidence_score,

    market_value_updated_at =
      coalesce(
        v_estimate.data_as_of,
        now()
      ),

    current_market_estimate_id =
      v_estimate.id

  where
    id = v_estimate.card_id
    and user_id = v_user_id;


  if not found then
    raise exception
      using
        message =
          'Kortet blev ikke fundet, eller du har ikke adgang til det.',
        errcode = 'P0001';
  end if;


  return query
  select
    v_estimate.card_id,
    v_estimate.id,
    v_estimate.estimated_value,
    v_estimate.currency,
    v_estimate.confidence_score;

end;
$function$


CREATE OR REPLACE FUNCTION public.create_cardshow_event(p_name text, p_venue text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_currency text DEFAULT 'DKK'::text, p_payment_methods text[] DEFAULT ARRAY['cash'::text, 'mobilepay'::text, 'card'::text, 'other'::text], p_booth_fee numeric DEFAULT 0, p_travel_cost numeric DEFAULT 0, p_accommodation_cost numeric DEFAULT 0, p_food_cost numeric DEFAULT 0, p_other_event_costs numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(event_id uuid, event_status text, event_cost_total numeric, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_name text := nullif(
    btrim(p_name),
    ''
  );

  v_venue text := nullif(
    btrim(p_venue),
    ''
  );

  v_city text := nullif(
    btrim(p_city),
    ''
  );

  v_address text := nullif(
    btrim(p_address),
    ''
  );

  v_currency text := upper(
    coalesce(
      nullif(
        btrim(p_currency),
        ''
      ),
      'DKK'
    )
  );

  v_notes text := nullif(
    btrim(p_notes),
    ''
  );

  v_payment_methods text[];

  v_booth_fee numeric :=
    coalesce(
      p_booth_fee,
      0
    );

  v_travel_cost numeric :=
    coalesce(
      p_travel_cost,
      0
    );

  v_accommodation_cost numeric :=
    coalesce(
      p_accommodation_cost,
      0
    );

  v_food_cost numeric :=
    coalesce(
      p_food_cost,
      0
    );

  v_other_event_costs numeric :=
    coalesce(
      p_other_event_costs,
      0
    );

  v_event_id uuid;

  v_event_status text;

  v_event_cost_total numeric;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal være logget ind for at oprette et cardshow.',
        errcode = 'P0001';
  end if;


  if v_name is null then
    raise exception
      using
        message =
          'Cardshow-navnet mangler.',
        errcode = 'P0001';
  end if;


  if char_length(v_name) > 160 then
    raise exception
      using
        message =
          'Cardshow-navnet må højst være 160 tegn.',
        errcode = 'P0001';
  end if;


  if v_currency !~ '^[A-Z]{3}$' then
    raise exception
      using
        message =
          'Valutaen skal være en gyldig kode på tre bogstaver.',
        errcode = 'P0001';
  end if;


  if
    p_starts_at is not null
    and p_ends_at is not null
    and p_ends_at < p_starts_at
  then
    raise exception
      using
        message =
          'Sluttidspunktet kan ikke ligge før starttidspunktet.',
        errcode = 'P0001';
  end if;


  if
    v_booth_fee < 0
    or v_travel_cost < 0
    or v_accommodation_cost < 0
    or v_food_cost < 0
    or v_other_event_costs < 0
  then
    raise exception
      using
        message =
          'Cardshowets omkostninger kan ikke være negative.',
        errcode = 'P0001';
  end if;


  select
    coalesce(
      array_agg(
        distinct lower(
          btrim(method_value)
        )
      ),
      array[]::text[]
    )
  into v_payment_methods
  from unnest(
    coalesce(
      p_payment_methods,
      array[]::text[]
    )
  ) as payment_method(method_value)
  where btrim(method_value) <> '';


  if
    coalesce(
      array_length(
        v_payment_methods,
        1
      ),
      0
    ) = 0
  then
    v_payment_methods :=
      array[
        'cash',
        'mobilepay',
        'card',
        'other'
      ]::text[];
  end if;


  if exists (
    select 1
    from unnest(
      v_payment_methods
    ) as payment_method(method_value)
    where method_value not in (
      'cash',
      'mobilepay',
      'card',
      'bank_transfer',
      'paypal',
      'other'
    )
  )
  then
    raise exception
      using
        message =
          'En eller flere betalingsformer er ugyldige.',
        errcode = 'P0001';
  end if;


  insert into public.cardshow_events as created_event (
    user_id,
    name,
    status,
    venue,
    city,
    address,
    starts_at,
    ends_at,
    currency,
    payment_methods,
    booth_fee,
    travel_cost,
    accommodation_cost,
    food_cost,
    other_event_costs,
    notes
  )
  values (
    v_user_id,
    v_name,
    'planning',
    v_venue,
    v_city,
    v_address,
    p_starts_at,
    p_ends_at,
    v_currency,
    v_payment_methods,
    round(
      v_booth_fee,
      2
    ),
    round(
      v_travel_cost,
      2
    ),
    round(
      v_accommodation_cost,
      2
    ),
    round(
      v_food_cost,
      2
    ),
    round(
      v_other_event_costs,
      2
    ),
    v_notes
  )
  returning
    created_event.id,
    created_event.status,
    created_event.event_cost_total
  into
    v_event_id,
    v_event_status,
    v_event_cost_total;


  return query
  select
    v_event_id,
    v_event_status,
    v_event_cost_total,
    (
      v_name
      || ' er oprettet som et planlagt cardshow.'
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.create_grading_submission(p_name text, p_grading_company text, p_service_level text DEFAULT NULL::text, p_currency text DEFAULT 'DKK'::text, p_submission_number text DEFAULT NULL::text, p_estimated_turnaround_days integer DEFAULT NULL::integer, p_submission_fee numeric DEFAULT 0, p_outbound_shipping_cost numeric DEFAULT 0, p_return_shipping_cost numeric DEFAULT 0, p_insurance_cost numeric DEFAULT 0, p_other_shared_costs numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_cards jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(submission_id uuid, card_count integer, shared_cost_total numeric, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_submission_id uuid;

  v_name text := nullif(
    btrim(p_name),
    ''
  );

  v_grading_company text := upper(
    coalesce(
      nullif(
        btrim(p_grading_company),
        ''
      ),
      ''
    )
  );

  v_service_level text := nullif(
    btrim(p_service_level),
    ''
  );

  v_currency text := upper(
    coalesce(
      nullif(
        btrim(p_currency),
        ''
      ),
      'DKK'
    )
  );

  v_submission_number text := nullif(
    btrim(p_submission_number),
    ''
  );

  v_notes text := nullif(
    btrim(p_notes),
    ''
  );

  v_submission_fee numeric :=
    coalesce(
      p_submission_fee,
      0
    );

  v_outbound_shipping_cost numeric :=
    coalesce(
      p_outbound_shipping_cost,
      0
    );

  v_return_shipping_cost numeric :=
    coalesce(
      p_return_shipping_cost,
      0
    );

  v_insurance_cost numeric :=
    coalesce(
      p_insurance_cost,
      0
    );

  v_other_shared_costs numeric :=
    coalesce(
      p_other_shared_costs,
      0
    );

  v_shared_total numeric;

  v_card_count integer;

  v_base_shared_cost numeric;

  v_shared_cost_remainder numeric;

  v_item jsonb;

  v_position bigint;

  v_card_id uuid;

  v_player_name text;

  v_card_state text;

  v_collection_currency text;

  v_market_value numeric;

  v_market_currency text;

  v_manual_value numeric;

  v_raw_value_snapshot numeric;

  v_declared_value numeric;

  v_grading_fee numeric;

  v_preparation_fee numeric;

  v_other_card_costs numeric;

  v_allocated_shared_cost numeric;

  v_expected_grade text;

  v_expected_graded_value numeric;

  v_submission_card_id uuid;

  v_distinct_card_count integer;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal være logget ind for at oprette en grading submission.',
        errcode = 'P0001';
  end if;


  if v_name is null then
    raise exception
      using
        message =
          'Submission-navnet mangler.',
        errcode = 'P0001';
  end if;


  if char_length(v_name) > 160 then
    raise exception
      using
        message =
          'Submission-navnet må højst være 160 tegn.',
        errcode = 'P0001';
  end if;


  if v_grading_company = '' then
    raise exception
      using
        message =
          'Graderingsfirmaet mangler.',
        errcode = 'P0001';
  end if;


  if char_length(v_grading_company) > 40 then
    raise exception
      using
        message =
          'Graderingsfirmaets navn er for langt.',
        errcode = 'P0001';
  end if;


  if v_currency !~ '^[A-Z]{3}$' then
    raise exception
      using
        message =
          'Valutaen skal være en gyldig kode på tre bogstaver.',
        errcode = 'P0001';
  end if;


  if
    p_estimated_turnaround_days is not null
    and p_estimated_turnaround_days < 1
  then
    raise exception
      using
        message =
          'Forventet turnaround skal være mindst én dag.',
        errcode = 'P0001';
  end if;


  if
    v_submission_fee < 0
    or v_outbound_shipping_cost < 0
    or v_return_shipping_cost < 0
    or v_insurance_cost < 0
    or v_other_shared_costs < 0
  then
    raise exception
      using
        message =
          'Submissionens gebyrer og omkostninger kan ikke være negative.',
        errcode = 'P0001';
  end if;


  if
    p_cards is null
    or jsonb_typeof(p_cards) <> 'array'
  then
    raise exception
      using
        message =
          'Kortlisten har et ugyldigt format.',
        errcode = 'P0001';
  end if;


  v_card_count :=
    jsonb_array_length(
      p_cards
    );


  if v_card_count < 1 then
    raise exception
      using
        message =
          'Vælg mindst ét kort til submissionen.',
        errcode = 'P0001';
  end if;


  if v_card_count > 200 then
    raise exception
      using
        message =
          'En submission kan højst indeholde 200 kort.',
        errcode = 'P0001';
  end if;


  begin
    select
      count(
        distinct (
          nullif(
            btrim(
              item ->> 'cardId'
            ),
            ''
          )::uuid
        )
      )
    into v_distinct_card_count
    from jsonb_array_elements(
      p_cards
    ) as item;
  exception
    when invalid_text_representation then
      raise exception
        using
          message =
            'Et eller flere kort-ID''er har et ugyldigt format.',
          errcode = 'P0001';
  end;


  if
    v_distinct_card_count <>
    v_card_count
  then
    raise exception
      using
        message =
          'Det samme kort må kun tilføjes én gang til submissionen.',
        errcode = 'P0001';
  end if;


  v_shared_total :=
    round(
      (
        v_submission_fee
        + v_outbound_shipping_cost
        + v_return_shipping_cost
        + v_insurance_cost
        + v_other_shared_costs
      )::numeric,
      2
    );


  /*
   * We allocate shared costs using whole øre/cents.
   * Any rounding remainder is placed on the first card,
   * so the allocated total always matches the submission total.
   */
  v_base_shared_cost :=
    trunc(
      (
        v_shared_total /
        v_card_count
      ) * 100
    ) / 100;


  v_shared_cost_remainder :=
    round(
      (
        v_shared_total
        - (
          v_base_shared_cost
          * v_card_count
        )
      )::numeric,
      2
    );


  insert into public.grading_submissions (
    user_id,
    name,
    grading_company,
    service_level,
    status,
    currency,
    submission_number,
    estimated_turnaround_days,
    submission_fee,
    outbound_shipping_cost,
    return_shipping_cost,
    insurance_cost,
    other_shared_costs,
    notes
  )
  values (
    v_user_id,
    v_name,
    v_grading_company,
    v_service_level,
    'draft',
    v_currency,
    v_submission_number,
    p_estimated_turnaround_days,
    round(
      v_submission_fee,
      2
    ),
    round(
      v_outbound_shipping_cost,
      2
    ),
    round(
      v_return_shipping_cost,
      2
    ),
    round(
      v_insurance_cost,
      2
    ),
    round(
      v_other_shared_costs,
      2
    ),
    v_notes
  )
  returning id
  into v_submission_id;


  insert into public.grading_submission_events (
    user_id,
    submission_id,
    event_type,
    from_status,
    to_status,
    message,
    metadata
  )
  values (
    v_user_id,
    v_submission_id,
    'submission_created',
    null,
    'draft',
    'Grading submission oprettet.',
    jsonb_build_object(
      'name',
      v_name,
      'gradingCompany',
      v_grading_company,
      'serviceLevel',
      v_service_level,
      'currency',
      v_currency,
      'cardCount',
      v_card_count,
      'sharedCostTotal',
      v_shared_total
    )
  );


  for
    v_item,
    v_position
  in
    select
      item,
      ordinality
    from jsonb_array_elements(
      p_cards
    )
    with ordinality as cards(
      item,
      ordinality
    )
  loop

    if
      jsonb_typeof(
        v_item
      ) <> 'object'
    then
      raise exception
        using
          message =
            'Et kort i submissionen har et ugyldigt format.',
          errcode = 'P0001';
    end if;


    begin
      v_card_id :=
        nullif(
          btrim(
            v_item ->> 'cardId'
          ),
          ''
        )::uuid;

      v_declared_value :=
        nullif(
          btrim(
            v_item ->> 'declaredValue'
          ),
          ''
        )::numeric;

      v_grading_fee :=
        coalesce(
          nullif(
            btrim(
              v_item ->> 'gradingFee'
            ),
            ''
          )::numeric,
          0
        );

      v_preparation_fee :=
        coalesce(
          nullif(
            btrim(
              v_item ->> 'preparationFee'
            ),
            ''
          )::numeric,
          0
        );

      v_other_card_costs :=
        coalesce(
          nullif(
            btrim(
              v_item ->> 'otherCardCosts'
            ),
            ''
          )::numeric,
          0
        );

      v_expected_grade :=
        nullif(
          btrim(
            v_item ->> 'expectedGrade'
          ),
          ''
        );

      v_expected_graded_value :=
        nullif(
          btrim(
            v_item ->> 'expectedGradedValue'
          ),
          ''
        )::numeric;

    exception
      when invalid_text_representation then
        raise exception
          using
            message =
              'Et kort indeholder et ugyldigt ID eller tal.',
            errcode = 'P0001';
    end;


    if v_card_id is null then
      raise exception
        using
          message =
            'Et kort i submissionen mangler et kort-ID.',
          errcode = 'P0001';
    end if;


    if
      v_declared_value is not null
      and v_declared_value < 0
    then
      raise exception
        using
          message =
            'Declared value kan ikke være negativ.',
          errcode = 'P0001';
    end if;


    if
      v_grading_fee < 0
      or v_preparation_fee < 0
      or v_other_card_costs < 0
    then
      raise exception
        using
          message =
            'Kortets gradingomkostninger kan ikke være negative.',
          errcode = 'P0001';
    end if;


    if
      v_expected_graded_value is not null
      and v_expected_graded_value < 0
    then
      raise exception
        using
          message =
            'Forventet værdi efter grading kan ikke være negativ.',
          errcode = 'P0001';
    end if;


    select
      card.player_name,
      card.state,
      collection.currency,
      card.market_estimated_value,
      card.market_value_currency,
      card.estimated_value
    into
      v_player_name,
      v_card_state,
      v_collection_currency,
      v_market_value,
      v_market_currency,
      v_manual_value
    from public.cards card

    join public.collections collection
      on collection.id =
        card.current_collection_id

    where
      card.id =
        v_card_id

      and card.user_id =
        v_user_id

      and collection.user_id =
        v_user_id

    for update of card;


    if not found then
      raise exception
        using
          message =
            'Et valgt kort blev ikke fundet, eller du har ikke adgang til det.',
          errcode = 'P0001';
    end if;


    if
      v_card_state in (
        'sold',
        'archived'
      )
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' kan ikke tilføjes til grading, fordi det er '
            || coalesce(
              v_card_state,
              'utilgængeligt'
            )
            || '.',
          errcode = 'P0001';
    end if;


    if exists (
      select 1
      from public.grading_submission_cards existing_card
      where
        existing_card.card_id =
          v_card_id

        and existing_card.status in (
          'queued',
          'submitted',
          'grading',
          'graded'
        )
    )
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' ligger allerede i en aktiv grading submission.',
          errcode = 'P0001';
    end if;


    v_raw_value_snapshot :=
      case
        when
          v_market_value is not null

          and upper(
            coalesce(
              nullif(
                btrim(
                  v_market_currency
                ),
                ''
              ),
              v_collection_currency
            )
          ) =
          v_currency
        then
          v_market_value

        when
          v_manual_value is not null

          and upper(
            v_collection_currency
          ) =
          v_currency
        then
          v_manual_value

        else
          null
      end;


    if v_declared_value is null then
      v_declared_value :=
        v_raw_value_snapshot;
    end if;


    v_allocated_shared_cost :=
      v_base_shared_cost

      + case
          when v_position = 1
          then v_shared_cost_remainder
          else 0
        end;


    insert into public.grading_submission_cards (
      user_id,
      submission_id,
      card_id,
      position,
      status,
      original_card_state,
      declared_value,
      grading_fee,
      preparation_fee,
      allocated_shared_cost,
      other_card_costs,
      raw_value_snapshot,
      expected_grade,
      expected_graded_value
    )
    values (
      v_user_id,
      v_submission_id,
      v_card_id,
      v_position::integer,
      'queued',
      v_card_state,
      v_declared_value,
      round(
        v_grading_fee,
        2
      ),
      round(
        v_preparation_fee,
        2
      ),
      round(
        v_allocated_shared_cost,
        2
      ),
      round(
        v_other_card_costs,
        2
      ),
      v_raw_value_snapshot,
      v_expected_grade,
      v_expected_graded_value
    )
    returning id
    into v_submission_card_id;


    insert into public.grading_submission_events (
      user_id,
      submission_id,
      submission_card_id,
      card_id,
      event_type,
      from_status,
      to_status,
      message,
      metadata
    )
    values (
      v_user_id,
      v_submission_id,
      v_submission_card_id,
      v_card_id,
      'card_added',
      null,
      'queued',
      coalesce(
        v_player_name,
        'Kort'
      )
      || ' tilføjet til submissionen.',
      jsonb_build_object(
        'position',
        v_position,
        'declaredValue',
        v_declared_value,
        'rawValueSnapshot',
        v_raw_value_snapshot,
        'expectedGrade',
        v_expected_grade,
        'expectedGradedValue',
        v_expected_graded_value,
        'gradingFee',
        round(
          v_grading_fee,
          2
        ),
        'preparationFee',
        round(
          v_preparation_fee,
          2
        ),
        'allocatedSharedCost',
        round(
          v_allocated_shared_cost,
          2
        ),
        'otherCardCosts',
        round(
          v_other_card_costs,
          2
        )
      )
    );

  end loop;


  return query
  select
    v_submission_id,
    v_card_count,
    v_shared_total,
    (
      v_name
      || ' er oprettet med '
      || v_card_count
      || case
          when v_card_count = 1
          then ' kort.'
          else ' kort.'
        end
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.create_purchase_lot(p_name text, p_allocation_method text DEFAULT 'proportional'::text, p_source text DEFAULT NULL::text, p_seller text DEFAULT NULL::text, p_purchase_reference text DEFAULT NULL::text, p_purchased_at timestamp with time zone DEFAULT now(), p_currency text DEFAULT 'DKK'::text, p_purchase_amount numeric DEFAULT 0, p_buyer_fee numeric DEFAULT 0, p_shipping_cost numeric DEFAULT 0, p_taxes numeric DEFAULT 0, p_other_costs numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_cards jsonb DEFAULT '[]'::jsonb, p_lock boolean DEFAULT true, p_overwrite_existing_purchase_price boolean DEFAULT false)
 RETURNS TABLE(lot_id uuid, lot_status text, card_count integer, total_cost numeric, allocated_total numeric, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_name text := nullif(
    btrim(p_name),
    ''
  );

  v_allocation_method text := lower(
    coalesce(
      nullif(
        btrim(
          p_allocation_method
        ),
        ''
      ),
      'proportional'
    )
  );

  v_source text := nullif(
    btrim(p_source),
    ''
  );

  v_seller text := nullif(
    btrim(p_seller),
    ''
  );

  v_purchase_reference text := nullif(
    btrim(
      p_purchase_reference
    ),
    ''
  );

  v_currency text := upper(
    coalesce(
      nullif(
        btrim(
          p_currency
        ),
        ''
      ),
      'DKK'
    )
  );

  v_notes text := nullif(
    btrim(p_notes),
    ''
  );

  v_purchase_amount numeric :=
    coalesce(
      p_purchase_amount,
      0
    );

  v_buyer_fee numeric :=
    coalesce(
      p_buyer_fee,
      0
    );

  v_shipping_cost numeric :=
    coalesce(
      p_shipping_cost,
      0
    );

  v_taxes numeric :=
    coalesce(
      p_taxes,
      0
    );

  v_other_costs numeric :=
    coalesce(
      p_other_costs,
      0
    );

  v_total_cost numeric;

  v_lot_id uuid;

  v_lot_status text;

  v_card_count integer;

  v_distinct_card_count integer;

  v_item jsonb;

  v_position bigint;

  v_card_id uuid;

  v_player_name text;

  v_card_state text;

  v_collection_currency text;

  v_existing_purchase_price numeric;

  v_market_value numeric;

  v_market_currency text;

  v_manual_value numeric;

  v_asking_value numeric;

  v_manual_reference_value numeric;

  v_manual_allocated_cost numeric;

  v_reference_value numeric;

  v_reference_source text;

  v_reference_total numeric;

  v_base_allocation numeric;

  v_allocation_remainder numeric;

  v_manual_total numeric;

  v_allocated_total numeric;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal være logget ind for at oprette et købslot.',
        errcode = 'P0001';
  end if;


  if v_name is null then
    raise exception
      using
        message =
          'Navnet på købslottet mangler.',
        errcode = 'P0001';
  end if;


  if char_length(v_name) > 160 then
    raise exception
      using
        message =
          'Navnet på købslottet må højst være 160 tegn.',
        errcode = 'P0001';
  end if;


  if v_allocation_method not in (
    'proportional',
    'equal',
    'manual'
  )
  then
    raise exception
      using
        message =
          'Fordelingsmetoden er ugyldig.',
        errcode = 'P0001';
  end if;


  if v_currency !~ '^[A-Z]{3}$' then
    raise exception
      using
        message =
          'Valutaen skal være en gyldig kode på tre bogstaver.',
        errcode = 'P0001';
  end if;


  if
    v_purchase_amount < 0
    or v_buyer_fee < 0
    or v_shipping_cost < 0
    or v_taxes < 0
    or v_other_costs < 0
  then
    raise exception
      using
        message =
          'Købslottets omkostninger kan ikke være negative.',
        errcode = 'P0001';
  end if;


  if
    p_cards is null
    or jsonb_typeof(
      p_cards
    ) <> 'array'
  then
    raise exception
      using
        message =
          'Kortlisten har et ugyldigt format.',
        errcode = 'P0001';
  end if;


  v_card_count :=
    jsonb_array_length(
      p_cards
    );


  if v_card_count < 1 then
    raise exception
      using
        message =
          'Vælg mindst ét kort til købslottet.',
        errcode = 'P0001';
  end if;


  if v_card_count > 5000 then
    raise exception
      using
        message =
          'Et købslot kan højst indeholde 5.000 kort.',
        errcode = 'P0001';
  end if;


  begin
    select
      count(
        distinct (
          nullif(
            btrim(
              item ->> 'cardId'
            ),
            ''
          )::uuid
        )
      )
    into v_distinct_card_count
    from jsonb_array_elements(
      p_cards
    ) as item;
  exception
    when invalid_text_representation then
      raise exception
        using
          message =
            'Et eller flere kort-ID''er har et ugyldigt format.',
          errcode = 'P0001';
  end;


  if
    v_distinct_card_count <>
    v_card_count
  then
    raise exception
      using
        message =
          'Det samme kort må kun tilføjes én gang til købslottet.',
        errcode = 'P0001';
  end if;


  v_total_cost :=
    round(
      (
        v_purchase_amount
        + v_buyer_fee
        + v_shipping_cost
        + v_taxes
        + v_other_costs
      )::numeric,
      2
    );


  insert into public.purchase_lots (
    user_id,
    name,
    status,
    allocation_method,
    source,
    seller,
    purchase_reference,
    purchased_at,
    currency,
    purchase_amount,
    buyer_fee,
    shipping_cost,
    taxes,
    other_costs,
    notes
  )
  values (
    v_user_id,
    v_name,
    'draft',
    v_allocation_method,
    v_source,
    v_seller,
    v_purchase_reference,
    coalesce(
      p_purchased_at,
      now()
    ),
    v_currency,
    round(
      v_purchase_amount,
      2
    ),
    round(
      v_buyer_fee,
      2
    ),
    round(
      v_shipping_cost,
      2
    ),
    round(
      v_taxes,
      2
    ),
    round(
      v_other_costs,
      2
    ),
    v_notes
  )
  returning id
  into v_lot_id;


  for
    v_item,
    v_position
  in
    select
      item,
      ordinality
    from jsonb_array_elements(
      p_cards
    )
    with ordinality as cards(
      item,
      ordinality
    )
  loop

    if
      jsonb_typeof(
        v_item
      ) <> 'object'
    then
      raise exception
        using
          message =
            'Et kort i købslottet har et ugyldigt format.',
          errcode = 'P0001';
    end if;


    begin
      v_card_id :=
        nullif(
          btrim(
            v_item ->> 'cardId'
          ),
          ''
        )::uuid;

      v_manual_reference_value :=
        nullif(
          btrim(
            v_item ->> 'referenceValue'
          ),
          ''
        )::numeric;

      v_manual_allocated_cost :=
        nullif(
          btrim(
            v_item ->> 'manualAllocatedCost'
          ),
          ''
        )::numeric;

    exception
      when invalid_text_representation then
        raise exception
          using
            message =
              'Et kort indeholder et ugyldigt ID eller beløb.',
            errcode = 'P0001';
    end;


    if v_card_id is null then
      raise exception
        using
          message =
            'Et kort i købslottet mangler et kort-ID.',
          errcode = 'P0001';
    end if;


    if
      v_manual_reference_value is not null
      and v_manual_reference_value < 0
    then
      raise exception
        using
          message =
            'En manuel referenceværdi kan ikke være negativ.',
          errcode = 'P0001';
    end if;


    if
      v_manual_allocated_cost is not null
      and v_manual_allocated_cost < 0
    then
      raise exception
        using
          message =
            'En manuel kostpris kan ikke være negativ.',
          errcode = 'P0001';
    end if;


    select
      card.player_name,
      card.state,
      collection.currency,
      card.purchase_price,
      card.market_estimated_value,
      card.market_value_currency,
      card.estimated_value
    into
      v_player_name,
      v_card_state,
      v_collection_currency,
      v_existing_purchase_price,
      v_market_value,
      v_market_currency,
      v_manual_value
    from public.cards card

    join public.collections collection
      on collection.id =
        card.current_collection_id

    where
      card.id =
        v_card_id

      and card.user_id =
        v_user_id

      and collection.user_id =
        v_user_id

    for update of card;


    if not found then
      raise exception
        using
          message =
            'Et valgt kort blev ikke fundet, eller du har ikke adgang til det.',
          errcode = 'P0001';
    end if;


    if exists (
      select 1
      from public.purchase_lot_cards existing_lot_card
      where
        existing_lot_card.card_id =
          v_card_id
    )
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' tilhører allerede et købslot.',
          errcode = 'P0001';
    end if;


    if
      p_lock
      and not p_overwrite_existing_purchase_price
      and v_existing_purchase_price is not null
      and v_existing_purchase_price > 0
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' har allerede en kostpris. Tillad overskrivning eller fjern kortet fra lotsettet.',
          errcode = 'P0001';
    end if;


    v_asking_value := null;


    select
      inventory.asking_price
    into v_asking_value
    from public.cardshow_inventory_items inventory

    join public.cardshow_events event
      on event.id =
        inventory.event_id

    where
      inventory.card_id =
        v_card_id

      and inventory.user_id =
        v_user_id

      and event.user_id =
        v_user_id

      and event.currency =
        v_currency

      and event.status in (
        'planning',
        'active'
      )

      and inventory.status in (
        'available',
        'reserved'
      )

      and inventory.asking_price is not null

    order by
      inventory.updated_at desc

    limit 1;


    v_reference_value := null;
    v_reference_source := 'equal';


    if v_manual_reference_value is not null then
      v_reference_value :=
        v_manual_reference_value;

      v_reference_source :=
        'override';

    elsif
      v_market_value is not null

      and upper(
        coalesce(
          nullif(
            btrim(
              v_market_currency
            ),
            ''
          ),
          v_collection_currency
        )
      ) =
      v_currency
    then
      v_reference_value :=
        v_market_value;

      v_reference_source :=
        'market';

    elsif v_asking_value is not null then
      v_reference_value :=
        v_asking_value;

      v_reference_source :=
        'asking';

    elsif
      v_manual_value is not null
      and upper(
        v_collection_currency
      ) =
      v_currency
    then
      v_reference_value :=
        v_manual_value;

      v_reference_source :=
        'manual';
    end if;


    if v_allocation_method = 'equal' then
      v_reference_source :=
        'equal';

      v_reference_value :=
        null;
    end if;


    if
      v_allocation_method = 'manual'
      and v_manual_allocated_cost is null
    then
      raise exception
        using
          message =
            'Manuel fordeling kræver en manuel kostpris for hvert kort.',
          errcode = 'P0001';
    end if;


    insert into public.purchase_lot_cards (
      user_id,
      lot_id,
      card_id,
      position,
      reference_source,
      reference_value,
      manual_allocated_cost,
      previous_purchase_price
    )
    values (
      v_user_id,
      v_lot_id,
      v_card_id,
      v_position::integer,
      case
        when v_allocation_method = 'manual'
        then 'manual'
        else v_reference_source
      end,
      v_reference_value,
      v_manual_allocated_cost,
      v_existing_purchase_price
    );

  end loop;


  if v_allocation_method = 'proportional' then

    if exists (
      select 1
      from public.purchase_lot_cards lot_card
      where
        lot_card.lot_id =
          v_lot_id

        and (
          lot_card.reference_value is null
          or lot_card.reference_value <= 0
        )
    )
    then
      raise exception
        using
          message =
            'Forholdsmæssig fordeling kræver en positiv referenceværdi på alle kort. Angiv en manuel referenceværdi eller vælg lige fordeling.',
          errcode = 'P0001';
    end if;


    select
      sum(
        lot_card.reference_value
      )
    into v_reference_total
    from public.purchase_lot_cards lot_card
    where
      lot_card.lot_id =
        v_lot_id;


    update public.purchase_lot_cards lot_card
    set
      allocation_weight =
        lot_card.reference_value
        / v_reference_total,

      allocated_cost =
        trunc(
          (
            v_total_cost
            * lot_card.reference_value
            / v_reference_total
          ) * 100
        ) / 100,

      allocated_at =
        now()

    where
      lot_card.lot_id =
        v_lot_id;


    select
      round(
        (
          v_total_cost
          - coalesce(
            sum(
              lot_card.allocated_cost
            ),
            0
          )
        )::numeric,
        2
      )
    into v_allocation_remainder
    from public.purchase_lot_cards lot_card
    where
      lot_card.lot_id =
        v_lot_id;


    update public.purchase_lot_cards lot_card
    set
      allocated_cost =
        lot_card.allocated_cost
        + v_allocation_remainder

    where
      lot_card.lot_id =
        v_lot_id

      and lot_card.position = 1;


  elsif v_allocation_method = 'equal' then

    v_base_allocation :=
      trunc(
        (
          v_total_cost
          / v_card_count
        ) * 100
      ) / 100;


    v_allocation_remainder :=
      round(
        (
          v_total_cost
          - (
            v_base_allocation
            * v_card_count
          )
        )::numeric,
        2
      );


    update public.purchase_lot_cards lot_card
    set
      allocation_weight =
        1::numeric
        / v_card_count,

      allocated_cost =
        v_base_allocation
        + case
            when lot_card.position = 1
            then v_allocation_remainder
            else 0
          end,

      allocated_at =
        now()

    where
      lot_card.lot_id =
        v_lot_id;


  else

    select
      round(
        coalesce(
          sum(
            lot_card.manual_allocated_cost
          ),
          0
        )::numeric,
        2
      )
    into v_manual_total
    from public.purchase_lot_cards lot_card
    where
      lot_card.lot_id =
        v_lot_id;


    if
      v_manual_total <>
      v_total_cost
    then
      raise exception
        using
          message =
            'De manuelt fordelte kostpriser skal tilsammen svare præcist til lotsets samlede kostpris.',
          errcode = 'P0001';
    end if;


    update public.purchase_lot_cards lot_card
    set
      allocation_weight =
        case
          when v_total_cost > 0
          then
            lot_card.manual_allocated_cost
            / v_total_cost
          else
            1::numeric
            / v_card_count
        end,

      allocated_cost =
        lot_card.manual_allocated_cost,

      allocated_at =
        now()

    where
      lot_card.lot_id =
        v_lot_id;

  end if;


  select
    round(
      coalesce(
        sum(
          lot_card.allocated_cost
        ),
        0
      )::numeric,
      2
    )
  into v_allocated_total
  from public.purchase_lot_cards lot_card
  where
    lot_card.lot_id =
      v_lot_id;


  if v_allocated_total <> v_total_cost then
    raise exception
      using
        message =
          'Den fordelte kostpris stemmer ikke med lotsets samlede kostpris.',
        errcode = 'P0001';
  end if;


  update public.purchase_lots lot
  set
    status =
      'allocated',

    allocation_reference_total =
      case
        when v_allocation_method = 'proportional'
        then v_reference_total
        else null
      end,

    allocated_total =
      v_allocated_total,

    allocated_at =
      now()

  where
    lot.id =
      v_lot_id;


  if p_lock then

    update public.cards card
    set
      purchase_price =
        lot_card.allocated_cost

    from public.purchase_lot_cards lot_card

    where
      lot_card.lot_id =
        v_lot_id

      and lot_card.card_id =
        card.id

      and card.user_id =
        v_user_id;


    update public.purchase_lot_cards lot_card
    set
      cost_locked_at =
        now()

    where
      lot_card.lot_id =
        v_lot_id;


    update public.purchase_lots lot
    set
      status =
        'locked',

      locked_at =
        now()

    where
      lot.id =
        v_lot_id;


    v_lot_status :=
      'locked';

  else
    v_lot_status :=
      'allocated';
  end if;


  return query
  select
    v_lot_id,
    v_lot_status,
    v_card_count,
    v_total_cost,
    v_allocated_total,
    (
      v_name
      || ' er oprettet med '
      || v_card_count
      || ' kort og '
      || case
          when p_lock
          then 'kostpriserne er låst.'
          else 'fordelingen er klar til godkendelse.'
        end
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.lock_purchase_lot(p_lot_id uuid, p_overwrite_existing_purchase_price boolean DEFAULT false)
 RETURNS TABLE(lot_id uuid, lot_status text, card_count integer, total_cost numeric, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_lot_name text;

  v_lot_status text;

  v_total_cost numeric;

  v_allocated_total numeric;

  v_card_count integer;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal være logget ind for at låse et købslot.',
        errcode = 'P0001';
  end if;


  if p_lot_id is null then
    raise exception
      using
        message =
          'Købslot-ID mangler.',
        errcode = 'P0001';
  end if;


  select
    lot.name,
    lot.status,
    lot.total_cost,
    lot.allocated_total
  into
    v_lot_name,
    v_lot_status,
    v_total_cost,
    v_allocated_total
  from public.purchase_lots lot
  where
    lot.id =
      p_lot_id

    and lot.user_id =
      v_user_id
  for update;


  if not found then
    raise exception
      using
        message =
          'Købslottet blev ikke fundet, eller du har ikke adgang til det.',
        errcode = 'P0001';
  end if;


  select
    count(*)
  into v_card_count
  from public.purchase_lot_cards lot_card
  where
    lot_card.lot_id =
      p_lot_id

    and lot_card.user_id =
      v_user_id;


  if v_lot_status = 'locked' then
    return query
    select
      p_lot_id,
      'locked'::text,
      v_card_count,
      v_total_cost,
      (
        v_lot_name
        || ' er allerede låst.'
      )::text;

    return;
  end if;


  if v_lot_status <> 'allocated' then
    raise exception
      using
        message =
          'Kun et fuldt fordelt købslot kan låses.',
        errcode = 'P0001';
  end if;


  if
    v_allocated_total is null
    or v_allocated_total <>
      v_total_cost
  then
    raise exception
      using
        message =
          'Kostprisfordelingen er ikke komplet.',
        errcode = 'P0001';
  end if;


  if not p_overwrite_existing_purchase_price then

    if exists (
      select 1
      from public.purchase_lot_cards lot_card

      join public.cards card
        on card.id =
          lot_card.card_id

      where
        lot_card.lot_id =
          p_lot_id

        and card.user_id =
          v_user_id

        and card.purchase_price is not null

        and abs(
          card.purchase_price
          - lot_card.allocated_cost
        ) > 0.005
    )
    then
      raise exception
        using
          message =
            'Et eller flere kort har allerede en anden kostpris. Tillad overskrivning for at låse lotsettet.',
          errcode = 'P0001';
    end if;

  end if;


  update public.cards card
  set
    purchase_price =
      lot_card.allocated_cost

  from public.purchase_lot_cards lot_card

  where
    lot_card.lot_id =
      p_lot_id

    and lot_card.card_id =
      card.id

    and card.user_id =
      v_user_id;


  update public.purchase_lot_cards lot_card
  set
    cost_locked_at =
      now()

  where
    lot_card.lot_id =
      p_lot_id;


  update public.purchase_lots lot
  set
    status =
      'locked',

    locked_at =
      now()

  where
    lot.id =
      p_lot_id

    and lot.user_id =
      v_user_id;


  return query
  select
    p_lot_id,
    'locked'::text,
    v_card_count,
    v_total_cost,
    (
      v_lot_name
      || ' er låst, og kostpriserne er overført til kortene.'
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.record_card_collection_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into card_collection_history (
      card_id,
      user_id,
      from_collection_id,
      to_collection_id,
      reason
    )
    values (
      new.id,
      new.user_id,
      null,
      new.current_collection_id,
      'Kort oprettet'
    );

  elsif tg_op = 'UPDATE'
    and old.current_collection_id is distinct from new.current_collection_id
  then
    insert into card_collection_history (
      card_id,
      user_id,
      from_collection_id,
      to_collection_id,
      reason
    )
    values (
      new.id,
      new.user_id,
      old.current_collection_id,
      new.current_collection_id,
      'Kort flyttet'
    );
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.record_card_sale(p_card_id uuid, p_sale_price numeric, p_shipping_income numeric DEFAULT 0, p_platform_fee numeric DEFAULT 0, p_payment_fee numeric DEFAULT 0, p_shipping_cost numeric DEFAULT 0, p_other_costs numeric DEFAULT 0, p_platform text DEFAULT NULL::text, p_buyer text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_sold_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(transaction_id uuid, sold_card_id uuid, new_state text, transaction_currency text, gross_amount numeric, net_proceeds numeric, cost_basis numeric, realized_profit numeric, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_card public.cards%rowtype;

  v_collection public.collections%rowtype;

  v_transaction public.card_transactions%rowtype;

  v_shipping_income numeric :=
    coalesce(p_shipping_income, 0);

  v_platform_fee numeric :=
    coalesce(p_platform_fee, 0);

  v_payment_fee numeric :=
    coalesce(p_payment_fee, 0);

  v_shipping_cost numeric :=
    coalesce(p_shipping_cost, 0);

  v_other_costs numeric :=
    coalesce(p_other_costs, 0);

  v_cost_basis numeric;
begin

  if v_user_id is null then
    raise exception
      using
        message = 'Du skal være logget ind for at registrere et salg.',
        errcode = 'P0001';
  end if;


  if p_card_id is null then
    raise exception
      using
        message = 'Kort-ID mangler.',
        errcode = 'P0001';
  end if;


  if p_sale_price is null or p_sale_price <= 0 then
    raise exception
      using
        message = 'Salgsprisen skal være større end 0.',
        errcode = 'P0001';
  end if;


  if v_shipping_income < 0 then
    raise exception
      using
        message = 'Fragt betalt af køber kan ikke være negativ.',
        errcode = 'P0001';
  end if;


  if v_platform_fee < 0 then
    raise exception
      using
        message = 'Platformgebyret kan ikke være negativt.',
        errcode = 'P0001';
  end if;


  if v_payment_fee < 0 then
    raise exception
      using
        message = 'Betalingsgebyret kan ikke være negativt.',
        errcode = 'P0001';
  end if;


  if v_shipping_cost < 0 then
    raise exception
      using
        message = 'Fragtudgiften kan ikke være negativ.',
        errcode = 'P0001';
  end if;


  if v_other_costs < 0 then
    raise exception
      using
        message = 'Øvrige omkostninger kan ikke være negative.',
        errcode = 'P0001';
  end if;


  select *
  into v_card
  from public.cards
  where
    id = p_card_id
    and user_id = v_user_id
  for update;


  if not found then
    raise exception
      using
        message = 'Kortet blev ikke fundet, eller du har ikke adgang til det.',
        errcode = 'P0001';
  end if;


  if v_card.state = 'sold' then
    raise exception
      using
        message = 'Kortet er allerede registreret som solgt.',
        errcode = 'P0001';
  end if;


  if v_card.state = 'archived' then
    raise exception
      using
        message = 'Et arkiveret kort skal genåbnes, før det kan sælges.',
        errcode = 'P0001';
  end if;


  select *
  into v_collection
  from public.collections
  where
    id = v_card.current_collection_id
    and user_id = v_user_id;


  if not found then
    raise exception
      using
        message = 'Kortets nuværende collection blev ikke fundet.',
        errcode = 'P0001';
  end if;


  v_cost_basis :=
    coalesce(
      v_card.purchase_price,
      0
    );


  insert into public.card_transactions (
    user_id,
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
    v_user_id,
    v_card.id,
    v_collection.id,
    'sale',
    'completed',
    coalesce(
      p_sold_at,
      now()
    ),
    coalesce(
      v_collection.currency,
      'DKK'
    ),
    p_sale_price,
    v_shipping_income,
    v_platform_fee,
    v_payment_fee,
    v_shipping_cost,
    v_other_costs,
    v_cost_basis,
    nullif(
      trim(p_platform),
      ''
    ),
    nullif(
      trim(p_buyer),
      ''
    ),
    nullif(
      trim(p_reference),
      ''
    ),
    nullif(
      trim(p_notes),
      ''
    ),
    v_card.state
  )
  returning *
  into v_transaction;


  update public.cards
  set
    state = 'sold'
  where
    id = v_card.id
    and user_id = v_user_id;


  return query
  select
    v_transaction.id,
    v_card.id,
    'sold'::text,
    v_transaction.currency,
    v_transaction.item_amount,
    v_transaction.net_amount,
    v_transaction.cost_basis,
    v_transaction.realized_profit,
    (
      v_card.player_name
      || ' er registreret som solgt.'
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.record_grading_card_result(p_submission_card_id uuid, p_result_grade text, p_certification_number text DEFAULT NULL::text, p_result_qualifier text DEFAULT NULL::text, p_result_subgrades jsonb DEFAULT '{}'::jsonb, p_result_market_value numeric DEFAULT NULL::numeric, p_result_notes text DEFAULT NULL::text, p_graded_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(submission_id uuid, submission_card_id uuid, card_id uuid, grading_company text, result_grade text, certification_number text, result_market_value numeric, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_submission_id uuid;
  v_card_id uuid;
  v_submission_status text;
  v_submission_card_status text;
  v_grading_company text;
  v_player_name text;
  v_previous_grade text;

  v_result_grade text := nullif(
    btrim(p_result_grade),
    ''
  );

  v_certification_number text := nullif(
    btrim(p_certification_number),
    ''
  );

  v_result_qualifier text := nullif(
    btrim(p_result_qualifier),
    ''
  );

  v_result_notes text := nullif(
    btrim(p_result_notes),
    ''
  );

  v_result_subgrades jsonb := coalesce(
    p_result_subgrades,
    '{}'::jsonb
  );

  v_result_market_value numeric := p_result_market_value;
  v_graded_at timestamp with time zone := coalesce(
    p_graded_at,
    now()
  );
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal vaere logget ind for at registrere et gradingresultat.',
        errcode = 'P0001';
  end if;


  if p_submission_card_id is null then
    raise exception
      using
        message =
          'Submission-card-ID mangler.',
        errcode = 'P0001';
  end if;


  if v_result_grade is null then
    raise exception
      using
        message =
          'Den faktiske grade mangler.',
        errcode = 'P0001';
  end if;


  if char_length(v_result_grade) > 40 then
    raise exception
      using
        message =
          'Grade maa hoejst vaere 40 tegn.',
        errcode = 'P0001';
  end if;


  if
    v_certification_number is not null
    and char_length(v_certification_number) > 120
  then
    raise exception
      using
        message =
          'Certifikatnummeret maa hoejst vaere 120 tegn.',
        errcode = 'P0001';
  end if;


  if
    v_result_qualifier is not null
    and char_length(v_result_qualifier) > 120
  then
    raise exception
      using
        message =
          'Qualifieren maa hoejst vaere 120 tegn.',
        errcode = 'P0001';
  end if;


  if jsonb_typeof(v_result_subgrades) <> 'object' then
    raise exception
      using
        message =
          'Subgrades skal have et gyldigt objektformat.',
        errcode = 'P0001';
  end if;


  if
    v_result_market_value is not null
    and v_result_market_value < 0
  then
    raise exception
      using
        message =
          'Resultatets markedsvaerdi kan ikke vaere negativ.',
        errcode = 'P0001';
  end if;


  select
    submission_card.submission_id,
    submission_card.card_id,
    submission_card.status,
    submission.status,
    submission.grading_company,
    card.player_name,
    submission_card.result_grade
  into
    v_submission_id,
    v_card_id,
    v_submission_card_status,
    v_submission_status,
    v_grading_company,
    v_player_name,
    v_previous_grade
  from public.grading_submission_cards submission_card

  join public.grading_submissions submission
    on submission.id =
      submission_card.submission_id

  join public.cards card
    on card.id =
      submission_card.card_id

  where
    submission_card.id =
      p_submission_card_id

    and submission_card.user_id =
      v_user_id

    and submission.user_id =
      v_user_id

    and card.user_id =
      v_user_id

  for update of
    submission_card,
    submission,
    card;


  if not found then
    raise exception
      using
        message =
          'Kortet i submissionen blev ikke fundet, eller du har ikke adgang til det.',
        errcode = 'P0001';
  end if;


  if v_submission_status not in (
    'grading',
    'grades_ready'
  ) then
    raise exception
      using
        message =
          'Gradingresultater kan kun registreres, mens submissionen er i grading eller har grades ready.',
        errcode = 'P0001';
  end if;


  if v_submission_card_status not in (
    'submitted',
    'grading',
    'graded'
  ) then
    raise exception
      using
        message =
          'Kortets nuvaerende gradingstatus tillader ikke registrering af et resultat.',
        errcode = 'P0001';
  end if;


  update public.grading_submission_cards
  set
    status = 'graded',
    result_grade = v_result_grade,
    result_qualifier = v_result_qualifier,
    certification_number = v_certification_number,
    result_subgrades = v_result_subgrades,
    result_market_value = case
      when v_result_market_value is null
      then null
      else round(
        v_result_market_value,
        2
      )
    end,
    result_notes = v_result_notes,
    graded_at = v_graded_at
  where
    id = p_submission_card_id
    and user_id = v_user_id;


  insert into public.grading_submission_events (
    user_id,
    submission_id,
    submission_card_id,
    card_id,
    event_type,
    from_status,
    to_status,
    message,
    metadata,
    occurred_at
  )
  values (
    v_user_id,
    v_submission_id,
    p_submission_card_id,
    v_card_id,
    case
      when v_previous_grade is null
      then 'grade_recorded'
      else 'grade_updated'
    end,
    v_submission_card_status,
    'graded',
    coalesce(
      v_player_name,
      'Kortet'
    )
    || ' fik registreret grade '
    || v_grading_company
    || ' '
    || v_result_grade
    || '.',
    jsonb_strip_nulls(
      jsonb_build_object(
        'gradingCompany',
        v_grading_company,
        'previousGrade',
        v_previous_grade,
        'resultGrade',
        v_result_grade,
        'resultQualifier',
        v_result_qualifier,
        'certificationNumber',
        v_certification_number,
        'resultSubgrades',
        v_result_subgrades,
        'resultMarketValue',
        v_result_market_value,
        'resultNotes',
        v_result_notes
      )
    ),
    v_graded_at
  );


  return query
  select
    v_submission_id,
    p_submission_card_id,
    v_card_id,
    v_grading_company,
    v_result_grade,
    v_certification_number,
    v_result_market_value,
    (
      coalesce(
        v_player_name,
        'Kortet'
      )
      || ' er registreret som '
      || v_grading_company
      || ' '
      || v_result_grade
      || '.'
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.set_card_market_estimates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.set_card_transactions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.set_cards_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.set_cardshow_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.set_grading_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.transition_grading_submission(p_submission_id uuid, p_target_status text, p_occurred_at timestamp with time zone DEFAULT now(), p_submission_number text DEFAULT NULL::text, p_outbound_tracking_number text DEFAULT NULL::text, p_return_tracking_number text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(submission_id uuid, previous_status text, new_status text, card_count integer, updated_card_count integer, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_current_status text;
  v_target_status text := lower(
    coalesce(
      nullif(
        btrim(p_target_status),
        ''
      ),
      ''
    )
  );

  v_submission_name text;
  v_grading_company text;

  v_submission_number text := nullif(
    btrim(p_submission_number),
    ''
  );

  v_outbound_tracking_number text := nullif(
    btrim(p_outbound_tracking_number),
    ''
  );

  v_return_tracking_number text := nullif(
    btrim(p_return_tracking_number),
    ''
  );

  v_notes text := nullif(
    btrim(p_notes),
    ''
  );

  v_occurred_at timestamp with time zone := coalesce(
    p_occurred_at,
    now()
  );

  v_card_count integer := 0;
  v_updated_card_count integer := 0;
  v_graded_card_count integer := 0;

  v_card_record record;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal vaere logget ind for at opdatere en grading submission.',
        errcode = 'P0001';
  end if;


  if p_submission_id is null then
    raise exception
      using
        message =
          'Submission-ID mangler.',
        errcode = 'P0001';
  end if;


  if v_target_status not in (
    'draft',
    'ready',
    'shipped',
    'received',
    'grading',
    'grades_ready',
    'returned',
    'completed',
    'cancelled'
  ) then
    raise exception
      using
        message =
          'Den valgte gradingstatus er ugyldig.',
        errcode = 'P0001';
  end if;


  if
    v_submission_number is not null
    and char_length(v_submission_number) > 120
  then
    raise exception
      using
        message =
          'Submissionnummeret maa hoejst vaere 120 tegn.',
        errcode = 'P0001';
  end if;


  if
    v_outbound_tracking_number is not null
    and char_length(v_outbound_tracking_number) > 180
  then
    raise exception
      using
        message =
          'Det udgaaende trackingnummer maa hoejst vaere 180 tegn.',
        errcode = 'P0001';
  end if;


  if
    v_return_tracking_number is not null
    and char_length(v_return_tracking_number) > 180
  then
    raise exception
      using
        message =
          'Retur-trackingnummeret maa hoejst vaere 180 tegn.',
        errcode = 'P0001';
  end if;


  select
    submission.status,
    submission.name,
    submission.grading_company
  into
    v_current_status,
    v_submission_name,
    v_grading_company
  from public.grading_submissions submission
  where
    submission.id =
      p_submission_id

    and submission.user_id =
      v_user_id
  for update;


  if not found then
    raise exception
      using
        message =
          'Submissionen blev ikke fundet, eller du har ikke adgang til den.',
        errcode = 'P0001';
  end if;


  if v_current_status = v_target_status then
    raise exception
      using
        message =
          'Submissionen har allerede den valgte status.',
        errcode = 'P0001';
  end if;


  if not (
    (
      v_current_status = 'draft'
      and v_target_status in (
        'ready',
        'cancelled'
      )
    )

    or (
      v_current_status = 'ready'
      and v_target_status in (
        'draft',
        'shipped',
        'cancelled'
      )
    )

    or (
      v_current_status = 'shipped'
      and v_target_status = 'received'
    )

    or (
      v_current_status = 'received'
      and v_target_status = 'grading'
    )

    or (
      v_current_status = 'grading'
      and v_target_status = 'grades_ready'
    )

    or (
      v_current_status = 'grades_ready'
      and v_target_status in (
        'grading',
        'returned'
      )
    )

    or (
      v_current_status = 'returned'
      and v_target_status = 'completed'
    )
  ) then
    raise exception
      using
        message =
          'Status kan ikke aendres direkte fra '
          || v_current_status
          || ' til '
          || v_target_status
          || '.',
        errcode = 'P0001';
  end if;


  select count(*)::integer
  into v_card_count
  from public.grading_submission_cards submission_card
  where
    submission_card.submission_id =
      p_submission_id

    and submission_card.user_id =
      v_user_id

    and submission_card.status <> 'cancelled';


  if
    v_target_status <> 'cancelled'
    and v_card_count < 1
  then
    raise exception
      using
        message =
          'Submissionen skal indeholde mindst eet aktivt kort.',
        errcode = 'P0001';
  end if;


  if v_target_status = 'ready' then

    update public.grading_submissions
    set
      status = 'ready',
      ready_at = v_occurred_at,
      submission_number = coalesce(
        v_submission_number,
        submission_number
      ),
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


  elsif v_target_status = 'draft' then

    update public.grading_submissions
    set
      status = 'draft',
      ready_at = null,
      submission_number = coalesce(
        v_submission_number,
        submission_number
      ),
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


  elsif v_target_status = 'cancelled' then

    update public.grading_submissions
    set
      status = 'cancelled',
      cancelled_at = v_occurred_at,
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


    for v_card_record in
      select
        submission_card.id as submission_card_id,
        submission_card.card_id,
        submission_card.status as card_status,
        card.player_name
      from public.grading_submission_cards submission_card

      join public.cards card
        on card.id =
          submission_card.card_id

      where
        submission_card.submission_id =
          p_submission_id

        and submission_card.user_id =
          v_user_id

        and submission_card.status <> 'cancelled'

      order by submission_card.position

      for update of
        submission_card,
        card
    loop

      update public.grading_submission_cards
      set
        status = 'cancelled'
      where
        id = v_card_record.submission_card_id
        and user_id = v_user_id;


      insert into public.grading_submission_events (
        user_id,
        submission_id,
        submission_card_id,
        card_id,
        event_type,
        from_status,
        to_status,
        message,
        metadata,
        occurred_at
      )
      values (
        v_user_id,
        p_submission_id,
        v_card_record.submission_card_id,
        v_card_record.card_id,
        'card_cancelled',
        v_card_record.card_status,
        'cancelled',
        coalesce(
          v_card_record.player_name,
          'Kortet'
        )
        || ' blev fjernet fra den aktive gradingproces.',
        jsonb_strip_nulls(
          jsonb_build_object(
            'notes',
            v_notes
          )
        ),
        v_occurred_at
      );


      v_updated_card_count :=
        v_updated_card_count + 1;

    end loop;


  elsif v_target_status = 'shipped' then

    update public.grading_submissions
    set
      status = 'shipped',
      shipped_at = v_occurred_at,
      submission_number = coalesce(
        v_submission_number,
        submission_number
      ),
      outbound_tracking_number = coalesce(
        v_outbound_tracking_number,
        outbound_tracking_number
      ),
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


    for v_card_record in
      select
        submission_card.id as submission_card_id,
        submission_card.card_id,
        submission_card.status as card_status,
        card.player_name,
        card.state as current_card_state
      from public.grading_submission_cards submission_card

      join public.cards card
        on card.id =
          submission_card.card_id

      where
        submission_card.submission_id =
          p_submission_id

        and submission_card.user_id =
          v_user_id

        and submission_card.status = 'queued'

      order by submission_card.position

      for update of
        submission_card,
        card
    loop

      if v_card_record.current_card_state in (
        'sold',
        'archived'
      ) then
        raise exception
          using
            message =
              coalesce(
                v_card_record.player_name,
                'Kortet'
              )
              || ' kan ikke sendes til grading, fordi det er '
              || v_card_record.current_card_state
              || '.',
            errcode = 'P0001';
      end if;


      update public.grading_submission_cards
      set
        status = 'submitted',
        submitted_at = v_occurred_at
      where
        id = v_card_record.submission_card_id
        and user_id = v_user_id;


      update public.cards
      set
        state = 'submitted'
      where
        id = v_card_record.card_id
        and user_id = v_user_id;


      insert into public.grading_submission_events (
        user_id,
        submission_id,
        submission_card_id,
        card_id,
        event_type,
        from_status,
        to_status,
        message,
        metadata,
        occurred_at
      )
      values (
        v_user_id,
        p_submission_id,
        v_card_record.submission_card_id,
        v_card_record.card_id,
        'card_submitted',
        v_card_record.card_status,
        'submitted',
        coalesce(
          v_card_record.player_name,
          'Kortet'
        )
        || ' blev sendt til '
        || v_grading_company
        || '.',
        jsonb_strip_nulls(
          jsonb_build_object(
            'submissionNumber',
            coalesce(
              v_submission_number,
              null
            ),
            'outboundTrackingNumber',
            v_outbound_tracking_number
          )
        ),
        v_occurred_at
      );


      v_updated_card_count :=
        v_updated_card_count + 1;

    end loop;


    if v_updated_card_count <> v_card_count then
      raise exception
        using
          message =
            'Ikke alle kort kunne markeres som sendt. Ingen aendringer blev gemt.',
          errcode = 'P0001';
    end if;


  elsif v_target_status = 'received' then

    update public.grading_submissions
    set
      status = 'received',
      received_by_grader_at = v_occurred_at,
      submission_number = coalesce(
        v_submission_number,
        submission_number
      ),
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


  elsif v_target_status = 'grading' then

    update public.grading_submissions
    set
      status = 'grading',
      grading_started_at = case
        when v_current_status = 'received'
        then v_occurred_at
        else grading_started_at
      end,
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


    if v_current_status = 'received' then
      for v_card_record in
        select
          submission_card.id as submission_card_id,
          submission_card.card_id,
          submission_card.status as card_status,
          card.player_name
        from public.grading_submission_cards submission_card

        join public.cards card
          on card.id =
            submission_card.card_id

        where
          submission_card.submission_id =
            p_submission_id

          and submission_card.user_id =
            v_user_id

          and submission_card.status = 'submitted'

        order by submission_card.position

        for update of
          submission_card,
          card
      loop

        update public.grading_submission_cards
        set
          status = 'grading'
        where
          id = v_card_record.submission_card_id
          and user_id = v_user_id;


        insert into public.grading_submission_events (
          user_id,
          submission_id,
          submission_card_id,
          card_id,
          event_type,
          from_status,
          to_status,
          message,
          metadata,
          occurred_at
        )
        values (
          v_user_id,
          p_submission_id,
          v_card_record.submission_card_id,
          v_card_record.card_id,
          'card_grading_started',
          v_card_record.card_status,
          'grading',
          coalesce(
            v_card_record.player_name,
            'Kortet'
          )
          || ' er nu i grading hos '
          || v_grading_company
          || '.',
          '{}'::jsonb,
          v_occurred_at
        );


        v_updated_card_count :=
          v_updated_card_count + 1;

      end loop;
    end if;


  elsif v_target_status = 'grades_ready' then

    select count(*)::integer
    into v_graded_card_count
    from public.grading_submission_cards submission_card
    where
      submission_card.submission_id =
        p_submission_id

      and submission_card.user_id =
        v_user_id

      and submission_card.status = 'graded'

      and submission_card.result_grade is not null;


    if v_graded_card_count <> v_card_count then
      raise exception
        using
          message =
            'Alle kort skal have en registreret grade, foer submissionen kan markeres som grades ready.',
          errcode = 'P0001';
    end if;


    update public.grading_submissions
    set
      status = 'grades_ready',
      grades_ready_at = v_occurred_at,
      return_tracking_number = coalesce(
        v_return_tracking_number,
        return_tracking_number
      ),
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


  elsif v_target_status = 'returned' then

    select count(*)::integer
    into v_graded_card_count
    from public.grading_submission_cards submission_card
    where
      submission_card.submission_id =
        p_submission_id

      and submission_card.user_id =
        v_user_id

      and submission_card.status = 'graded'

      and submission_card.result_grade is not null;


    if v_graded_card_count <> v_card_count then
      raise exception
        using
          message =
            'Alle kort skal have en registreret grade, foer de kan markeres som returneret.',
          errcode = 'P0001';
    end if;


    update public.grading_submissions
    set
      status = 'returned',
      returned_at = v_occurred_at,
      return_tracking_number = coalesce(
        v_return_tracking_number,
        return_tracking_number
      ),
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;


    for v_card_record in
      select
        submission_card.id as submission_card_id,
        submission_card.card_id,
        submission_card.status as card_status,
        submission_card.result_grade,
        submission_card.result_qualifier,
        submission_card.certification_number,
        submission_card.result_subgrades,
        submission_card.result_market_value,
        submission_card.total_grading_cost,
        submission_card.graded_at,
        card.player_name
      from public.grading_submission_cards submission_card

      join public.cards card
        on card.id =
          submission_card.card_id

      where
        submission_card.submission_id =
          p_submission_id

        and submission_card.user_id =
          v_user_id

        and submission_card.status = 'graded'

      order by submission_card.position

      for update of
        submission_card,
        card
    loop

      update public.grading_submission_cards
      set
        status = 'returned',
        returned_at = v_occurred_at
      where
        id = v_card_record.submission_card_id
        and user_id = v_user_id;


      update public.cards
      set
        state = 'graded',
        market_estimated_value = null,
        market_value_low = null,
        market_value_high = null,
        market_value_currency = null,
        market_value_confidence = null,
        market_value_updated_at = null,
        current_market_estimate_id = null
      where
        id = v_card_record.card_id
        and user_id = v_user_id;


      update public.card_market_estimates
      set
        is_current = false
      where
        card_id = v_card_record.card_id
        and user_id = v_user_id
        and is_current = true;


      delete from public.card_attributes
      where
        user_id = v_user_id

        and card_id = v_card_record.card_id

        and attribute_key in (
          'grading_company',
          'grade',
          'certification_number',
          'grading_qualifier',
          'grading_subgrades',
          'grading_total_cost',
          'grading_submission_id',
          'graded_at',
          'grading_result_market_value'
        );


      insert into public.card_attributes (
        user_id,
        card_id,
        attribute_key,
        attribute_value,
        source,
        confidence_score,
        is_verified
      )
      values
        (
          v_user_id,
          v_card_record.card_id,
          'grading_company',
          to_jsonb(
            v_grading_company
          ),
          'manual',
          null,
          true
        ),
        (
          v_user_id,
          v_card_record.card_id,
          'grade',
          to_jsonb(
            v_card_record.result_grade
          ),
          'manual',
          null,
          true
        ),
        (
          v_user_id,
          v_card_record.card_id,
          'grading_total_cost',
          to_jsonb(
            v_card_record.total_grading_cost
          ),
          'manual',
          null,
          true
        ),
        (
          v_user_id,
          v_card_record.card_id,
          'grading_submission_id',
          to_jsonb(
            p_submission_id::text
          ),
          'manual',
          null,
          true
        ),
        (
          v_user_id,
          v_card_record.card_id,
          'graded_at',
          to_jsonb(
            coalesce(
              v_card_record.graded_at,
              v_occurred_at
            )::text
          ),
          'manual',
          null,
          true
        );


      if v_card_record.certification_number is not null then
        insert into public.card_attributes (
          user_id,
          card_id,
          attribute_key,
          attribute_value,
          source,
          confidence_score,
          is_verified
        )
        values (
          v_user_id,
          v_card_record.card_id,
          'certification_number',
          to_jsonb(
            v_card_record.certification_number
          ),
          'manual',
          null,
          true
        );
      end if;


      if v_card_record.result_qualifier is not null then
        insert into public.card_attributes (
          user_id,
          card_id,
          attribute_key,
          attribute_value,
          source,
          confidence_score,
          is_verified
        )
        values (
          v_user_id,
          v_card_record.card_id,
          'grading_qualifier',
          to_jsonb(
            v_card_record.result_qualifier
          ),
          'manual',
          null,
          true
        );
      end if;


      if
        v_card_record.result_subgrades is not null
        and v_card_record.result_subgrades <> '{}'::jsonb
      then
        insert into public.card_attributes (
          user_id,
          card_id,
          attribute_key,
          attribute_value,
          source,
          confidence_score,
          is_verified
        )
        values (
          v_user_id,
          v_card_record.card_id,
          'grading_subgrades',
          v_card_record.result_subgrades,
          'manual',
          null,
          true
        );
      end if;


      if v_card_record.result_market_value is not null then
        insert into public.card_attributes (
          user_id,
          card_id,
          attribute_key,
          attribute_value,
          source,
          confidence_score,
          is_verified
        )
        values (
          v_user_id,
          v_card_record.card_id,
          'grading_result_market_value',
          to_jsonb(
            v_card_record.result_market_value
          ),
          'manual',
          null,
          true
        );
      end if;


      insert into public.grading_submission_events (
        user_id,
        submission_id,
        submission_card_id,
        card_id,
        event_type,
        from_status,
        to_status,
        message,
        metadata,
        occurred_at
      )
      values (
        v_user_id,
        p_submission_id,
        v_card_record.submission_card_id,
        v_card_record.card_id,
        'card_returned',
        v_card_record.card_status,
        'returned',
        coalesce(
          v_card_record.player_name,
          'Kortet'
        )
        || ' blev returneret som '
        || v_grading_company
        || ' '
        || v_card_record.result_grade
        || '.',
        jsonb_strip_nulls(
          jsonb_build_object(
            'gradingCompany',
            v_grading_company,
            'resultGrade',
            v_card_record.result_grade,
            'resultQualifier',
            v_card_record.result_qualifier,
            'certificationNumber',
            v_card_record.certification_number,
            'totalGradingCost',
            v_card_record.total_grading_cost,
            'resultMarketValue',
            v_card_record.result_market_value
          )
        ),
        v_occurred_at
      );


      v_updated_card_count :=
        v_updated_card_count + 1;

    end loop;


    if v_updated_card_count <> v_card_count then
      raise exception
        using
          message =
            'Ikke alle kort kunne markeres som returneret. Ingen aendringer blev gemt.',
          errcode = 'P0001';
    end if;


  elsif v_target_status = 'completed' then

    update public.grading_submissions
    set
      status = 'completed',
      completed_at = v_occurred_at,
      notes = coalesce(
        v_notes,
        notes
      )
    where
      id = p_submission_id
      and user_id = v_user_id;

  end if;


  insert into public.grading_submission_events (
    user_id,
    submission_id,
    event_type,
    from_status,
    to_status,
    message,
    metadata,
    occurred_at
  )
  values (
    v_user_id,
    p_submission_id,
    'submission_status_changed',
    v_current_status,
    v_target_status,
    v_submission_name
    || ' blev aendret fra '
    || v_current_status
    || ' til '
    || v_target_status
    || '.',
    jsonb_strip_nulls(
      jsonb_build_object(
        'gradingCompany',
        v_grading_company,
        'submissionNumber',
        v_submission_number,
        'outboundTrackingNumber',
        v_outbound_tracking_number,
        'returnTrackingNumber',
        v_return_tracking_number,
        'notes',
        v_notes,
        'cardCount',
        v_card_count,
        'updatedCardCount',
        v_updated_card_count
      )
    ),
    v_occurred_at
  );


  return query
  select
    p_submission_id,
    v_current_status,
    v_target_status,
    v_card_count,
    v_updated_card_count,
    (
      v_submission_name
      || ' er nu '
      || v_target_status
      || '.'
    )::text;

end;
$function$


CREATE OR REPLACE FUNCTION public.upsert_cardshow_inventory_items(p_event_id uuid, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(event_id uuid, added_count integer, updated_count integer, item_count integer, result_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_event_name text;

  v_event_status text;

  v_event_currency text;

  v_item_count integer;

  v_distinct_card_count integer;

  v_added_count integer := 0;

  v_updated_count integer := 0;

  v_item jsonb;

  v_card_id uuid;

  v_player_name text;

  v_card_state text;

  v_collection_currency text;

  v_market_value numeric;

  v_market_currency text;

  v_manual_value numeric;

  v_reference_value numeric;

  v_reference_source text;

  v_status text;

  v_asking_price numeric;

  v_floor_price numeric;

  v_price_source text;

  v_price_group_label text;

  v_price_group_amount numeric;

  v_location_label text;

  v_inventory_code text;

  v_reserved_for text;

  v_reservation_note text;

  v_reserved_until timestamp with time zone;

  v_notes text;

  v_existing_status text;

  v_existing_reserved_at timestamp with time zone;

  v_is_existing boolean;
begin

  if v_user_id is null then
    raise exception
      using
        message =
          'Du skal være logget ind for at administrere cardshow-inventory.',
        errcode = 'P0001';
  end if;


  if p_event_id is null then
    raise exception
      using
        message =
          'Cardshow-ID mangler.',
        errcode = 'P0001';
  end if;


  select
    event.name,
    event.status,
    event.currency
  into
    v_event_name,
    v_event_status,
    v_event_currency
  from public.cardshow_events event
  where
    event.id = p_event_id
    and event.user_id = v_user_id
  for update;


  if not found then
    raise exception
      using
        message =
          'Cardshowet blev ikke fundet, eller du har ikke adgang til det.',
        errcode = 'P0001';
  end if;


  if v_event_status not in (
    'planning',
    'active'
  )
  then
    raise exception
      using
        message =
          'Inventory kan kun ændres på planlagte eller aktive cardshows.',
        errcode = 'P0001';
  end if;


  if
    p_items is null
    or jsonb_typeof(
      p_items
    ) <> 'array'
  then
    raise exception
      using
        message =
          'Kortlisten har et ugyldigt format.',
        errcode = 'P0001';
  end if;


  v_item_count :=
    jsonb_array_length(
      p_items
    );


  if v_item_count < 1 then
    raise exception
      using
        message =
          'Vælg mindst ét kort til cardshowet.',
        errcode = 'P0001';
  end if;


  if v_item_count > 5000 then
    raise exception
      using
        message =
          'Der kan højst behandles 5.000 kort ad gangen.',
        errcode = 'P0001';
  end if;


  begin
    select
      count(
        distinct (
          nullif(
            btrim(
              item ->> 'cardId'
            ),
            ''
          )::uuid
        )
      )
    into v_distinct_card_count
    from jsonb_array_elements(
      p_items
    ) as item;
  exception
    when invalid_text_representation then
      raise exception
        using
          message =
            'Et eller flere kort-ID''er har et ugyldigt format.',
          errcode = 'P0001';
  end;


  if
    v_distinct_card_count <>
    v_item_count
  then
    raise exception
      using
        message =
          'Det samme kort må kun forekomme én gang i batchen.',
        errcode = 'P0001';
  end if;


  for v_item in
    select item
    from jsonb_array_elements(
      p_items
    ) as item
  loop

    if
      jsonb_typeof(
        v_item
      ) <> 'object'
    then
      raise exception
        using
          message =
            'Et inventory-element har et ugyldigt format.',
          errcode = 'P0001';
    end if;


    begin
      v_card_id :=
        nullif(
          btrim(
            v_item ->> 'cardId'
          ),
          ''
        )::uuid;

      v_status :=
        lower(
          coalesce(
            nullif(
              btrim(
                v_item ->> 'status'
              ),
              ''
            ),
            'available'
          )
        );

      v_asking_price :=
        nullif(
          btrim(
            v_item ->> 'askingPrice'
          ),
          ''
        )::numeric;

      v_floor_price :=
        nullif(
          btrim(
            v_item ->> 'floorPrice'
          ),
          ''
        )::numeric;

      v_price_source :=
        lower(
          coalesce(
            nullif(
              btrim(
                v_item ->> 'priceSource'
              ),
              ''
            ),
            'manual'
          )
        );

      v_price_group_label :=
        nullif(
          btrim(
            v_item ->> 'priceGroupLabel'
          ),
          ''
        );

      v_price_group_amount :=
        nullif(
          btrim(
            v_item ->> 'priceGroupAmount'
          ),
          ''
        )::numeric;

      v_location_label :=
        nullif(
          btrim(
            v_item ->> 'locationLabel'
          ),
          ''
        );

      v_inventory_code :=
        nullif(
          btrim(
            v_item ->> 'inventoryCode'
          ),
          ''
        );

      v_reserved_for :=
        nullif(
          btrim(
            v_item ->> 'reservedFor'
          ),
          ''
        );

      v_reservation_note :=
        nullif(
          btrim(
            v_item ->> 'reservationNote'
          ),
          ''
        );

      v_reserved_until :=
        nullif(
          btrim(
            v_item ->> 'reservedUntil'
          ),
          ''
        )::timestamp with time zone;

      v_notes :=
        nullif(
          btrim(
            v_item ->> 'notes'
          ),
          ''
        );

    exception
      when invalid_text_representation then
        raise exception
          using
            message =
              'Et inventory-element indeholder et ugyldigt ID, beløb eller tidspunkt.',
            errcode = 'P0001';
    end;


    if v_card_id is null then
      raise exception
        using
          message =
            'Et inventory-element mangler et kort-ID.',
          errcode = 'P0001';
    end if;


    if v_status not in (
      'available',
      'reserved',
      'withdrawn'
    )
    then
      raise exception
        using
          message =
            'Nye inventory-elementer kan kun være Available, Reserved eller Withdrawn.',
          errcode = 'P0001';
    end if;


    if v_price_source not in (
      'manual',
      'market',
      'suggested',
      'price_group'
    )
    then
      raise exception
        using
          message =
            'Priskilden er ugyldig.',
          errcode = 'P0001';
    end if;


    if
      v_asking_price is not null
      and v_asking_price <= 0
    then
      raise exception
        using
          message =
            'Asking price skal være større end 0.',
          errcode = 'P0001';
    end if;


    if
      v_floor_price is not null
      and v_floor_price < 0
    then
      raise exception
        using
          message =
            'Floor price kan ikke være negativ.',
          errcode = 'P0001';
    end if;


    if
      v_price_group_amount is not null
      and v_price_group_amount <= 0
    then
      raise exception
        using
          message =
            'Prisgruppens beløb skal være større end 0.',
          errcode = 'P0001';
    end if;


    if
      v_status = 'reserved'
      and v_reserved_for is null
    then
      raise exception
        using
          message =
            'Angiv hvem kortet er reserveret til.',
          errcode = 'P0001';
    end if;


    select
      card.player_name,
      card.state,
      collection.currency,
      card.market_estimated_value,
      card.market_value_currency,
      card.estimated_value
    into
      v_player_name,
      v_card_state,
      v_collection_currency,
      v_market_value,
      v_market_currency,
      v_manual_value
    from public.cards card

    join public.collections collection
      on collection.id =
        card.current_collection_id

    where
      card.id =
        v_card_id

      and card.user_id =
        v_user_id

      and collection.user_id =
        v_user_id

    for update of card;


    if not found then
      raise exception
        using
          message =
            'Et valgt kort blev ikke fundet, eller du har ikke adgang til det.',
          errcode = 'P0001';
    end if;


    if v_card_state in (
      'sold',
      'archived'
    )
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' kan ikke tilføjes til cardshow-inventory, fordi det er '
            || v_card_state
            || '.',
          errcode = 'P0001';
    end if;


    if
      upper(
        v_collection_currency
      ) <>
      upper(
        v_event_currency
      )
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' har en anden valuta end cardshowet.',
          errcode = 'P0001';
    end if;


    v_reference_value := null;
    v_reference_source := 'none';


    if
      v_market_value is not null

      and upper(
        coalesce(
          nullif(
            btrim(
              v_market_currency
            ),
            ''
          ),
          v_collection_currency
        )
      ) =
      upper(
        v_event_currency
      )
    then
      v_reference_value :=
        v_market_value;

      v_reference_source :=
        'market';

    elsif v_manual_value is not null then
      v_reference_value :=
        v_manual_value;

      v_reference_source :=
        'manual';
    end if;


    if
      v_asking_price is null
      and v_price_source = 'market'
      and v_reference_source = 'market'
    then
      v_asking_price :=
        v_reference_value;
    end if;


    if
      v_asking_price is null
      and v_price_source = 'price_group'
      and v_price_group_amount is not null
    then
      v_asking_price :=
        v_price_group_amount;
    end if;


    if
      v_floor_price is not null
      and v_asking_price is not null
      and v_floor_price >
        v_asking_price
    then
      raise exception
        using
          message =
            'Floor price kan ikke være højere end asking price.',
          errcode = 'P0001';
    end if;


    select
      item.status,
      item.reserved_at
    into
      v_existing_status,
      v_existing_reserved_at
    from public.cardshow_inventory_items item
    where
      item.event_id =
        p_event_id

      and item.card_id =
        v_card_id

      and item.user_id =
        v_user_id;


    v_is_existing :=
      found;


    if
      v_is_existing
      and v_existing_status = 'sold'
    then
      raise exception
        using
          message =
            coalesce(
              v_player_name,
              'Kortet'
            )
            || ' er allerede solgt på dette cardshow og kan ikke overskrives.',
          errcode = 'P0001';
    end if;


    insert into public.cardshow_inventory_items (
      user_id,
      event_id,
      card_id,
      status,
      asking_price,
      floor_price,
      price_source,
      price_group_label,
      price_group_amount,
      location_label,
      inventory_code,
      reference_value,
      reference_value_source,
      reference_value_captured_at,
      reserved_for,
      reservation_note,
      reserved_at,
      reserved_until,
      sold_at,
      withdrawn_at,
      notes
    )
    values (
      v_user_id,
      p_event_id,
      v_card_id,
      v_status,
      v_asking_price,
      v_floor_price,
      v_price_source,
      v_price_group_label,
      v_price_group_amount,
      v_location_label,
      v_inventory_code,
      v_reference_value,
      v_reference_source,
      now(),
      case
        when v_status = 'reserved'
        then v_reserved_for
        else null
      end,
      case
        when v_status = 'reserved'
        then v_reservation_note
        else null
      end,
      case
        when v_status = 'reserved'
        then now()
        else null
      end,
      case
        when v_status = 'reserved'
        then v_reserved_until
        else null
      end,
      null,
      case
        when v_status = 'withdrawn'
        then now()
        else null
      end,
      v_notes
    )
    on conflict (
      event_id,
      card_id
    )
    do update
    set
      status =
        excluded.status,

      asking_price =
        excluded.asking_price,

      floor_price =
        excluded.floor_price,

      price_source =
        excluded.price_source,

      price_group_label =
        excluded.price_group_label,

      price_group_amount =
        excluded.price_group_amount,

      location_label =
        excluded.location_label,

      inventory_code =
        excluded.inventory_code,

      reference_value =
        excluded.reference_value,

      reference_value_source =
        excluded.reference_value_source,

      reference_value_captured_at =
        excluded.reference_value_captured_at,

      reserved_for =
        excluded.reserved_for,

      reservation_note =
        excluded.reservation_note,

      reserved_at =
        case
          when excluded.status = 'reserved'
          then coalesce(
            v_existing_reserved_at,
            now()
          )
          else null
        end,

      reserved_until =
        excluded.reserved_until,

      sold_at =
        null,

      withdrawn_at =
        excluded.withdrawn_at,

      notes =
        excluded.notes;


    if v_is_existing then
      v_updated_count :=
        v_updated_count + 1;
    else
      v_added_count :=
        v_added_count + 1;
    end if;

  end loop;


  return query
  select
    p_event_id,
    v_added_count,
    v_updated_count,
    v_item_count,
    (
      v_added_count
      || ' kort tilføjet og '
      || v_updated_count
      || ' kort opdateret i '
      || v_event_name
      || '.'
    )::text;

end;
$function$


-- Triggers, storage configuration, and row-level security policies

CREATE TRIGGER card_market_estimates_set_updated_at BEFORE UPDATE ON card_market_estimates FOR EACH ROW EXECUTE FUNCTION set_card_market_estimates_updated_at();

CREATE TRIGGER card_transactions_set_updated_at BEFORE UPDATE ON card_transactions FOR EACH ROW EXECUTE FUNCTION set_card_transactions_updated_at();

CREATE TRIGGER cards_record_collection_movement AFTER INSERT OR UPDATE OF current_collection_id ON cards FOR EACH ROW EXECUTE FUNCTION record_card_collection_movement();

CREATE TRIGGER cards_set_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION set_cards_updated_at();

CREATE TRIGGER cardshow_events_set_updated_at BEFORE UPDATE ON cardshow_events FOR EACH ROW EXECUTE FUNCTION set_cardshow_updated_at();

CREATE TRIGGER cardshow_inventory_items_set_updated_at BEFORE UPDATE ON cardshow_inventory_items FOR EACH ROW EXECUTE FUNCTION set_cardshow_updated_at();

CREATE TRIGGER grading_submission_cards_set_updated_at BEFORE UPDATE ON grading_submission_cards FOR EACH ROW EXECUTE FUNCTION set_grading_updated_at();

CREATE TRIGGER grading_submissions_set_updated_at BEFORE UPDATE ON grading_submissions FOR EACH ROW EXECUTE FUNCTION set_grading_updated_at();

CREATE TRIGGER purchase_lot_cards_set_updated_at BEFORE UPDATE ON purchase_lot_cards FOR EACH ROW EXECUTE FUNCTION set_cardshow_updated_at();

CREATE TRIGGER purchase_lots_set_updated_at BEFORE UPDATE ON purchase_lots FOR EACH ROW EXECUTE FUNCTION set_cardshow_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', 'f', 15728640, array['image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can create own card attributes" on public.card_attributes as permissive for insert to public
with check ((auth.uid() = user_id));

create policy "Users can delete own card attributes" on public.card_attributes as permissive for delete to public
using ((auth.uid() = user_id));

create policy "Users can update own card attributes" on public.card_attributes as permissive for update to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));

create policy "Users can view own card attributes" on public.card_attributes as permissive for select to public
using ((auth.uid() = user_id));

create policy "Users can view own card history" on public.card_collection_history as permissive for select to public
using ((auth.uid() = user_id));

create policy "Users can create own card images" on public.card_images as permissive for insert to public
with check ((auth.uid() = user_id));

create policy "Users can delete own card images" on public.card_images as permissive for delete to public
using ((auth.uid() = user_id));

create policy "Users can update own card images" on public.card_images as permissive for update to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));

create policy "Users can view own card images" on public.card_images as permissive for select to public
using ((auth.uid() = user_id));

create policy "Users can create own market comparables" on public.card_market_comparables as permissive for insert to authenticated
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM card_market_estimates
  WHERE ((card_market_estimates.id = card_market_comparables.estimate_id) AND (card_market_estimates.user_id = auth.uid()) AND (card_market_estimates.card_id = card_market_estimates.card_id))))));

create policy "Users can delete own market comparables" on public.card_market_comparables as permissive for delete to authenticated
using ((auth.uid() = user_id));

create policy "Users can update own market comparables" on public.card_market_comparables as permissive for update to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));

create policy "Users can view own market comparables" on public.card_market_comparables as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can create own market estimates" on public.card_market_estimates as permissive for insert to authenticated
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM cards
  WHERE ((cards.id = card_market_estimates.card_id) AND (cards.user_id = auth.uid()))))));

create policy "Users can delete own market estimates" on public.card_market_estimates as permissive for delete to authenticated
using ((auth.uid() = user_id));

create policy "Users can update own market estimates" on public.card_market_estimates as permissive for update to authenticated
using ((auth.uid() = user_id))
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM cards
  WHERE ((cards.id = card_market_estimates.card_id) AND (cards.user_id = auth.uid()))))));

create policy "Users can view own market estimates" on public.card_market_estimates as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can view own card transactions" on public.card_transactions as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can delete own cards" on public.cards as permissive for delete to public
using ((auth.uid() = user_id));

create policy "Users can insert own cards" on public.cards as permissive for insert to public
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = cards.current_collection_id) AND (collections.user_id = auth.uid()))))));

create policy "Users can update own cards" on public.cards as permissive for update to public
using ((auth.uid() = user_id))
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = cards.current_collection_id) AND (collections.user_id = auth.uid()))))));

create policy "Users can view own cards" on public.cards as permissive for select to public
using ((auth.uid() = user_id));

create policy "Users can view own cardshow events" on public.cardshow_events as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can view own cardshow inventory" on public.cardshow_inventory_items as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can delete own collections" on public.collections as permissive for delete to public
using ((auth.uid() = user_id));

create policy "Users can insert own collections" on public.collections as permissive for insert to public
with check ((auth.uid() = user_id));

create policy "Users can update own collections" on public.collections as permissive for update to public
using ((auth.uid() = user_id));

create policy "Users can view own collections" on public.collections as permissive for select to public
using ((auth.uid() = user_id));

create policy "Users can create own grading submission cards" on public.grading_submission_cards as permissive for insert to authenticated
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM grading_submissions submission
  WHERE ((submission.id = grading_submission_cards.submission_id) AND (submission.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM cards card
  WHERE ((card.id = grading_submission_cards.card_id) AND (card.user_id = auth.uid()))))));

create policy "Users can delete own grading submission cards" on public.grading_submission_cards as permissive for delete to authenticated
using ((auth.uid() = user_id));

create policy "Users can update own grading submission cards" on public.grading_submission_cards as permissive for update to authenticated
using ((auth.uid() = user_id))
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM grading_submissions submission
  WHERE ((submission.id = grading_submission_cards.submission_id) AND (submission.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM cards card
  WHERE ((card.id = grading_submission_cards.card_id) AND (card.user_id = auth.uid()))))));

create policy "Users can view own grading submission cards" on public.grading_submission_cards as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can create own grading events" on public.grading_submission_events as permissive for insert to authenticated
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM grading_submissions submission
  WHERE ((submission.id = grading_submission_events.submission_id) AND (submission.user_id = auth.uid()))))));

create policy "Users can delete own grading events" on public.grading_submission_events as permissive for delete to authenticated
using ((auth.uid() = user_id));

create policy "Users can update own grading events" on public.grading_submission_events as permissive for update to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));

create policy "Users can view own grading events" on public.grading_submission_events as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can create own grading submissions" on public.grading_submissions as permissive for insert to authenticated
with check ((auth.uid() = user_id));

create policy "Users can delete own grading submissions" on public.grading_submissions as permissive for delete to authenticated
using ((auth.uid() = user_id));

create policy "Users can update own grading submissions" on public.grading_submissions as permissive for update to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));

create policy "Users can view own grading submissions" on public.grading_submissions as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can view own purchase lot cards" on public.purchase_lot_cards as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can view own purchase lots" on public.purchase_lots as permissive for select to authenticated
using ((auth.uid() = user_id));

create policy "Users can delete their own card images" on storage.objects as permissive for delete to authenticated
using (((bucket_id = 'card-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));

create policy "Users can update their own card images" on storage.objects as permissive for update to authenticated
using (((bucket_id = 'card-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))))
with check (((bucket_id = 'card-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));

create policy "Users can upload their own card images" on storage.objects as permissive for insert to authenticated
with check (((bucket_id = 'card-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));

create policy "Users can view their own card images" on storage.objects as permissive for select to authenticated
using (((bucket_id = 'card-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));
