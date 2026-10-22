import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseAiUsageReservationDecision,
  type AiFeature,
  type AiUsageAllowance,
  type AiUsageReservation,
} from "@/lib/billing/aiUsage";

export class AiUsageGuardError extends Error {
  code: "AI_LIMIT_REACHED" | "AI_REQUEST_IN_PROGRESS" | "AI_REQUEST_REUSED";
  status: number;
  allowance: AiUsageAllowance | null;

  constructor({
    code,
    message,
    status,
    allowance,
  }: {
    code: AiUsageGuardError["code"];
    message: string;
    status: number;
    allowance: AiUsageAllowance | null;
  }) {
    super(message);
    this.name = "AiUsageGuardError";
    this.code = code;
    this.status = status;
    this.allowance = allowance;
  }
}

function firstRpcRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export async function reserveAiUsage({
  supabase,
  feature,
  workspaceId,
  idempotencyKey,
}: {
  supabase: SupabaseClient;
  feature: AiFeature;
  workspaceId: string;
  idempotencyKey: string;
}): Promise<AiUsageReservation> {
  const { data, error } = await supabase.rpc("reserve_vallective_ai_usage", {
    requested_feature: feature,
    requested_workspace_id: workspaceId,
    requested_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(`AI usage could not be reserved: ${error.message}`);
  }

  const decision = parseAiUsageReservationDecision(
    firstRpcRow(data),
    feature
  );

  if (!decision.allowed || !decision.reservationId || !decision.allowance) {
    if (decision.reason === "limit_reached") {
      throw new AiUsageGuardError({
        code: "AI_LIMIT_REACHED",
        message:
          "Din månedlige AI-kvote er brugt. Opgrader dit abonnement eller vent til næste periode.",
        status: 402,
        allowance: decision.allowance,
      });
    }

    if (decision.reason === "already_completed") {
      throw new AiUsageGuardError({
        code: "AI_REQUEST_REUSED",
        message:
          "Denne AI-behandling er allerede gennemført. Genindlæs siden for at hente resultatet.",
        status: 409,
        allowance: decision.allowance,
      });
    }

    throw new AiUsageGuardError({
      code: "AI_REQUEST_IN_PROGRESS",
      message:
        "Denne AI-behandling kører allerede. Vent et øjeblik og genindlæs resultatet.",
      status: 409,
      allowance: decision.allowance,
    });
  }

  return {
    id: decision.reservationId,
    allowance: decision.allowance,
  };
}

export async function completeAiUsage({
  supabase,
  reservationId,
  estimatedCostUsd,
}: {
  supabase: SupabaseClient;
  reservationId: string;
  estimatedCostUsd: number | null;
}) {
  const { data, error } = await supabase.rpc("complete_vallective_ai_usage", {
    requested_reservation_id: reservationId,
    requested_estimated_cost_usd: estimatedCostUsd,
  });

  if (error || data !== true) {
    throw new Error(
      `AI usage could not be completed: ${error?.message ?? "reservation was not active"}`
    );
  }
}

export async function failAiUsage({
  supabase,
  reservationId,
  failureCode,
}: {
  supabase: SupabaseClient;
  reservationId: string;
  failureCode: string;
}) {
  const { error } = await supabase.rpc("fail_vallective_ai_usage", {
    requested_reservation_id: reservationId,
    requested_failure_code: failureCode,
  });

  if (error) {
    throw new Error(`AI usage could not be released: ${error.message}`);
  }
}
