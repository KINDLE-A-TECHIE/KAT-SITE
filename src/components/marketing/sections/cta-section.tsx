import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="kat-page kat-defer pb-20">
      <div
        className="relative overflow-hidden rounded-3xl p-8 text-white sm:p-12"
        style={{ background: "linear-gradient(135deg, #0D1F45 0%, #132B5E 45%, #1E5FAF 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--kat-accent-sky)] opacity-10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[var(--kat-primary-blue)] opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/4 h-32 w-32 rounded-full bg-white opacity-5 blur-2xl" />

        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <Badge className="mb-5 border-0 bg-white/10 text-blue-200 hover:bg-white/10">
            <Sparkles className="mr-1.5 size-3" />
            Ready to start?
          </Badge>
          <h2 className="[font-family:var(--font-space-grotesk)] text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.8rem]">
            Give your child a future in tech.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-blue-200">
            From first lines of code to real projects and leadership opportunities — KAT helps kids
            and teens grow with confidence and community.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-white px-8 font-semibold text-[var(--kat-primary-blue)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:bg-slate-100"
            >
              <Link href="/register">Enroll Your Child</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl border-white/20 text-white hover:bg-white/10"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <Link href="/login">Sign In to Dashboard</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-blue-300">
            Parent-managed enrollment · 3 age-based tracks · Live mentors
          </p>
        </div>
      </div>
    </section>
  );
}
