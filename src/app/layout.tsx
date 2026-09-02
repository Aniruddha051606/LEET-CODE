import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { Navbar } from "@/components/navbar";
import { themeInitScript } from "@/components/theme-toggle";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Campus LeetCode Challenge",
    template: "%s | Campus LeetCode Challenge",
  },
  description:
    "A four-month, college-wide LeetCode challenge. Register once with your LeetCode username and your progress is tracked automatically.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#08080b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        {/* Applies the stored theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-foreground"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Statistics are read from public LeetCode profiles and refreshed automatically. This site is
          not affiliated with LeetCode.
        </p>
        <div className="flex gap-4">
          <Link href="/leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/challenge" className="hover:text-foreground">
            Challenge
          </Link>
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
