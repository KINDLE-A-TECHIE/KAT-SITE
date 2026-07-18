"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
    >
      Print / Save PDF
    </button>
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  );
}
