import type { Metadata, Viewport } from "next";
import { Mona_Sans } from "next/font/google";

import "./globals.css";
import ThemedToaster from "@/components/ThemedToaster";
import { NO_FLASH_SCRIPT } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "Practice job interviews with an adaptive AI interviewer. Voice interviews, live coding rounds, résumé-based questions and instant, detailed feedback — free.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PrepWise — AI Mock Interview Practice",
    template: "%s · PrepWise",
  },
  description: DESCRIPTION,
  applicationName: "PrepWise",
  keywords: [
    "mock interview",
    "AI interview practice",
    "technical interview",
    "coding interview",
    "interview feedback",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "PrepWise",
    title: "PrepWise — AI Mock Interview Practice",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "PrepWise — AI Mock Interview Practice",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme class is set by NO_FLASH_SCRIPT before paint, so the server
    // markup can't match it — hence suppressHydrationWarning on <html> only.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className={`${monaSans.className} antialiased`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}

        <ThemedToaster />
      </body>
    </html>
  );
}
