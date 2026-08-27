import { Suspense } from "react";
import type { Metadata } from "next";
import { TravelSpendView } from "@/components/pages/TravelSpendView";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { singleUrlPageMetadata } from "@/lib/seo/metadata";
import { webPageGraph } from "@/lib/seo/structured-data";

// Server wrapper — see src/app/single/page.tsx for why the split exists.

const LOCALE = DEFAULT_LOCALE;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = singleUrlPageMetadata({
  route: "/travel",
  title: dict.meta.travel.title,
  description: dict.meta.travel.description,
});

export default function TravelPage() {
  return (
    <>
      <JsonLd
        data={webPageGraph({
          locale: LOCALE,
          route: "/travel",
          name: dict.meta.travel.title,
          description: dict.meta.travel.description,
          breadcrumb: [{ name: dict.modes.items[2].title, route: "/travel" }],
          homeLabel: dict.nav.home,
        })}
      />
      {/* The view reads ?trip / ?view via useSearchParams, which opts a route
          out of static prerendering unless it sits behind a Suspense boundary —
          exactly as /single and /multiple already do for ?resume. Without this,
          /travel drops from ○ static to ƒ dynamic. The fallback is null because
          the view paints instantly from the local mirror; a skeleton would only
          flash. */}
      <Suspense fallback={null}>
        <TravelSpendView />
      </Suspense>
    </>
  );
}
