import type { Metadata } from "next";
import Link from "next/link";

import AppSidebar from "@/components/app/AppSidebar";
import {
  type StorefrontCard,
  loadStorefrontListingDesk,
} from "@/lib/storefront/listings.server";

import { saveStorefrontListingAction } from "./actions";
import styles from "./storefront.module.css";

export const metadata: Metadata = {
  title: "Storefront Pipeline",
  description: "Klargør Vallectives lager til den offentlige Shopify-butik.",
};

function cardTitle(card: StorefrontCard) {
  return [
    card.year,
    card.manufacturer,
    card.set_name,
    card.player_name,
    card.parallel_name,
    card.card_number ? `#${card.card_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function suggestedPrice(card: StorefrontCard) {
  const market = Number(card.market_estimated_value);
  const manual = Number(card.estimated_value);
  const value = market > 0 ? market : manual > 0 ? manual : 0;

  return value > 0 ? value.toFixed(2).replace(".", ",") : "";
}

const statusLabels = {
  error: "Kræver handling",
  paused: "Sat på pause",
  published: "Live i Shopify",
  ready_for_shopify: "Klar til Shopify",
  sold: "Solgt",
  synced: "Synkroniseret",
} as const;

export default async function StorefrontPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const desk = await loadStorefrontListingDesk();
  const listingsByCard = new Map(
    desk.listings.map((listing) => [listing.card_id, listing])
  );
  const readyCount = desk.listings.filter(
    (listing) => listing.status === "ready_for_shopify"
  ).length;
  const publishedCount = desk.listings.filter(
    (listing) => listing.status === "published"
  ).length;

  return (
    <div className={styles.shell}>
      <AppSidebar variant="fixed" />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Vallective Business · {desk.workspaceName}</p>
            <h1>Storefront pipeline</h1>
            <p>
              Vælg et fysisk kort, kvalitetssikr salgsdata og markér det som
              klar. Intet bliver vist offentligt, før det findes som produkt i Shopify.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/shop">Se offentlig shop</Link>
            <Link href="/trade">← Trade Desk</Link>
          </div>
        </header>

        {saved ? (
          <p className={styles.successNotice} role="status">
            Kortet er gemt sikkert og står nu klar i Shopify-køen.
          </p>
        ) : null}
        {error ? (
          <p className={styles.errorNotice} role="alert">
            {error}
          </p>
        ) : null}

        <section className={styles.summaryGrid} aria-label="Pipeline status">
          <article>
            <span>Kort i lagerudsnit</span>
            <strong>{desk.cards.length}</strong>
          </article>
          <article>
            <span>Klar til Shopify</span>
            <strong>{readyCount}</strong>
          </article>
          <article>
            <span>Live i Shopify</span>
            <strong>{publishedCount}</strong>
          </article>
          <article className={styles.currencyCard}>
            <span>Aktiv checkout-valuta</span>
            <strong>DKK</strong>
            <small>EUR aktiveres senere via Shopify Markets</small>
          </article>
        </section>

        <section className={styles.guide}>
          <div>
            <span>1</span>
            <p><strong>Klargør</strong> titel, stand og pris.</p>
          </div>
          <div>
            <span>2</span>
            <p><strong>Synkronisér</strong> til Shopify i næste integrationstrin.</p>
          </div>
          <div>
            <span>3</span>
            <p><strong>Udgiv</strong> først når produkt og lager er kontrolleret.</p>
          </div>
        </section>

        <section className={styles.cardList}>
          <div className={styles.listHeading}>
            <div>
              <p className={styles.eyebrow}>Virksomhedslager</p>
              <h2>Vælg kort til webshoppen</h2>
            </div>
            <p>Viser de senest opdaterede 100 aktive kort.</p>
          </div>

          {desk.cards.length > 0 ? (
            desk.cards.map((card) => {
              const listing = listingsByCard.get(card.id);
              const title = listing?.title ?? cardTitle(card);
              const price = listing
                ? Number(listing.price_amount).toFixed(2).replace(".", ",")
                : suggestedPrice(card);

              return (
                <article className={styles.cardRow} key={card.id}>
                  <div className={styles.cardIdentity}>
                    <div className={styles.cardMark}>V</div>
                    <div>
                      <span>{card.state.replaceAll("_", " ")}</span>
                      <h3>{card.player_name}</h3>
                      <p>
                        {[card.year, card.manufacturer, card.set_name]
                          .filter(Boolean)
                          .join(" · ") || "Kortdetaljer mangler"}
                      </p>
                    </div>
                    {listing ? (
                      <small data-status={listing.status}>
                        {statusLabels[listing.status]}
                      </small>
                    ) : null}
                  </div>

                  <form action={saveStorefrontListingAction} className={styles.listingForm}>
                    <input name="workspaceId" type="hidden" value={desk.workspaceId} />
                    <input name="cardId" type="hidden" value={card.id} />
                    <label className={styles.titleField}>
                      <span>Shop-titel</span>
                      <input defaultValue={title} maxLength={180} name="title" required />
                    </label>
                    <label>
                      <span>Stand</span>
                      <input
                        defaultValue={listing?.condition_label ?? ""}
                        maxLength={80}
                        name="conditionLabel"
                        placeholder="Fx Near Mint"
                      />
                    </label>
                    <label>
                      <span>Pris</span>
                      <input
                        defaultValue={price}
                        inputMode="decimal"
                        name="priceAmount"
                        placeholder="0,00"
                        required
                      />
                    </label>
                    <label>
                      <span>Valuta</span>
                      <select defaultValue={listing?.currency ?? "DKK"} name="currency">
                        <option value="DKK">DKK</option>
                        <option disabled value="EUR">EUR · kommer via Markets</option>
                      </select>
                    </label>
                    <label className={styles.descriptionField}>
                      <span>Beskrivelse</span>
                      <textarea
                        defaultValue={listing?.description ?? ""}
                        maxLength={5000}
                        name="description"
                        placeholder="Det særlige ved kortet, stand og relevante detaljer…"
                        rows={3}
                      />
                    </label>
                    <button type="submit">
                      {listing ? "Opdatér Shopify-kø" : "Klar til Shopify"}
                    </button>
                  </form>
                </article>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <h3>Virksomhedslageret er tomt</h3>
              <p>Scan eller flyt kort til Vallective Business, før de klargøres til shoppen.</p>
              <Link href="/scanner">Åbn scanner</Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
