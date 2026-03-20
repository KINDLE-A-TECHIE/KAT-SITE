import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RetryButton } from "./retry-button";
import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 ring-8 ring-blue-50/60">
          <WifiOff className="h-9 w-9 text-blue-400" strokeWidth={1.5} />
        </div>

        {/* Text */}
        <h1 className="mt-6 [font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900">
          Looks like you&rsquo;re offline
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
          Your internet connection seems to have gone away. Check your Wi-Fi or mobile data, then
          tap <span className="font-medium text-slate-700">Try Again</span> — you&rsquo;ll be right
          back in class.
        </p>

        {/* Actions */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <RetryButton />
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>

        {/* Tip */}
        <p className="mt-8 text-xs text-slate-400">
          Pages you&rsquo;ve already visited may still be available from cache.
        </p>
      </div>
    </main>
  );
}
