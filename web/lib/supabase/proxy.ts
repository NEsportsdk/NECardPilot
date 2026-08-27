import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirects";
import { isGuestOnlyRoute, isPublicRoute } from "@/lib/auth/routes";

function copyResponseCookies(
  source: NextResponse,
  destination: NextResponse
) {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie);
  });

  return destination;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  /*
   * Keep this call directly after createServerClient.
   * getClaims validates the access token and lets the
   * Supabase client refresh cookies when required.
   */
  const { data, error } = await supabase.auth.getClaims();

  const isAuthenticated = Boolean(data?.claims?.sub) && !error;
  const pathname = request.nextUrl.pathname;

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`
    );

    const redirectResponse = NextResponse.redirect(loginUrl);

    return copyResponseCookies(response, redirectResponse);
  }

  if (isAuthenticated && isGuestOnlyRoute(pathname)) {
    const homeUrl = request.nextUrl.clone();
    const nextPath = getSafeNextPath(
      request.nextUrl.searchParams.get("next")
    );
    const targetUrl = new URL(nextPath, homeUrl.origin);
    homeUrl.pathname = targetUrl.pathname;
    homeUrl.search = "";
    homeUrl.search = targetUrl.search;
    homeUrl.hash = targetUrl.hash;

    const redirectResponse = NextResponse.redirect(homeUrl);

    return copyResponseCookies(response, redirectResponse);
  }

  return response;
}
