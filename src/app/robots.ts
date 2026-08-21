import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Let crawlers index the marketing + tool pages, but keep private/functional
// surfaces out: the API, admin, per-user pages, and the read-only share links
// (/s/<code> and the hash-based /share view are user data, not content).
//
// `host` is deliberately kept: it names the canonical hostname for the crawlers
// that honour it, reinforcing the apex → www 301 in src/middleware.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Surfaces we don't want crawled at all. Signed-in-only pages
        // (/dashboard, /history, /admin, /maintenance) are deliberately NOT
        // listed here: they carry a `robots: noindex` tag instead. A robots.txt
        // disallow would stop Google from ever *reading* that tag, and a
        // disallowed URL can still be indexed URL-only if something links to it.
        // Noindex is the directive that actually guarantees exclusion.
        disallow: ["/api/", "/s/", "/share", "/invite/"],
      },
    ],
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
    host: BRAND.siteUrl,
  };
}
