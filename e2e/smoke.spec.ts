import { test, expect, type Page } from "@playwright/test";

// Critical public-flow smoke tests. Deliberately narrow and robust — they guard
// against build/routing regressions on the pages that matter most, without
// depending on auth or the database.
//
// Locators here avoid asserting on marketing copy wherever possible. The
// landing page is bilingual (English at /, Indonesian at /id) and its wording
// changes often; tests pinned to a specific English phrase break on every copy
// edit and, worse, can pass for the wrong reason — the previous version of this
// file asserted a /Split Bills/i heading that was actually being satisfied by
// the onboarding modal overlay, not the landing hero.

// The first-run onboarding modal renders over the landing page once per
// browser. Suppressing it keeps these tests focused on the page under test.
const ONBOARDING_STORAGE_KEY = "splitzy-onboarding-seen";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "1");
  }, ONBOARDING_STORAGE_KEY);
});

/** Pathname of a page's rel=canonical, normalised so "" reads as "/". */
async function canonicalPath(page: Page): Promise<string> {
  const href = await page
    .locator('link[rel="canonical"]')
    .first()
    .getAttribute("href");
  expect(href, "page must declare a canonical URL").toBeTruthy();
  const url = new URL(href!);
  expect(url.host, "canonical must use the canonical host").toBe(
    "www.splitzy.my.id"
  );
  return url.pathname === "" ? "/" : url.pathname;
}

// ── Rendering ──────────────────────────────────────────────────────────────

test("English landing renders the hero and mode cards", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Splitzy/);

  // Exactly one h1, and it is the hero — not a modal or a nested heading.
  const h1 = page.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).toBeVisible();
  await expect(h1).toContainText(/split the bill/i);

  // Mode cards located by destination, so they survive copy and language edits.
  await expect(page.locator('main a[href="/single"]').first()).toBeVisible();
  await expect(page.locator('main a[href="/travel"]').first()).toBeVisible();
});

test("Indonesian landing renders at /id", async ({ page }) => {
  await page.goto("/id");
  await expect(page).toHaveTitle(/Splitzy/);

  const h1 = page.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).toContainText(/bagi tagihan/i);
});

test("brand entity pages render in both languages", async ({ page }) => {
  for (const route of ["/about", "/faq", "/id/about", "/id/faq"]) {
    const res = await page.goto(route);
    expect(res?.status(), `${route} should render`).toBeLessThan(400);
    await expect(page.locator("h1"), `${route} needs an h1`).toHaveCount(1);
  }
});

test("single-split tool page loads without error", async ({ page }) => {
  const res = await page.goto("/single");
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/single/);
});

test("legal pages render", async ({ page }) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: /Privacy Policy/i })
  ).toBeVisible();

  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: /Terms of Service/i })
  ).toBeVisible();
});

test("pricing page honours its feature flag", async ({ page }) => {
  // NEXT_PUBLIC_FLAG_PRICING_PAGE is inlined into the server bundle at build
  // time, so the test process cannot read it reliably (CI builds without it,
  // local builds pick it up from .env). Assert the *contract* instead: the
  // route either serves the real pricing page or a clean 404 — never a 500,
  // and never a 200 with an empty shell.
  const res = await page.goto("/pricing");
  const status = res?.status();
  expect([200, 404]).toContain(status);

  if (status === 200) {
    // All three purchasable Pro durations render with their own price.
    await expect(
      page.getByRole("button", { name: /Trip Pass.*Rp\s?14\.900/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /30 Hari.*Rp\s?29\.000/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /1 Tahun.*Rp\s?99\.000/ })
    ).toBeVisible();
    expect(await canonicalPath(page)).toBe("/pricing");
  }
});

// ── SEO regressions ────────────────────────────────────────────────────────
//
// These exist because of a real incident: a single `alternates.canonical: "/"`
// in the root layout was inherited by every page, so the whole site told Google
// each page was a duplicate of the homepage and effectively went unindexed. It
// built, linted and rendered perfectly — only the emitted metadata was wrong.

const INDEXABLE_ROUTES = [
  "/",
  "/id",
  "/about",
  "/id/about",
  "/faq",
  "/id/faq",
  "/single",
  "/travel",
  "/privacy",
  "/terms",
];

test("every indexable page declares a self-referencing canonical", async ({
  page,
}) => {
  for (const route of INDEXABLE_ROUTES) {
    await page.goto(route);
    expect(await canonicalPath(page), `${route} canonical`).toBe(route);
  }
});

test("indexable pages are not accidentally noindexed", async ({ page }) => {
  for (const route of INDEXABLE_ROUTES) {
    await page.goto(route);
    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    expect(robots ?? "", `${route} must not be noindexed`).not.toMatch(
      /noindex/i
    );
  }
});

