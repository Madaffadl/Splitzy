import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import {
  BILINGUAL_ROUTES,
  HTML_LANG,
  localePath,
  type BilingualRoute,
} from "@/lib/i18n/config";

// SEO sitemap.
//
// Lists every page that is genuinely public and indexable. Excluded on purpose:
// the API, /admin, per-user surfaces (/dashboard, /history), and the read-only
// share links (/s/<code>, /share) — those are user data, not content.
//
// Bilingual routes are emitted once per language with `alternates.languages`, so
// Google discovers both trees and understands they are translations of each
// other rather than duplicates.

const base = BRAND.siteUrl;

type ChangeFrequency = "weekly" | "monthly" | "yearly";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const bilingual = BILINGUAL_ROUTES.flatMap((route: BilingualRoute) => {
    const priority = route === "/" ? 1 : 0.7;
    const changeFrequency: ChangeFrequency =
      route === "/" ? "weekly" : "monthly";
    const languages = {
      [HTML_LANG.id]: `${base}${localePath("id", route)}`,
      [HTML_LANG.en]: `${base}${localePath("en", route)}`,
    };

    return (["id", "en"] as const).map((locale) => ({
      url: `${base}${localePath(locale, route)}`,
      lastModified: now,
      changeFrequency,
      // The English tree is a secondary market, so it ranks below its
      // Indonesian counterpart.
      priority: locale === "id" ? priority : priority * 0.8,
      alternates: { languages },
    }));
  });

  // Single-URL pages: the interactive tools and the legal pages. No `alternates`
  // — there is no second-language URL for these, and Google ignores hreflang
  // annotations that aren't reciprocal.
  const singleUrl: {
    path: string;
    priority: number;
    changeFrequency: ChangeFrequency;
  }[] = [
    { path: "/single", priority: 0.9, changeFrequency: "monthly" },
    { path: "/travel", priority: 0.9, changeFrequency: "monthly" },
    // NOTE: /multiple is deliberately absent. src/proxy.ts lists it as a
    // protected route, so an unauthenticated visitor — Googlebot included — is
    // 307'd to /?login=required. Listing a redirecting URL in the sitemap just
    // produces "Page with redirect" errors in Search Console. It is a valuable
    // keyword target ("split bill banyak struk"), so making it publicly
    // viewable in a read-only state would be worth doing — that is a product
    // decision, not an SEO change.
    { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

  return [
    ...bilingual,
    ...singleUrl.map((page) => ({
      url: `${base}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  ];
}
