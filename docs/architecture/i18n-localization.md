# Splitzy — Internationalization & Localization

> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[ASSUMED]** · **[UNKNOWN]**

---

## 1. Supported locales **[IMPLEMENTED]**

```ts
// src/lib/i18n/config.ts
export const LOCALES = ["id", "en"] as const;
export const DEFAULT_LOCALE:  Locale = "en";   // owns the un-prefixed URLs
export const PREFIXED_LOCALE: Locale = "id";   // served from /id
export const HTML_LANG = { id: "id-ID", en: "en" };
export const OG_LOCALE = { id: "id_ID", en: "en_US" };
```

| Locale | Language | URL tree | BCP-47 | `og:locale` |
|---|---|---|---|---|
| `en` | English | `/`, `/about`, `/faq` | `en` | `en_US` |
| `id` | Bahasa Indonesia | `/id`, `/id/about`, `/id/faq` | `id-ID` | `id_ID` |

**[IMPLEMENTED]** English is the default and owns the root. The config file records the decision,
its date, and the trade-off it accepts:

> *Owner decision (2026-08-21): English is the default. Note the SEO trade-off this accepts.
> Splitzy's market is Indonesia (Rupiah pricing, Indonesian receipts) and "Splitzy" is a heavily
> contested brand name… Google Indonesia is the one arena where the name is realistically winnable,
> and serving Indonesian from the un-prefixed root was the strongest geo-linguistic signal available
> there. English at the root weakens that signal; the Indonesian tree at /id and the hreflang pair
> are what keep us competitive.*

**[IMPLEMENTED]** Flipping back is a one-line change to `DEFAULT_LOCALE` plus renaming the route
folder — everything else (links, canonicals, hreflang, sitemap, `<html lang>`, manifest, OG image)
derives from it. This is why `localePath()` must never hardcode a prefix.

---

## 2. No i18n library **[IMPLEMENTED]**

There is **no `next-intl`, `next-i18next`, `i18next`, `react-intl`, or `lingui`** in
`package.json`, and no `i18n` block in `next.config.mjs` (the App Router does not support one
anyway). Localization is entirely hand-rolled:

| Piece | Implementation |
|---|---|
| Message catalogues | Two plain TypeScript objects: [dictionaries/id.ts](../../src/lib/i18n/dictionaries/id.ts) (1011 L) and [dictionaries/en.ts](../../src/lib/i18n/dictionaries/en.ts) (986 L) |
| Type safety | `type Dictionary = typeof id`; `en` is declared `const en: Dictionary`, so **a key added to `id.ts` without a counterpart in `en.ts` is a build error** |
| Lookup | `getDictionary(locale)` — synchronous, a plain record index. Deliberately sync *"so there is nothing to await and pages stay fully static"* |
| Interpolation | `fill(template, vars)` — a 3-line `String.replace(/\{(\w+)\}/g, …)`. An unknown placeholder is left intact rather than printing `undefined` |
| Pluralisation | **None.** Not needed for Indonesian (no plural inflection); English strings are phrased to avoid it |
| Date/number formatting | `Intl.NumberFormat("id-ID", …)` for IDR, hardcoded to the Indonesian convention regardless of UI locale |

**[INFERRED]** The rationale, stated in `use-locale.ts`, is proportionality: *"the alternative is a
runtime i18n library, and this app needs interpolation in about a dozen strings, not a framework."*

---

## 3. Two different routing strategies **[IMPLEMENTED]**

This is the central design fact of Splitzy's i18n, and it is unusual.

### 3.1 Marketing tree — locale from the URL

`/`, `/about`, `/faq` and their `/id/*` counterparts are **separate Server Components** that each
hardcode their own locale:

```tsx
// src/app/id/about/page.tsx
const LOCALE = "id" as const;
const dict = getDictionary(LOCALE);
export const metadata = bilingualPageMetadata({ locale: LOCALE, route: "/about", … });
export default function IndonesianAboutPage() {
  return <div lang={HTML_LANG.id}><AboutContent locale={LOCALE} /></div>;
}
```

There is no dynamic `[locale]` segment and no middleware locale rewrite — six physical route files
for three logical pages.

