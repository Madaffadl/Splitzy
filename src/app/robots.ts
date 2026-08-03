import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// SEO (Sprint 4). Let crawlers index the marketing + tool pages, but keep
// private/functional surfaces out: the API, admin, and per-share read-only
// links (/s/<code> and the hash-based /share view are user data, not content).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/s/", "/share"],
    },
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
    host: BRAND.siteUrl,
  };
}
