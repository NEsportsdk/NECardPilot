"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  publishShopifyProduct,
  upsertShopifyProduct,
} from "@/lib/shopify/publishListing";
import { parseStorefrontListingInput } from "@/lib/storefront/listingInput";
import { createClient } from "@/lib/supabase/server";
import { parseWorkspaceList } from "@/lib/workspaces/workspace";

function redirectWithStatus(
  key: "error" | "published" | "saved",
  value: string
): never {
  const query = new URLSearchParams({ [key]: value });
  redirect(`/trade/storefront?${query.toString()}`);
}

export async function saveStorefrontListingAction(formData: FormData) {
  const parsed = parseStorefrontListingInput(formData);

  if (!parsed.ok) {
    redirectWithStatus("error", parsed.error);
  }

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
    redirectWithStatus("error", "Arbejdsrummet kunne ikke kontrolleres.");
  }

  const workspace = parseWorkspaceList(workspaceRows).find(
    (candidate) => candidate.id === parsed.data.workspaceId
  );

  if (!workspace || workspace.kind !== "business" || !workspace.canManageSales) {
    redirectWithStatus("error", "Du har ikke salgsadgang til dette arbejdsrum.");
  }

  const { error } = await supabase.from("storefront_listings").upsert(
    {
      card_id: parsed.data.cardId,
      condition_label: parsed.data.conditionLabel,
      currency: parsed.data.currency,
      description: parsed.data.description,
      price_amount: parsed.data.priceAmount,
      status: "ready_for_shopify",
      title: parsed.data.title,
      workspace_id: parsed.data.workspaceId,
    },
    { onConflict: "card_id" }
  );

  if (error) {
    redirectWithStatus("error", "Kortet kunne ikke klargøres. Prøv igen.");
  }

  revalidatePath("/trade");
  revalidatePath("/trade/storefront");
  redirectWithStatus("saved", parsed.data.cardId);
}

export async function publishStorefrontListingAction(formData: FormData) {
  const parsed = parseStorefrontListingInput(formData);

  if (!parsed.ok) {
    redirectWithStatus("error", parsed.error);
  }

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
  const workspace = parseWorkspaceList(workspaceRows).find(
    (candidate) => candidate.id === parsed.data.workspaceId
  );

  if (
    workspaceError ||
    !workspace ||
    workspace.kind !== "business" ||
    !workspace.canManageSales
  ) {
    redirectWithStatus("error", "Du har ikke salgsadgang til dette arbejdsrum.");
  }

  const { data: listing, error: listingError } = await supabase
    .from("storefront_listings")
    .upsert(
      {
        card_id: parsed.data.cardId,
        condition_label: parsed.data.conditionLabel,
        currency: parsed.data.currency,
        description: parsed.data.description,
        price_amount: parsed.data.priceAmount,
        status: "ready_for_shopify",
        title: parsed.data.title,
        workspace_id: parsed.data.workspaceId,
      },
      { onConflict: "card_id" }
    )
    .select(
      "id,shopify_product_id,shopify_variant_id,shopify_handle"
    )
    .single();

  if (listingError || !listing) {
    redirectWithStatus("error", "Kortet kunne ikke klargøres til Shopify.");
  }

  const [cardResult, attributeResult, imageResult] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id,player_name,year,manufacturer,set_name,card_number,parallel_name,serial_number"
      )
      .eq("id", parsed.data.cardId)
      .eq("workspace_id", parsed.data.workspaceId)
      .single(),
    supabase
      .from("card_attributes")
      .select("attribute_key,attribute_value")
      .eq("card_id", parsed.data.cardId),
    supabase
      .from("card_images")
      .select("image_type,storage_path,public_url")
      .eq("card_id", parsed.data.cardId),
  ]);

  if (cardResult.error || !cardResult.data || attributeResult.error || imageResult.error) {
    redirectWithStatus("error", "Kortets data kunne ikke hentes til Shopify.");
  }

  const imageRows = [...(imageResult.data ?? [])].sort((left, right) => {
    const order = { back: 1, detail: 3, front: 0, slab: 2 } as const;
    return (
      (order[left.image_type as keyof typeof order] ?? 9) -
      (order[right.image_type as keyof typeof order] ?? 9)
    );
  });
  const imageUrls = (
    await Promise.all(
      imageRows.map(async (image) => {
        const publicUrl = image.public_url?.trim();
        const url = publicUrl?.startsWith("https://")
          ? publicUrl
          : (
              await supabase.storage
                .from("card-images")
                .createSignedUrl(image.storage_path, 60 * 60)
            ).data?.signedUrl;

        return url
          ? {
              alt: `${parsed.data.title} · ${image.image_type}`,
              url,
            }
          : null;
      })
    )
  ).filter((image): image is { alt: string; url: string } => Boolean(image));

  let productIdentity: Awaited<ReturnType<typeof upsertShopifyProduct>> | null = null;

  try {
    productIdentity = await upsertShopifyProduct({
      attributes: attributeResult.data ?? [],
      card: cardResult.data,
      conditionLabel: parsed.data.conditionLabel,
      currency: parsed.data.currency,
      description: parsed.data.description,
      imageUrls,
      priceAmount: parsed.data.priceAmount,
      shopifyProductId: listing.shopify_product_id,
      shopifyVariantId: listing.shopify_variant_id,
      title: parsed.data.title,
    });

    const { error: syncError } = await supabase
      .from("storefront_listings")
      .update({
        shopify_handle: productIdentity.handle,
        shopify_product_id: productIdentity.productId,
        shopify_variant_id: productIdentity.variantId,
        status: "synced",
      })
      .eq("id", listing.id)
      .eq("workspace_id", parsed.data.workspaceId);

    if (syncError) {
      throw new Error("Vallective could not save the Shopify product identity.");
    }

    await publishShopifyProduct(productIdentity.productId);

    const { error: publishError } = await supabase
      .from("storefront_listings")
      .update({ status: "published" })
      .eq("id", listing.id)
      .eq("workspace_id", parsed.data.workspaceId);

    if (publishError) {
      throw new Error("Vallective could not confirm the published product.");
    }
  } catch (error) {
    const safeError =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Shopify-publiceringen fejlede.";

    await supabase
      .from("storefront_listings")
      .update({
        ...(productIdentity
          ? {
              shopify_handle: productIdentity.handle,
              shopify_product_id: productIdentity.productId,
              shopify_variant_id: productIdentity.variantId,
            }
          : {}),
        status: "error",
        sync_error: safeError,
      })
      .eq("id", listing.id)
      .eq("workspace_id", parsed.data.workspaceId);

    redirectWithStatus(
      "error",
      "Shopify kunne ikke udgive kortet. Fejlen er gemt sikkert på kortets status."
    );
  }

  updateTag("shopify-products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/trade");
  revalidatePath("/trade/storefront");
  redirectWithStatus("published", parsed.data.cardId);
}
