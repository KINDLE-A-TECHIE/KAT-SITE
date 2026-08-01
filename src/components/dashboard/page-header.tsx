import type { ReactNode } from "react";

type PageHeaderProps = {
  badge: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
};

/**
 * Shared dashboard page header. Flat and typographic: mono kicker, display
 * title, serif sub-line, one hairline rule. Matches the overview header in
 * src/app/dashboard/page.tsx (the old dark blob banner is retired).
 */
export function PageHeader({ badge, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5 dark:border-stone-800 print:hidden">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-orange-700 dark:text-orange-500">
          {badge}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          {title}
        </h1>
        <p className="mt-1.5 max-w-xl font-body text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {subtitle}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
