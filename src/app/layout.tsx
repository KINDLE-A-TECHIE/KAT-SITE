import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Bricolage_Grotesque, Fraunces, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/*
 * The type system, actually loaded. Previously globals.css merely NAMED "Manrope" /
 * "Space Grotesk" in a font stack without ever fetching them, so every page silently
 * fell back to Segoe/Arial. next/font self-hosts these and emits the --font-* vars
 * that globals.css and tailwind.config.js consume.
 *
 * display=swap on all three: text paints immediately in the fallback rather than
 * blocking on the webfont.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
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
