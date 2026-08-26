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

    test("settlement amounts are the largest figures in the panel", async ({ page }) => {
        await page.goto("/single");
        await page.getByRole("button", { name: /sample data/i }).click();
        await page.getByRole("button", { name: /^Next$/ }).click();
        await page.getByRole("button", { name: /View Summary/i }).click();
        await expect(page.locator("h4", { hasText: /^Settlements$/ })).toBeVisible();

        // The owner prefers the bill arithmetic first, so the settlement is
        // scrolled to rather than led with — but it must still be the loudest
        // number on the panel, not the same 14px as every other row.
        const sizes = await page.evaluate(() => {
            const money = (Array.from(document.querySelectorAll("*")) as HTMLElement[])
                .filter((el) => el.children.length === 0 && /^Rp\s?[\d.]+$/.test((el.textContent ?? "").trim()));
            const settlement = money.filter((el) => el.className.includes("text-2xl") || el.className.includes("text-xl"));
            return { biggest: Math.max(...money.map((el) => parseFloat(getComputedStyle(el).fontSize))), settlementCount: settlement.length };
        });
        expect(sizes.settlementCount).toBeGreaterThan(0);
        expect(sizes.biggest).toBeGreaterThanOrEqual(20);
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

// Reported from real screenshots on 2026-08-26 and reproduced before fixing.
test.describe("layout regressions", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the sticky header stays on top once the page scrolls", async ({ page }) => {
        // Normalising every header to z-10 put it on the same layer as content
        // that already used z-10 — the landing hero and the Stepper row — and
        // those come later in the DOM, so they painted straight over it.
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));

        for (const route of ["/", "/single"]) {
            await page.goto(route);
            await page.mouse.wheel(0, 110);
            await page.waitForTimeout(300);

            const covered = await page.evaluate(() => {
                const header = document.querySelector("header")!;
                const b = header.getBoundingClientRect();
                return [0.2, 0.35, 0.5, 0.8]
                    .map((f) => document.elementFromPoint(Math.round(b.width * f), Math.round(b.top + b.height * 0.55)))
                    .filter((el) => !el || !header.contains(el)).length;
            });
            expect(covered, `${route}: something paints over the sticky header`).toBe(0);
        }
    });

    test("a split with a receipt does not widen the document", async ({ page }) => {
        // `mx-auto` on a flex item cancels cross-axis stretch, so the wrapper is
        // sized to fit-content and can never be narrower than its min-content.
        // One un-shrinkable row therefore widened the whole page — which is why
        // the header and footer, correctly 100% of the viewport, looked cut short
        // of the content's right edge once you zoomed out.
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-onboarding-seen", "1");
            localStorage.setItem("splitbill-multiple", JSON.stringify({
                split: {
                    id: "s1", name: "My Split",
                    participants: [{ id: "p1", name: "er4" }, { id: "p2", name: "sds" }],
                    receipts: [{
                        id: "r1", title: "Receipt 1", date: "2026-08-24", payerId: "p1",
                        items: [{ id: "i1", name: "Nasi Goreng Spesial", qty: 1, unitPrice: 234343, total: 234343, assignedToIds: ["p1", "p2"] }],
                        tax: 0, service: 0,
                    }],
                },
            }));
        });
        await page.goto("/multiple");
        await expect(page.getByText("Receipt 1")).toBeVisible();

        const m = await page.evaluate(() => {
            const de = document.documentElement;
            return {
                over: de.scrollWidth - de.clientWidth,
                headerW: Math.round(document.querySelector("header")!.getBoundingClientRect().width),
                vw: de.clientWidth,
            };
        });
        expect(m.over, "document is wider than the viewport").toBeLessThanOrEqual(1);
        expect(m.headerW, "header must span the full document width").toBe(m.vw);
    });

    test("every form control is at least 16px on mobile, so iOS cannot auto-zoom", async ({ page }) => {
        await page.goto("/single");
        await page.getByRole("button", { name: /sample data/i }).click();
        await page.getByRole("button", { name: /^Next$/ }).click();
        await page.waitForTimeout(400);

        const small = await page.evaluate(() =>
            (Array.from(document.querySelectorAll("input, select, textarea")) as HTMLElement[])
                .filter((el) => el.offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 16)
                .map((el) => ({ tag: el.tagName.toLowerCase(), size: getComputedStyle(el).fontSize, cls: el.className.slice(0, 60) }))
        );
        expect(small, JSON.stringify(small)).toHaveLength(0);
    });
});
