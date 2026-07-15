"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS, STAMP_CTA_SM } from "../landing-tokens";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--kat-border)] bg-[var(--kat-paper)]/90 backdrop-blur-xl">
      <div className="kat-page flex h-[4.25rem] items-center justify-between">
        <Link href="/" className="kat-focus-ring flex items-center gap-2.5 rounded">
          <Image
            src="/kindle-a-techie.svg"
            alt="KAT logo"
            width={52}
            height={52}
            className="shrink-0"
            priority
          />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight text-[var(--kat-ink)]">
            kindle <span className="text-[var(--kat-clay)]">a techie</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="kat-focus-ring rounded text-sm font-medium text-[var(--kat-muted)] transition-colors hover:text-[var(--kat-clay)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className="kat-focus-ring rounded text-sm font-semibold text-[var(--kat-ink)] hover:text-[var(--kat-clay)]"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className={STAMP_CTA_SM}>
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        <button
          type="button"
          className="kat-focus-ring inline-flex size-10 items-center justify-center rounded-lg border border-[var(--kat-border)] text-[var(--kat-ink)] lg:hidden"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      <div
        id="mobile-nav"
        className={`border-t border-[var(--kat-border)] bg-[var(--kat-paper)] transition-all duration-200 ease-in-out lg:hidden ${
          mobileMenuOpen ? "max-h-[600px] opacity-100" : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="kat-page flex flex-col gap-1 py-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--kat-muted)] hover:bg-[var(--kat-raised)] hover:text-[var(--kat-clay)]"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 pt-1">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-lg border-[var(--kat-border)] text-[var(--kat-ink)]"
            >
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                Sign in
              </Link>
            </Button>
            <Button asChild size="sm" className={STAMP_CTA_SM}>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                Join now
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-[4.25rem] z-[-1] bg-[var(--kat-ink)]/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
