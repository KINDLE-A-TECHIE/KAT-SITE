import type { ReactNode } from "react";

type PageHeaderProps = {
  badge: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function PageHeader({ badge, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-2xl bg-kat-dark px-6 py-7 text-white print:hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-12 left-8 h-40 w-40 rounded-full bg-orange-600/10 blur-2xl" />
      </div>
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-100">
            {badge}
          </span>
          <h1 className="mt-3 [font-family:var(--font-space-grotesk)] text-2xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-stone-300">{subtitle}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
