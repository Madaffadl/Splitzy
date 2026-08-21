import type { Metadata } from "next";
import { NewLanding } from "@/components/landing/NewLanding";
import { JsonLd } from "@/components/seo/JsonLd";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { bilingualPageMetadata } from "@/lib/seo/metadata";
import { faqGraph, webPageGraph } from "@/lib/seo/structured-data";

// The English landing page. English is the default locale and so owns the
// un-prefixed URL; Indonesian lives at /id. See src/lib/i18n/config.ts for the
// SEO trade-off this represents.

const LOCALE = "en" as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = bilingualPageMetadata({
  locale: LOCALE,
  route: "/",
  title: dict.meta.home.title,
  description: dict.meta.home.description,
  // Title already contains "Splitzy", so skip the "%s · Splitzy" template.
  titleAbsolute: true,
});

export default function Home() {
  return (
    <>
      <JsonLd
        data={webPageGraph({
          locale: LOCALE,
          route: "/",
          name: dict.meta.home.title,
          description: dict.meta.home.description,
          homeLabel: dict.nav.home,
        })}
      />
      {/* The landing page's FAQ accordion, mirrored as FAQPage markup so the
          answers are eligible to expand directly in the SERP. */}
      <JsonLd data={faqGraph(LOCALE, "/", dict.faq.items)} />
      <NewLanding locale={LOCALE} />
    </>
  );
}
