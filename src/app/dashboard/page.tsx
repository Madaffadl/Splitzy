import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  // Per-user surface: nothing here is public content, and to a crawler it is a
  // thin auth shell. Kept crawlable (not robots.txt-disallowed) so Google can
  // actually read this directive.
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
