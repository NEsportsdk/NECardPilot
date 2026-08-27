import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";

import MobileNavigation from "@/components/app/MobileNavigation";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vallective.com"),
  applicationName: "Vallective",
  title: {
    default: "Vallective",
    template: "%s | Vallective",
  },
  description:
    "Saml, forstå og udvikl din kortportefølje med scanning, markedsdata, grading og Cardshow-værktøjer.",
  openGraph: {
    title: "Vallective",
    description: "Collect what matters. Know what it's worth.",
    url: "https://vallective.com",
    siteName: "Vallective",
    locale: "da_DK",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vallective",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#07090d",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Suspense fallback={null}>
          <MobileNavigation />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
