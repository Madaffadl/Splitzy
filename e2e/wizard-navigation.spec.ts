import { test, expect } from "@playwright/test";

// The /single wizard used to keep its position in React state only, so the
// system back gesture left the page instead of returning a step — and it showed
// two ArrowLeft controls labelled "Back" that went to different places. These
// pin the shape that replaced it: one back control, in the header, doing exactly
// what the system gesture does.
test.describe("single-receipt wizard navigation", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("shows exactly one back control", async ({ page }) => {
        await page.goto("/single");

        const backControls = await page
            .locator("main button, main a")
            .evaluateAll((els) =>
                els.filter((el) =>
                    /back|kembali|keluar|exit/i.test(el.getAttribute("aria-label") ?? "")
                ).length
            );

        expect(backControls).toBe(1);
    });

    test("the step is in the URL, and back means one step back", async ({ page }) => {
        await page.goto("/single");

        const name = page.getByPlaceholder(/participant name/i);
        await name.fill("Alya");
        await name.press("Enter");
        await name.fill("Budi");
        await name.press("Enter");

        await page.getByRole("button", { name: /^Next$/ }).click();
        await expect(page).toHaveURL(/\?step=bill$/);

        // The visible control and the system gesture must agree — that agreement
        // is the whole reason one control is enough.
        await page.getByRole("button", { name: /back|kembali/i }).first().click();
        await expect(page).toHaveURL(/\/single$/);

        await page.getByRole("button", { name: /^Next$/ }).click();
        await expect(page).toHaveURL(/\?step=bill$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/single$/);
    });

    test("no horizontal overflow on any mode at 375px", async ({ page }) => {
        for (const route of ["/single", "/multiple", "/travel"]) {
            await page.goto(route);
            const { scrollW, clientW } = await page.evaluate(() => ({
                scrollW: document.documentElement.scrollWidth,
                clientW: document.documentElement.clientWidth,
            }));
            expect(scrollW, `${route} overflows at 375px`).toBeLessThanOrEqual(clientW + 1);
        }
    });

    test("the locale chosen on /id carries into the tool routes", async ({ page }) => {
        // /single has no locale in its path by design (see i18n/config.ts), so it
        // follows the preference the localized landing writes. This is the funnel
        // the translation exists for: land on /id, tap the CTA, keep reading
        // Indonesian.
        await page.goto("/id");
        // Tap the hero CTA, which is the actual journey — and which used to be
        // fast enough to beat hydration and lose the locale entirely.
        await page.getByRole("link", { name: /split bill/i }).first().click();
        await expect(page).toHaveURL(/\/single\?lang=id/);
        await expect(page.locator("nav").first()).toContainText("Peserta");
    });
});
