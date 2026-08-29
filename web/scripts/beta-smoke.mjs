#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const REQUEST_TIMEOUT_MS = 20_000;
const STARTUP_TIMEOUT_MS = 30_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function readOption(name) {
  const exactIndex = process.argv.indexOf(name);

  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1];
  }

  const prefix = `${name}=`;
  const inlineOption = process.argv.find((argument) =>
    argument.startsWith(prefix)
  );

  return inlineOption?.slice(prefix.length);
}

function normalizeBaseUrl(value) {
  const url = new URL(value ?? process.env.BASE_URL ?? DEFAULT_BASE_URL);

  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("The beta smoke base URL must use HTTP or HTTPS.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url;
}

function expectCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, pathname, options = {}) {
  const { headers, ...requestOptions } = options;

  return fetch(new URL(pathname, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "user-agent": "VallectiveBetaSmoke/1.0",
      ...headers,
    },
    ...requestOptions,
  });
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await request(baseUrl, "/login");

      if (response.status < 500) {
        return;
      }

      lastError = new Error(`Server returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(
    `Vallective did not become ready within ${STARTUP_TIMEOUT_MS / 1000} seconds: ${lastError instanceof Error ? lastError.message : "unknown error"}`
  );
}

async function expectHtml(baseUrl, pathname, expectedText) {
  const response = await request(baseUrl, pathname);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  expectCondition(
    response.status === 200,
    `${pathname} returned HTTP ${response.status}.`
  );
  expectCondition(
    contentType.includes("text/html"),
    `${pathname} did not return HTML.`
  );
  expectCondition(
    body.includes(expectedText),
    `${pathname} did not contain “${expectedText}”.`
  );
  expectCondition(
    /<html[^>]+lang="en"/i.test(body),
    `${pathname} did not declare English document language.`
  );
}

async function expectProtectedRedirect(baseUrl, pathname, expectedNext) {
  const response = await request(baseUrl, pathname);
  const location = response.headers.get("location");

  expectCondition(
    REDIRECT_STATUSES.has(response.status),
    `${pathname} returned HTTP ${response.status} instead of an auth redirect.`
  );
  expectCondition(Boolean(location), `${pathname} did not return a Location header.`);

  const target = new URL(location, baseUrl);
  expectCondition(
    target.pathname === "/login",
    `${pathname} redirected to ${target.pathname} instead of /login.`
  );
  expectCondition(
    target.searchParams.get("next") === expectedNext,
    `${pathname} did not preserve the intended destination.`
  );
}

async function expectImage(baseUrl, pathname, expectedType) {
  const response = await request(baseUrl, pathname);
  const contentType = response.headers.get("content-type") ?? "";

  expectCondition(
    response.status === 200,
    `${pathname} returned HTTP ${response.status}.`
  );
  expectCondition(
    contentType.includes(expectedType),
    `${pathname} returned ${contentType || "no content type"}.`
  );
}

async function expectManifest(baseUrl) {
  const response = await request(baseUrl, "/manifest.webmanifest");

  expectCondition(
    response.status === 200,
    `/manifest.webmanifest returned HTTP ${response.status}.`
  );

  const manifest = await response.json();
  expectCondition(manifest.short_name === "Vallective", "Manifest name is stale.");
  expectCondition(manifest.start_url === "/", "Manifest start URL is invalid.");
  expectCondition(manifest.display === "standalone", "PWA display mode is invalid.");

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const iconBySize = new Map(icons.map((icon) => [icon.sizes, icon]));
  expectCondition(iconBySize.has("192x192"), "Manifest is missing the 192px icon.");
  expectCondition(iconBySize.has("512x512"), "Manifest is missing the 512px icon.");
  expectCondition(
    icons.some((icon) => String(icon.purpose).includes("maskable")),
    "Manifest is missing a maskable icon."
  );

  await Promise.all(
    icons.map((icon) => expectImage(baseUrl, icon.src, "image/png"))
  );
}

async function expectServiceWorker(baseUrl) {
  const response = await request(baseUrl, "/sw.js");
  const contentType = response.headers.get("content-type") ?? "";
  const cacheControl = response.headers.get("cache-control") ?? "";
  const contentSecurityPolicy =
    response.headers.get("content-security-policy") ?? "";
  const body = await response.text();

  expectCondition(
    response.status === 200,
    `/sw.js returned HTTP ${response.status}.`
  );
  expectCondition(
    contentType.includes("application/javascript"),
    `/sw.js returned ${contentType || "no content type"}.`
  );
  expectCondition(
    cacheControl.includes("no-cache") && cacheControl.includes("no-store"),
    "/sw.js can be served stale."
  );
  expectCondition(
    contentSecurityPolicy.includes("default-src 'self'"),
    "/sw.js is missing its restrictive Content-Security-Policy."
  );
  expectCondition(
    body.includes("vallective-offline"),
    "/sw.js is missing the Vallective offline cache."
  );
}

async function expectOfflineFallback(baseUrl) {
  const response = await request(baseUrl, "/offline.html");
  const contentType = response.headers.get("content-type") ?? "";
  const cacheControl = response.headers.get("cache-control") ?? "";
  const body = await response.text();

  expectCondition(
    response.status === 200,
    `/offline.html returned HTTP ${response.status}.`
  );
  expectCondition(
    contentType.includes("text/html"),
    "/offline.html did not return HTML."
  );
  expectCondition(
    cacheControl.includes("no-cache") && cacheControl.includes("no-store"),
    "/offline.html can be precached stale."
  );
  expectCondition(
    /<html[^>]+lang="en"/i.test(body) && body.includes("You are offline"),
    "/offline.html is missing its accessible offline content."
  );
  expectCondition(
    body.includes("default-src 'none'") && body.includes("form-action 'self'"),
    "/offline.html is missing its restrictive Content-Security-Policy."
  );
}

const baseUrl = normalizeBaseUrl(readOption("--base-url"));

const checks = [
  ["branded sign-in entry", () => expectHtml(baseUrl, "/login", "Sign in")],
  [
    "account creation entry",
    () => expectHtml(baseUrl, "/signup", "Create your account"),
  ],
  [
    "password recovery entry",
    () => expectHtml(baseUrl, "/forgot-password", "Reset your password"),
  ],
  [
    "expired auth-link recovery",
    () => expectHtml(baseUrl, "/auth/error", "We couldn&#x27;t use that link"),
  ],
  ["protected Home redirect", () => expectProtectedRedirect(baseUrl, "/", "/")],
  [
    "protected beta pilot redirect",
    () => expectProtectedRedirect(baseUrl, "/beta", "/beta"),
  ],
  [
    "protected route destination",
    () =>
      expectProtectedRedirect(
        baseUrl,
        "/cards?state=graded",
        "/cards?state=graded"
      ),
  ],
  ["installable app manifest", () => expectManifest(baseUrl)],
  ["offline fallback", () => expectOfflineFallback(baseUrl)],
  ["service worker", () => expectServiceWorker(baseUrl)],
  ["brand icon", () => expectImage(baseUrl, "/icon.svg", "image/svg+xml")],
  [
    "Open Graph image",
    () => expectImage(baseUrl, "/opengraph-image", "image/png"),
  ],
  [
    "Twitter image",
    () => expectImage(baseUrl, "/twitter-image", "image/png"),
  ],
];

console.log(`Vallective beta smoke: ${baseUrl.origin}`);
await waitForServer(baseUrl);

const results = [];

for (const [name, run] of checks) {
  try {
    await run();
    results.push({ name, passed: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, message });
    console.error(`  FAIL  ${name}: ${message}`);
  }
}

const failures = results.filter((result) => !result.passed);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);

if (failures.length > 0) {
  process.exitCode = 1;
}
