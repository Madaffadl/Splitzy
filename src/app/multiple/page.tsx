import { Suspense } from "react";
import type { Metadata } from "next";
import { MultipleReceiptView } from "@/components/pages/MultipleReceiptView";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { singleUrlPageMetadata } from "@/lib/seo/metadata";
import { webPageGraph } from "@/lib/seo/structured-data";

// Server wrapper — see src/app/single/page.tsx for why the split exists.

const LOCALE = DEFAULT_LOCALE;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = singleUrlPageMetadata({
  route: "/multiple",
  title: dict.meta.multiple.title,
  description: dict.meta.multiple.description,
});

export default function MultiplePage() {
  return (
    <>
      <JsonLd
        data={webPageGraph({
          locale: LOCALE,
          route: "/multiple",
          name: dict.meta.multiple.title,
          description: dict.meta.multiple.description,
          breadcrumb: [{ name: dict.modes.items[1].title, route: "/multiple" }],
          homeLabel: dict.nav.home,
        })}
      />
      {/* The view reads ?resume=<id> via useSearchParams, which opts a page
          out of static prerendering unless it sits behind a Suspense
          boundary. The fallback is null because the view hydrates instantly
          from localStorage — a skeleton would flash for no reason. */}
      <Suspense fallback={null}>
        <MultipleReceiptView />
      </Suspense>
    </>
  );
}
