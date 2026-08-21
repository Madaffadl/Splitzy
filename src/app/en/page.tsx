import type { Metadata } from "next";
import { NewLanding } from "@/components/landing/NewLanding";
import { JsonLd } from "@/components/seo/JsonLd";
import { HTML_LANG } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { bilingualPageMetadata } from "@/lib/seo/metadata";
import { faqGraph, webPageGraph } from "@/lib/seo/structured-data";

// The English landing page. The `lang` attribute is set on the content wrapper
// rather than <html> because the App Router has a single root layout that owns
// <html>, and splitting the whole app into per-locale root layouts would force a
// full page reload on every cross-locale navigation. A subtree `lang` is valid
// HTML5 and is the semantically correct way to mark a language change inside a
// document; the authoritative language signals for Google are the hreflang pair
// and og:locale, both of which this page emits.

const LOCALE = "en" as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = bilingualPageMetadata({
  locale: LOCALE,
  route: "/",
  title: dict.meta.home.title,
  description: dict.meta.home.description,
  titleAbsolute: true,
});

export default function EnglishHome() {
  return (
    <div lang={HTML_LANG.en}>
      <JsonLd
        data={webPageGraph({
          locale: LOCALE,
          route: "/",
          name: dict.meta.home.title,
          description: dict.meta.home.description,
          homeLabel: dict.nav.home,
        })}
      />
      <JsonLd data={faqGraph(LOCALE, "/", dict.faq.items)} />
      <NewLanding locale={LOCALE} />
    </div>
  );
}
