import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/ui/Logo";

// Shared chrome for the /privacy and /terms pages so both stay visually
// consistent and pick up future header/footer tweaks in one place.
export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-6 py-4 glass sticky top-0 z-50 border-b">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Logo size="md" />
            <span className="font-bold text-lg tracking-tight">{BRAND.name}</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to home</span>
          </Link>
        </div>
      </header>

      <article className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: {lastUpdated}
        </p>
        <div className="space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-3 [&_h2]:mt-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </div>
      </article>
    </main>
  );
}
