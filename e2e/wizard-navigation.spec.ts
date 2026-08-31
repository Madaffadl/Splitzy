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
        // /multiple is deliberately absent: it is auth-gated in proxy.ts, so an
        // anonymous visit lands on the landing page instead. Leaving it in the
        // list kept the test green while measuring "/" a second time — a pass
        // that asserted nothing. It comes back with PBI-047.
        for (const route of ["/single", "/travel"]) {
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
        // "Settlements" was jargon; the heading is "Who pays whom" now, in both
        // languages ("Siapa bayar ke siapa").
        await expect(page.locator("h4", { hasText: /who pays whom/i })).toBeVisible();

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

    // SKIPPED: needs a signed-in session. /multiple is in proxy.ts's
    // protectedPaths and now redirects anonymous visitors, so this test can no
    // longer reach the screen it measures.
    //
    // It was written while the proxy's auth guard was failing open for every
    // anonymous request, which made /multiple look public. It was not. Unblock
    // by seeding a Supabase test account and a Playwright storageState (PBI-047
    // in docs/analysis/improvement-backlog.md); CI today runs against a
    // placeholder Supabase host with no database, so no session can exist.
    //
    // The regression below is real and still worth guarding — do not delete it.
    test.skip("a split with a receipt does not widen the document", async ({ page }) => {
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

    // Reported from an iPhone 15 on 2026-08-31: on /travel with a trip open the
    // cards looked off-centre and asymmetric.
    //
    // They were. A grid item defaults to `min-width: auto`, so the single
    // implicit column the workspace collapses to on a phone could not size below
    // its content — and the page grew 70px wider than the viewport. `mx-auto`
    // then centred the cards inside the *document*, not the screen.
    //
    // The overflow also put real controls out of reach: a receipt's delete
    // button, a payment's remove button and half the settle-up form were past
    // the right edge with no way to scroll to them. So the last assertion here
    // is the functional one — every control has to be reachable.
    //
    // The pre-existing overflow test in this file covers /travel with no trip
    // open, which is why this went unnoticed: it takes a trip with content to
    // push the column past the viewport.
    test("a trip with receipts does not widen the page past the viewport", async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-onboarding-seen", "1");
            const receipt = (id: string, title: string, price: number) => ({
                id, title, date: "2026-08-30", payerId: "p1",
                items: [{
                    id: `${id}i`, name: "Item panjang sekali namanya untuk menguji lebar",
                    qty: 1, unitPrice: price, total: price, assignedToIds: ["p1", "p2", "p3"],
                }],
                tax: 0, service: 0,
            });
            localStorage.setItem("splitzy-travel", JSON.stringify({
                activeId: "t1",
                trips: [{
                    id: "t1", name: "Trip Bali Bareng Anak Kantor", budget: 10_000_000,
                    participants: [{ id: "p1", name: "Daffa" }, { id: "p2", name: "Tere" }, { id: "p3", name: "leo" }],
                    receipts: [
                        receipt("r1", "Billiard", 347_000),
                        receipt("r2", "Makan Malam Seafood", 1_250_000),
                        receipt("r3", "Hotel", 1_500_000),
                    ],
                    payments: [{ id: "pay1", from: "p2", to: "p1", amount: 10_000, createdAt: "2026-08-30T10:00:00.000Z" }],
                }],
            }));
        });
        await page.goto("/travel");
        await expect(page.getByText("Settle-up payments")).toBeVisible();

        const m = await page.evaluate(() => {
            const de = document.documentElement;
            const vw = de.clientWidth;
            const cards = Array.from(document.querySelectorAll(".rounded-2xl.border")).map((el) => {
                const r = el.getBoundingClientRect();
                return {
                    label: (el.textContent ?? "").trim().slice(0, 24),
                    gapL: Math.round(r.left),
                    gapR: Math.round(vw - r.right),
                };
            });
            const unreachable = Array.from(document.querySelectorAll("main button")).filter((b) => {
                const r = b.getBoundingClientRect();
                return r.width > 0 && (r.right > vw + 1 || r.left < -1);
            }).map((b) => (b.getAttribute("aria-label") || b.textContent || "?").trim().slice(0, 30));
            return { vw, over: de.scrollWidth - de.clientWidth, cards, unreachable };
        });

        expect(m.over, "the trip workspace widens the document past the viewport").toBeLessThanOrEqual(1);
        expect(m.cards.length, "no cards found — the trip did not render").toBeGreaterThan(3);
        for (const c of m.cards) {
            expect(
                Math.abs(c.gapL - c.gapR),
                `card "${c.label}" is off-centre: ${c.gapL}px left vs ${c.gapR}px right`
            ).toBeLessThanOrEqual(1);
        }
        expect(
            m.unreachable,
            "these controls sit outside the viewport with no way to reach them"
        ).toEqual([]);
    });

    // Reported from an iPhone 15 on 2026-08-31: the date field in the receipt
    // editor sat wider than its card and its value was centred while every other
    // field was left-aligned.
    //
    // Read this test for what it is. The defect itself does NOT reproduce in any
    // desktop engine — measured in both Playwright Chromium and WebKit, where the
    // field already matches its sibling exactly and overflows nothing. It comes
    // from iOS Safari's native date control, which neither engine ships. So the
    // geometry half below is a property worth holding but passes trivially here;
    // the load-bearing half is the computed-style check, which fails the moment
    // the globals.css block that corrects iOS is edited away.
    test("the date field is styled to survive iOS's native date control", async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-onboarding-seen", "1");
            localStorage.setItem("splitzy-travel", JSON.stringify({
                activeId: "t1",
                trips: [{
                    id: "t1", name: "Bali 2026",
                    participants: [{ id: "p1", name: "Alya" }, { id: "p2", name: "Budi" }],
                    receipts: [],
                }],
            }));
        });
        await page.goto("/travel");
        await page.getByRole("button", { name: /add receipt/i }).first().click();
        await page.waitForSelector('input[type="date"]');

        const m = await page.evaluate(() => {
            const date = document.querySelector('input[type="date"]') as HTMLInputElement;
            const text = Array.from(document.querySelectorAll("input")).find(
                (i) => i.type === "text"
            ) as HTMLInputElement | undefined;
            let card: HTMLElement | null = date.parentElement;
            while (card && card.getBoundingClientRect().width <= date.getBoundingClientRect().width) {
                card = card.parentElement;
            }
            const cs = getComputedStyle(date);
            return {
                dateW: Math.round(date.getBoundingClientRect().width),
                dateRight: Math.round(date.getBoundingClientRect().right),
                textW: text ? Math.round(text.getBoundingClientRect().width) : null,
                cardRight: card ? Math.round(card.getBoundingClientRect().right) : null,
                minWidth: cs.minWidth,
                appearance: cs.appearance,
            };
        });

        // iOS's UA min-width beats width:100%; pinning it to 0 is what lets the
        // field stay inside its column.
        expect(m.minWidth, "date input must not carry a min-width floor").toBe("0px");
        // Stops iOS rendering it as a native button with its own metrics.
        expect(m.appearance, "date input must opt out of native appearance").toBe("none");

        expect(m.textW, "no sibling text field to compare against").not.toBeNull();
        expect(
            Math.abs(m.dateW - m.textW!),
            "the date field must be the same width as the text field above it"
        ).toBeLessThanOrEqual(1);
        expect(
            m.dateRight,
            "the date field must not extend past the card it sits in"
        ).toBeLessThanOrEqual(m.cardRight! + 1);
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

