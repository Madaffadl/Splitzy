import Link from "next/link";
import { ContentPageShell } from "@/components/ContentPageShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { BRAND } from "@/lib/brand";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { webPageGraph } from "@/lib/seo/structured-data";

// /about — the brand-entity anchor.
//
// This page exists for a specific SEO reason: "Splitzy" is a contested name, so
// Google needs a page that unambiguously describes *this* Splitzy as an entity —
// what it is, what it does, who to contact. An About page with a matching
// Organization reference in the JSON-LD graph is the conventional signal for
// that, and it is a prerequisite for a brand Knowledge Panel.
export function AboutContent({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const home = localePath(locale, "/");

  return (
    <>
      <JsonLd
        data={webPageGraph({
          locale,
          route: "/about",
          name: dict.about.heading,
          description: dict.meta.about.description,
          breadcrumb: [{ name: dict.nav.about, route: "/about" }],
          homeLabel: dict.nav.home,
        })}
      />
      <ContentPageShell
        title={dict.about.heading}
        lead={dict.about.lead}
        homeHref={home}
        backLabel={dict.nav.home}
      >
        {dict.about.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}

        <section>
          <h2>{dict.about.contactHeading}</h2>
          <p>
            {dict.about.contactBody}{" "}
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
          </p>
        </section>

        <section>
          <h2>{dict.about.ctaHeading}</h2>
          <p>{dict.about.ctaBody}</p>
          <p>
            <Link href="/single">{dict.about.cta}</Link>
            {" · "}
            <Link href={localePath(locale, "/faq")}>{dict.nav.faq}</Link>
          </p>
        </section>
      </ContentPageShell>
    </>
  );
}
