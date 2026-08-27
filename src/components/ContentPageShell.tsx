import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/ui/Logo";

// Shared chrome for the long-form content pages — /privacy, /terms, /about,
// /faq and their /en counterparts — so they stay visually consistent and pick
// up future header/footer tweaks in one place.
//
// `homeHref` / `backLabel` are parameterised because the bilingual pages need to
// link back to the home page *in their own language* (/en for English), and a
// hardcoded "/" would drop an English visitor into the Indonesian tree.
export function ContentPageShell({
  title,
  lead,
  lastUpdated,
  homeHref = "/",
  backLabel = "Back to home",
  children,
}: {
  title: string;
  lead?: string;
  lastUpdated?: string;
  homeHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-4 glass sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href={homeHref} className="flex items-center gap-2 group">
            <Logo size="md" />
            <span className="font-bold text-lg tracking-tight">{BRAND.name}</span>
          </Link>
          {/* 44px. This was a bare text+icon link about 20px tall — the same
              miss the mode headers had. The logo beside it also goes home, and
              that duplication is fine here in a way it was not in the receipt
              editor: both are unambiguous navigation to the same safe place,
              whereas "Back to split" next to "Cancel" left it unclear whether
              your edits survived. */}
          <Link
            href={homeHref}
            className="touch-manipulation -mr-2 flex min-h-[44px] items-center gap-1.5 px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </Link>
        </div>
      </header>

      <article className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
          {title}
        </h1>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: {lastUpdated}
          </p>
        )}
        {lead && (
          <p className="text-lead text-muted-foreground mb-10 mt-3">{lead}</p>
        )}
        <div className="space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-3 [&_h2]:mt-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </div>
      </article>
    </main>
  );
}