// The only way to change language used to be a link twelve sections below the
// fold of the landing page, and nothing at all once you were inside a split.
test.describe("language", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the switcher is reachable from the landing header and from inside a split", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));

        await page.goto("/");
        await expect(page.locator("header").getByLabel(/change language|ganti bahasa/i)).toBeVisible();

        await page.goto("/single");
        await expect(page.locator("footer").getByLabel(/change language|ganti bahasa/i)).toBeVisible();
    });

    test("switching from inside a split keeps you in the split, in the new language", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));
        await page.goto("/single");
        await page.getByPlaceholder(/participant name/i).fill("Alya");

        await page.locator("footer").getByLabel(/change language/i).click();
        await expect(page).toHaveURL(/\/single/);
        // Stepper copy is the cheapest proof the whole product UI followed.
        await expect(page.locator("nav").first()).toContainText("Peserta");
    });

    test("the whole /single flow speaks Indonesian, not half of it", async ({ page }) => {
        // A flow that is translated up to the result and English from there is
        // worse than one that is English throughout — the switch lands exactly
        // where the user is reading numbers they need to trust.
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-locale", "id");
            localStorage.setItem("splitzy-onboarding-seen", "1");
        });
        await page.goto("/single");
        await page.getByRole("button", { name: /data contoh/i }).click();
        await page.getByRole("button", { name: /^Lanjut$/ }).click();
        await page.getByRole("button", { name: /Lihat ringkasan/i }).click();

        for (const phrase of ["Ringkasan", "Pajak", "Biaya layanan", "Total tagihan",
                              "Dibayar oleh", "Per orang", "Siapa bayar ke siapa",
                              "Rekening tujuan"]) {
            await expect(page.getByText(phrase, { exact: false }).first()).toBeVisible();
        }

        // "Subtotal" is the same word in Indonesian and appears on real receipts,
        // so it is expected. Anything else from this list is a missed string.
        const leaks = await page.evaluate(() => {
            const english = ["Grand Total", "Paid by", "Per Person", "Settlements",
                             "Payment Details", "Total bill", "Participants", "Tip:"];
            return english.filter((w) => document.body.innerText.includes(w));
        });
        expect(leaks, `untranslated on the summary: ${leaks.join(", ")}`).toHaveLength(0);
    });

    test("the input path speaks Indonesian after /id", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("splitzy-locale", "id"));
        await page.goto("/single");
        await page.getByRole("button", { name: /sample data|data contoh/i }).click();
        await page.getByRole("button", { name: /^(Next|Lanjut)$/ }).click();
        await page.waitForTimeout(400);

        // ItemsTable, FeesInput and the item labels are all on this step.
        for (const phrase of ["Harga", "Pajak", "Biaya layanan", "Siapa yang bayar?"]) {
            await expect(page.getByText(phrase, { exact: false }).first()).toBeVisible();
        }
    });
});

