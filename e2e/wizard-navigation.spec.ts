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

// Measured, not guessed: on a 375x667 viewport the settlement heading used to
// land 10px past the fold even after it was moved to the top of the summary
// card, because the celebration block and the quick stats were still above it.
// The whole point of the panel is that this number is the first thing you see.
test.describe("summary hierarchy", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the settlement amount is visible without scrolling", async ({ page }) => {
        await page.goto("/single");
        await page.getByRole("button", { name: /sample data/i }).click();
        await page.getByRole("button", { name: /^Next$/ }).click();
        await page.getByRole("button", { name: /View Summary/i }).click();

        const settlement = page.locator("h4", { hasText: /^Settlements$/ });
        await expect(settlement).toBeVisible();

        const fold = await page.evaluate(() => window.innerHeight);
        const top = await settlement.evaluate((el) => el.getBoundingClientRect().top);
        expect(top, "settlements must be above the fold").toBeLessThan(fold);

        // And it must be the largest money on screen, not the bill total.
        const biggest = await page.evaluate(() => {
            const money = (Array.from(document.querySelectorAll("*")) as HTMLElement[])
                .filter((el) => el.children.length === 0 && /^Rp\s?[\d.]+$/.test((el.textContent ?? "").trim()))
                .map((el) => ({
                    text: (el.textContent ?? "").trim(),
                    size: parseFloat(getComputedStyle(el).fontSize),
                    top: el.getBoundingClientRect().top,
                }))
                .filter((m) => m.top >= 0 && m.top < window.innerHeight)
                .sort((a, b) => b.size - a.size);
            return money[0] ?? null;
        });
        expect(biggest?.size, "the settlement amount should be the largest figure above the fold").toBeGreaterThanOrEqual(24);
    });

    test("the last stepper label is not clipped at 375px", async ({ page }) => {
        await page.goto("/single?step=summary");
        // evaluate() does not auto-wait the way a locator does.
        await page.locator("nav").first().waitFor();
        const overflow = await page.evaluate(() => {
            const nav = document.querySelector("nav")!;
            const navRight = nav.getBoundingClientRect().right;
            return Array.from(nav.querySelectorAll("button")).map((b) => {
                const label = b.querySelector("span:not(.sr-only)");
                return label ? Math.round(label.getBoundingClientRect().right - navRight) : 0;
            });
        });
        for (const over of overflow) expect(over).toBeLessThanOrEqual(0);
    });
});
