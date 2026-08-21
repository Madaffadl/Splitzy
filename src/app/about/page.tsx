import type { Metadata } from "next";
import { AboutContent } from "@/components/pages/AboutContent";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { bilingualPageMetadata } from "@/lib/seo/metadata";

const LOCALE = "en" as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = bilingualPageMetadata({
  locale: LOCALE,
  route: "/about",
  title: dict.meta.about.title,
  description: dict.meta.about.description,
  // Title already contains the brand — skip the "%s · Splitzy" template.
  titleAbsolute: true,
});

export default function AboutPage() {
  return <AboutContent locale={LOCALE} />;
}
