import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// SEO (Sprint 4). Only always-available public pages are listed. Flag-gated
// pages (/pricing, /dashboard) are intentionally omitted while they 404, and
// per-user pages (history, shared links) are private.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = BRAND.siteUrl;
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: "weekly" | "monthly" | "yearly"
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1, "weekly"),
    page("/single", 0.9, "monthly"),
    page("/multiple", 0.9, "monthly"),
    page("/travel", 0.9, "monthly"),
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
  ];
}
