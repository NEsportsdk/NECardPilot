import { NextResponse } from "next/server";

import {
  BetaFeedbackValidationError,
  parseBetaFeedback,
} from "@/lib/feedback/betaFeedback";
import { createStructuredErrorEvent } from "@/lib/observability/errorReporting";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let feedback: ReturnType<typeof parseBetaFeedback>;

  try {
    feedback = parseBetaFeedback(await request.json());
  } catch (error) {
    const message =
      error instanceof BetaFeedbackValidationError
        ? error.message
        : "Feedback details could not be read.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in before sending beta feedback." },
        { status: 401 }
      );
    }

    const { error } = await supabase.from("beta_feedback").insert({
      allow_follow_up: feedback.allowFollowUp,
      category: feedback.category,
      contact_email: feedback.allowFollowUp ? (user.email ?? null) : null,
      experience_rating: feedback.experienceRating,
      is_online: feedback.deviceContext.online,
      is_standalone: feedback.deviceContext.standalone,
      language: feedback.deviceContext.language,
      message: feedback.message,
      page_path: feedback.pagePath,
      screen_class: feedback.deviceContext.screen,
      user_id: user.id,
    });

    if (error) {
      throw error;
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "beta_feedback_submitted",
        category: feedback.category,
        experienceRating: feedback.experienceRating,
        pagePath: feedback.pagePath,
        source: "server",
        durationMs: Date.now() - startedAt,
        requestId: request.headers.get("x-vercel-id"),
      })
    );

    return NextResponse.json({ submitted: true }, { status: 201 });
  } catch (error) {
    console.error(
      JSON.stringify(
        createStructuredErrorEvent({
          error,
          event: "beta_feedback_failed",
          source: "server",
          context: {
            category: feedback.category,
            durationMs: Date.now() - startedAt,
            pagePath: feedback.pagePath,
            requestId: request.headers.get("x-vercel-id"),
          },
        })
      )
    );

    return NextResponse.json(
      { error: "Your feedback could not be sent. Please try again." },
      { status: 500 }
    );
  }
}
