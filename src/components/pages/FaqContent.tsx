import Link from "next/link";
import { ContentPageShell } from "@/components/layout/ContentPageShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { BRAND } from "@/lib/brand";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { webPageGraph } from "@/lib/seo/structured-data";

// /faq — the long-form FAQ, marked up as a FAQPage.
//
// Two jobs. First, it answers the "is splitzy free / legit / safe" questions
// that dominate a brand query, which is what converts a searcher who has heard
// the name. Second, FAQPage markup makes the page eligible for expandable
// answers in the SERP, which takes up more vertical space than the App Store
// listings we're competing against for the "splitzy" query.
export function FaqContent({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const home = localePath(locale, "/");

  // Flattened for the JSON-LD: schema.org FAQPage takes one mainEntity list,
  // with no notion of the visual grouping.
  const allQuestions = dict.faqPage.groups.flatMap((group) => group.items);

  return (
    <>
      <JsonLd
        data={webPageGraph({
          locale,
          route: "/faq",
          name: dict.faqPage.heading,
          description: dict.meta.faq.description,
          breadcrumb: [{ name: dict.nav.faq, route: "/faq" }],
          faq: allQuestions,
          homeLabel: dict.nav.home,
        })}
      />
      <ContentPageShell
        title={dict.faqPage.heading}
        lead={dict.faqPage.lead}
        homeHref={home}
        backLabel={dict.nav.home}
      >
        {dict.faqPage.groups.map((group) => (
          <section key={group.heading}>
            <h2>{group.heading}</h2>
            <div className="space-y-3 not-prose">
              {group.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="cursor-pointer font-semibold list-none text-foreground">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2>{dict.faqPage.stillStuckHeading}</h2>
          <p>
            {dict.faqPage.stillStuckBody}{" "}
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
          </p>
          <p>
            <Link href={localePath(locale, "/about")}>{dict.nav.about}</Link>
            {" · "}
            <Link href="/privacy">{dict.nav.privacy}</Link>
            {" · "}
            <Link href="/terms">{dict.nav.terms}</Link>
          </p>
        </section>
      </ContentPageShell>
    </>
  );
}
