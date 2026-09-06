// JSON-LD structured data (SEO Sprint 7).
//
// Why this matters more than usual for Splitzy: "Splitzy" is not a unique name.
// Several unrelated products use it (two iOS apps, two Play Store apps, a
// Facebook page, a UK LinkedIn company). When a name is contested, Google has
// to decide *which* Splitzy a searcher meant, and it leans on explicit entity
// markup to do that. Emitting a consistent Organization + WebSite +
// SoftwareApplication graph, with stable @ids that every page references, is
// how we stake a claim to the name rather than hoping Google infers it.
//
// Integrity constraint: aggregateRating is only emitted when the live `reviews`
// table has ≥5 approved rows — see fetchAggregateRating(). The landing page
// stats and testimonials are still placeholder figures and must never be marked
// up as structured data (that would violate Google's spam policy).

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { BRAND, BRAND_PROFILES } from "@/lib/brand";
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  PREFIXED_LOCALE,
  localePath,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";

const SITE = BRAND.siteUrl;

/** Stable node identifiers. Every page points at these same @ids. */
export const NODE = {
  organization: `${SITE}/#organization`,
  website: `${SITE}/#website`,
  app: `${SITE}/#app`,
  logo: `${SITE}/#logo`,
} as const;

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return path === "/" ? `${SITE}/` : `${SITE}${path}`;
}

type JsonLdNode = Record<string, unknown>;

function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": NODE.organization,
    name: BRAND.name,
    url: `${SITE}/`,
    email: BRAND.supportEmail,
    description:
      "Splitzy builds a free web app for splitting shared bills and trip expenses fairly, with itemised receipt scanning and minimal-transfer settlement.",
    foundingDate: "2024",
    knowsLanguage: [HTML_LANG[DEFAULT_LOCALE], HTML_LANG[PREFIXED_LOCALE]],
    logo: {
      "@type": "ImageObject",
      "@id": NODE.logo,
      url: absoluteUrl("/logo.png"),
      width: 1920,
      height: 2194,
      caption: BRAND.name,
    },
    image: { "@id": NODE.logo },
    // Empty until real profiles exist — see BRAND_PROFILES for why this matters.
    ...(BRAND_PROFILES.length > 0 ? { sameAs: [...BRAND_PROFILES] } : {}),
  };
}

function webSiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": NODE.website,
    url: `${SITE}/`,
    name: BRAND.name,
    alternateName: "Splitzy — Split Bill",
    description:
      "Free web app for splitting shared bills and trip expenses fairly.",
    // The site is served in both languages; the default locale is x-default.
    inLanguage: [HTML_LANG[DEFAULT_LOCALE], HTML_LANG[PREFIXED_LOCALE]],
    publisher: { "@id": NODE.organization },
    // potentialAction enables the Google Sitelinks Searchbox for branded queries.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export type AggregateRating = {
  ratingValue: number;
  reviewCount: number;
};

