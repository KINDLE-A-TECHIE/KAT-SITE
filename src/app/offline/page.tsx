import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RetryButton } from "./retry-button";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="kat-page flex min-h-[70vh] items-center py-10">
      <div className="kat-card mx-auto w-full max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Offline Mode</p>
        <h1 className="mt-2 font-[var(--font-space-grotesk)] text-2xl font-semibold text-slate-900">
          You are currently offline
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Check your internet connection and retry. Core pages can still load from cache where available.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
          <RetryButton />
        </div>
      </div>
    </main>
  );
}
