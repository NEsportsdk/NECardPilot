import { expect, test, type Page } from "@playwright/test";

type RouteExpectation = {
  pathname: string;
  heading?: string;
  navigationLabel: string;
};

const routeExpectations: RouteExpectation[] = [
  { pathname: "/", navigationLabel: "Home" },
  { pathname: "/cards", heading: "Cards", navigationLabel: "Cards" },
  {
    pathname: "/scanner",
    heading: "Global Scanner",
    navigationLabel: "Scanner",
  },
  {
    pathname: "/grading",
    heading: "Grading Center",
    navigationLabel: "Grading",
  },
  {
    pathname: "/cardshow",
    heading: "Cardshow Center",
    navigationLabel: "Cardshow",
  },
  {
    pathname: "/transactions",
    heading: "Transactions",
    navigationLabel: "Transactions",
  },
  {
    pathname: "/analytics",
    heading: "Analytics",
    navigationLabel: "Analytics",
  },
  {
    pathname: "/beta",
    heading: "Your pilot journey",
    navigationLabel: "Beta pilot",
  },
  {
    pathname: "/feedback",
    heading: "Beta feedback",
    navigationLabel: "Beta feedback",
  },
  {
    pathname: "/settings",
    heading: "Settings",
    navigationLabel: "Settings",
  },
];

function credentials() {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;

  expect(email, "E2E_EMAIL must contain the dedicated test account email.").toBeTruthy();
  expect(
    password,
    "E2E_PASSWORD must contain the dedicated test account password."
  ).toBeTruthy();

  return { email: email!, password: password! };
}

function monitorServerFailures(page: Page) {
  const failures: string[] = [];
  const appOrigin = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000")
    .origin;

  page.on("pageerror", (error) => {
    failures.push(`Browser error: ${error.message}`);
  });

  page.on("response", (response) => {
    const url = new URL(response.url());

    if (url.origin === appOrigin && response.status() >= 500) {
      failures.push(`${response.status()} ${url.pathname}`);
    }
  });

  return failures;
}

async function signIn(page: Page, nextPath = "/scanner") {
  const { email, password } = credentials();
  const loginUrl = `/login?next=${encodeURIComponent(nextPath)}`;

  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === nextPath, {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(new RegExp(`${nextPath.replace("/", "\\/")}$`));
}

async function expectCurrentNavigation(
  page: Page,
  label: string,
  isMobile: boolean
) {
  if (!isMobile) {
    if (label === "Settings") {
      await expect(
        page.getByRole("link", { name: "Settings", exact: true })
      ).toHaveAttribute("aria-current", "page");
      return;
    }

    await expect(
      page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: label, exact: true })
    ).toHaveAttribute("aria-current", "page");
    return;
  }

  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });

  if (new Set(["Home", "Cards", "Scanner"]).has(label)) {
    const mobileLabel = label === "Scanner" ? "Scan" : label;
    await expect(
      mobileNavigation.getByRole("link", { name: mobileLabel, exact: true })
    ).toHaveAttribute("aria-current", "page");
    return;
  }

  await mobileNavigation.getByRole("button", { name: "More" }).click();
  const dialog = page.getByRole("dialog", { name: "More from Vallective" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: label, exact: true })
  ).toHaveAttribute("aria-current", "page");
  await dialog.getByRole("button", { name: "Close menu" }).click();
}

test("signed-in collector can read every core workspace without changing data", async ({
  page,
}, testInfo) => {
  const failures = monitorServerFailures(page);
  const isMobile = Boolean(testInfo.project.use.isMobile);
  await signIn(page);

  for (const route of routeExpectations) {
    const response = await page.goto(route.pathname, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status(), `${route.pathname} should not return an error`).toBeLessThan(
      400
    );
    await expect(page).toHaveURL(
      new RegExp(`${route.pathname === "/" ? "/" : route.pathname.replace("/", "\\/")}$`)
    );

    const heading = route.heading
      ? page.getByRole("heading", { level: 1, name: route.heading })
      : page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expectCurrentNavigation(page, route.navigationLabel, isMobile);
  }

  expect(failures, failures.join("\n")).toEqual([]);
});

test("scanner exposes rear-camera and photo-library capture on both card sides", async ({
  page,
}) => {
  const failures = monitorServerFailures(page);
  await signIn(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Global Scanner" })
  ).toBeVisible();

  const startScanner = page.getByRole("button", {
    name: "Start scanner",
    exact: true,
  });
  await expect(
    startScanner,
    "The dedicated test account needs one empty collection for camera readiness."
  ).toBeEnabled();
  await startScanner.click();

  for (const side of ["front", "back"] as const) {
    const cameraInput = page.getByLabel(`Take photo of ${side} of card`);
    const libraryInput = page.getByLabel(`Choose ${side} image from library`);

    await expect(cameraInput).toHaveAttribute("type", "file");
    await expect(cameraInput).toHaveAttribute("accept", "image/*");
    await expect(cameraInput).toHaveAttribute("capture", "environment");
    await expect(libraryInput).toHaveAttribute("type", "file");
    await expect(libraryInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,image/heic,image/heif"
    );
  }

  await expect(
    page.getByRole("button", { name: "Identify with AI" })
  ).toBeVisible();
  expect(failures, failures.join("\n")).toEqual([]);
});

test("the dedicated beta operator can read the private operations queue", async ({
  page,
}) => {
  const failures = monitorServerFailures(page);
  await signIn(page, "/feedback/manage");

  await expect(page).toHaveURL(/\/feedback\/manage$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Feedback command centre" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Feedback queue summary" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Pilot coverage summary" })
  ).toBeVisible();
  expect(failures, failures.join("\n")).toEqual([]);
});
