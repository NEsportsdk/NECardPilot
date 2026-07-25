"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

import EditCardModal from "@/components/cards/EditCardModal";
import MoveCardModal from "@/components/cards/MoveCardModal";
import {
  type EditableCardData,
  type UpdateCardResult,
} from "@/lib/cards/updateCard";
import { createClient } from "@/lib/supabase/client";

const CARD_IMAGE_BUCKET = "card-images";
const SIGNED_URL_SECONDS = 60 * 60;

type CardRow = {
  id: string;
  current_collection_id: string;
  player_name: string;
  year: string | null;
  manufacturer: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel_name: string | null;
  serial_number: string | null;
  purchase_price: number | null;
  estimated_value: number | null;
  notes: string | null;
  state: string | null;
  created_at: string;
};

type CollectionRow = {
  id: string;
  name: string;
  type: "pc" | "inventory";
  currency: string;
};

type CardImageRow = {
  image_type: string;
  storage_path: string;
};

type CardAttributeRow = {
  attribute_key: string;
  attribute_value: unknown;
};

type ImageSide = "front" | "back";

type CardStateMeta = {
  label: string;
  tone:
    | "verified"
    | "review"
    | "grading"
    | "listed"
    | "sold"
    | "neutral";
};

function getAttributeValue(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  return attributes.find(
    (attribute) =>
      attribute.attribute_key === attributeKey
  )?.attribute_value;
}

function getStringAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  const value = getAttributeValue(
    attributes,
    attributeKey
  );

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function getNumberAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  const value = getAttributeValue(
    attributes,
    attributeKey
  );

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsedValue = Number(
      value.replace(",", ".")
    );

    return Number.isFinite(parsedValue)
      ? parsedValue
      : null;
  }

  return null;
}

function getBooleanAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  const value = getAttributeValue(
    attributes,
    attributeKey
  );

  if (typeof value === "boolean") {
    return value;
  }

  if (
    typeof value === "string" &&
    value.toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    typeof value === "string" &&
    value.toLowerCase() === "false"
  ) {
    return false;
  }

  return null;
}

function getStringArrayAttribute(
  attributes: CardAttributeRow[],
  attributeKey: string
) {
  const value = getAttributeValue(
    attributes,
    attributeKey
  );

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function joinDistinct(
  values: Array<
    string | null | undefined
  >
) {
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            Boolean(value.trim())
        )
        .map((value) =>
          value.trim()
        )
    )
  ).join(" · ");
}

function formatCurrency(
  value: number | null,
  currency = "DKK"
) {
  if (value === null) {
    return "—";
  }

  if (currency === "DKK") {
    return `${Number(
      value
    ).toLocaleString(
      "da-DK"
    )} kr.`;
  }

  return new Intl.NumberFormat(
    "da-DK",
    {
      style: "currency",
      currency,
    }
  ).format(value);
}

function formatDate(
  dateValue: string
) {
  return new Intl.DateTimeFormat(
    "da-DK",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(dateValue)
  );
}

function formatBoolean(
  value: boolean | null
) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "Unknown";
}

function getSerialNumberedTo(
  serialNumber: string | null
) {
  if (!serialNumber) {
    return null;
  }

  const match =
    serialNumber.match(
      /\/\s*(\d+)\s*$/
    );

  if (!match) {
    return null;
  }

  const parsedValue =
    Number(match[1]);

  return Number.isInteger(
    parsedValue
  ) && parsedValue > 0
    ? parsedValue
    : null;
}

function getCardStateMeta(
  state: string | null
): CardStateMeta {
  switch (state) {
    case "verified":
      return {
        label: "Verified",
        tone: "verified",
      };

    case "needs_review":
    case "draft":
      return {
        label: "Needs review",
        tone: "review",
      };

    case "submitted":
    case "graded":
      return {
        label:
          state === "graded"
            ? "Graded"
            : "At grading",
        tone: "grading",
      };

    case "listed":
      return {
        label: "For sale",
        tone: "listed",
      };

    case "sold":
      return {
        label: "Sold",
        tone: "sold",
      };

    default:
      return {
        label: "Registered",
        tone: "neutral",
      };
  }
}

