import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isEnabled } from "@/lib/flags";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Splitzy",
};

// Server gate (audit Sprint 3): dark until NEXT_PUBLIC_FLAG_DASHBOARD is on.
export default function DashboardPage() {
  if (!isEnabled("dashboard")) notFound();
  return <DashboardClient />;
}
