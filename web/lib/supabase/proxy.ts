import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!isAuthenticated && !isLoginPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";

    const redirectResponse = NextResponse.redirect(loginUrl);

    return copyResponseCookies(response, redirectResponse);
  }

  if (isAuthenticated && isLoginPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";

    const redirectResponse = NextResponse.redirect(homeUrl);

    return copyResponseCookies(response, redirectResponse);
  }

  return response;
}