function DetailItem({
  label,
  value,
  important = false,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
  important?: boolean;
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ""
      ? "—"
      : String(value);

  return (
    <div
      className={[
        "detail-item",
        important
          ? "detail-item-important"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>

      <strong>
        {displayValue}
      </strong>

      <style jsx>{`
        .detail-item {
          min-width: 0;
          padding: 15px 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          border-radius: 14px;
          background: rgba(
            255,
            255,
            255,
            0.02
          );
        }

        .detail-item-important {
          border-color: rgba(
            139,
            92,
            246,
            0.25
          );
          background: rgba(
            124,
            92,
            255,
            0.07
          );
        }

        .detail-item span {
          display: block;
          color: #71798b;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .detail-item strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 7px;
          color: #f8fafc;
          font-size: 13px;
          line-height: 1.45;
        }

        .detail-item-important strong {
          color: #ddd6fe;
        }
      `}</style>
    </div>
  );
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawCardId = params.id;

  const cardId = Array.isArray(
    rawCardId
  )
    ? rawCardId[0]
    : rawCardId ?? "";

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    card,
    setCard,
  ] = useState<CardRow | null>(
    null
  );

  const [
    collection,
    setCollection,
  ] =
    useState<CollectionRow | null>(
      null
    );

  const [
    attributes,
    setAttributes,
  ] = useState<
    CardAttributeRow[]
  >([]);

  const [
    frontImageUrl,
    setFrontImageUrl,
  ] = useState<string | null>(
    null
  );

  const [
    backImageUrl,
    setBackImageUrl,
  ] = useState<string | null>(
    null
  );

  const [
    activeImage,
    setActiveImage,
  ] =
    useState<ImageSide>("front");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    showEditCard,
    setShowEditCard,
  ] = useState(false);

  const [
    showMoveCard,
    setShowMoveCard,
  ] = useState(false);

  const loadCard =
    useCallback(async () => {
      if (!cardId) {
        setMessage(
          "Kort-ID mangler."
        );

        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      const {
        data: cardData,
        error: cardError,
      } = await supabase
        .from("cards")
        .select(`
          id,
          current_collection_id,
          player_name,
          year,
          manufacturer,
          set_name,
          card_number,
          parallel_name,
          serial_number,
          purchase_price,
          estimated_value,
          notes,
          state,
          created_at
        `)
        .eq("id", cardId)
        .single();

      if (
        cardError ||
        !cardData
      ) {
        setCard(null);

        setMessage(
          cardError?.message ??
            "Kortet blev ikke fundet."
        );

        setLoading(false);
        return;
      }

      const currentCard =
        cardData as CardRow;

      const [
        collectionResult,
        imageResult,
        attributeResult,
      ] = await Promise.all([
        supabase
          .from("collections")
          .select(`
            id,
            name,
            type,
            currency
          `)
          .eq(
            "id",
            currentCard.current_collection_id
          )
          .single(),

        supabase
          .from("card_images")
          .select(`
            image_type,
            storage_path
          `)
          .eq(
            "card_id",
            cardId
          ),

        supabase
          .from("card_attributes")
          .select(`
            attribute_key,
            attribute_value
          `)
          .eq(
            "card_id",
            cardId
          ),
      ]);

      setCard(currentCard);

      if (
        !collectionResult.error &&
        collectionResult.data
      ) {
        setCollection(
          collectionResult.data as CollectionRow
        );
      } else {
        setCollection(null);
      }

      if (
        !attributeResult.error
      ) {
        setAttributes(
          (attributeResult.data ??
            []) as CardAttributeRow[]
        );
      } else {
        setAttributes([]);
      }

      const imageRows =
        imageResult.error
          ? []
          : ((imageResult.data ??
              []) as CardImageRow[]);

      const nextImageUrls: {
        front: string | null;
        back: string | null;
      } = {
        front: null,
        back: null,
      };

      await Promise.all(
        imageRows.map(
          async (image) => {
            const {
              data,
              error,
            } =
              await supabase.storage
                .from(
                  CARD_IMAGE_BUCKET
                )
                .createSignedUrl(
                  image.storage_path,
                  SIGNED_URL_SECONDS
                );

            if (
              error ||
              !data?.signedUrl
            ) {
              console.error(
                "Kortbilledet kunne ikke åbnes:",
                {
                  path:
                    image.storage_path,
                  error,
                }
              );

              return;
            }

            if (
              image.image_type ===
              "front"
            ) {
              nextImageUrls.front =
                data.signedUrl;
            }

            if (
              image.image_type ===
              "back"
            ) {
              nextImageUrls.back =
                data.signedUrl;
            }
          }
        )
      );

      setFrontImageUrl(
        nextImageUrls.front
      );

      setBackImageUrl(
        nextImageUrls.back
      );

      if (
        !nextImageUrls.front &&
        nextImageUrls.back
      ) {
        setActiveImage("back");
      } else {
        setActiveImage("front");
      }

      const warnings: string[] =
        [];

      if (collectionResult.error) {
        warnings.push(
          "Collection-oplysningerne kunne ikke indlæses."
        );
      }

      if (imageResult.error) {
        warnings.push(
          "Kortbillederne kunne ikke indlæses."
        );
      }

      if (
        attributeResult.error
      ) {
        warnings.push(
          "Card DNA kunne ikke indlæses."
        );
      }

      if (warnings.length > 0) {
        setMessage(
          warnings.join(" ")
        );
      }

      setLoading(false);
    }, [
      cardId,
      supabase,
    ]);

  useEffect(() => {
    void loadCard();
  }, [loadCard]);

  async function handleCardUpdated(
    result: UpdateCardResult
  ) {
    setShowEditCard(false);

    await loadCard();

    setMessage(
      result.message
    );
  }

  if (loading) {
    return (
      <main className="card-detail-page">
        <div className="card-detail-loading">
          <div className="loading-indicator" />

          <p>
            Indlæser kortet...
          </p>
        </div>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="card-detail-page">
        <Link
          className="card-detail-back"
          href="/"
        >
          ← Tilbage til Home
        </Link>

        <section className="detail-panel card-detail-error">
          <h1>
            Kortet blev ikke fundet
          </h1>

          <p>{message}</p>
        </section>
      </main>
    );
  }

  const currency =
    collection?.currency ??
    "DKK";

  const sport =
    getStringAttribute(
      attributes,
      "sport"
    );

  const team =
    getStringAttribute(
      attributes,
      "team"
    );

  const manufacturer =
    getStringAttribute(
      attributes,
      "manufacturer"
    ) ??
    card.manufacturer;

  const brand =
    getStringAttribute(
      attributes,
      "brand"
    );

  const product =
    getStringAttribute(
      attributes,
      "product"
    );

  const insertName =
    getStringAttribute(
      attributes,
      "set_name"
    ) ??
    card.set_name;

  const serialNumberedTo =
    getNumberAttribute(
      attributes,
      "serial_numbered_to"
    ) ??
    getSerialNumberedTo(
      card.serial_number
    );

  const rookieCard =
    getBooleanAttribute(
      attributes,
      "rookie_card"
    );

  const autograph =
    getBooleanAttribute(
      attributes,
      "autograph"
    );

  const memorabilia =
    getBooleanAttribute(
      attributes,
      "memorabilia"
    );

  const memorabiliaType =
    getStringAttribute(
      attributes,
      "memorabilia_type"
    );

  const variation =
    getStringAttribute(
      attributes,
      "variation"
    );

  const gradingCompany =
    getStringAttribute(
      attributes,
      "grading_company"
    );

  const grade =
    getStringAttribute(
      attributes,
      "grade"
    );

  const certificationNumber =
    getStringAttribute(
      attributes,
      "certification_number"
    );

  const language =
    getStringAttribute(
      attributes,
      "language"
    );

  const purchaseSource =
    getStringAttribute(
      attributes,
      "purchase_source"
    );

  const aiConfidence =
    getNumberAttribute(
      attributes,
      "ai_confidence"
    );

  const uncertainFields =
    getStringArrayAttribute(
      attributes,
      "ai_uncertain_fields"
    );

  const aiNotes =
    getStringArrayAttribute(
      attributes,
      "ai_notes"
    );

  const stateMeta =
    getCardStateMeta(
      card.state
    );

  const purchasePrice =
    card.purchase_price === null
      ? null
      : Number(
          card.purchase_price
        );

  const estimatedValue =
    card.estimated_value === null
      ? null
      : Number(
          card.estimated_value
        );

  const unrealizedResult =
    purchasePrice !== null &&
    estimatedValue !== null
      ? estimatedValue -
        purchasePrice
      : null;

  const roi =
    purchasePrice !== null &&
    purchasePrice > 0 &&
    unrealizedResult !== null
      ? (unrealizedResult /
          purchasePrice) *
        100
      : null;

  const productLine =
    joinDistinct([
      card.year,
      brand ??
        manufacturer,
      product,
      insertName,
    ]);

  const activeImageUrl =
    activeImage === "front"
      ? frontImageUrl
      : backImageUrl;

  const editableCard:
    EditableCardData = {
      playerName:
        card.player_name,

      sport,

      team,

      manufacturer,

      brand,

      product,

      setName:
        insertName,

      year:
        card.year,

      cardNumber:
        card.card_number,

      parallel:
        card.parallel_name,

      serialNumber:
        card.serial_number,

      serialNumberedTo,

      rookieCard,

      autograph,

      memorabilia,

      memorabiliaType,

      gradingCompany,

      grade,

      certificationNumber,

      language,

      variation,
    };

  return (
    <main className="card-detail-page">
      <header className="card-detail-header">
        <div>
          <Link
            className="card-detail-back"
            href={
              collection
                ? `/collections/${collection.id}`
                : "/"
            }
          >
            ← Tilbage til{" "}
            {collection?.name ??
              "collection"}
          </Link>

          <div className="card-title-badges">
            <span
              className={`detail-state detail-state-${stateMeta.tone}`}
            >
              {stateMeta.label}
            </span>

            {aiConfidence !==
              null && (
              <span className="detail-ai-badge">
                {Math.round(
                  aiConfidence
                )}
                % AI
              </span>
            )}

            {gradingCompany &&
              grade && (
                <span className="detail-grade-badge">
                  {gradingCompany}{" "}
                  {grade}
                </span>
              )}
          </div>

          <h1>
            {card.player_name}
          </h1>

          <p className="card-detail-subtitle">
            {productLine ||
              "Card details not specified"}
          </p>
        </div>

        <div className="card-detail-actions">
          <button
            className="detail-edit-action"
            type="button"
            onClick={() =>
              setShowEditCard(
                true
              )
            }
          >
            Edit card
          </button>

          <button
            className="detail-move-action"
            type="button"
            onClick={() =>
              setShowMoveCard(
                true
              )
            }
            disabled={!collection}
            title={
              collection
                ? "Move card to another collection"
                : "Collection data is unavailable"
            }
          >
            Move card
          </button>

          <button
            className="detail-primary-action"
            type="button"
            disabled
            title="Coming soon"
          >
            Record sale
            <span>Soon</span>
          </button>
        </div>
      </header>

      {message && (
        <p className="card-detail-message">
          {message}
        </p>
      )}

      <section className="card-hero-grid">
        <section className="detail-panel card-gallery-panel">
          <div className="card-gallery-stage">
            {activeImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    activeImageUrl
                  }
                  alt={`${card.player_name} ${activeImage} side`}
                />
              </>
            ) : (
              <div className="card-gallery-empty">
                <span>NE</span>

                <p>
                  No{" "}
                  {activeImage} image
                </p>
              </div>
            )}

            <span className="gallery-side-label">
              {activeImage}
            </span>
          </div>

          <div className="gallery-selector">
            <button
              type="button"
              className={
                activeImage ===
                "front"
                  ? "gallery-selector-active"
                  : ""
              }
              onClick={() =>
                setActiveImage(
                  "front"
                )
              }
              disabled={
                !frontImageUrl
              }
            >
              <div>
                {frontImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        frontImageUrl
                      }
                      alt="Card front thumbnail"
                    />
                  </>
                ) : (
                  <span>NE</span>
                )}
              </div>

              Front
            </button>

            <button
              type="button"
              className={
                activeImage ===
                "back"
                  ? "gallery-selector-active"
                  : ""
              }
              onClick={() =>
                setActiveImage(
                  "back"
                )
              }
              disabled={
                !backImageUrl
              }
            >
              <div>
                {backImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        backImageUrl
                      }
                      alt="Card back thumbnail"
                    />
                  </>
                ) : (
                  <span>NE</span>
                )}
              </div>

              Back
            </button>
          </div>
        </section>

        <div className="card-overview-column">
          <section className="detail-panel card-identity-panel">
            <div className="detail-panel-heading">
              <div>
                <p>
                  CARD IDENTITY
                </p>

                <h2>
                  Card DNA
                </h2>
              </div>

              {card.serial_number && (
                <span className="detail-serial">
                  {
                    card.serial_number
                  }
                </span>
              )}
            </div>

            <div className="identity-grid">
              <DetailItem
                label="Player"
                value={
                  card.player_name
                }
                important
              />

              <DetailItem
                label="Team"
                value={team}
              />

              <DetailItem
                label="Sport"
                value={sport}
              />

              <DetailItem
                label="Year / season"
                value={card.year}
                important
              />

              <DetailItem
                label="Manufacturer"
                value={
                  manufacturer
                }
              />

              <DetailItem
                label="Brand"
                value={brand}
              />

              <DetailItem
                label="Product"
                value={product}
                important
              />

              <DetailItem
                label="Set / insert"
                value={insertName}
                important
              />

              <DetailItem
                label="Card number"
                value={
                  card.card_number
                }
                important
              />

              <DetailItem
                label="Parallel"
                value={
                  card.parallel_name
                }
                important
              />

              <DetailItem
                label="Variation"
                value={variation}
              />

              <DetailItem
                label="Language"
                value={language}
              />
            </div>

            <div className="feature-badges">
              <span
                className={
                  rookieCard
                    ? "feature-active"
                    : ""
                }
              >
                Rookie:{" "}
                {formatBoolean(
                  rookieCard
                )}
              </span>

              <span
                className={
                  autograph
                    ? "feature-active"
                    : ""
                }
              >
                Autograph:{" "}
                {formatBoolean(
                  autograph
                )}
              </span>

              <span
                className={
                  memorabilia
                    ? "feature-active"
                    : ""
                }
              >
                Memorabilia:{" "}
                {formatBoolean(
                  memorabilia
                )}
              </span>
            </div>

            {memorabiliaType && (
              <p className="memorabilia-type">
                Memorabilia type:{" "}
                <strong>
                  {
                    memorabiliaType
                  }
                </strong>
              </p>
            )}
          </section>

          <section className="detail-metrics-grid">
            <article className="detail-metric">
              <span>
                Purchase price
              </span>

              <strong>
                {formatCurrency(
                  purchasePrice,
                  currency
                )}
              </strong>
            </article>

            <article className="detail-metric">
              <span>
                Estimated value
              </span>

              <strong>
                {formatCurrency(
                  estimatedValue,
                  currency
                )}
              </strong>
            </article>

            <article
              className={[
                "detail-metric",
                unrealizedResult !==
                  null &&
                unrealizedResult >= 0
                  ? "detail-metric-positive"
                  : "",
                unrealizedResult !==
                  null &&
                unrealizedResult < 0
                  ? "detail-metric-negative"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>
                Unrealized result
              </span>

              <strong>
                {formatCurrency(
                  unrealizedResult,
                  currency
                )}
              </strong>
            </article>

            <article className="detail-metric">
              <span>
                Estimated ROI
              </span>

              <strong>
                {roi === null
                  ? "—"
                  : `${roi.toLocaleString(
                      "da-DK",
                      {
                        maximumFractionDigits: 1,
                      }
                    )}%`}
              </strong>
            </article>
          </section>
        </div>
      </section>

      <section className="card-secondary-grid">
        <section className="detail-panel">
          <div className="detail-panel-heading">
            <div>
              <p>
                OWNERSHIP
              </p>

              <h2>
                Purchase details
              </h2>
            </div>
          </div>

          <div className="purchase-detail-grid">
            <DetailItem
              label="Collection"
              value={
                collection?.name
              }
            />

            <DetailItem
              label="Collection type"
              value={
                collection?.type ===
                "pc"
                  ? "Personal Collection"
                  : collection?.type ===
                      "inventory"
                    ? "Dealer Inventory"
                    : null
              }
            />

            <DetailItem
              label="Purchase source"
              value={
                purchaseSource
              }
            />

            <DetailItem
              label="Registered"
              value={formatDate(
                card.created_at
              )}
            />
          </div>

          <div className="user-notes">
            <span>
              YOUR NOTES
            </span>

            <p>
              {card.notes ||
                "No personal notes have been added."}
            </p>
          </div>
        </section>

        <section className="detail-panel">
          <div className="detail-panel-heading">
            <div>
              <p>
                GRADING
              </p>

              <h2>
                Grading details
              </h2>
            </div>

            {gradingCompany &&
              grade && (
                <span className="grading-pill">
                  {gradingCompany}{" "}
                  {grade}
                </span>
              )}
          </div>

          <div className="purchase-detail-grid">
            <DetailItem
              label="Company"
              value={
                gradingCompany
              }
            />

            <DetailItem
              label="Grade"
              value={grade}
            />

            <DetailItem
              label="Certification number"
              value={
                certificationNumber
              }
            />

            <DetailItem
              label="Status"
              value={
                gradingCompany
                  ? "Graded"
                  : "Raw"
              }
            />
          </div>

          <button
            className="detail-placeholder-action"
            type="button"
            disabled
          >
            Create grading submission
            <span>Soon</span>
          </button>
        </section>
      </section>

      <section className="detail-panel intelligence-panel">
        <div className="detail-panel-heading">
          <div>
            <p>
              INTELLIGENCE
            </p>

            <h2>
              AI and Card Brain
            </h2>
          </div>

          {aiConfidence !==
            null && (
            <div className="intelligence-confidence">
              <strong>
                {Math.round(
                  aiConfidence
                )}
                %
              </strong>

              <span>
                Identification confidence
              </span>
            </div>
          )}
        </div>

        {uncertainFields.length >
          0 && (
          <div className="uncertain-fields">
            <strong>
              Fields requiring attention
            </strong>

            <div>
              {uncertainFields.map(
                (field) => (
                  <span key={field}>
                    {field}
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {aiNotes.length > 0 ? (
          <div className="intelligence-notes">
            {aiNotes.map(
              (note, index) => (
                <div
                  key={`${note}-${index}`}
                >
                  <span>✦</span>

                  <p>{note}</p>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="no-intelligence-notes">
            No AI notes were stored for
            this card.
          </p>
        )}
      </section>

      <EditCardModal
        isOpen={showEditCard}
        cardId={card.id}
        initialCard={editableCard}
        initialPurchasePrice={
          purchasePrice
        }
        initialEstimatedValue={
          estimatedValue
        }
        initialPurchaseSource={
          purchaseSource
        }
        initialUserNotes={
          card.notes
        }
        currency={currency}
        onClose={() =>
          setShowEditCard(false)
        }
        onUpdated={(result) => {
          void handleCardUpdated(
            result
          );
        }}
      />

      {collection && (
        <MoveCardModal
          isOpen={showMoveCard}
          cardId={card.id}
          playerName={
            card.player_name
          }
          currentCollection={{
            id: collection.id,
            name: collection.name,
            type: collection.type,
            currency:
              collection.currency,
          }}
          onClose={() =>
            setShowMoveCard(false)
          }
          onMoved={(result) => {
            setShowMoveCard(false);

            router.push(
              `/collections/${result.toCollection.id}`
            );
          }}
        />
      )}

      <style jsx>{`
        .card-detail-page {
          min-height: 100vh;
          padding: 42px 48px 70px;
          background:
            radial-gradient(
              circle at 82% 3%,
              rgba(
                124,
                92,
                255,
                0.09
              ),
              transparent 30%
            ),
            #080a10;
          color: #f8fafc;
        }

        .card-detail-loading {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          color: #9299aa;
        }

        .card-detail-back {
          display: inline-flex;
          color: #8f98ac;
          font-size: 13px;
          text-decoration: none;
          transition:
            color 150ms ease,
            transform 150ms ease;
        }

        .card-detail-back:hover {
          color: #ffffff;
          transform: translateX(
            -2px
          );
        }

        .card-detail-header {
          max-width: 1450px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          margin: 0 auto 28px;
        }

        .card-title-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 24px;
        }

        .detail-state,
        .detail-ai-badge,
        .detail-grade-badge {
          display: inline-flex;
          align-items: center;
          min-height: 27px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .detail-state-verified {
          border: 1px solid
            rgba(
              52,
              211,
              153,
              0.3
            );
          background: rgba(
            16,
            185,
            129,
            0.09
          );
          color: #a7f3d0;
        }

        .detail-state-review {
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.3
            );
          background: rgba(
            245,
            158,
            11,
            0.09
          );
          color: #fde68a;
        }

        .detail-state-grading {
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.28
            );
          background: rgba(
            59,
            130,
            246,
            0.08
          );
          color: #bfdbfe;
        }

        .detail-state-listed {
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.3
            );
          background: rgba(
            139,
            92,
            246,
            0.09
          );
          color: #ddd6fe;
        }

        .detail-state-sold,
        .detail-state-neutral {
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.22
            );
          background: rgba(
            148,
            163,
            184,
            0.06
          );
          color: #cbd5e1;
        }

        .detail-ai-badge {
          border: 1px solid
            rgba(
              167,
              139,
              250,
              0.28
            );
          background: rgba(
            139,
            92,
            246,
            0.09
          );
          color: #c4b5fd;
        }

        .detail-grade-badge {
          border: 1px solid
            rgba(
              96,
              165,
              250,
              0.28
            );
          background: rgba(
            59,
            130,
            246,
            0.08
          );
          color: #bfdbfe;
        }

        .card-detail-header h1 {
          margin: 13px 0 0;
          color: #ffffff;
          font-size: clamp(
            38px,
            5vw,
            64px
          );
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .card-detail-subtitle {
          max-width: 760px;
          margin: 13px 0 0;
          color: #9299aa;
          font-size: 15px;
          line-height: 1.55;
        }

        .card-detail-actions {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }

        .card-detail-actions button,
        .detail-placeholder-action {
          min-height: 43px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0 15px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.14
            );
          border-radius: 12px;
          background: rgba(
            255,
            255,
            255,
            0.025
          );
          color: #7f8798;
          font-size: 12px;
          font-weight: 700;
        }

        .detail-edit-action {
          cursor: pointer;
          border-color: rgba(
            167,
            139,
            250,
            0.26
          ) !important;
          background: rgba(
            124,
            92,
            255,
            0.08
          ) !important;
          color: #ddd6fe !important;
          transition:
            transform 150ms ease,
            filter 150ms ease,
            border-color 150ms ease;
        }

        .detail-edit-action:hover {
          transform: translateY(
            -1px
          );
          border-color: rgba(
            167,
            139,
            250,
            0.55
          ) !important;
          filter: brightness(
            1.1
          );
        }

        .detail-move-action {
          cursor: pointer;
          border-color: rgba(
            96,
            165,
            250,
            0.24
          ) !important;
          background: rgba(
            59,
            130,
            246,
            0.07
          ) !important;
          color: #bfdbfe !important;
          transition:
            transform 150ms ease,
            filter 150ms ease,
            border-color 150ms ease;
        }

        .detail-move-action:hover:not(
            :disabled
          ) {
          transform: translateY(
            -1px
          );
          border-color: rgba(
            96,
            165,
            250,
            0.5
          ) !important;
          filter: brightness(
            1.1
          );
        }

        .card-detail-actions button span,
        .detail-placeholder-action span {
          padding: 3px 5px;
          border-radius: 5px;
          background: rgba(
            255,
            255,
            255,
            0.05
          );
          font-size: 8px;
          text-transform: uppercase;
        }

        .card-detail-actions button:disabled,
        .detail-placeholder-action:disabled {
          cursor: not-allowed;
          opacity: 0.75;
        }

        .detail-primary-action {
          border-color: rgba(
            139,
            92,
            246,
            0.22
          ) !important;
          background: rgba(
            124,
            92,
            255,
            0.08
          ) !important;
          color: #a99dfd !important;
        }

        .card-detail-message {
          max-width: 1450px;
          margin: 0 auto 18px;
          padding: 12px 14px;
          border: 1px solid
            rgba(
              52,
              211,
              153,
              0.2
            );
          border-radius: 12px;
          background: rgba(
            16,
            185,
            129,
            0.06
          );
          color: #a7f3d0;
          font-size: 12px;
        }

        .card-hero-grid {
          max-width: 1450px;
          display: grid;
          grid-template-columns:
            minmax(
              300px,
              490px
            )
            minmax(0, 1fr);
          gap: 22px;
          margin: 0 auto;
        }

        .card-overview-column {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 18px;
        }

        .detail-panel {
          min-width: 0;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 22px;
          background:
            radial-gradient(
              circle at top right,
              rgba(
                124,
                92,
                255,
                0.055
              ),
              transparent 40%
            ),
            #10131b;
          box-shadow: 0 18px 55px
            rgba(
              0,
              0,
              0,
              0.18
            );
        }

        .card-gallery-panel {
          overflow: hidden;
          align-self: start;
        }

        .card-gallery-stage {
          position: relative;
          min-height: 660px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          background:
            radial-gradient(
              circle at 50% 35%,
              rgba(
                124,
                92,
                255,
                0.13
              ),
              transparent 43%
            ),
            #07090e;
        }

        .card-gallery-stage img {
          display: block;
          max-width: 100%;
          max-height: 610px;
          border-radius: 14px;
          object-fit: contain;
          filter: drop-shadow(
            0 22px 35px
              rgba(
                0,
                0,
                0,
                0.45
              )
          );
        }

        .gallery-side-label {
          position: absolute;
          top: 17px;
          left: 17px;
          padding: 6px 9px;
          border-radius: 8px;
          background: rgba(
            0,
            0,
            0,
            0.72
          );
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .card-gallery-empty {
          display: grid;
          place-items: center;
          gap: 12px;
          color: #667085;
        }

        .card-gallery-empty span {
          width: 68px;
          height: 68px;
          display: grid;
          place-items: center;
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.25
            );
          border-radius: 18px;
          background: rgba(
            124,
            92,
            255,
            0.09
          );
          color: #9f93ff;
          font-weight: 800;
        }

        .card-gallery-empty p {
          margin: 0;
          font-size: 12px;
          text-transform: capitalize;
        }

        .gallery-selector {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 12px;
          padding: 16px;
          border-top: 1px solid
            rgba(
              148,
              163,
              184,
              0.11
            );
        }

        .gallery-selector button {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          border-radius: 13px;
          background: rgba(
            255,
            255,
            255,
            0.018
          );
          color: #81899c;
          font-size: 12px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }

        .gallery-selector button:disabled {
          cursor: not-allowed;
          opacity: 0.38;
        }

        .gallery-selector button:not(
            :disabled
          ):hover {
          border-color: rgba(
            167,
            139,
            250,
            0.28
          );
          color: #ffffff;
        }

        .gallery-selector-active {
          border-color: rgba(
            139,
            92,
            246,
            0.58
          ) !important;
          background: rgba(
            124,
            92,
            255,
            0.09
          ) !important;
          color: #ffffff !important;
        }

        .gallery-selector button div {
          width: 45px;
          height: 60px;
          display: grid;
          place-items: center;
          overflow: hidden;
          flex: 0 0 auto;
          border-radius: 8px;
          background: #07090e;
        }

        .gallery-selector button img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
        }

        .gallery-selector button div span {
          color: #6f648e;
          font-size: 10px;
          font-weight: 800;
        }

        .card-identity-panel {
          padding: 24px;
        }

        .detail-panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 18px;
          border-bottom: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
        }

        .detail-panel-heading p {
          margin: 0;
          color: #9f93ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .detail-panel-heading h2 {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 21px;
          letter-spacing: -0.025em;
        }

        .detail-serial,
        .grading-pill {
          flex: 0 0 auto;
          padding: 8px 11px;
          border: 1px solid
            rgba(
              139,
              92,
              246,
              0.28
            );
          border-radius: 10px;
          background: rgba(
            124,
            92,
            255,
            0.09
          );
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 800;
        }

        .identity-grid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 10px;
          padding-top: 18px;
        }

        .feature-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 17px;
        }

        .feature-badges span {
          padding: 7px 10px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.13
            );
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.02
          );
          color: #747d91;
          font-size: 10px;
          font-weight: 700;
        }

        .feature-badges .feature-active {
          border-color: rgba(
            167,
            139,
            250,
            0.25
          );
          background: rgba(
            139,
            92,
            246,
            0.08
          );
          color: #c4b5fd;
        }

        .memorabilia-type {
          margin: 15px 0 0;
          color: #71798b;
          font-size: 11px;
        }

        .memorabilia-type strong {
          color: #d5d8e0;
        }

        .detail-metrics-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 10px;
        }

        .detail-metric {
          min-width: 0;
          padding: 17px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          border-radius: 16px;
          background: #10131b;
        }

        .detail-metric span {
          display: block;
          color: #71798b;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .detail-metric strong {
          display: block;
          margin-top: 8px;
          color: #ffffff;
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .detail-metric-positive strong {
          color: #86efac;
        }

        .detail-metric-negative strong {
          color: #fca5a5;
        }

        .card-secondary-grid {
          max-width: 1450px;
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 22px;
          margin: 22px auto 0;
        }

        .card-secondary-grid
          > .detail-panel,
        .intelligence-panel {
          padding: 24px;
        }

        .purchase-detail-grid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 10px;
          padding-top: 18px;
        }

        .user-notes {
          margin-top: 15px;
          padding: 16px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          border-radius: 14px;
          background: rgba(
            0,
            0,
            0,
            0.13
          );
        }

        .user-notes span {
          color: #71798b;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.09em;
        }

        .user-notes p {
          margin: 8px 0 0;
          color: #b4bac7;
          font-size: 12px;
          line-height: 1.6;
        }

        .detail-placeholder-action {
          width: 100%;
          justify-content: center;
          margin-top: 16px;
        }

        .intelligence-panel {
          max-width: 1450px;
          margin: 22px auto 0;
        }

        .intelligence-confidence {
          flex: 0 0 auto;
          text-align: right;
        }

        .intelligence-confidence strong {
          display: block;
          color: #a7f3d0;
          font-size: 24px;
        }

        .intelligence-confidence span {
          display: block;
          margin-top: 3px;
          color: #6ee7b7;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .uncertain-fields {
          margin-top: 18px;
          padding: 15px;
          border: 1px solid
            rgba(
              251,
              191,
              36,
              0.2
            );
          border-radius: 14px;
          background: rgba(
            245,
            158,
            11,
            0.06
          );
        }

        .uncertain-fields strong {
          color: #fde68a;
          font-size: 11px;
        }

        .uncertain-fields div {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .uncertain-fields span {
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(
            245,
            158,
            11,
            0.1
          );
          color: #d6b967;
          font-size: 9px;
          font-weight: 700;
        }

        .intelligence-notes {
          display: grid;
          gap: 9px;
          padding-top: 18px;
        }

        .intelligence-notes div {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px 14px;
          border: 1px solid
            rgba(
              148,
              163,
              184,
              0.09
            );
          border-radius: 13px;
          background: rgba(
            0,
            0,
            0,
            0.12
          );
        }

        .intelligence-notes span {
          flex: 0 0 auto;
          color: #9f93ff;
        }

        .intelligence-notes p,
        .no-intelligence-notes {
          margin: 0;
          color: #8b93a5;
          font-size: 11px;
          line-height: 1.55;
        }

        .no-intelligence-notes {
          padding-top: 18px;
        }

        .card-detail-error {
          max-width: 800px;
          margin-top: 22px;
          padding: 28px;
        }

        .card-detail-error h1 {
          margin: 0;
        }

        .card-detail-error p {
          color: #9299aa;
        }

        @media (
          max-width: 1100px
        ) {
          .card-detail-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .card-detail-actions {
            justify-content: flex-start;
          }

          .card-hero-grid {
            grid-template-columns:
              minmax(
                280px,
                390px
              )
              minmax(0, 1fr);
          }

          .identity-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .detail-metrics-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }
        }

        @media (
          max-width: 820px
        ) {
          .card-detail-page {
            padding: 28px 22px 55px;
          }

          .card-hero-grid,
          .card-secondary-grid {
            grid-template-columns:
              1fr;
          }

          .card-gallery-stage {
            min-height: 520px;
          }

          .card-gallery-stage img {
            max-height: 470px;
          }
        }

        @media (
          max-width: 560px
        ) {
          .card-detail-page {
            padding: 22px 14px 45px;
          }

          .card-detail-header h1 {
            font-size: 40px;
          }

          .card-detail-actions {
            width: 100%;
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .card-detail-actions
            button:last-child {
            grid-column: 1 / -1;
          }

          .identity-grid,
          .detail-metrics-grid,
          .purchase-detail-grid {
            grid-template-columns:
              1fr;
          }

          .card-gallery-stage {
            min-height: 430px;
            padding: 20px;
          }

          .card-gallery-stage img {
            max-height: 390px;
          }

          .card-identity-panel,
          .card-secondary-grid
            > .detail-panel,
          .intelligence-panel {
            padding: 19px;
          }

          .detail-panel-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .intelligence-confidence {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}