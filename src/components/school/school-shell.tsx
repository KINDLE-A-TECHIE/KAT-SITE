"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  BookOpen,
  Code2,
  FileBarChart,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/sign-out-button";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/teachers", label: "Teachers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/billing", label: "Billing & seats", icon: ReceiptText },
  { href: "/admin/api", label: "API keys", icon: KeyRound },
  { href: "/admin/embed", label: "Embed", icon: Code2 },
  { href: "/admin/profile", label: "School profile", icon: Building2 },
];

const TEACHER_NAV: NavItem[] = [{ href: "/teach", label: "Teaching", icon: GraduationCap }];
const PUPIL_NAV: NavItem[] = [{ href: "/learn", label: "Learning", icon: BookOpen }];

function getNav(isSchoolAdmin: boolean, isTeacher: boolean): NavItem[] {
  // A user can be both (an admin who also teaches a class); show both, admin first.
  if (isSchoolAdmin || isTeacher) {
    return [...(isSchoolAdmin ? ADMIN_NAV : []), ...(isTeacher ? TEACHER_NAV : [])];
  }
  return PUPIL_NAV;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w.charAt(0));
  return (letters.join("") || "KA").toUpperCase();
}

function resolveIsDark(): boolean {
  const stored = localStorage.getItem("theme") ?? "light";
  if (stored === "dark") return true;
  if (stored === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return false;
}

export function SchoolShell({
  user,
  schoolName,
  logoUrl,
  isSchoolAdmin,
  isTeacher,
  children,
}: {
  user: { firstName: string; lastName: string };
  schoolName: string;
  logoUrl: string | null;
  isSchoolAdmin: boolean;
  isTeacher: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  const nav = getNav(isSchoolAdmin, isTeacher);
  const roleLabel = isSchoolAdmin ? "School admin" : isTeacher ? "Teacher" : "Pupil";
  const who = [user.firstName, user.lastName].join(" ").trim();
  const initials = initialsFor(schoolName);
  // The logo links to its settings for an admin; for others it is a plain brand mark.
  const homeHref = isSchoolAdmin ? "/admin" : isTeacher ? "/teach" : "/learn";

  // Dark mode is driven by the same `theme` key the rest of the app uses.
  useEffect(() => {
    function apply() {
      const dark = resolveIsDark();
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    }
    apply();
    const onTheme = () => apply();
    const onStorage = (e: StorageEvent) => { if (e.key === "theme") apply(); };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("kat-theme-changed", onTheme);
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", onTheme);
    return () => {
      window.removeEventListener("kat-theme-changed", onTheme);
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", onTheme);
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && href !== "/teach" && href !== "/learn" && pathname.startsWith(href + "/"));

  const logo = (
    <Avatar className="size-9 shrink-0 rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
      {/* A logo can be any shape, contain it so a wordmark or wide crest is not cropped. */}
      <AvatarImage src={logoUrl ?? undefined} alt={`${schoolName} logo`} className="object-contain" />
      <AvatarFallback className="rounded-lg bg-kat-dark text-[11px] font-bold text-white">{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]", isDark && "dark")}>
      <div className="kat-page grid grid-cols-1 gap-4 py-4 sm:gap-6 sm:py-6 lg:grid-cols-[256px_1fr]">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="h-fit overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900 print:hidden">
          {/* Brand, desktop only */}
          <Link href={homeHref} className="hidden items-center gap-2.5 border-b border-stone-100 px-4 py-4 dark:border-stone-800 lg:flex">
            <Image src="/kindle-a-techie.svg" alt="KAT logo" width={30} height={30} className="shrink-0" />
            <span className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              kindle <span className="text-orange-600">a techie</span>
              <span className="ml-1.5 border-l border-stone-200 pl-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-stone-400 dark:border-stone-700">
                for schools
              </span>
            </span>
          </Link>

          {/* School card: the logo is the school's "profile picture". */}
          <div className="mx-3 my-3 hidden items-center gap-3 rounded-lg bg-stone-50 px-3 py-2.5 dark:bg-stone-800 lg:flex">
            {logo}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{schoolName}</p>
              <p className="truncate text-[11px] text-stone-400 dark:text-stone-500">
                {who ? `${who} · ${roleLabel}` : roleLabel}
              </p>
            </div>
          </div>

          {/* Nav */}
          <div className="relative">
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-14 bg-gradient-to-l from-white to-transparent dark:from-stone-900 lg:hidden" />
            <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-3 lg:pt-0">
              {nav.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <motion.div
                    key={item.href}
                    className="shrink-0 lg:shrink"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-kat-dark text-white"
                          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-orange-300" : "text-stone-400 dark:text-stone-500")} />
                      <span>{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>
          </div>

          {/* Sign out */}
          <div className="flex gap-1 border-t border-stone-100 px-3 py-2 dark:border-stone-800 lg:block lg:py-3">
            <SignOutButton className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200 lg:w-full lg:gap-2.5 lg:py-2.5">
              <LogOut className="size-4 shrink-0 text-stone-400 dark:text-stone-500" />
              <span>Sign out</span>
            </SignOutButton>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <header className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-5 py-3 shadow-sm dark:border-stone-800 dark:bg-stone-900 print:hidden">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-stone-900 dark:text-stone-100">KAT for Schools</span>
              <span className="text-stone-300 dark:text-stone-600">/</span>
              <span className="text-stone-500 dark:text-stone-400">{roleLabel}</span>
            </div>
            {isSchoolAdmin ? (
              <Link href="/admin/profile" className="rounded-full transition hover:opacity-90" title="School profile">
                {logo}
              </Link>
            ) : (
              logo
            )}
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
