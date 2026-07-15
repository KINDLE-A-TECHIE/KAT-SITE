import type { ReactNode } from "react";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";

export function LegalLayout({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-x-clip bg-[var(--kat-paper)]">
      <LandingHeader />
      <main className="kat-page py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-10 border-l-2 border-[var(--kat-clay)] pl-5">
            <p className="kat-eyebrow">{eyebrow}</p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[var(--kat-ink)] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-[var(--kat-muted)]">
              Last updated: {updated}
            </p>
          </div>

          {/* Body */}
          <div className="prose max-w-none font-body prose-headings:font-display prose-headings:font-semibold prose-headings:text-[var(--kat-ink)] prose-p:text-[var(--kat-muted)] prose-li:text-[var(--kat-muted)] prose-a:text-[var(--kat-clay)] prose-a:no-underline hover:prose-a:underline">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
