"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addVariantToCart,
  getCart,
  removeCartLine,
  updateCartLine,
} from "@/lib/shopify/cart";

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${key}.`);
  }

  return value.trim();
}

export async function addToCartAction(formData: FormData) {
  await addVariantToCart(readRequiredString(formData, "variantId"));
  revalidatePath("/shop/cart");
  redirect("/shop/cart");
}

export async function updateCartLineAction(formData: FormData) {
  const lineId = readRequiredString(formData, "lineId");
  const rawQuantity = Number(formData.get("quantity"));
  const quantity = Number.isInteger(rawQuantity)
    ? Math.min(10, Math.max(1, rawQuantity))
    : 1;

  await updateCartLine(lineId, quantity);
  revalidatePath("/shop/cart");
}

export async function removeCartLineAction(formData: FormData) {
  await removeCartLine(readRequiredString(formData, "lineId"));
  revalidatePath("/shop/cart");
}

export async function checkoutAction() {
  const cart = await getCart();

  if (!cart?.checkoutUrl) {
    redirect("/shop/cart");
  }

  redirect(cart.checkoutUrl);
}
