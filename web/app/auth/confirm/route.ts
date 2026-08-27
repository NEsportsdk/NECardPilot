import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function authErrorResponse(request: NextRequest) {
  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/auth/error";
  errorUrl.search = "";

  return NextResponse.redirect(errorUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const otpType =
    rawType && EMAIL_OTP_TYPES.has(rawType as EmailOtpType)
      ? (rawType as EmailOtpType)
      : null;
  const fallbackPath = otpType === "recovery" ? "/change-password" : "/welcome";
  const nextPath = getSafeNextPath(
    request.nextUrl.searchParams.get("next"),
    fallbackPath
  );
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
    }
  }

  return authErrorResponse(request);
}