**[IMPLEMENTED]** The `lang` attribute is set on a **content wrapper**, not `<html>`, because the
App Router has a single root layout that owns `<html>`. Splitting into per-locale root layouts would
force a full page reload on every cross-locale navigation. A subtree `lang` is valid HTML5 and is
the semantically correct way to mark a language change inside a document; the authoritative signals
for Google are the hreflang pair and `og:locale`, both of which the page emits.

### 3.2 Tool tree — locale from a persisted preference

`/single`, `/multiple`, `/travel` are **single-URL**. They read locale client-side via
`useLocale()`, in this precedence order:

1. **`?lang=` query parameter** — and reading it also persists it.
2. **`localStorage["splitzy-locale"]`**.
3. **`navigator.language.slice(0,2)`** if it matches a published locale — *not* persisted, so a
   later deliberate choice still wins.
4. `DEFAULT_LOCALE` (`"en"`).

Two constraints force this design, both documented in
[use-locale.ts](../../src/lib/i18n/use-locale.ts):

- The tool routes are deliberately single-URL — see §5 on hreflang reciprocity — so there is no path
  segment to read a locale from.
- They **must stay statically prerenderable** (`○` in the build output). Reading a locale cookie on
  the server would make them `ƒ` dynamic.

**[IMPLEMENTED] The stated trade-off:** *"the preference can only be read after hydration, so the
very first paint of a tool page uses DEFAULT_LOCALE. An Indonesian visitor sees one frame of English
before it settles. Removing that would mean making these routes dynamic, which costs more than it
buys."*

### 3.3 Handing the locale across the boundary

Two mechanisms cooperate:

- **`LocaleSync`** — a null-rendering client component dropped on every localized marketing page. It
  writes the preference **conditionally**:

  ```ts
  if (locale !== DEFAULT_LOCALE || readStoredLocale() === null) storeLocale(locale);
  ```

  Only a deliberate signal may overwrite a stored choice. `/id` is deliberate; `/` is not — it is
  the default and the catch-all. Writing unconditionally used to revert an Indonesian user to
  English simply by tapping the logo, and produced a first-run modal rendering in two languages at
  once (the dialog read the preference before the effect clobbered it; the mock inside it mounted a
  commit later through a Radix portal and read the clobbered value).

- **`?lang=` on CTA links** — `LANG_PARAM`. The stored preference alone was a race: `LocaleSync`
  writes from an effect, the hero CTA sits above the fold, and a tap landing before hydration
  completes leaves with nothing written. The link carries the locale explicitly.

### 3.4 `LocaleSwitcher` **[IMPLEMENTED]**

A globe button that stores the next locale and **reloads** rather than re-rendering:

```ts
const onLanding = path === "/" || path === "/id";
window.location.assign(onLanding ? (next === "id" ? "/id" : "/") : path);
```

The reload is deliberate: the marketing tree takes its locale from the URL while the tool routes
take it from the preference, and going through the server keeps the two from disagreeing.

Its existence is a fix for a real gap — the only way to change language used to be a link in the
landing footer, twelve full-height sections below the fold, unreachable from inside a split.

---

## 4. Legacy `/en` redirect **[IMPLEMENTED]**

English briefly lived at `/en` while Indonesian owned the root. After the 2026-08-21 flip,
[src/proxy.ts](../../src/proxy.ts) `301`s `/en` → `/` and `/en/*` → `/*`, because those URLs were
already submitted to Search Console and must not 404. Pinned by an E2E test. Marked safe to delete
once Search Console shows no traffic for `/en`, "realistically several months out".

---

## 5. hreflang **[IMPLEMENTED]**

```ts
export const BILINGUAL_ROUTES = ["/", "/about", "/faq"] as const;

export function alternateLanguages(route: BilingualRoute) {
  return {
    "id-ID":     localePath("id", route),
    "en":        localePath("en", route),
    "x-default": localePath(DEFAULT_LOCALE, route),   // → the un-prefixed URL
  };
}
```

Emitted through `bilingualPageMetadata()` → Next `Metadata.alternates`, producing
`<link rel="alternate" hreflang="…">` plus a self-referencing `rel="canonical"`.

