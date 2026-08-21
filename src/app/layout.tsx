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
import { DEFAULT_LOCALE, HTML_LANG, OG_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { siteGraph } from "@/lib/seo/structured-data";

const inter = Inter({ subsets: ["latin"] });

// Site-wide defaults. Indonesian is the primary language (see
// src/lib/i18n/config.ts for why), so the fallback title/description are
// Indonesian and og:locale is id_ID with English as the alternate.
const DEFAULT_DICT = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  // metadataBase lets Next resolve relative OG/canonical URLs to absolute ones.
  metadataBase: new URL(BRAND.siteUrl),
  title: {
    default: DEFAULT_DICT.meta.home.title,
    // Page-level titles render as "Harga · Splitzy", etc.
    template: "%s · Splitzy",
  },
  description: DEFAULT_DICT.meta.home.description,
  applicationName: "Splitzy",
  // Indonesian search terms first — these are the queries the target market
  // actually types. Kept short and honest; keyword stuffing is not a ranking
  // factor and a bloated list only dilutes the signal.
  keywords: [
    "splitzy",
    "split bill",
    "aplikasi split bill",
    "bagi tagihan",
    "hitung patungan",
    "patungan",
    "split bill online",
    "scan struk",
    "bagi tagihan makan",
    "catat pengeluaran trip",
    "bill splitter",
    "who owes what",
  ],
  // ⚠️ NO site-wide `alternates.canonical` here. Next merges layout metadata
  // into every page, so a canonical set at this level made EVERY page declare
  // the homepage as its canonical URL — an explicit "this page is a duplicate,
  // don't index it" for /single, /pricing, /privacy and the rest. Canonicals
  // must be declared per page; see src/lib/seo/metadata.ts.
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Splitzy",
    title: DEFAULT_DICT.meta.home.title,
    description: DEFAULT_DICT.meta.home.description,
    locale: OG_LOCALE.id,
    alternateLocale: [OG_LOCALE.en],
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
  // Indonesian is the site's default language and owns the un-prefixed URLs.
  // The /en tree marks its own subtree with lang="en" (see src/app/en/page.tsx
  // for why that is done on the content wrapper rather than here).
  return (
    <html lang={HTML_LANG.id} suppressHydrationWarning>
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