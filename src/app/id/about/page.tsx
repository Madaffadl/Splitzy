import type { Metadata } from "next";
import { AboutContent } from "@/components/pages/AboutContent";
import { HTML_LANG } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { bilingualPageMetadata } from "@/lib/seo/metadata";

const LOCALE = "id" as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = bilingualPageMetadata({
  locale: LOCALE,
  route: "/about",
  title: dict.meta.about.title,
  description: dict.meta.about.description,
  // Title already contains the brand — skip the "%s · Splitzy" template.
  titleAbsolute: true,
});

export default function IndonesianAboutPage() {
  return (
    <div lang={HTML_LANG.id}>
      <AboutContent locale={LOCALE} />
    </div>
  );
}