**Only three routes emit hreflang**, and the reason is a hard rule stated twice in the codebase:
*Google requires the annotations to be reciprocal — a page pointing at an alternate that doesn't
point back is ignored.* The tool routes are single-URL, so they get localized metadata but **no**
hreflang; `singleUrlPageMetadata()` exists precisely to express that.

**[IMPLEMENTED]** [e2e/smoke.spec.ts](../../e2e/smoke.spec.ts) asserts reciprocity in both
directions for `/`, `/id`, `/about`, `/id/about`, and that `x-default` always resolves to the
un-prefixed URL.

---

## 6. What is translated, and what is not

### 6.1 Fully translated **[IMPLEMENTED]**

The dictionary has 21 top-level namespaces:

`meta` · `nav` · `og` · `header` · `preview` · `hero` · `stats` · `problem` · `features` ·
`featureVisuals` · `steps` · `modes` · `proof` · `testimonials` · `pricing` · `faq` · `finalCta` ·
`footer` · `about` · `faqPage` · **`app`**

The `app` namespace (from line 460 to the end of the file — over half the catalogue) covers the
product UI: `common`, `locale`, `modes`, `stepper`, `participants`, `scan`, `cards`, `loginRequired`
and more.

32 files call `getDictionary`/`useDictionary`, including every substantial product surface:

| Surface | Localized |
|---|---|
| Landing (`NewLanding`), About, FAQ, footer | ✅ |
| Page metadata, OG image, PWA manifest | ✅ |
| `SingleSplitView`, `MultipleReceiptView`, `TravelSpendView` | ✅ |
| `ReceiptInput` (scan errors), `ReceiptEditor`, `ItemsTable`, `ParticipantManager`, `FeesInput`, `DiscountsInput`, `SummaryPanel`, `Stepper` | ✅ |
| `OnboardingModal`, `GuestLimitDialog`, `LoginBanner`, `LocaleSwitcher`, `ChangeRequests` | ✅ |

### 6.2 English-only **[IMPLEMENTED]**

Surfaces with no dictionary usage — every string is hardcoded English:

| Surface | Why it matters |
|---|---|
| `/privacy`, `/terms` | **Legal documents shown to an Indonesian audience in English only** |
| `/pricing` (incl. the 5-question `PRICING_FAQ`) | Purchase-decision copy in the conversion path |
| `/history`, `/history/[id]` | "Receipt History", "Your past splits", "Sign in with Google" |
| `/dashboard` (`DashboardClient`) | Post-login home |
| `/s/[code]` and `/share` | Public share view — the surface most likely to be opened by someone who has never used the app |
| `/invite/[token]` | First contact for an invited collaborator |
| `/admin` | Internal only; English is fine |
| `error.tsx`, `not-found.tsx`, `maintenance/page.tsx` | 404/500/maintenance |
| `AuthButton`, `ErrorBoundary`, `ReferralCard`, `ReceiptHistoryList/Card`, billing components | Mixed chrome |
| Server-side API error messages | e.g. *"This split was saved from somewhere else…"*, *"Members can't edit this trip directly…"* — surfaced verbatim in toasts |
| The welcome email | `sendWelcomeEmail` HTML is English-only |
| Skip link (`"Skip to content"`) | Hardcoded in the root layout |

**[INFERRED]** The translation effort followed the SEO work: marketing pages and the split editors
are done; transactional, legal, and post-conversion surfaces are not. The highest-impact gaps are
`/s/[code]` (shared into Indonesian WhatsApp groups by design) and `/privacy` + `/terms`.

### 6.3 Deliberately not localized **[IMPLEMENTED]**

- **Currency formatting** — always `Intl.NumberFormat("id-ID", { currency: "IDR" })`, so an English
  user still sees `Rp 29.000`. Correct: the price *is* in Rupiah.
- **Brand strings** — `BRAND.name`, `short_name: "Splitzy"`, `applicationName`.
- **Admin console** — internal tooling.

---

## 7. Translation-quality guards **[IMPLEMENTED]**

Beyond the compile-time key check, [app-copy.test.ts](../../src/lib/i18n/app-copy.test.ts) asserts
the things the type system cannot see:

1. **`fill` semantics** — substitutes named placeholders, substitutes every occurrence, and leaves
   an unknown placeholder intact instead of printing `undefined`.
