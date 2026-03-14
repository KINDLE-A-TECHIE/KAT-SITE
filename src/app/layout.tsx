import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAT Academy - Tech Education for Kids and Teens",
  description:
    "KAT helps kids and teens learn coding through guided lessons, projects, mentorship, and live group or 1-on-1 classes.",
  manifest: "/manifest.webmanifest",
  applicationName: "KAT Academy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KAT Academy",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/kindle-a-techie.svg", type: "image/svg+xml" }],
    apple: [{ url: "/kindle-a-techie.svg", type: "image/svg+xml" }],
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
