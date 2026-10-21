import "server-only";

import { redirect } from "next/navigation";

import type { CardAttribute } from "@/lib/storefront/cardDna";
import { createClient } from "@/lib/supabase/server";
import { parseWorkspaceList } from "@/lib/workspaces/workspace";

export type StorefrontListing = {
  card_id: string;
  condition_label: string | null;
  currency: "DKK" | "EUR";
  description: string | null;
  id: string;
  price_amount: number | string;
  shopify_handle: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  status: "error" | "paused" | "published" | "ready_for_shopify" | "sold" | "synced";
  sync_error: string | null;
  title: string;
  updated_at: string;
};

export type StorefrontCard = {
  attributes: CardAttribute[];
  card_number: string | null;
  estimated_value: number | string | null;
  id: string;
  manufacturer: string | null;
  market_estimated_value: number | string | null;
  parallel_name: string | null;
  player_name: string;
  serial_number: string | null;
  set_name: string | null;
  state: string;
  updated_at: string;
  year: string | null;
};

export type StorefrontListingDesk = {
  canManageSales: boolean;
  cards: StorefrontCard[];
  listings: StorefrontListing[];
  workspaceId: string;
  workspaceName: string;
};

export async function loadStorefrontListingDesk(): Promise<StorefrontListingDesk> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=%2Ftrade%2Fstorefront");
  }

  const { data: workspaceRows, error: workspaceError } = await supabase.rpc(
    "list_vallective_workspaces"
  );

  if (workspaceError) {
    throw workspaceError;
  }

  const businessWorkspace = parseWorkspaceList(workspaceRows).find(
    (workspace) => workspace.kind === "business" && workspace.canManageSales
  );

  if (!businessWorkspace) {
    redirect("/trade");
  }

  const [cardsResult, listingsResult] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id,player_name,year,manufacturer,set_name,card_number,parallel_name,serial_number,state,estimated_value,market_estimated_value,updated_at"
      )
      .eq("workspace_id", businessWorkspace.id)
      .not("state", "in", '("sold","archived")')
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("storefront_listings")
      .select(
        "id,card_id,status,title,description,condition_label,price_amount,currency,shopify_product_id,shopify_variant_id,shopify_handle,sync_error,updated_at"
      )
      .eq("workspace_id", businessWorkspace.id)
      .order("updated_at", { ascending: false }),
  ]);

  if (cardsResult.error || listingsResult.error) {
    throw cardsResult.error ?? listingsResult.error;
  }

  const cards = (cardsResult.data ?? []) as Array<Omit<StorefrontCard, "attributes">>;
  const cardIds = cards.map((card) => card.id);
  const attributesResult = cardIds.length
    ? await supabase
        .from("card_attributes")
        .select("card_id,attribute_key,attribute_value")
        .in("card_id", cardIds)
    : { data: [], error: null };

  if (attributesResult.error) {
    throw attributesResult.error;
  }

  const attributesByCard = new Map<string, CardAttribute[]>();
  for (const attribute of attributesResult.data ?? []) {
    const attributes = attributesByCard.get(attribute.card_id) ?? [];
    attributes.push({
      attribute_key: attribute.attribute_key,
      attribute_value: attribute.attribute_value,
    });
    attributesByCard.set(attribute.card_id, attributes);
  }

  return {
    canManageSales: businessWorkspace.canManageSales,
    cards: cards.map((card) => ({
      ...card,
      attributes: attributesByCard.get(card.id) ?? [],
    })),
    listings: (listingsResult.data ?? []) as StorefrontListing[],
    workspaceId: businessWorkspace.id,
    workspaceName: businessWorkspace.name,
  };
}
