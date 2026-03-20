"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  CreditCard,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  LineChart,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  UserCircle,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserRoleValue } from "@/lib/enums";
import { NotificationsPopover } from "@/components/dashboard/notifications-popover";

type DashboardShellProps = {
  user: {
    firstName: string;
    lastName: string;
    role: UserRoleValue;
    avatarUrl?: string | null;
  };
  isEnrolled?: boolean;
  children: ReactNode;
};

const CORE_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

const LEARNING_NAV = [
  { href: "/dashboard/assessments", label: "Assessments", icon: BookOpen },
  { href: "/dashboard/meetings", label: "Sessions", icon: Calendar },
  { href: "/dashboard/curriculum", label: "Curriculum", icon: GraduationCap },
  { href: "/dashboard/certificates", label: "Certificates", icon: Award },
];

function getNavItems(role: UserRoleValue, isEnrolled = true) {
  if (role === "STUDENT" && !isEnrolled) {
    return [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
    ];
  }
  switch (role) {
    case "SUPER_ADMIN":
      return [
        ...CORE_NAV,
        ...LEARNING_NAV,
        { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
        { href: "/dashboard/content-review", label: "Content Review", icon: Library },
        { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
        { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
        { href: "/dashboard/fellows/applications", label: "Applications", icon: FileText },
        { href: "/dashboard/cohorts", label: "Cohorts", icon: UsersRound },
        { href: "/dashboard/super-admin-invites", label: "Access", icon: ShieldAlert },
      ];
    case "ADMIN":
      return [
        ...CORE_NAV,
        ...LEARNING_NAV,
        { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
        { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
        { href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
        { href: "/dashboard/fellows/applications", label: "Applications", icon: FileText },
      ];
    case "PARENT":
      return [
        ...CORE_NAV,
        { href: "/dashboard/children", label: "My Children", icon: Users },
        { href: "/dashboard/grades", label: "Children's Grades", icon: Award },
        { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
      ];
    case "STUDENT":
      return [
        ...CORE_NAV,
        ...LEARNING_NAV,
        { href: "/dashboard/badges", label: "Badges", icon: BadgeCheck },
        { href: "/dashboard/grades", label: "My Grades", icon: Award },
        { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
        { href: "/dashboard/transcript", label: "Transcript", icon: ScrollText },
        { href: "/dashboard/fellows/apply", label: "Fellowship", icon: FileText },
      ];
    case "FELLOW":
      return [
        ...CORE_NAV,
        ...LEARNING_NAV,
        { href: "/dashboard/badges", label: "Badges", icon: BadgeCheck },
        { href: "/dashboard/grades", label: "My Grades", icon: Award },
        { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
        { href: "/dashboard/transcript", label: "Transcript", icon: ScrollText },
      ];
    case "INSTRUCTOR":
      return [...CORE_NAV, ...LEARNING_NAV, { href: "/dashboard/projects", label: "Projects", icon: FolderOpen }];
    default:
      return CORE_NAV;
  }
}

const ROLE_LABEL: Record<UserRoleValue, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  FELLOW: "Fellow",
  STUDENT: "Student",
  PARENT: "Parent",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || "KA";
}

function resolveIsDark(): boolean {
  const stored = localStorage.getItem("theme") ?? "light";
  if (stored === "dark") return true;
  if (stored === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return false;
}

export function DashboardShell({ user, isEnrolled = true, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [displayFirstName, setDisplayFirstName] = useState(user.firstName);
  const [displayLastName, setDisplayLastName] = useState(user.lastName);
  const [isDark, setIsDark] = useState(false);
  const navItems = getNavItems(user.role, isEnrolled);
  const initials = getInitials(displayFirstName, displayLastName);

  useEffect(() => {
    setDisplayFirstName(user.firstName);
    setDisplayLastName(user.lastName);
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user.firstName, user.lastName, user.avatarUrl]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch("/api/users/avatar", { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ avatarUrl?: string | null }>) : Promise.reject()))
      .then((p) => { if (active) setAvatarUrl(p.avatarUrl ?? null); })
      .catch(() => {});
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent<{ avatarUrl?: string | null; firstName?: string; lastName?: string }>;
      if (e.detail?.avatarUrl !== undefined) setAvatarUrl(e.detail.avatarUrl ?? null);
      if (e.detail?.firstName) setDisplayFirstName(e.detail.firstName);
      if (e.detail?.lastName) setDisplayLastName(e.detail.lastName);
    };
    window.addEventListener("kat-profile-updated", handler as EventListener);
    return () => window.removeEventListener("kat-profile-updated", handler as EventListener);
  }, []);

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
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]", isDark && "dark")}>
      <div className="kat-page grid grid-cols-1 gap-4 py-4 max-[360px]:gap-3 max-[360px]:py-3 sm:gap-6 sm:py-6 lg:grid-cols-[256px_1fr]">

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 print:hidden">
          {/* Brand — desktop only (top bar serves this role on mobile) */}
          <div className="hidden items-center gap-2.5 border-b border-slate-100 px-4 py-4 dark:border-slate-800 lg:flex">
            <Image src="/kindle-a-techie.svg" alt="KAT logo" width={30} height={30} className="shrink-0" />
            <span className="[font-family:var(--font-space-grotesk)] text-sm font-semibold text-slate-900 dark:text-slate-100">
              KAT Learning
            </span>
          </div>

          {/* User card — desktop only (top bar shows avatar on mobile) */}
          <div className="mx-3 my-3 hidden items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800 lg:flex">
            <Avatar className="size-9 shrink-0 border border-slate-200">
              <AvatarImage src={avatarUrl ?? undefined} alt={`${displayFirstName} ${displayLastName}`} />
              <AvatarFallback className="bg-[#0D1F45] text-[11px] font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {displayFirstName} {displayLastName}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>

          {/* Nav */}
          <div className="relative">
            {/* Gradient fade to hint at horizontal scroll on mobile */}
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-white to-transparent dark:from-slate-900 lg:hidden" />
            <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-3 lg:pt-0">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const active = pathname === item.href;
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
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors max-[360px]:gap-1.5 max-[360px]:px-2.5 max-[360px]:py-1.5 max-[360px]:text-xs",
                        active
                          ? "bg-[#0D1F45] text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-blue-300" : "text-slate-400 dark:text-slate-500")} />
                      <span>{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>
          </div>

          {/* Settings + Sign out — compact row on mobile, stacked on desktop */}
          <div className="flex gap-1 border-t border-slate-100 px-3 py-2 dark:border-slate-800 lg:block lg:space-y-0.5 lg:py-3">
            {(() => {
              const active = pathname === "/dashboard/settings";
              return (
                <Link
                  href="/dashboard/settings"
                  className={cn(
                    "flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:gap-2.5 lg:py-2.5",
                    active
                      ? "bg-[#0D1F45] text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                  )}
                >
                  <Settings className={cn("size-4 shrink-0", active ? "text-blue-300" : "text-slate-400 dark:text-slate-500")} />
                  <span>Settings</span>
                </Link>
              );
            })()}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:w-full lg:gap-2.5 lg:py-2.5"
            >
              <LogOut className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4 max-[360px]:space-y-3">
          {/* Top bar */}
          <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:hidden">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-900 dark:text-slate-100">KAT Learning</span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="text-slate-500 dark:text-slate-400">{ROLE_LABEL[user.role]}</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsPopover />
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 transition hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
              >
                <Avatar className="size-7 border border-slate-200">
                  <AvatarImage src={avatarUrl ?? undefined} alt={`${displayFirstName} ${displayLastName}`} />
                  <AvatarFallback className="bg-[#0D1F45] text-[10px] font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-xs font-medium text-slate-700 sm:inline dark:text-slate-300">{displayFirstName}</span>
              </Link>
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
