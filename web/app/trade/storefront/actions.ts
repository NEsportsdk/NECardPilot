"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseStorefrontListingInput } from "@/lib/storefront/listingInput";
import { createClient } from "@/lib/supabase/server";
import { parseWorkspaceList } from "@/lib/workspaces/workspace";

function redirectWithStatus(
  key: "error" | "saved",
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
