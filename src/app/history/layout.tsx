import type { Metadata } from "next";

// Receipt history is per-user data. The page itself is a Client Component and so
// cannot export `metadata`, hence this thin server layout — it also covers
// /history/[id]. Noindex (rather than a robots.txt disallow) so Google can read
// the directive and drop the URLs properly.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
