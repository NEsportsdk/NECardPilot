import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildDuplicateCheckResult,
  type DuplicateCardCandidate,
  type DuplicateCardCheckResult,
  type DuplicateCardIdentity,
} from "@/lib/cards/duplicateCards";

type CollectionNameRow = {
  id: string;
  name: string;
};

export async function findDuplicateCards(
  supabase: SupabaseClient,
  userId: string,
  identity: DuplicateCardIdentity
): Promise<DuplicateCardCheckResult> {
  if (!identity.playerName?.trim()) {
    return {
      matches: [],
      requiresAcknowledgement: false,
    };
  }

  const { data, error } = await supabase
    .from("cards")
    .select(
      "id,current_collection_id,player_name,year,manufacturer,set_name,card_number,parallel_name,serial_number,state,created_at"
    )
    .eq("user_id", userId)
    .ilike("player_name", identity.playerName.trim())
    .order("created_at", {
      ascending: false,
    })
    .limit(75);

  if (error) {
    throw new Error(
      `Dubletkontrollen kunne ikke læse kortbiblioteket: ${error.message}`
    );
  }

  const candidates =
    (data ?? []) as DuplicateCardCandidate[];

  const collectionIds = Array.from(
    new Set(
      candidates.map(
        (candidate) =>
          candidate.current_collection_id
      )
    )
  );

  const collectionNames = new Map<
    string,
    string
  >();

  if (collectionIds.length > 0) {
    const {
      data: collectionData,
      error: collectionError,
    } = await supabase
      .from("collections")
      .select("id,name")
      .eq("user_id", userId)
      .in("id", collectionIds);

    if (collectionError) {
      throw new Error(
        `Dubletkontrollen kunne ikke læse collections: ${collectionError.message}`
      );
    }

    for (const collection of (collectionData ?? []) as CollectionNameRow[]) {
      collectionNames.set(
        collection.id,
        collection.name
      );
    }
  }

  return buildDuplicateCheckResult(
    identity,
    candidates,
    collectionNames
  );
}
