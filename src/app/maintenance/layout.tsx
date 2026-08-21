import type { Metadata } from "next";

// Operational page. Indexing it risks Google showing "Splitzy is under
// maintenance" as the brand result — the worst possible first impression for a
// brand query we're trying to win.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
