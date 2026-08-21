// Bilingual routing (SEO Sprint 7).
//
// Splitzy's market is Indonesia (Rupiah pricing, Indonesian receipts), but the
// brand name "Splitzy" is heavily contested internationally — there are several
// unrelated apps on the App Store / Play Store using it. We cannot outrank
// those on a global "splitzy" query, so the strategy is to own the query in
// *Indonesia* instead. That means Indonesian is the primary language and it
// owns the un-prefixed URLs; English is served from an /en prefix.
//
//   /            → Indonesian landing   (x-default)
//   /en          → English landing
//   /about,/faq  → Indonesian entity pages
//   /en/about,…  → English entity pages
//
// Only routes that genuinely exist in BOTH languages may emit hreflang, because
// Google requires the annotations to be reciprocal — a page pointing at an
// alternate that doesn't point back is ignored. The app/tool routes
// (/single, /multiple, /travel) are single-URL for now, so they get localized
// metadata but no hreflang.

export const LOCALES = ["id", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Indonesian is the primary market, so it owns the un-prefixed URLs. */
export const DEFAULT_LOCALE: Locale = "id";

/** BCP-47 tags for `lang` attributes and hreflang keys. */
export const HTML_LANG: Record<Locale, string> = {
  id: "id-ID",
  en: "en",
};

/** OpenGraph `og:locale` values. */
export const OG_LOCALE: Record<Locale, string> = {
  id: "id_ID",
  en: "en_US",
};

/**
 * Routes that are published in both languages. Keep this list and the actual
 * route folders in sync — an entry here with no `/en` counterpart would emit a
 * broken hreflang pair.
 */
export const BILINGUAL_ROUTES = ["/", "/about", "/faq"] as const;

export type BilingualRoute = (typeof BILINGUAL_ROUTES)[number];

/**
 * The URL path for `route` in `locale`. `route` is always the canonical
 * (Indonesian) path with a leading slash — "/" for home, "/about", etc.
 */
export function localePath(locale: Locale, route: string): string {
  const suffix = route === "/" ? "" : route;
  if (locale === DEFAULT_LOCALE) return suffix || "/";
  return `/en${suffix}`;
}

/**
 * `alternates.languages` for a bilingual route. Values are relative; Next
 * resolves them against `metadataBase`. `x-default` points at the Indonesian
 * version because that is the version we want served to unmatched locales.
 */
export function alternateLanguages(route: BilingualRoute) {
  return {
    [HTML_LANG.id]: localePath("id", route),
    [HTML_LANG.en]: localePath("en", route),
    "x-default": localePath("id", route),
  };
}

/**
 * Canonical + hreflang block for a bilingual page, ready to spread into a
 * Next `Metadata.alternates`.
 */
export function bilingualAlternates(locale: Locale, route: BilingualRoute) {
  return {
    canonical: localePath(locale, route),
    languages: alternateLanguages(route),
  };
}
