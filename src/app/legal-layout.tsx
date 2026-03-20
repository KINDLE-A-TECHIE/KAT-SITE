import type { CSSProperties, ReactNode } from "react";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";
import { DESIGN_TOKENS } from "@/components/marketing/landing-tokens";

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
    <div style={DESIGN_TOKENS as CSSProperties} className="relative overflow-x-clip bg-[var(--kat-bg)]">
      <LandingHeader />
      <main className="kat-page py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--kat-primary-blue)]">
              {eyebrow}
            </p>
            <h1 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-[var(--kat-text-secondary)]">
              Last updated: {updated}
            </p>
          </div>

          {/* Body */}
          <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-headings:[font-family:var(--font-space-grotesk)] prose-headings:text-[var(--kat-text-primary)] prose-p:text-[var(--kat-text-secondary)] prose-li:text-[var(--kat-text-secondary)] prose-a:text-[var(--kat-primary-blue)] prose-a:no-underline hover:prose-a:underline">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
