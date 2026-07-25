import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type MoveCardRequest = {
  cardId?: unknown;
  targetCollectionId?: unknown;
};

type CardRow = {
  id: string;
  user_id: string;
  current_collection_id: string;
  player_name: string;
};

type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
};

class RequestError extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);

    this.name = "RequestError";
    this.status = status;
  }
}

function getRequiredString(
  value: unknown,
  label: string
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new RequestError(
      `${label} mangler.`
    );
  }

  return value.trim();
}

function getErrorMessage(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Der opstod en ukendt fejl.";
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as MoveCardRequest;

    const cardId =
      getRequiredString(
        body.cardId,
        "Kort-ID"
      );

    const targetCollectionId =
      getRequiredString(
        body.targetCollectionId,
        "Den nye collection"
      );

    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      throw new RequestError(
        "Du skal være logget ind for at flytte kortet.",
        401
      );
    }

    const userId = user.id;

    const {
      data: cardData,
      error: cardError,
    } = await supabase
      .from("cards")
      .select(`
        id,
        user_id,
        current_collection_id,
        player_name
      `)
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (
      cardError ||
      !cardData
    ) {
      throw new RequestError(
        "Kortet blev ikke fundet, eller du har ikke adgang til det.",
        404
      );
    }

    const card =
      cardData as CardRow;

    const sourceCollectionId =
      card.current_collection_id;

    if (
      sourceCollectionId ===
      targetCollectionId
    ) {
      throw new RequestError(
        "Kortet ligger allerede i den valgte collection.",
        409
      );
    }

    const {
      data: collectionData,
      error: collectionError,
    } = await supabase
      .from("collections")
      .select(`
        id,
        user_id,
        name,
        type,
        currency
      `)
      .eq("user_id", userId)
      .in("id", [
        sourceCollectionId,
        targetCollectionId,
      ]);

    if (collectionError) {
      throw new RequestError(
        `Collections kunne ikke indlæses: ${collectionError.message}`,
        500
      );
    }

    const collections =
      (collectionData ??
        []) as CollectionRow[];

    const sourceCollection =
      collections.find(
        (collection) =>
          collection.id ===
          sourceCollectionId
      );

    const targetCollection =
      collections.find(
        (collection) =>
          collection.id ===
          targetCollectionId
      );

    if (!sourceCollection) {
      throw new RequestError(
        "Kortets nuværende collection blev ikke fundet.",
        404
      );
    }

    if (!targetCollection) {
      throw new RequestError(
        "Den valgte destination blev ikke fundet, eller du har ikke adgang til den.",
        404
      );
    }

    /*
     * Kortets købspris og værdi gemmes uden
     * en separat valutakode på selve kortet.
     *
     * Derfor tillader vi foreløbig kun en
     * flytning mellem collections med samme
     * valuta.
     */
    if (
      sourceCollection.currency !==
      targetCollection.currency
    ) {
      throw new RequestError(
        `Kortet kan ikke flyttes fra ${sourceCollection.currency} til ${targetCollection.currency}, før vi har bygget valutaomregning.`,
        409
      );
    }

    const {
      data: updatedCard,
      error: updateError,
    } = await supabase
      .from("cards")
      .update({
        current_collection_id:
          targetCollectionId,
      })
      .eq("id", cardId)
      .eq("user_id", userId)
      .eq(
        "current_collection_id",
        sourceCollectionId
      )
      .select(`
        id,
        current_collection_id
      `)
      .maybeSingle();

    if (updateError) {
      throw new RequestError(
        `Kortet kunne ikke flyttes: ${updateError.message}`,
        500
      );
    }

    if (!updatedCard) {
      throw new RequestError(
        "Kortets placering blev ændret af en anden proces. Genindlæs siden og prøv igen.",
        409
      );
    }

    /*
     * Databasens eksisterende trigger på
     * cards.current_collection_id registrerer
     * automatisk flytningen i
     * card_collection_history.
     */

    return NextResponse.json({
      success: true,

      cardId,

      playerName:
        card.player_name,

      fromCollection: {
        id:
          sourceCollection.id,

        name:
          sourceCollection.name,

        type:
          sourceCollection.type,
      },

      toCollection: {
        id:
          targetCollection.id,

        name:
          targetCollection.name,

        type:
          targetCollection.type,
      },

      message:
        `${card.player_name} er flyttet fra ${sourceCollection.name} til ${targetCollection.name}.`,
    });
  } catch (error) {
    console.error(
      "Fejl i move-card route:",
      error
    );

    const status =
      error instanceof RequestError
        ? error.status
        : 500;

    return NextResponse.json(
      {
        error:
          getErrorMessage(error),
      },
      {
        status,
      }
    );
  }
}