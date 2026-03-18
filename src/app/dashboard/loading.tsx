export default function DashboardLoading() {
  return (
    <div className="flex min-h-[80vh] animate-pulse flex-col gap-6 p-6">
      {/* Page title */}
      <div className="h-7 w-44 rounded-lg bg-slate-200 dark:bg-slate-800" />

      {/* Stat cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>

      {/* Main content block */}
      <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800" />

      {/* Secondary row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
