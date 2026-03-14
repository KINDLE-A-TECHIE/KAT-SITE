"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAQ_ITEMS } from "../landing-tokens";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="kat-page kat-defer pb-16 sm:pb-20">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kat-primary-blue)]">FAQ</p>
        <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-4xl">
          Common questions from parents
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[var(--kat-text-secondary)]">
          Everything you need to know before enrolling your child.
        </p>
      </div>

      <div className="mx-auto max-w-3xl divide-y divide-[var(--kat-border)] rounded-2xl border border-[var(--kat-border)] bg-white shadow-[0_4px_24px_-8px_rgba(19,43,94,0.08)]">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-[var(--kat-text-primary)] sm:text-base">
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-[var(--kat-text-secondary)] transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed text-[var(--kat-text-secondary)]">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-[var(--kat-text-secondary)]">
        Still have questions?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--kat-primary-blue)] hover:underline"
        >
          Sign in and message us
        </Link>
        .
      </p>
    </section>
  );
}
