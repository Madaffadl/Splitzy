import { test, expect } from "@playwright/test";

// Critical public-flow smoke tests. Deliberately narrow and robust — they guard
// against build/routing regressions on the pages that matter most, without
// depending on auth or the database.

test("landing renders the hero and mode cards", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Splitzy/);
  await expect(page.getByRole("heading", { name: /Split Bills/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Single Receipt/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Travel Spend/i })).toBeVisible();
});

test("single-split tool page loads without error", async ({ page }) => {
  const res = await page.goto("/single");
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/single/);
});

test("legal pages render", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /Terms of Service/i })).toBeVisible();
});

test("flag-gated pricing page is hidden by default", async ({ page }) => {
  const res = await page.goto("/pricing");
  // Pricing is dark (flag off) → 404 until launch.
  expect(res?.status()).toBe(404);
});
