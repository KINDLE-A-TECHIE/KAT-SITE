import Link from "next/link";
import Image from "next/image";

const LINKS = {
  Company: [
    { label: "Our Programs", href: "/#tracks" },
    { label: "Pricing", href: "/#pricing" },
    { label: "KAT for Schools", href: "/schools" },
    { label: "Partner with Us", href: "/partners" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contact Us", href: "mailto:support@kindleatechie.com" },
  ],
  Account: [
    { label: "Sign In", href: "/login" },
    { label: "Register as a Parent", href: "/register" },
    { label: "Parent Portal", href: "/dashboard" },
    { label: "Student Portal", href: "/dashboard" },
  ],
};

// Legal links depend on the surface: the school host and /schools/* pages are governed by the
// B2B documents, everyone else by the consumer documents.
const B2C_LEGAL = [
  { label: "Privacy Policy", short: "Privacy", href: "/privacy" },
  { label: "Terms of Service", short: "Terms", href: "/terms" },
  { label: "Cookie Policy", short: "Cookies", href: "/cookies" },
];
const SCHOOL_LEGAL = [
  { label: "School Privacy Notice", short: "Privacy", href: "/schools/privacy" },
  { label: "School Terms", short: "Terms", href: "/schools/terms" },
  { label: "Data Processing Agreement", short: "DPA", href: "/schools/dpa" },
];

const SOCIALS = [
  {
    label: "Twitter / X",
    href: "https://twitter.com/katLearning",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/kindleatechie",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/kindle-a-techie",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@katlearning",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

export function SiteFooter({ schoolHost = false }: { schoolHost?: boolean }) {
  const legal = schoolHost ? SCHOOL_LEGAL : B2C_LEGAL;
  const columns = {
    Company: LINKS.Company,
    Support: legal.map(({ label, href }) => ({ label, href })),
    Account: LINKS.Account,
  };
  return (
    <footer className="border-t border-[var(--kat-border)] bg-[var(--kat-paper)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="kat-focus-ring flex items-center gap-2 rounded">
              <Image src="/kindle-a-techie.svg" alt="KAT logo" width={44} height={44} className="shrink-0" />
              <span className="font-display font-semibold text-[var(--kat-ink)]">
                kindle <span className="text-[var(--kat-clay)]">a techie</span>
              </span>
            </Link>
            <p className="mt-4 font-body text-sm leading-relaxed text-[var(--kat-muted)]">
              Empowering African kids and teens with world-class tech education,
              live mentorship, and real projects.
            </p>
            <a
              href="mailto:support@kindleatechie.com"
              className="kat-focus-ring mt-2 block rounded font-mono text-xs text-[var(--kat-muted)] transition hover:text-[var(--kat-clay)]"
            >
              support@kindleatechie.com
            </a>
            {/* Socials */}
            <div className="mt-5 flex gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="kat-focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--kat-border)] text-[var(--kat-muted)] transition hover:border-[var(--kat-clay)] hover:text-[var(--kat-clay)]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(columns).map(([heading, links]) => (
            <div key={heading}>
              <p className="mb-3 font-mono text-[0.7rem] font-medium uppercase tracking-[0.22em] text-[var(--kat-muted)]">
                {heading}
              </p>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("mailto:") ? (
                      <a
                        href={link.href}
                        className="kat-focus-ring rounded font-body text-sm text-[var(--kat-muted)] transition hover:text-[var(--kat-clay)]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="kat-focus-ring rounded font-body text-sm text-[var(--kat-muted)] transition hover:text-[var(--kat-clay)]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[var(--kat-border)] pt-6 sm:flex-row">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]">
            © {new Date().getFullYear()} Kindle a Techie · kindleatechie.com
          </p>
          <div className="flex gap-4 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]">
            {legal.map((l) => (
              <Link key={l.href} href={l.href} className="kat-focus-ring rounded hover:text-[var(--kat-clay)]">{l.short}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
