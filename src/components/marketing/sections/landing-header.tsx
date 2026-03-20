"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "../landing-tokens";

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--kat-border)] bg-white/90 backdrop-blur-xl">
      <div className="kat-page flex h-[4.25rem] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/kindle-a-techie.svg"
            alt="KAT logo"
            width={52}
            height={52}
            className="shrink-0"
            priority
          />
          <span className="[font-family:var(--font-space-grotesk)] text-[1.05rem] font-semibold tracking-tight text-[var(--kat-text-primary)]">
            kindle <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--kat-gradient)" }}>a techie</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[var(--kat-text-secondary)] transition-colors hover:text-[var(--kat-primary-blue)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-lg text-[var(--kat-primary-blue)] hover:bg-blue-50"
          >
            <Link href="/login">Sign In</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-lg gap-1.5 text-white shadow-[0_4px_14px_-4px_rgba(30,95,175,0.5)]"
            style={{ background: "var(--kat-gradient)" }}
          >
            <Link href="/register">
              Get Started
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--kat-border)] text-[var(--kat-primary-blue)] md:hidden"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {/* Animated mobile dropdown */}
      <div
        id="mobile-nav"
        className={`border-t border-[var(--kat-border)] bg-white transition-all duration-200 ease-in-out md:hidden ${
          mobileMenuOpen
            ? "max-h-[600px] opacity-100"
            : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="kat-page flex flex-col gap-1 py-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--kat-text-secondary)] hover:bg-slate-50 hover:text-[var(--kat-primary-blue)]"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 pt-1">
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-lg text-white"
              style={{ background: "var(--kat-gradient)" }}
            >
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>Join Now</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Backdrop overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-[4.25rem] z-[-1] bg-black/30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}
