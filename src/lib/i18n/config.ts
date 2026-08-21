// Bilingual routing (SEO Sprint 7).
//
// The default locale owns the un-prefixed URLs; every other locale is served
// from a /<locale> prefix:
//
//   /             → English landing        (x-default)
//   /id           → Indonesian landing
//   /about,/faq   → English entity pages
//   /id/about,…   → Indonesian entity pages
//
// Owner decision (2026-08-21): English is the default. Note the SEO trade-off
// this accepts. Splitzy's market is Indonesia (Rupiah pricing, Indonesian
// receipts) and "Splitzy" is a heavily contested brand name — several unrelated
// apps use it on the App Store, Play Store, Facebook and LinkedIn. Google
// Indonesia is the one arena where the name is realistically winnable, and
// serving Indonesian from the un-prefixed root was the strongest geo-linguistic
// signal available there. English at the root weakens that signal; the
// Indonesian tree at /id and the hreflang pair are what keep us competitive.
//
// Flipping the default back is a one-line change to DEFAULT_LOCALE plus
// renaming the prefixed route folder — everything else derives from here, which
// is why localePath() must never hardcode a prefix.
//
// Only routes that genuinely exist in BOTH languages may emit hreflang, because
// Google requires the annotations to be reciprocal — a page pointing at an
// alternate that doesn't point back is ignored. The app/tool routes
// (/single, /multiple, /travel) are single-URL for now, so they get localized
// metadata but no hreflang.

export const LOCALES = ["id", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** The locale served from the un-prefixed URLs. */
export const DEFAULT_LOCALE: Locale = "en";

/** The locale served from a /<locale> prefix. */
export const PREFIXED_LOCALE: Locale = "id";

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
 * route folders in sync — an entry here with no prefixed counterpart would emit
 * a broken hreflang pair.
 */
export const BILINGUAL_ROUTES = ["/", "/about", "/faq"] as const;

export type BilingualRoute = (typeof BILINGUAL_ROUTES)[number];

/**
 * The URL path for `route` in `locale`. `route` is the un-prefixed path with a
 * leading slash — "/" for home, "/about", etc.
 *
 * The prefix is derived from the locale rather than hardcoded, so changing
 * DEFAULT_LOCALE re-points every link, canonical, hreflang and sitemap entry in
 * the app without touching this function.
 */
export function localePath(locale: Locale, route: string): string {
  const suffix = route === "/" ? "" : route;
  if (locale === DEFAULT_LOCALE) return suffix || "/";
  return `/${locale}${suffix}`;
}

/**
 * `alternates.languages` for a bilingual route. Values are relative; Next
 * resolves them against `metadataBase`. `x-default` points at the default
 * locale — that is the version served to visitors whose language we don't
 * explicitly target.
 */
export function alternateLanguages(route: BilingualRoute) {
  return {
    [HTML_LANG.id]: localePath("id", route),
    [HTML_LANG.en]: localePath("en", route),
    "x-default": localePath(DEFAULT_LOCALE, route),
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