// /multiple shares its summary panel with /travel, so translating it covers both.
//
// SKIPPED: both tests here need a signed-in session. /multiple is protected in
// proxy.ts and redirects anonymous visitors; these were written while the auth
// guard was failing open, which made the route look public. Unblock with a
// seeded Supabase test account and a Playwright storageState (PBI-047).
//
// Until then the Indonesian coverage of the shared summary panel rests on the
// "trip mode in Indonesian" block below, which reaches the same panel through
// /travel — an unprotected route. That is narrower, not equivalent.
test.describe.skip("multiple-receipt split in Indonesian", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-locale", "id");
            localStorage.setItem("splitzy-onboarding-seen", "1");
            localStorage.setItem("splitbill-multiple", JSON.stringify({
                split: {
                    id: "s1", name: "Liburan Bali",
                    participants: [{ id: "p1", name: "Alya" }, { id: "p2", name: "Budi" }],
                    receipts: [{
                        id: "r1", title: "Warung Sate", date: "2026-08-24", payerId: "p1",
                        items: [{ id: "i1", name: "Sate Ayam", qty: 2, unitPrice: 35000, total: 70000, assignedToIds: ["p1", "p2"] }],
                        tax: 7000, service: 5000,
                    }],
                },
            }));
        });
    });

    test("no untranslated strings on the overview", async ({ page }) => {
        await page.goto("/multiple");
        await expect(page.getByText("Rincian split")).toBeVisible();

        const leaks = await page.evaluate(() => {
            // Not in this list, deliberately: "Total" and "Subtotal" are the
            // same words in Indonesian and are what real receipts print, and
            // "WhatsApp" is a brand name.
            const english = ["Split Details", "Split name", "Add Receipt", "Saved on this device only",
                             "receipts added", "Paid by", "Save split", "Summary", "Balances",
                             "Final Settlements", "Receipt details", "Spending breakdown",
                             "Share", "Copy", "Payment Details"];
            return english.filter((w) => document.body.innerText.includes(w));
        });
        expect(leaks, `untranslated on /multiple: ${leaks.join(", ")}`).toHaveLength(0);
    });

    test("the Receipts header keeps a real gap from its button", async ({ page }) => {
        // Measured at 4px once the Indonesian description widened the left block.
        await page.goto("/multiple");
        // The split is seeded into localStorage, so the receipts card only exists
        // once the client has hydrated and read it.
        await expect(page.getByText("Warung Sate")).toBeVisible();
        const gap = await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll("div.flex.flex-row.items-center.justify-between"))
                .find((r) => r.children.length >= 2) as HTMLElement | undefined;
            if (!row) return null;
            const kids = Array.from(row.children) as HTMLElement[];
            return Math.round(kids[kids.length - 1].getBoundingClientRect().left - kids[0].getBoundingClientRect().right);
        });
        expect(gap).not.toBeNull();
        expect(gap!, "title and button must keep 8px apart").toBeGreaterThanOrEqual(8);
    });
});

