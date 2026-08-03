import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ui/toast";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Splitzy — Split Bills With Friends",
  description: "Split dining or trip expenses fairly with friends. Calculate who owes what with minimal transactions.",
  // icons: {
  //   icon: "/icon.svg",
  //   shortcut: "/icon.svg",
  //   apple: "/icon.svg",
  // },
};

export const viewport = {
  themeColor: "#3a4a1f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
              <RegisterServiceWorker />
              <AnalyticsProvider />
              <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
                {children}
              </div>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}