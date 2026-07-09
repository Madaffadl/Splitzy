import Link from "next/link";
import { ArrowLeft, Calculator, AlertCircle, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseSharedSummaryPayload } from "@/lib/shared-summary";
import { SummaryPanel, MultipleReceiptSummaryPanel } from "@/components/SummaryPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppFooter } from "@/components/AppFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// User data, looked up per-request — never statically cached.
export const dynamic = "force-dynamic";

// Kept outside the component so the time-based expiry check isn't subject to
// the react-hooks purity rule (Date.now in render). Returns the parsed snapshot
// or flags why it's unavailable.
async function loadSharedSummary(code: string) {
  const record = code
    ? await prisma.sharedSummary.findUnique({ where: { code } })
    : null;
  if (!record) return { record: null, payload: null, expired: false };

  const expired = record.expiresAt.getTime() < Date.now();
  const payload = expired ? null : parseSharedSummaryPayload(record.payload);
  return { record, payload, expired };
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-3 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden sm:inline">Splitzy home</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/25">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm sm:text-base">Shared split</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-grow w-full">
        {children}
      </div>

      <AppFooter />
    </main>
  );
}

export default async function SharedSplitPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { record, payload, expired } = await loadSharedSummary(code);

  if (!payload) {
    return (
      <PageShell>
        <Card className="border-destructive/30">
          <CardContent className="py-12 text-center space-y-3">
            {expired ? (
              <Clock className="h-10 w-10 text-amber-500 mx-auto" />
            ) : (
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            )}
            <p className="font-semibold">
              {expired
                ? "This share link has expired."
                : "This share link is invalid or no longer exists."}
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ask whoever sent it to share a fresh link, or start your own split.
            </p>
            <Link href="/">
              <Button className="mt-2">Go to Splitzy</Button>
            </Link>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const expiresOn = record!.expiresAt.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <PageShell>
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">
            {payload.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only view. Anyone with this link can see the breakdown. Link
            expires {expiresOn}.
          </p>
        </div>

        {payload.type === "single" ? (
          <SummaryPanel
            receipt={payload.receipts[0]}
            participants={payload.participants}
            title={payload.title}
            readOnly
          />
        ) : (
          <MultipleReceiptSummaryPanel
            receipts={payload.receipts}
            participants={payload.participants}
            splitName={payload.title}
            splitId={code}
            budget={payload.budget}
            readOnly
          />
        )}
      </div>
    </PageShell>
  );
}
