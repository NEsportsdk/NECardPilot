import type { IdentificationUsage } from "@/lib/scan/identificationUsage";

export type IdentifiedCard = {
  sport: string | null;
  playerName: string | null;
  team: string | null;
  manufacturer: string | null;
  brand: string | null;
  product: string | null;
  setName: string | null;
  year: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumber: string | null;
  serialNumberedTo: number | null;
  rookieCard: boolean | null;
  autograph: boolean | null;
  memorabilia: boolean | null;
  memorabiliaType: string | null;
  gradingCompany: string | null;
  grade: string | null;
  certificationNumber: string | null;
  language: string | null;
  variation: string | null;
  notes: string[];
  confidence: number;
  needsManualReview: boolean;
  uncertainFields: string[];
};

export type IdentifyCardResult = {
  success: boolean;
  card: IdentifiedCard;
  usage: IdentificationUsage | null;
};

export async function identifyCard(
  frontPath: string,
  backPath: string,
  queueItemId?: string
): Promise<IdentifyCardResult> {
  const response = await fetch("/api/ai/identify-card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(queueItemId ? { queueItemId } : {}),
      frontPath,
      backPath,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "AI-identifikation mislykkedes.");
  }

  return data;
}
