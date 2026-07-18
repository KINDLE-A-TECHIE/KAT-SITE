import type { ReactNode } from "react";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";

export type LegalSection = {
  /** Stable slug used as the anchor id and deep-link target. */
  id: string;
  title: string;
  body: ReactNode;
};

/**
 * Shared shell for the privacy / terms / cookies pages. Pages hand over a list of
 * sections; the layout owns the structure: auto-numbering, anchor ids, the "On this
 * page" table of contents, and back-to-top. Keeping numbering here means it stays
 * consistent across all three pages and never drifts from the content.
 */
export function LegalLayout({
  eyebrow,
  title,
  updated,
  intro,
  sections,
  schoolHost = false,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro?: ReactNode;
  sections: LegalSection[];
  schoolHost?: boolean;
}) {
  const num = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <div className="relative overflow-x-clip bg-[var(--kat-paper)]">
      <LandingHeader />
      <main className="kat-page py-14 sm:py-20">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div id="top" className="mb-12 scroll-mt-28 border-l-2 border-[var(--kat-clay)] pl-5">
            <p className="kat-eyebrow">{eyebrow}</p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[var(--kat-ink)] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-[var(--kat-muted)]">
              Last updated: {updated}
            </p>
          </div>

          <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
            {/* Table of contents */}
            <aside className="mb-12 lg:mb-0">
              <nav aria-label="On this page" className="lg:sticky lg:top-24">
                <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]">
                  On this page
                </p>
                <ol className="space-y-2 border-l border-[var(--kat-ink)]/10">
                  {sections.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="group -ml-px flex gap-2.5 border-l border-transparent py-0.5 pl-4 text-sm leading-snug text-[var(--kat-muted)] no-underline transition-colors hover:border-[var(--kat-clay)] hover:text-[var(--kat-ink)]"
                      >
                        <span className="font-mono text-xs text-[var(--kat-clay)]/60 group-hover:text-[var(--kat-clay)]">
                          {num(i)}
                        </span>
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            {/* Body */}
            <div className="prose max-w-none font-body prose-headings:font-display prose-headings:font-semibold prose-headings:text-[var(--kat-ink)] prose-p:text-[var(--kat-muted)] prose-li:text-[var(--kat-muted)] prose-a:text-[var(--kat-clay)] prose-a:no-underline hover:prose-a:underline">
              {intro ? <div className="not-prose mb-12 text-lg leading-relaxed text-[var(--kat-ink)]/80">{intro}</div> : null}

              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-28 border-t border-[var(--kat-ink)]/10 pt-8 first:border-t-0 first:pt-0">
                  <h2 className="group mt-0 flex items-baseline gap-3">
                    <span className="font-mono text-base font-medium text-[var(--kat-clay)]" aria-hidden>
                      {num(i)}
                    </span>
                    <span className="flex-1">{s.title}</span>
                    <a
                      href={`#${s.id}`}
                      aria-label={`Permalink to ${s.title}`}
                      className="font-mono text-[var(--kat-clay)] no-underline opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    >
                      #
                    </a>
                  </h2>
                  {s.body}
                </section>
              ))}

              <p className="not-prose mt-14 border-t border-[var(--kat-ink)]/10 pt-6 text-sm">
                <a href="#top" className="font-mono text-[var(--kat-clay)] no-underline hover:underline">
                  ↑ Back to top
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter schoolHost={schoolHost} />
    </div>
  );
}
