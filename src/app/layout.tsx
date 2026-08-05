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
import { BRAND } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"] });

const TITLE = "Splitzy — Split Bills With Friends";
const DESCRIPTION =
  "Split dining or trip expenses fairly with friends. Calculate who owes what with minimal transactions.";

export const metadata: Metadata = {
  // metadataBase lets Next resolve relative OG/canonical URLs to absolute ones.
  metadataBase: new URL(BRAND.siteUrl),
  title: {
    default: TITLE,
    // Page-level titles render as "Pricing · Splitzy", etc.
    template: "%s · Splitzy",
  },
  description: DESCRIPTION,
  applicationName: "Splitzy",
  keywords: [
    "split bill",
    "bill splitter",
    "split expenses",
    "patungan",
    "bagi tagihan",
    "travel expenses",
    "who owes what",
    "receipt scanner",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    url: BRAND.siteUrl,
    siteName: "Splitzy",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/logo.png", width: 1920, height: 2194, alt: "Splitzy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
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
  return (
    <html lang="en" suppressHydrationWarning>
      {supabaseOrigin && (
        <>
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={supabaseOrigin} />
        </>
      )}
      <body className={inter.className}>
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