test.describe("trip mode in Indonesian", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("no untranslated strings in a trip with a receipt and a budget", async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-locale", "id");
            localStorage.setItem("splitzy-onboarding-seen", "1");
            localStorage.setItem("splitzy-travel", JSON.stringify({
                activeId: "t1",
                trips: [{
                    id: "t1", name: "Bali 2026", budget: 2_000_000,
                    participants: [{ id: "p1", name: "Alya" }, { id: "p2", name: "Budi" }],
                    receipts: [{
                        id: "r1", title: "Warung Sate", date: "2026-08-24", payerId: "p1",
                        items: [{ id: "i1", name: "Sate Ayam", qty: 2, unitPrice: 35000, total: 70000, assignedToIds: ["p1", "p2"] }],
                        tax: 7000, service: 5000,
                    }],
                }],
            }));
        });
        await page.goto("/travel");
        await expect(page.getByText("Rincian trip")).toBeVisible();

        // The budget block was the one this list originally missed: its "left" /
        // "Over by" / "spent Rp" fragments were assembled inline, so a heading
        // check would not have caught them.
        const leaks = await page.evaluate(() => {
            const english = ["Trip details", "Trip name", "Budget (optional)", "Travelers",
                             "Everyone sharing", "Individual budgets", "Receipts", "Add receipt",
                             "Settle-up payments", "Record money paid", "Members", "Invite link",
                             "Delete trip", "View summary", "Saved on this device only",
                             "Sign in to sync", "Summary", "Balances", "Final Settlements",
                             "Receipt details", "Spending breakdown", "Payment Details",
                             "Default receipt currency", "Tap a receipt",
                             "left", "Over by", "Over budget", "spent Rp", "Budget"];
            return english.filter((w) => document.body.innerText.includes(w));
        });
        expect(leaks, `untranslated on /travel: ${leaks.join(", ")}`).toHaveLength(0);
    });
});

// There were three sticky action bars with three different appearances. The
// receipt editor's was a floating rounded card with a heavier blur that kept
// floating on desktop, while the split it sits inside used an edge-to-edge bar —
// two visual languages for two taps seconds apart.
test.describe("action bar", () => {
    async function measure(page: import("@playwright/test").Page) {
        return page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("div")).find(
                (d) => getComputedStyle(d).position === "sticky" && getComputedStyle(d).bottom === "0px"
            ) as HTMLElement | undefined;
            if (!el) return null;
            const b = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                left: Math.round(b.left),
                width: Math.round(b.width),
                bottom: Math.round(b.bottom),
                radius: cs.borderTopLeftRadius,
                blur: cs.backdropFilter,
            };
        });
    }

    // SKIPPED: the second half needs a signed-in session — /multiple is
    // protected in proxy.ts and redirects anonymous visitors. The whole test
    // goes rather than half of it, because its assertion *is* the comparison:
    // measuring /single's bar alone proves nothing about the two matching.
    // Unblock with a seeded test account and storageState (PBI-047).
    test.skip("the split and the receipt editor use the same bar at 375px", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.addInitScript(() => {
            localStorage.setItem("splitzy-onboarding-seen", "1");
            localStorage.setItem("splitbill-multiple", JSON.stringify({
                split: { id: "s1", name: "X", participants: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }], receipts: [] },
            }));
        });

        await page.goto("/single");
        await page.getByRole("button", { name: /sample data/i }).click();
        await page.getByRole("button", { name: /^Next$/ }).click();
        const split = await measure(page);

        await page.goto("/multiple");
        await page.getByRole("button", { name: /Add receipt/i }).first().click();
        const editor = await measure(page);

        expect(split).not.toBeNull();
        expect(editor).toEqual(split);
        // Edge to edge, flush to the bottom, no rounding.
        expect(split!.left).toBe(0);
        expect(split!.width).toBe(375);
        expect(split!.bottom).toBe(667);
        expect(split!.radius).toBe("0px");
    });

    test("it returns to the flow on a mouse-driven screen", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));
        await page.goto("/single");
        await page.getByRole("button", { name: /sample data/i }).click();
        await page.getByRole("button", { name: /^Next$/ }).click();

        const position = await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll("div")).find((d) => d.className.includes("md:static"));
            return el ? getComputedStyle(el).position : null;
        });
        expect(position).toBe("static");
    });

    test("no form control in the app is under 44px on a phone", async ({ page }) => {
        // SelectTrigger was a flat h-10 (40px) — the shared component was the one
        // breaking the rule, while the "non-compliant" native selects were right.
        await page.setViewportSize({ width: 375, height: 667 });
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));
        await page.goto("/single");
        await page.getByRole("button", { name: /sample data/i }).click();
        await page.getByRole("button", { name: /^Next$/ }).click();
        await page.waitForTimeout(400);

        const small = await page.evaluate(() =>
            (Array.from(document.querySelectorAll("select, [role='combobox']")) as HTMLElement[])
                .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height < 44)
                .map((el) => ({ tag: el.tagName.toLowerCase(), h: Math.round(el.getBoundingClientRect().height) }))
        );
        expect(small, JSON.stringify(small)).toHaveLength(0);
    });
});

