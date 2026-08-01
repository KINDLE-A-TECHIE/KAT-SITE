import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KAT for Schools",
  description: "NERDC-aligned coding & robotics, delivered by your own teachers.",
};

/**
 * The (school) group's shared layout is intentionally BARE. The embed iframe surface
 * ((school)/embed/*) and the redirect-only /home must render with NO chrome, a sidebar in a school's
 * third-party iframe would be wrong. The dashboard chrome lives one level down in
 * (school)/(app)/layout.tsx, scoped to /admin, /teach, /learn only.
 */
export default function SchoolRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