test("private pages are not indexable", async ({ page }) => {
  // A private route can satisfy "not indexable" two ways, and both are correct:
  // it renders and declares noindex, or the proxy turns the anonymous visitor
  // away before there is a page to index. /dashboard takes the first path;
  // /history is in proxy.ts's protectedPaths and takes the second.
  //
  // This used to assert the meta tag only, which quietly assumed every private
  // route renders for a signed-out visitor. That assumption held only because
  // the proxy's auth guard was failing open for anonymous requests — a
  // signed-out visitor produces AuthSessionMissingError, which carries status
  // 400, and the guard was admitting everything that was not a 401. With that
  // fixed, /history redirects and there is no meta tag to read.
  for (const route of ["/dashboard", "/history"]) {
    await page.goto(route);
    const landed = new URL(page.url()).pathname;

    if (landed !== route) {
      expect(landed, `${route} must redirect to the login entry point`).toBe(
        "/"
      );
      continue;
    }

    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content");
    expect(robots ?? "", `${route} must be noindexed`).toMatch(/noindex/i);
  }
});

test("bilingual pages declare reciprocal hreflang", async ({ page }) => {
  // hreflang only works when both directions agree; a one-way annotation is
  // silently ignored by Google.
  for (const [route, alternates] of [
    ["/", { "id-ID": "/id", en: "/" }],
    ["/id", { "id-ID": "/id", en: "/" }],
    ["/about", { "id-ID": "/id/about", en: "/about" }],
    ["/id/about", { "id-ID": "/id/about", en: "/about" }],
  ] as const) {
    await page.goto(route);
    for (const [lang, expected] of Object.entries(alternates)) {
      const href = await page
        .locator(`link[rel="alternate"][hreflang="${lang}"]`)
        .first()
        .getAttribute("href");
      expect(
        href ? new URL(href).pathname : null,
        `${route} hreflang=${lang}`
      ).toBe(expected);
    }
    // x-default must point at the default-locale (un-prefixed) version.
    const xDefault = await page
      .locator('link[rel="alternate"][hreflang="x-default"]')
      .first()
      .getAttribute("href");
    expect(xDefault, `${route} needs an x-default`).toBeTruthy();
    expect(
      new URL(xDefault!).pathname,
      `${route} x-default must be the un-prefixed URL`
    ).toBe(alternates.en);
  }
});

test("retired /en URLs redirect to the un-prefixed English tree", async ({
  request,
}) => {
  // English briefly lived at /en. Those URLs were submitted to Search Console,
  // so they must 301 rather than 404 after the default locale was flipped.
  for (const [from, to] of [
    ["/en", "/"],
    ["/en/about", "/about"],
    ["/en/faq", "/faq"],
  ]) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status(), `${from} should 301`).toBe(301);
    expect(new URL(res.headers()["location"], "http://x").pathname).toBe(to);
  }
});

test("pages carry the Splitzy entity graph", async ({ page }) => {
  // "Splitzy" is a contested brand name, so the Organization/WebSite/
  // SoftwareApplication graph is how Google tells this product apart from the
  // unrelated apps sharing the name. Losing it is a silent, expensive failure.
  for (const route of ["/", "/id", "/about", "/faq", "/single"]) {
    await page.goto(route);
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(blocks.length, `${route} must emit JSON-LD`).toBeGreaterThan(0);

    const types = blocks.flatMap((raw) => {
      const parsed = JSON.parse(raw);
      const nodes = parsed["@graph"] ?? [parsed];
      return nodes.flatMap((n: { "@type"?: string | string[] }) =>
        Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]
      );
    });

    for (const required of ["Organization", "WebSite", "SoftwareApplication"]) {
      expect(types, `${route} JSON-LD`).toContain(required);
    }

    // Never emit rating/review markup: the landing page's stats and
    // testimonials are still placeholder figures, and marking up fabricated
    // reviews breaches Google's spam policies.
    expect(
      JSON.stringify(blocks),
      `${route} must not claim ratings`
    ).not.toMatch(/aggregateRating|"@type":\s*"Review"/);
  }
});

test("apex host redirects to the canonical www host", async ({ request }) => {
  // Guards src/proxy.ts. Both hosts previously served 200, splitting ranking
  // signals across two identical sites.
  const res = await request.get("/faq", {
    headers: { host: "splitzy.my.id" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toBe("https://www.splitzy.my.id/faq");
});

test("robots.txt and sitemap are served and consistent", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Sitemap: https://www.splitzy.my.id/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();

  // Everything advertised in the sitemap must actually be reachable — a
  // sitemap listing redirects or 404s produces errors in Search Console.
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(0);
  for (const loc of locs) {
    const path = new URL(loc).pathname;
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} is listed in the sitemap`).toBe(200);
  }

  // /multiple is auth-gated (see src/proxy.ts) and 307s for crawlers, so it
  // must stay out of the sitemap.
  expect(xml).not.toContain("/multiple");
});