test.describe("protected routes explain themselves", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("a bounced admin is told why, not dumped on the landing page", async ({ page }) => {
        // /admin used to `router.replace("/")` on 401/403. An admin whose session
        // had expired tapped their bookmark and got the marketing landing with
        // the first-run modal on top — no explanation, and no reason to think the
        // URL had not simply changed. It carries ?login=required now, which is
        // the convention /history/[id] and UpgradeButton already use, and which
        // reveals nothing about the route.
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));
        await page.goto("/admin");

        await expect(page).toHaveURL(/login=required/);
        await expect(page.getByText(/sign in to continue|masuk untuk melanjutkan/i)).toBeVisible();
    });

    test("the bounce banner does not claim to be about receipt history", async ({ page }) => {
        // Its copy was hardcoded to "Sign in to view your Receipt History", so it
        // was already lying to UpgradeButton, which bounces off /pricing.
        await page.addInitScript(() => localStorage.setItem("splitzy-onboarding-seen", "1"));
        await page.goto("/?login=required&redirect=/pricing");
        const banner = page.getByText(/sign in to continue/i);
        await expect(banner).toBeVisible();
        await expect(page.getByText(/Receipt History across devices/i)).toHaveCount(0);
    });
});

// The first screen every new visitor sees. It was a hand-rolled fixed div with
// no focus trap, no Escape, no aria-modal, a 20px close button, no way back a
// step, and English-only copy — and a stale comment claiming it was behind a
// feature flag, which is why none of that had been fixed.
test.describe("first-run tour", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("is a real dialog: focus trapped, Escape closes, targets 44px", async ({ page }) => {
        await page.goto("/");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();

        expect(await page.evaluate(() =>
            document.querySelector('[role="dialog"]')!.contains(document.activeElement)
        ), "focus must be inside the dialog").toBe(true);

        const heights = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[role="dialog"] button'))
                .map((b) => Math.round(b.getBoundingClientRect().height))
        );
        // Includes DialogContent's built-in close, which shipped at 16px and is
        // shared by every dialog in the app.
        expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
    });

    test("can go back a step, not only forward or out", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: /^Next$/ }).click();
        await page.getByRole("button", { name: /^Back$/ }).click();
        await expect(page.getByRole("button", { name: /^Skip$/ })).toBeVisible();
    });

    test("visiting the English root does not revert a chosen language", async ({ page }) => {
        // LocaleSync wrote the page's locale unconditionally, so `/` — which is
        // where the logo on every tool page pointed — silently reverted an
        // Indonesian user to English. It also produced a two-language dialog:
        // the tour read the preference before the clobber, and the mock inside
        // it mounts a commit later through a portal and read it after.
        await page.addInitScript(() => localStorage.setItem("splitzy-locale", "id"));
        await page.goto("/");
        await expect(page.getByRole("dialog")).toBeVisible();

        const state = await page.evaluate(() => ({
            stored: localStorage.getItem("splitzy-locale"),
            text: (document.querySelector('[role="dialog"]') as HTMLElement).innerText,
        }));
        expect(state.stored).toBe("id");
        expect(state.text).toContain("Ringkasan");
        expect(state.text).not.toContain("Summary");
    });
});

