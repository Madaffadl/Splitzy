import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Splitzy - Split Tagihan dengan Teman",
  description: "Split tagihan untuk makan bersama atau trip dengan mudah. Hitung siapa yang harus bayar berapa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          {children}
        </div>
      </body>
    </html>
  );
}
