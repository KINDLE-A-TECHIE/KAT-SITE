import Link from "next/link";
import Image from "next/image";
import { NAV_ITEMS } from "../landing-tokens";

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--kat-border)] bg-white">
      <div className="kat-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <div className="flex items-center gap-3">
          <Image src="/kindle-a-techie.svg" alt="KAT logo" width={40} height={40} className="shrink-0" />
          <span className="text-xs text-[var(--kat-text-secondary)]">
            © {new Date().getFullYear()} Kindle a Techie
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-[var(--kat-text-secondary)]">
          <Link href="/login" className="transition-colors hover:text-[var(--kat-primary-blue)]">Sign In</Link>
          <Link href="/register" className="transition-colors hover:text-[var(--kat-primary-blue)]">Register</Link>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[var(--kat-primary-blue)]">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