function softwareApplicationNode(
  dict: Dictionary,
  rating?: AggregateRating
): JsonLdNode {
  return {
    "@type": ["SoftwareApplication", "WebApplication"],
    "@id": NODE.app,
    name: BRAND.name,
    url: `${SITE}/`,
    applicationCategory: "FinanceApplication",
    applicationSubCategory: "Bill Splitting",
    operatingSystem: "Web browser (Android, iOS, Windows, macOS)",
    browserRequirements: "Requires JavaScript.",
    inLanguage: [HTML_LANG[DEFAULT_LOCALE], HTML_LANG[PREFIXED_LOCALE]],
    availableOnDevice: ["Desktop", "Mobile"],
    description: dict.meta.home.description,
    publisher: { "@id": NODE.organization },
    isPartOf: { "@id": NODE.website },
    screenshot: absoluteUrl("/opengraph-image"),
    featureList: [
      ...dict.features.scan.points,
      ...dict.features.settle.points,
      ...dict.features.travel.points,
    ],
    // Two real offers: the free tier and the one-time Pro purchase. Prices come
    // from the billing constants so this can never drift from what we charge.
    offers: [
      {
        "@type": "Offer",
        name: FREE_PLAN.name,
        price: "0",
        priceCurrency: FREE_PLAN.currency,
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/pricing"),
      },
      {
        "@type": "Offer",
        name: PRO_PLAN.name,
        price: String(PRO_PLAN.priceIDR),
        priceCurrency: PRO_PLAN.currency,
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/pricing"),
        description: `One-time payment granting ${PRO_PLAN.periodDays} days of Splitzy Pro. No auto-renewal.`,
      },
    ],
    // Only emitted once there are ≥5 approved reviews — Google ignores (and may
    // penalise) aggregateRating with too few samples. See also the comment at
    // the top of this file about not marking up placeholder stats.
    ...(rating && rating.reviewCount >= 5
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.ratingValue.toFixed(1),
            reviewCount: rating.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/**
 * The site-wide entity graph: Organization + WebSite + the app itself. Rendered
 * once from the root layout so every page — including the tool routes — carries
 * a consistent claim on the "Splitzy" name.
 *
 * Pass `rating` to include aggregateRating in the SoftwareApplication node;
 * the node omits it if there are fewer than 5 approved reviews.
 */
export function siteGraph(
  dict: Dictionary,
  rating?: AggregateRating
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      webSiteNode(),
      softwareApplicationNode(dict, rating),
    ],
  };
}

/**
 * A page node tied into the site graph. `route` is the un-prefixed route; the
 * URL is resolved for `locale`.
 */
export function webPageGraph(options: {
  locale: Locale;
  route: string;
  name: string;
  description: string;
  /** Breadcrumb trail, root excluded — it is prepended automatically. */
  breadcrumb?: { name: string; route: string }[];
  faq?: { q: string; a: string }[];
  homeLabel: string;
}): JsonLdNode {
  const { locale, route, name, description, breadcrumb, faq, homeLabel } =
    options;
  const url = absoluteUrl(localePath(locale, route));
  const pageId = `${url}#webpage`;

  const nodes: JsonLdNode[] = [
    {
      "@type": faq ? "FAQPage" : "WebPage",
      "@id": pageId,
      url,
      name,
      description,
      inLanguage: HTML_LANG[locale],
      isPartOf: { "@id": NODE.website },
      about: { "@id": NODE.app },
      primaryImageOfPage: { "@id": NODE.logo },
      ...(breadcrumb ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
      ...(faq
        ? {
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }
        : {}),
    },
  ];

  if (breadcrumb) {
    const trail = [{ name: homeLabel, route: "/" }, ...breadcrumb];
    nodes.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: trail.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: absoluteUrl(localePath(locale, crumb.route)),
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * Standalone FAQPage markup for the FAQ block embedded in another page (the
 * landing page). Kept separate from `webPageGraph` because a page may only
 * declare one primary @type, and the landing page is a WebPage first.
 */
export function faqGraph(
  locale: Locale,
  route: string,
  faq: { q: string; a: string }[]
): JsonLdNode {
  const url = absoluteUrl(localePath(locale, route));
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    inLanguage: HTML_LANG[locale],
    isPartOf: { "@id": NODE.website },
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * Fetches the live aggregate rating from approved reviews. Cached for 1 hour
 * so every page load doesn't hit the DB. Returns undefined when there are
 * fewer than 5 approved reviews — the schema.org minimum for aggregateRating.
 */
export const fetchAggregateRating = unstable_cache(
  async (): Promise<AggregateRating | undefined> => {
    try {
      const result = await prisma.review.aggregate({
        where: { status: "approved" },
        _avg: { rating: true },
        _count: { rating: true },
      });
      const count = result._count.rating;
      const avg = result._avg.rating;
      if (count < 5 || avg === null) return undefined;
      return { ratingValue: avg, reviewCount: count };
    } catch {
      return undefined;
    }
  },
  ["aggregate-rating"],
  { revalidate: 3600 }
);
