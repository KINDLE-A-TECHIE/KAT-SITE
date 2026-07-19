import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SchoolRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "KAT for Schools",
  description: "NERDC-aligned coding & robotics, delivered by your own teachers.",
};

/**
 * Shell for the (school) route group, the B2B surface served on the school host.
 *
 * Uses the dashboard register (stone surfaces, shadcn primitives, orange-* accents)
 * rather than the flat marketing look, so it reads as an admin tool alongside the
 * other dashboards.
 *
 * No authorization here, each page enforces its own school + role guard
 * (ensureSchoolMembership / ensureSchoolStudent).
 */
export default async function SchoolLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  const memberships = session?.user?.schoolMemberships ?? [];
  const isSchoolAdmin = memberships.some((m) => m.role === SchoolRole.SCHOOL_ADMIN);
  const isTeacher = memberships.some((m) => m.role === SchoolRole.TEACHER);

  const nav = [
    ...(isSchoolAdmin ? [{ href: "/admin", label: "Overview" }] : []), ...(isTeacher ? [{ href: "/teach", label: "Teaching" }] : []), ...(!isSchoolAdmin && !isTeacher ? [{ href: "/learn", label: "Learning" }] : []),
  ];

  // The logo goes straight to the caller's own shell, never to `/`. On this host `/`
  // rewrites to /home, which immediately redirects a signed-in user right back; that
  // server redirect during a client-side navigation trips a Next dev Router bug
  // ("Rendered more hooks than during the previous render") and is a pointless bounce
  // anyway. Same resolution order as the nav above.
  const homeHref = isSchoolAdmin ? "/admin" : isTeacher ? "/teach" : "/learn";

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="kat-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={homeHref} className="flex items-center gap-2.5">
              <Image src="/kindle-a-techie.svg" alt="KAT logo" width={34} height={34} className="shrink-0" />
              <span className="text-[0.95rem] font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                kindle <span className="text-orange-600">a techie</span>
                <span className="ml-2 border-l border-stone-200 pl-2 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-stone-400 dark:border-stone-700">
                  for schools
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-orange-50 hover:text-orange-700 dark:text-stone-300 dark:hover:bg-orange-950/40 dark:hover:text-orange-400"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <SignOutButton className="text-sm font-medium text-stone-500 transition hover:text-orange-600 dark:text-stone-400">
            Sign out
          </SignOutButton>
        </div>
      </header>

      <main className="kat-page py-8">{children}</main>
    </div>
  );
}
