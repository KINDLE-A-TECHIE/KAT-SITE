import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

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
      // iOS "Add to Home Screen" icon — must be PNG, 180×180
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#132B5E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
