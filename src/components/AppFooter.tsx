import Link from "next/link";
import { Mail } from "@/components/ui/icons";
import { BRAND, copyrightYear } from "@/lib/brand";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";

// Shared footer used across the single, trip, and history pages. Keep all
// links and styling in one place — the previous copy-paste in three pages
// drifted independently and was a maintenance hazard.
//
// Personal contact channels (Gmail/Instagram/WhatsApp) were removed in favour
// of product-owned links: legal pages + a support address (audit T-03).
export function AppFooter() {
  return (
    <footer className="px-6 py-4 border-t bg-card/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-xs font-medium text-muted-foreground">
            © {copyrightYear()} {BRAND.name}
          </span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {/* The language control for anyone already inside a split. The tool
              headers have 50-78px of slack at 375px — /multiple would keep 6px
              after a 44px button — so it lives here rather than up there. */}
          <LocaleSwitcher className="-my-1" />
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            aria-label="Contact support"
          >
            <Mail className="h-3 w-3" />
            <span>Support</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
