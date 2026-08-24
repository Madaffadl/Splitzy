import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ui/toast";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { RefCapture } from "@/components/referral/RefCapture";
import { JsonLd } from "@/components/seo/JsonLd";
import { BRAND } from "@/lib/brand";
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  OG_LOCALE,
  PREFIXED_LOCALE,
} from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { siteGraph } from "@/lib/seo/structured-data";

const inter = Inter({ subsets: ["latin"] });

// Site-wide defaults, all derived from DEFAULT_LOCALE so that flipping the
// default language re-points the fallback title, description, og:locale and
// <html lang> in one place. Nothing here may hardcode a language.
const DEFAULT_DICT = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  // metadataBase lets Next resolve relative OG/canonical URLs to absolute ones.
  metadataBase: new URL(BRAND.siteUrl),
  title: {
    default: DEFAULT_DICT.meta.home.title,
    // Page-level titles render as "Pricing · Splitzy", etc.
    template: "%s · Splitzy",
  },
  description: DEFAULT_DICT.meta.home.description,
  applicationName: "Splitzy",
  // English terms lead, matching the default locale, but the Indonesian queries
  // stay because Indonesia remains the actual market. Kept short and honest:
  // Google ignores this tag entirely, so it exists for the minor engines that
  // still read it and there is nothing to gain from stuffing it.
  keywords: [
    "splitzy",
    "split bill",
    "bill splitter",
    "split expenses",
    "who owes what",
    "receipt scanner",
    "group trip expenses",
    "aplikasi split bill",
    "bagi tagihan",
    "hitung patungan",
    "patungan",
    "scan struk",
  ],
  // ⚠️ NO site-wide `alternates.canonical` here. Next merges layout metadata
  // into every page, so a canonical set at this level made EVERY page declare
  // the homepage as its canonical URL — an explicit "this page is a duplicate,
  // don't index it" for /single, /pricing, /privacy and the rest. Canonicals
  // must be declared per page; see src/lib/seo/metadata.ts.
  //
  // icon.jpeg is a 512×512 square JPEG (Google requires square, ≥48 px).
  // logo.png (1920×2194 portrait) is still used inside the app but cannot
  // serve as a favicon — Google ignores non-square images and shows a globe.
  icons: {
    icon: "/icon.jpeg",
    apple: "/icon.jpeg",
  },
  openGraph: {
    type: "website",
    siteName: "Splitzy",
    title: DEFAULT_DICT.meta.home.title,
    description: DEFAULT_DICT.meta.home.description,
    locale: OG_LOCALE[DEFAULT_LOCALE],
    alternateLocale: [OG_LOCALE[PREFIXED_LOCALE]],
    // Images come from the app/opengraph-image.tsx file convention (a proper
    // 1200×630 card). Do not set them here — explicit metadata beats the file
    // convention, and the raw logo is a 1920×2194 portrait that every social
    // platform crops badly.
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_DICT.meta.home.title,
    description: DEFAULT_DICT.meta.home.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Allow full-length snippets, large image previews, and video previews —
      // the defaults are conservative and cost us SERP real estate.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the token from Google Search
  // Console ("HTML tag" method) to verify ownership. Until the property is
  // verified we are blind: no index coverage, no query data, no way to submit
  // the sitemap.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport = {
  themeColor: "#3a4a1f",
  width: "device-width",
  initialScale: 1,
};

// Warm up the connection to Supabase (auth/data are fetched from the client on
// first paint) so the TLS handshake overlaps with parsing — a cheap perf win
// (Sprint 4). Next hoists these link tags into <head>.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;
  } catch {
    return null;
  }
})();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The default locale owns the un-prefixed URLs and sets the document language.
  // The prefixed tree marks its own subtree lang (see src/app/id/page.tsx for why
  // that is done on the content wrapper rather than here).
  return (
    <html lang={HTML_LANG[DEFAULT_LOCALE]} suppressHydrationWarning>
      {supabaseOrigin && (
        <>
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={supabaseOrigin} />
        </>
      )}
      <body className={inter.className}>
        {/* Site-wide entity graph (Organization + WebSite + SoftwareApplication).
            Emitted from the layout so every route — including the tool pages —
            carries the same claim on the contested "Splitzy" name. */}
        <JsonLd data={siteGraph(DEFAULT_DICT)} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          {/* ToastProvider wraps AuthProvider so AuthProvider can fire toasts
              (e.g. session-expired notification) via useToast(). */}
          <ToastProvider>
            <AuthProvider>
              {/* Skip link (WCAG 2.4.1): hidden until keyboard-focused. */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
              >
                Skip to content
              </a>
              <RegisterServiceWorker />
              <AnalyticsProvider />
              <OnboardingModal />
              <Suspense fallback={null}>
                <RefCapture />
              </Suspense>
              <div
                id="main-content"
                className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5"
              >
                {children}
              </div>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}