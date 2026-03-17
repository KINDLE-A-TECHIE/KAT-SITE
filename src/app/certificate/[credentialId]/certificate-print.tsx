"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Trophy, Star, ShieldCheck } from "lucide-react";

type Props = {
  recipientName: string;
  programName: string;
  programLevel: string;
  issuedBy: string;
  issuedAt: string;
  credentialId: string;
};

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  Beginner:     { label: "Beginner",     color: "#16a34a", bg: "#dcfce7", ring: "#86efac" },
  Intermediate: { label: "Intermediate", color: "#0369a1", bg: "#e0f2fe", ring: "#7dd3fc" },
  Advanced:     { label: "Advanced",     color: "#7c3aed", bg: "#f3e8ff", ring: "#c4b5fd" },
  Fellowship:   { label: "Fellowship",   color: "#b45309", bg: "#fef3c7", ring: "#fcd34d" },
};

export function CertificatePrint({
  recipientName,
  programName,
  programLevel,
  issuedBy,
  issuedAt,
  credentialId,
}: Props) {
  const date = new Date(issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const router = useRouter();
  const level = LEVEL_CONFIG[programLevel] ?? LEVEL_CONFIG["Advanced"];

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/certificate/${credentialId}`
      : `/certificate/${credentialId}`;

  return (
    <>
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          /* Hide toolbar only — keep cert-bg so cert-root stays visible */
          #no-print { display: none !important; }
          /* Strip the grey wrapper without hiding it */
          #cert-bg {
            background: white !important;
            padding: 0 !important;
            min-height: unset !important;
            display: block !important;
          }
          #cert-root {
            width: 297mm !important;
            height: 210mm !important;
            max-width: none !important;
            aspect-ratio: unset !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            position: relative !important;
          }
          /* Force backgrounds and colours to print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── Toolbar (hidden on print) ─────────────────────────── */}
      <div
        id="no-print"
        className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Image src="/kindle-a-techie.svg" alt="KAT Learning" width={28} height={28} />
            <span className="text-sm font-semibold text-slate-800">KAT Learning</span>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-[#0D1F45] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#162d5e]"
        >
          <Printer className="size-4" />
          Print / Save PDF
        </button>
      </div>

      {/* ── Gray page background (hidden on print) ────────────── */}
      <div
        id="cert-bg"
        className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-slate-100 p-6"
      >

        {/* ── Certificate card ──────────────────────────────────── */}
        <div
          id="cert-root"
          className="relative w-full max-w-[900px] overflow-hidden bg-white shadow-2xl"
          style={{ aspectRatio: "297 / 210" }}
        >

          {/* ══ Background decoration ══════════════════════════════ */}
          {/* Subtle dot-grid watermark */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#0D1F45" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {/* Top-left radial glow */}
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(13,31,69,0.10) 0%, transparent 70%)" }} />
          {/* Bottom-right radial glow */}
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)" }} />

          {/* ══ Gold outer + navy inner border frames ══════════════ */}
          <div className="pointer-events-none absolute inset-2 border-2 border-[#c9a84c]/60" />
          <div className="pointer-events-none absolute inset-[10px] border border-[#0D1F45]/15" />

          {/* ══ Corner star ornaments ═══════════════════════════════ */}
          {[
            "absolute top-4 left-4",
            "absolute top-4 right-4 rotate-90",
            "absolute bottom-4 left-4 -rotate-90",
            "absolute bottom-4 right-4 rotate-180",
          ].map((pos, i) => (
            <div key={i} className={`pointer-events-none ${pos}`}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 0 L10.5 7.5 L18 9 L10.5 10.5 L9 18 L7.5 10.5 L0 9 L7.5 7.5 Z"
                  fill="#c9a84c" opacity="0.7" />
              </svg>
            </div>
          ))}

          {/* ══ Left column — branding strip ═══════════════════════ */}
          <div
            className="absolute inset-y-0 left-0 flex w-[23%] flex-col items-center justify-between py-8"
            style={{ background: "linear-gradient(180deg, #0D1F45 0%, #132B5E 100%)" }}
          >
            {/* Logo on white pill */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center rounded-xl bg-white p-2 shadow-md">
                <Image src="/kindle-a-techie.svg" alt="KAT Learning" width={40} height={40} />
              </div>
              <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-200">
                KAT Learning
              </p>
              <p className="text-[8px] text-blue-300/60">by Kindle a Techie</p>
            </div>

            {/* Trophy medallion */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #d97706 100%)",
                  boxShadow: "0 0 20px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
              >
                <Trophy className="size-8 text-amber-900" strokeWidth={1.5} />
              </div>
              {/* Level badge */}
              <div
                className="rounded-full px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: level.bg, color: level.color, border: `1px solid ${level.ring}` }}
              >
                {level.label}
              </div>
            </div>

            {/* Stars row */}
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-3 fill-[#c9a84c] text-[#c9a84c]" />
              ))}
            </div>
          </div>

          {/* ══ Main content area ══════════════════════════════════ */}
          <div className="absolute inset-y-0 left-[23%] right-0 flex flex-col items-center justify-center px-10 text-center">

            {/* Title */}
            <div className="flex items-center gap-2">
              <div className="h-px w-8 bg-[#c9a84c]/60" />
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#c9a84c]">
                Certificate of Achievement
              </p>
              <div className="h-px w-8 bg-[#c9a84c]/60" />
            </div>

            {/* "This is to certify that" */}
            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              This is to certify that
            </p>

            {/* Recipient name */}
            <h1
              className="mt-1 leading-tight text-[#0D1F45]"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(1.4rem, 3vw, 2.4rem)",
                fontWeight: 400,
              }}
            >
              {recipientName}
            </h1>

            {/* Gold divider */}
            <div className="my-3 flex items-center gap-2 w-40">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #c9a84c)" }} />
              <Star className="size-2.5 fill-[#c9a84c] text-[#c9a84c]" />
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, #c9a84c)" }} />
            </div>

            {/* Completion text */}
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
              has successfully completed
            </p>

            {/* Programme name */}
            <h2
              className="mt-1 font-bold text-[#0D1F45]"
              style={{ fontSize: "clamp(0.85rem, 1.8vw, 1.15rem)" }}
            >
              {programName}
            </h2>

            {/* Bottom row — date, verified seal, issuer */}
            <div className="mt-5 flex w-full items-end justify-between">
              <div className="text-left">
                <div className="mb-1 w-28 border-b border-slate-300" />
                <p className="text-[9px] uppercase tracking-widest text-slate-400">Date issued</p>
                <p className="text-[11px] font-medium text-slate-700">{date}</p>
              </div>

              {/* Verified seal */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #e0f2fe, #bfdbfe)",
                    border: "2px solid #0D1F45",
                    boxShadow: "0 0 10px rgba(13,31,69,0.15)",
                  }}
                >
                  <ShieldCheck className="size-5 text-[#0D1F45]" strokeWidth={1.5} />
                </div>
                <p className="text-[8px] uppercase tracking-wider text-slate-400">Verified</p>
              </div>

              <div className="text-right">
                <div className="mb-1 ml-auto w-28 border-b border-slate-300" />
                <p className="text-[9px] uppercase tracking-widest text-slate-400">Authorised by</p>
                <p className="text-[11px] font-medium text-slate-700">{issuedBy}</p>
              </div>
            </div>

            {/* Credential footer */}
            <div className="mt-3 flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-1">
              <p className="text-[8px] uppercase tracking-widest text-slate-400">ID</p>
              <p className="font-mono text-[8.5px] text-slate-500">{credentialId}</p>
              <span className="text-slate-300">·</span>
              <p className="text-[8px] text-slate-400 truncate max-w-[200px]">{verifyUrl}</p>
            </div>
          </div>

        </div>
        {/* end cert-root */}
      </div>
      {/* end cert-bg */}
    </>
  );
}
