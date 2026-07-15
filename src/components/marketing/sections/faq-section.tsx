"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { FAQ_ITEMS } from "../landing-tokens";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="kat-page kat-defer py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="border-l-2 border-[var(--kat-clay)] pl-5 lg:sticky lg:top-28 lg:self-start">
          <p className="kat-eyebrow">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-4xl">
            Questions parents always ask.
          </h2>
          <p className="mt-4 font-body leading-relaxed text-[var(--kat-muted)]">
            Still stuck?{" "}
            <a
              href="mailto:hello@kindleatechie.com"
              className="kat-focus-ring rounded font-semibold text-[var(--kat-clay)] underline underline-offset-4"
            >
              hello@kindleatechie.com
            </a>
          </p>
        </div>

        <div className="border-t border-[var(--kat-border)]">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="border-b border-[var(--kat-border)]">
                <button
                  type="button"
                  className="kat-focus-ring flex w-full items-start justify-between gap-6 py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base font-semibold text-[var(--kat-ink)]">
                    {item.question}
                  </span>
                  {isOpen ? (
                    <Minus className="mt-0.5 size-4 shrink-0 text-[var(--kat-clay)]" aria-hidden />
                  ) : (
                    <Plus className="mt-0.5 size-4 shrink-0 text-[var(--kat-muted)]" aria-hidden />
                  )}
                </button>
                {isOpen && (
                  <p className="max-w-2xl pb-6 font-body text-sm leading-relaxed text-[var(--kat-muted)]">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
