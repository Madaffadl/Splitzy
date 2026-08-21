import type { Metadata } from "next";
import {
  OG_LOCALE,
  bilingualAlternates,
  localePath,
  type BilingualRoute,
  type Locale,
} from "@/lib/i18n/config";

// Metadata builders (SEO Sprint 7).
//
// Every indexable page needs a *unique* title and description. Before this, all
// pages inherited the same root title, which makes Google pick one page as the
// canonical representative of the whole site and suppress the rest — the exact
// opposite of what we want when chasing brand sitelinks.

/**
 * Full metadata for a page published in both languages: unique title and
 * description, a self-referencing canonical, and reciprocal hreflang.
 *
 * `titleAbsolute` bypasses the root layout's "%s · Splitzy" template. Use it for
 * pages whose title already contains the brand (the two landing pages), so we
 * don't ship "Splitzy — … · Splitzy".
 */
export function bilingualPageMetadata(options: {
  locale: Locale;
  route: BilingualRoute;
  title: string;
  description: string;
  titleAbsolute?: boolean;
}): Metadata {
  const { locale, route, title, description, titleAbsolute } = options;
  return {
    title: titleAbsolute ? { absolute: title } : title,
    description,
    alternates: bilingualAlternates(locale, route),
    openGraph: {
      type: "website",
      url: localePath(locale, route),
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: Object.values(OG_LOCALE).filter(
        (l) => l !== OG_LOCALE[locale]
      ),
    },
    twitter: { title, description },
  };
}

/**
 * Metadata for a page that exists at a single URL (the tool routes and the
 * legal pages). No hreflang is emitted — Google requires alternate annotations
 * to be reciprocal, and there is no second URL to point back.
 */
export function singleUrlPageMetadata(options: {
  route: string;
  title: string;
  description: string;
}): Metadata {
  const { route, title, description } = options;
  return {
    title,
    description,
    alternates: { canonical: route },
    openGraph: { type: "website", url: route, title, description },
    twitter: { title, description },
  };
}
