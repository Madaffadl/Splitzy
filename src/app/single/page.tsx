import { Suspense } from "react";
import type { Metadata } from "next";
import { SingleSplitView } from "@/components/pages/SingleSplitView";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { singleUrlPageMetadata } from "@/lib/seo/metadata";
import { webPageGraph } from "@/lib/seo/structured-data";

// Thin server wrapper around the client tool view.
//
// The interactive splitter has to be a Client Component, and a Client Component
// cannot export `metadata`. Before this split, /single inherited the root
// layout's title *and* its canonical — which pointed at the homepage, telling
// Google this page was a duplicate not worth indexing. Splitting the route into
// a server page + client view is what makes a per-page title, description, and
// self-referencing canonical possible.

const LOCALE = DEFAULT_LOCALE;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = singleUrlPageMetadata({
  route: "/single",
  title: dict.meta.single.title,
  description: dict.meta.single.description,
});

export default function SinglePage() {
  return (
    <>
      <JsonLd
        data={webPageGraph({
          locale: LOCALE,
          route: "/single",
          name: dict.meta.single.title,
          description: dict.meta.single.description,
          breadcrumb: [{ name: dict.modes.items[0].title, route: "/single" }],
          homeLabel: dict.nav.home,
        })}
      />
      {/* The view reads ?resume=<id> via useSearchParams, which opts a page
          out of static prerendering unless it sits behind a Suspense
          boundary. The fallback is null because the view hydrates instantly
          from localStorage — a skeleton would flash for no reason. */}
      <Suspense fallback={null}>
        <SingleSplitView />
      </Suspense>
    </>
  );
}
