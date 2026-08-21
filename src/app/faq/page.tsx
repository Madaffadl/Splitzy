import type { Metadata } from "next";
import { FaqContent } from "@/components/pages/FaqContent";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { bilingualPageMetadata } from "@/lib/seo/metadata";

const LOCALE = "en" as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = bilingualPageMetadata({
  locale: LOCALE,
  route: "/faq",
  title: dict.meta.faq.title,
  description: dict.meta.faq.description,
  // Title already contains the brand — skip the "%s · Splitzy" template.
  titleAbsolute: true,
});

export default function FaqPage() {
  return <FaqContent locale={LOCALE} />;
}
