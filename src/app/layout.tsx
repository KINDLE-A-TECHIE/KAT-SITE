import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

/*
 * The type system, self-hosted. These are the variable woff2 files in ./fonts, loaded via
 * next/font/local so there is NO build-time fetch to Google Fonts (it was timing out on slow
 * networks and silently falling back to Segoe/Arial). next/font still emits the --font-* vars
 * that globals.css and tailwind.config.js consume.
 *
 * display=swap on all three: text paints immediately in the fallback rather than blocking on
 * the webfont. To refresh a face, re-download its variable woff2 (latin subset) into ./fonts.
 */
const bricolage = localFont({
  src: "./fonts/bricolage.woff2",
  display: "swap",
  variable: "--font-bricolage",
  weight: "200 800",
});

const fraunces = localFont({
  src: "./fonts/fraunces.woff2",
  display: "swap",
  variable: "--font-fraunces",
  weight: "100 900",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains.woff2",
  display: "swap",
  variable: "--font-jetbrains",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "KAT Learning - Tech Education for Kids and Teens",
  description:
    "KAT helps kids and teens learn coding through guided lessons, projects, mentorship, and live group or 1-on-1 classes.",
  manifest: "/manifest.webmanifest",
  applicationName: "KAT Learning",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KAT Learning",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/kindle-a-techie.svg", type: "image/svg+xml" },
    ],
    apple: [
      // iOS "Add to Home Screen" icon, must be PNG, 180×180
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4EEE2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${bricolage.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