2. **Mode names cannot drift** — `app.modes.<x>.title` must equal `modes.items[n].title` in both
   languages, so a mode advertised as "Banyak Struk" on the landing page is called the same thing
   once you are inside it.
3. **Placeholder parity** — the `{…}` set must match between `id` and `en` for the interpolated
   strings.
4. **Actually translated, not copied** — asserts specific `id` strings differ from their `en`
   counterparts, catching the failure mode of pasting the English and moving on.

---

## 8. SEO implications

### 8.1 Working correctly **[IMPLEMENTED]**

| Signal | State |
|---|---|
| Per-page unique `title` + `description` in both languages | ✅ via `bilingualPageMetadata` |
| Self-referencing canonical on every indexable page | ✅ — E2E-asserted |
| Reciprocal hreflang + `x-default` on the three bilingual routes | ✅ — E2E-asserted |
| `og:locale` + `og:alternateLocale` | ✅ |
| Sitemap emits each bilingual route once per language with `alternates.languages` | ✅ |
| Default locale weighted higher in the sitemap (`priority × 0.8` for the prefixed tree) | ✅ |
| Legacy `/en` 301s preserved | ✅ — E2E-asserted |
| Apex → `www` 301 | ✅ — E2E-asserted |
| `<html lang>` for the default tree, subtree `lang` for `/id` | ✅ |
| Entity JSON-LD declares `inLanguage: ["en","id-ID"]` | ✅ |
| No `alternates.canonical` in the root layout | ✅ — deliberate; a site-wide canonical once made every page declare itself a duplicate of the homepage |

**[IMPLEMENTED]** The root-layout canonical incident is memorialised in both a code comment and an
E2E test: *"It built, linted and rendered perfectly — only the emitted metadata was wrong."*

### 8.2 Costs of the current design **[INFERRED]**

| # | Issue |
|---|---|
| 1 | **English owns the root in an Indonesian market.** Acknowledged in `config.ts` as an accepted trade-off, not an oversight |
| 2 | **The tool pages have no Indonesian URL.** `/single`, `/multiple`, `/travel` are the pages with real keyword value ("split bill", "bagi tagihan") and they exist only in English at a single URL. A crawler never sees the Indonesian version, because it is applied client-side after hydration |
| 3 | **`/multiple` is absent from the sitemap on purpose** — `proxy.ts` protects it, so Googlebot is 307'd to `/?login=required`. The sitemap comment names this as a product decision worth revisiting: *"It is a valuable keyword target… making it publicly viewable in a read-only state would be worth doing"* |
| 4 | **Client-side locale switching is invisible to crawlers.** Google indexes the default-locale render of every tool page |
| 5 | `/privacy` and `/terms` are English-only and single-URL, so they contribute nothing to Indonesian entity signals |

---

## 9. Adding a locale — what it would take **[INFERRED]**

1. Add the code to `LOCALES`, `HTML_LANG`, `OG_LOCALE`.
2. Write a third dictionary typed as `Dictionary` (the compiler enumerates every missing key).
3. Register it in `DICTIONARIES`.
4. Create the route folder `src/app/<locale>/{page,about/page,faq/page}.tsx` mirroring `/id`.
5. `alternateLanguages()` currently **hardcodes the two-locale shape** and would need generalising
   to map over `LOCALES` — the one place the design is not yet N-locale generic.
6. `LocaleSwitcher` assumes exactly two locales (`LOCALES.find(l => l !== current)`) and would need
   to become a menu.

---

## 10. Open questions

| # | Question | Label |
|---|---|---|
| 1 | Is leaving `/privacy` and `/terms` English-only acceptable for Indonesian users, legally and practically? | **[UNKNOWN]** |
| 2 | Should the tool routes get `/id/*` counterparts to earn Indonesian hreflang and keyword coverage? Blocked on the static-prerender constraint | **[UNKNOWN]** — a product decision |
| 3 | Is the one-frame English flash on tool pages measurably costing anything? No telemetry exists for it | **[UNKNOWN]** |
| 4 | Should `/multiple` get a read-only public state so it can be indexed? Explicitly raised in `sitemap.ts` and unresolved | **[UNKNOWN]** |
| 5 | Actual Search Console coverage per tree | **[UNKNOWN]** — external data |
