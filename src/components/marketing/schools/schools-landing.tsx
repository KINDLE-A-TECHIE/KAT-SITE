"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { STAMP_CTA, STAMP_CTA_SM } from "../landing-tokens";
import {
  COMPLIANCE_POINTS,
  CROSSWALK,
  PILOT_STEPS,
  STRAND_LABELS,
  type CrosswalkRow,
  type Strand,
} from "./schools-content";

/**
 * A restrained reveal-on-scroll wrapper. Respects reduced-motion via framer's
 * useReducedMotion (not just the CSS media query), when reduced, children
 * render statically with no transform or fade.
 */
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function StrandDot({ strand }: { strand: Strand }) {
  const isCoding = strand === "coding";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-2 w-2 shrink-0 ${isCoding ? "bg-[var(--kat-clay)]" : "bg-[var(--kat-pine)]"}`}
        aria-hidden
      />
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[var(--kat-text-2)]">
        {STRAND_LABELS[strand]}
      </span>
    </span>
  );
}

function BadgeCell({ row }: { row: CrosswalkRow }) {
  if (row.badge === "Compulsory core") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-[var(--kat-clay)]/40 bg-[var(--kat-clay)]/[0.07] px-2 py-0.5 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--kat-clay)]">
        <ShieldCheck className="size-3" />
        Compulsory core
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--kat-pine)]">
      <Check className="size-3" />
      {row.badge}
    </span>
  );
}

export function SchoolsLanding() {
  return (
    // Tokens come from :root (globals.css). This page previously carried an inline
    // token object that did not define a single one of the vars below, which is why it
    // rendered colourless.
    <main className="relative min-h-screen overflow-x-clip bg-[var(--kat-paper)] font-serif text-[var(--kat-ink)]">
      {/* Slim, calm header, logo + a single CTA. Denser and quieter than the kid site. */}
      <header className="sticky top-0 z-40 border-b border-[var(--kat-line)] bg-[var(--kat-paper)]/90 backdrop-blur-xl">
        <div className="kat-page flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/kindle-a-techie.svg"
              alt="KAT logo"
              width={40}
              height={40}
              className="shrink-0"
              priority
            />
            <span className="font-display text-[1rem] font-semibold tracking-tight text-[var(--kat-ink)]">
              kindle <span className="text-[var(--kat-clay)]">a techie</span>
              <span className="ml-2 border-l border-[var(--kat-line)] pl-2 font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--kat-text-2)]">
                for schools
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-5">
            {/* Quiet, secondary. The head teacher wants the pilot; their IT contractor wants this. */}
            <Link
              href="/schools/developers"
              className="hidden font-mono text-xs uppercase tracking-[0.14em] text-[var(--kat-text-2)] transition hover:text-[var(--kat-clay)] sm:block"
            >
              Developers
            </Link>
            <Button asChild size="sm" className={STAMP_CTA_SM}>
              <Link href="/partners">Request a pilot</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="kat-page pb-14 pt-16 sm:pt-24">
        <Reveal className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--kat-clay)]">
            // coding &amp; robotics curriculum-in-a-box
          </p>
          <h1 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.06] tracking-tight text-[var(--kat-ink)] sm:text-[3.1rem] lg:text-[3.6rem]">
            NERDC-aligned coding &amp; robotics{" "}
            <span className="text-[var(--kat-clay)]">your own teachers can deliver.</span>
          </h1>
          <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-[var(--kat-text-2)]">
            No specialist to hire, and it runs on the computers you already have. KAT licenses
            a complete, NERDC-mapped Digital Technologies curriculum to your school: lesson plans
            and worksheets for the digital-literacy strand, and a live coding platform for the
            part that&apos;s hard. Your teachers deliver it; your students build real projects.
          </p>
        </Reveal>

        <Reveal className="mt-8" delay={0.08}>
          <ul className="grid max-w-2xl gap-2.5">
            {COMPLIANCE_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--kat-pine)]" />
                <span className="font-serif text-[0.95rem] leading-relaxed text-[var(--kat-ink)]">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3" delay={0.16}>
          <Button
            asChild
            size="lg"
            className={`gap-2 px-7 ${STAMP_CTA}`}
          >
            <Link href="/partners">
              Request a pilot
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Link
            href="#compliance"
            className="kat-focus-ring font-mono text-sm font-medium text-[var(--kat-ink)] underline decoration-[var(--kat-clay)] decoration-2 underline-offset-4 hover:text-[var(--kat-clay)]"
          >
            See the NERDC crosswalk →
          </Link>
        </Reveal>
      </section>

      {/* ── NERDC compliance / crosswalk ───────────────────────────────────── */}
      <section
        id="compliance"
        className="kat-defer scroll-mt-20 border-y border-[var(--kat-line)] bg-white/40 py-16 sm:py-20"
      >
        <div className="kat-page">
          <Reveal className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--kat-clay)]">
              // nerdc compliance
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-[var(--kat-ink)] sm:text-4xl">
              One curriculum, compliant from Primary 1 to SS3
            </h2>
            <p className="mt-4 font-serif text-base leading-relaxed text-[var(--kat-text-2)]">
              The computing strand runs across the whole primary-and-secondary journey under
              three subject names, and at senior secondary, Digital Technologies is one of the
              compulsory core subjects. Here&apos;s how KAT maps onto each level.
            </p>
          </Reveal>

          {/* Legend */}
          <Reveal className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2" delay={0.06}>
            <StrandDot strand="coding" />
            <StrandDot strand="diglit" />
            <span className="font-mono text-[0.68rem] text-[var(--kat-text-2)]">
              Coding routes through the platform; digital literacy ships as teacher-led lessons.
            </span>
          </Reveal>

          {/* Table, scrolls horizontally on small screens, never the page body */}
          <Reveal className="mt-8" delay={0.1}>
            <div className="overflow-x-auto border border-[var(--kat-line)] bg-[var(--kat-paper)]">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--kat-line)] bg-white/50">
                    <th className="px-5 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--kat-text-2)]">
                      Level
                    </th>
                    <th className="px-5 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--kat-text-2)]">
                      NERDC subject
                    </th>
                    <th className="px-5 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--kat-text-2)]">
                      Status
                    </th>
                    <th className="px-5 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--kat-text-2)]">
                      What KAT delivers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CROSSWALK.map((row) => (
                    <tr
                      key={row.level}
                      className={`border-b border-[var(--kat-line)] last:border-b-0 align-top ${
                        row.emphasize ? "bg-[var(--kat-clay)]/[0.04]" : ""
                      }`}
                    >
                      <td className="px-5 py-4 align-top">
                        <span className="font-display text-base font-bold text-[var(--kat-ink)]">
                          {row.level}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          {row.strands.map((s) => (
                            <StrandDot key={s} strand={s} />
                          ))}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top font-serif text-sm text-[var(--kat-ink)]">
                        {row.subject}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <BadgeCell row={row} />
                      </td>
                      <td className="px-5 py-4 align-top font-serif text-sm leading-relaxed text-[var(--kat-text-2)]">
                        {row.covers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal className="mt-5 flex items-start gap-2.5" delay={0.14}>
            <GraduationCap className="mt-0.5 size-4 shrink-0 text-[var(--kat-pine)]" />
            <p className="max-w-3xl font-serif text-sm leading-relaxed text-[var(--kat-text-2)]">
              Assessment is project-based end to end: every stage closes with an SBA capstone,
              at Primary 6, at JSS 3 into the BECE, and a Final-Year project defence at SS3 into
              WASSCE/NECO, all delivered and marked in the same platform.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── How a pilot works ─────────────────────────────────────────────── */}
      <section className="kat-defer bg-[var(--kat-ink)] py-16 sm:py-20">
        <div className="kat-page">
          <Reveal className="mb-12 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--kat-sun)]">
              // how a pilot works
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-[var(--kat-paper)] sm:text-4xl">
              Trial a term before you commit a seat
            </h2>
          </Reveal>

          <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
            {PILOT_STEPS.map((step, i) => (
              <Reveal key={step.step} className="bg-[var(--kat-ink)]" delay={i * 0.08}>
                <div className="h-full p-7">
                  <div className="font-display text-6xl font-bold text-[var(--kat-clay)]">
                    {step.step}
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-[var(--kat-paper)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-serif text-sm leading-relaxed text-white/60">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 flex items-center gap-2.5" delay={0.24}>
            <Users className="size-4 shrink-0 text-[var(--kat-sun)]" />
            <p className="font-mono text-xs text-white/50">
              Licensed per seat, per term. Access unlocks when the term&apos;s invoice is paid.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Primary CTA ───────────────────────────────────────────────────── */}
      <section className="kat-page kat-defer py-16 sm:py-20">
        <Reveal>
          <div className="border-2 border-[var(--kat-ink)] bg-[var(--kat-paper)] p-8 shadow-[10px_10px_0_0_var(--kat-clay)] sm:p-12">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--kat-clay)]">
                // ready when you are
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-4xl">
                Make your school NERDC-compliant, with the teachers you already have.
              </h2>
              <p className="mt-4 font-serif text-base leading-relaxed text-[var(--kat-text-2)]">
                Tell us your levels and student numbers, and we&apos;ll map your classes onto the
                crosswalk and set up a pilot term. No specialist hire, no lab to equip, no long contract.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Button asChild size="lg" className={`gap-2 px-8 ${STAMP_CTA}`}>
                  <Link href="/partners">
                    Request a pilot
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>

                {/* Schools that already run their own pupil-records system ask this first. */}
                <Link
                  href="/schools/developers"
                  className="group inline-flex items-center gap-1.5 font-serif text-sm text-[var(--kat-text-2)] underline decoration-[var(--kat-line)] decoration-2 underline-offset-4 transition hover:text-[var(--kat-clay)] hover:decoration-[var(--kat-clay)]"
                >
                  Already run your own school system? Read the developer docs
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}
