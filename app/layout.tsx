import type { Metadata, Viewport } from "next";
import { Mona_Sans } from "next/font/google";

import "./globals.css";
import { Toaster } from "sonner";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://mock-ai-prep.vercel.app";
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
    images: [{ url: "/robot.png", alt: "PrepWise AI interviewer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PrepWise — AI Mock Interview Practice",
    description: DESCRIPTION,
    images: ["/robot.png"],
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#08090D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${monaSans.className} antialiased pattern`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}

        <Toaster theme="dark" richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
