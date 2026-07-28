"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Printer, ShieldCheck } from "lucide-react";

type Props = {
  recipientName: string;
  programName: string;
  programLevel: string;
  issuedBy: string;
  issuedAt: string;
  credentialId: string;
  initialTheme?: string;
  /** School term certificates feature a few "catchy" completed lesson titles; B2C certs omit this. */
  highlights?: string[];
};

/**
 * Certificate themes. All four draw ONLY from the shipped brand palette
 * (ink, clay, sun, pine, paper, plus the certificate gold that predates this
 * file) and the brand type system (Bricolage display, Fraunces serif,
 * JetBrains mono). Flat surfaces and hairline frames throughout: no glows,
 * no gradients, no ornament soup. "classic" and "midnight" read formal for
 * older learners and employers; "ember" and "sunburst" are the loud ones for
 * kids. The choice travels in ?theme= so a shared or printed link keeps it.
 */

const INK = "#1A1714";
const CLAY = "#B2401D";
const SUN = "#F2B705";
const PINE = "#1F5C4A";
const PAPER = "#F4EEE2";
const GOLD = "#c9a84c";

type Theme = {
  id: string;
  label: string;
  /** Toolbar swatch color. */
  swatch: string;
  card: string;
  /** Outer + inner hairline frame colors. */
  frameOuter: string;
  frameInner: string;
  eyebrow: string;
  smallcaps: string;
  name: string;
  nameFont: string;
  nameWeight: number;
  programText: string;
  rule: string;
  metaText: string;
  metaLabel: string;
  sealBorder: string;
  sealIcon: string;
  chipBg: string;
  chipText: string;
  footerBg: string;
  footerText: string;
  /** Optional flat band across the top (sunburst). */
  topBand?: string;
  /** Optional flat band down the left edge (flame). */
  sideBand?: string;
  logoWell: string;
};

const THEMES: Record<string, Theme> = {
  classic: {
    id: "classic",
    label: "Classic",
    swatch: "#ffffff",
    card: "#ffffff",
    frameOuter: `${GOLD}99`,
    frameInner: `${INK}26`,
    eyebrow: GOLD,
    smallcaps: "#a8a29e",
    name: INK,
    nameFont: "var(--font-body), Georgia, serif",
    nameWeight: 500,
    programText: INK,
    rule: GOLD,
    metaText: "#44403c",
    metaLabel: "#a8a29e",
    sealBorder: PINE,
    sealIcon: PINE,
    chipBg: `${CLAY}14`,
    chipText: CLAY,
    footerBg: "#fafaf9",
    footerText: "#78716c",
    logoWell: "transparent",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    swatch: INK,
    card: INK,
    frameOuter: `${GOLD}80`,
    frameInner: "#ffffff1f",
    eyebrow: SUN,
    smallcaps: "#ffffff73",
    name: PAPER,
    nameFont: "var(--font-display), sans-serif",
    nameWeight: 700,
    programText: "#ffffff",
    rule: GOLD,
    metaText: "#ffffffcc",
    metaLabel: "#ffffff59",
    sealBorder: SUN,
    sealIcon: SUN,
    chipBg: "#ffffff14",
    chipText: SUN,
    footerBg: "#ffffff0d",
    footerText: "#ffffff80",
    logoWell: "#ffffff",
  },
  ember: {
    id: "ember",
    label: "Ember",
    swatch: CLAY,
    card: CLAY,
    frameOuter: `${SUN}b3`,
    frameInner: "#ffffff2e",
    eyebrow: SUN,
    smallcaps: "#ffffff8c",
    name: "#ffffff",
    nameFont: "var(--font-display), sans-serif",
    nameWeight: 800,
    programText: "#ffffff",
    rule: SUN,
    metaText: "#ffffffd9",
    metaLabel: "#ffffff73",
    sealBorder: SUN,
    sealIcon: SUN,
    chipBg: "#ffffff1f",
    chipText: "#ffffff",
    footerBg: "#ffffff14",
    footerText: "#ffffffa6",
    logoWell: "#ffffff",
  },
  sunburst: {
    id: "sunburst",
    label: "Sunburst",
    swatch: SUN,
    card: PAPER,
    frameOuter: `${INK}33`,
    frameInner: `${CLAY}40`,
    eyebrow: CLAY,
    smallcaps: "#8c8378",
    name: CLAY,
    nameFont: "var(--font-display), sans-serif",
    nameWeight: 800,
    programText: INK,
    rule: SUN,
    metaText: "#57534e",
    metaLabel: "#a29a8d",
    sealBorder: PINE,
    sealIcon: PINE,
    chipBg: `${PINE}1a`,
    chipText: PINE,
    footerBg: `${INK}0a`,
    footerText: "#8c8378",
    topBand: SUN,
    logoWell: "transparent",
  },
  forest: {
    id: "forest",
    label: "Forest",
    swatch: PINE,
    card: PINE,
    frameOuter: `${SUN}8c`,
    frameInner: "#ffffff26",
    eyebrow: SUN,
    smallcaps: "#ffffff80",
    name: PAPER,
    nameFont: "var(--font-display), sans-serif",
    nameWeight: 700,
    programText: "#ffffff",
    rule: SUN,
    metaText: "#ffffffcc",
    metaLabel: "#ffffff59",
    sealBorder: SUN,
    sealIcon: SUN,
    chipBg: "#ffffff1a",
    chipText: SUN,
    footerBg: "#ffffff10",
    footerText: "#ffffff8c",
    logoWell: "#ffffff",
  },
  prestige: {
    id: "prestige",
    label: "Prestige",
    swatch: GOLD,
    card: PAPER,
    frameOuter: GOLD,
    frameInner: `${GOLD}59`,
    eyebrow: "#8a6a2f",
    smallcaps: "#8c8378",
    name: INK,
    nameFont: "var(--font-body), Georgia, serif",
    nameWeight: 600,
    programText: "#8a6a2f",
    rule: GOLD,
    metaText: "#57534e",
    metaLabel: "#a29a8d",
    sealBorder: "#8a6a2f",
    sealIcon: "#8a6a2f",
    chipBg: `${GOLD}2b`,
    chipText: "#8a6a2f",
    footerBg: `${INK}0a`,
    footerText: "#8c8378",
    logoWell: "transparent",
  },
  mono: {
    id: "mono",
    label: "Mono",
    swatch: "#57534e",
    card: "#ffffff",
    frameOuter: `${INK}59`,
    frameInner: `${INK}1f`,
    eyebrow: INK,
    smallcaps: "#a8a29e",
    name: INK,
    nameFont: "var(--font-display), sans-serif",
    nameWeight: 700,
    programText: INK,
    rule: INK,
    metaText: "#44403c",
    metaLabel: "#a8a29e",
    sealBorder: INK,
    sealIcon: INK,
    chipBg: `${INK}0f`,
    chipText: INK,
    footerBg: "#fafaf9",
    footerText: "#78716c",
    logoWell: "transparent",
  },
  flame: {
    id: "flame",
    label: "Flame",
    swatch: "#ffffff",
    card: "#ffffff",
    frameOuter: `${CLAY}40`,
    frameInner: `${SUN}59`,
    eyebrow: CLAY,
    smallcaps: "#a8a29e",
    name: INK,
    nameFont: "var(--font-display), sans-serif",
    nameWeight: 800,
    programText: CLAY,
    rule: SUN,
    metaText: "#44403c",
    metaLabel: "#a8a29e",
    sealBorder: CLAY,
    sealIcon: CLAY,
    chipBg: `${SUN}33`,
    chipText: "#8a6a2f",
    footerBg: "#fafaf9",
    footerText: "#78716c",
    sideBand: CLAY,
    logoWell: "transparent",
  },
};

const DEFAULT_THEME = "classic";

/** Level chip labels stay palette-mapped per theme (chip colors come from the theme). */
export function CertificatePrint({
  recipientName,
  programName,
  programLevel,
  issuedBy,
  issuedAt,
  credentialId,
  initialTheme,
  highlights,
}: Props) {
  const date = new Date(issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const router = useRouter();
  const [themeId, setThemeId] = useState(
    initialTheme && THEMES[initialTheme] ? initialTheme : DEFAULT_THEME,
  );
  const t = THEMES[themeId];

  // Resolve the full URL only on the client to avoid hydration mismatch
  const [verifyUrl, setVerifyUrl] = useState(`/certificate/${credentialId}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVerifyUrl(`${window.location.origin}/certificate/${credentialId}`);
  }, [credentialId]);

  const pickTheme = (id: string) => {
    setThemeId(id);
    // Keep the choice in the URL so copy/print/share carries the same look.
    router.replace(`/certificate/${credentialId}?theme=${id}`, { scroll: false });
  };

  const copyLink = async () => {
    const url = `${verifyUrl}?theme=${themeId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          #no-print { display: none !important; }
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
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Toolbar (hidden on print) */}
      <div
        id="no-print"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3 sm:px-6"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push("/")}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Image src="/kindle-a-techie.svg" alt="KAT Learning" width={28} height={28} />
            <span className="hidden text-sm font-semibold text-stone-800 sm:inline">KAT Learning</span>
          </div>
        </div>

        {/* Theme picker */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-stone-200 p-1">
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              onClick={() => pickTheme(theme.id)}
              aria-pressed={themeId === theme.id}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                themeId === theme.id
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full border border-stone-300"
                style={{ backgroundColor: theme.swatch }}
              />
              <span className="hidden sm:inline">{theme.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void copyLink()}
            className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            <span>{copied ? "Copied!" : "Copy Link"}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-kat-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            <Printer className="size-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Mobile tip banner */}
      <div id="no-print" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700 sm:hidden">
        Rotate your phone for the best view, or use <strong>Print / Save PDF</strong> to download.
      </div>

      {/* Page background (hidden on print) */}
      <div
        id="cert-bg"
        className="flex min-h-[calc(100vh-57px)] items-center justify-center overflow-x-auto bg-stone-100 p-4 sm:p-6"
      >
        {/* Certificate card */}
        <div
          id="cert-root"
          className="relative w-full min-w-[480px] max-w-[900px] overflow-hidden shadow-2xl"
          style={{ aspectRatio: "297 / 210", backgroundColor: t.card }}
        >
          {/* Optional flat top band (sunburst) */}
          {t.topBand ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: "6%", backgroundColor: t.topBand }}
            />
          ) : null}

          {/* Optional flat left edge band (flame). Thinner than the frame inset so they never cross. */}
          {t.sideBand ? (
            <div
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{ width: "8px", backgroundColor: t.sideBand }}
            />
          ) : null}

          {/* Double hairline frame */}
          <div className="pointer-events-none absolute inset-3 border" style={{ borderColor: t.frameOuter }} />
          <div className="pointer-events-none absolute inset-[18px] border" style={{ borderColor: t.frameInner }} />

          {/* Corner ticks: flat L-shaped marks, not ornaments */}
          {[
            { pos: "top-[26px] left-[26px]", b: "border-t-2 border-l-2" },
            { pos: "top-[26px] right-[26px]", b: "border-t-2 border-r-2" },
            { pos: "bottom-[26px] left-[26px]", b: "border-b-2 border-l-2" },
            { pos: "bottom-[26px] right-[26px]", b: "border-b-2 border-r-2" },
          ].map(({ pos, b }) => (
            <div
              key={pos}
              className={`pointer-events-none absolute h-4 w-4 ${pos} ${b}`}
              style={{ borderColor: t.rule }}
            />
          ))}

          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-between px-14 py-10 text-center">
            {/* Header: logo + wordmark */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center rounded-lg p-1.5"
                style={{ backgroundColor: t.logoWell }}
              >
                <Image src="/kindle-a-techie.svg" alt="KAT Learning" width={34} height={34} />
              </div>
              <p
                className="font-mono text-[9px] font-medium uppercase tracking-[0.32em]"
                style={{ color: t.eyebrow }}
              >
                Certificate of Achievement
              </p>
            </div>

            {/* Centerpiece */}
            <div className="flex w-full flex-col items-center">
              <p
                className="text-[10px] uppercase tracking-[0.22em]"
                style={{ color: t.smallcaps }}
              >
                This is to certify that
              </p>

              <h1
                className="mt-2 leading-tight"
                style={{
                  color: t.name,
                  fontFamily: t.nameFont,
                  fontWeight: t.nameWeight,
                  fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)",
                  letterSpacing: "-0.01em",
                }}
              >
                {recipientName}
              </h1>

              {/* Single flat rule with a small square, no stars */}
              <div className="my-4 flex w-44 items-center gap-2">
                <div className="h-px flex-1" style={{ backgroundColor: t.rule }} />
                <div className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: t.rule }} />
                <div className="h-px flex-1" style={{ backgroundColor: t.rule }} />
              </div>

              <p
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{ color: t.smallcaps }}
              >
                has successfully completed
              </p>

              <h2
                className="mt-1.5 font-semibold"
                style={{
                  color: t.programText,
                  fontSize: "clamp(0.95rem, 2vw, 1.3rem)",
                }}
              >
                {programName}
              </h2>

              <span
                className="mt-2.5 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                style={{ backgroundColor: t.chipBg, color: t.chipText }}
              >
                {programLevel}
              </span>

              {highlights && highlights.length > 0 ? (
                <p
                  className="mt-3 max-w-[82%] text-[10px] leading-relaxed"
                  style={{ color: t.metaText }}
                >
                  <span
                    className="uppercase tracking-[0.16em]"
                    style={{ color: t.metaLabel }}
                  >
                    Highlights&nbsp;&nbsp;
                  </span>
                  {highlights.join("  ·  ")}
                </p>
              ) : null}
            </div>

            {/* Bottom row: date / seal / issuer */}
            <div className="w-full">
              <div className="flex w-full items-end justify-between">
                <div className="text-left">
                  <div className="mb-1.5 w-32 border-b" style={{ borderColor: `${t.metaLabel}66` }} />
                  <p className="text-[9px] uppercase tracking-[0.18em]" style={{ color: t.metaLabel }}>
                    Date issued
                  </p>
                  <p className="font-mono text-[11px] tabular-nums" style={{ color: t.metaText }}>
                    {date}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2"
                    style={{ borderColor: t.sealBorder }}
                  >
                    <ShieldCheck className="size-5" strokeWidth={1.5} style={{ color: t.sealIcon }} />
                  </div>
                  <p className="text-[8px] uppercase tracking-[0.18em]" style={{ color: t.metaLabel }}>
                    Verified
                  </p>
                </div>

                <div className="text-right">
                  <div className="mb-1.5 ml-auto w-32 border-b" style={{ borderColor: `${t.metaLabel}66` }} />
                  <p className="text-[9px] uppercase tracking-[0.18em]" style={{ color: t.metaLabel }}>
                    Authorised by
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: t.metaText }}>
                    {issuedBy}
                  </p>
                </div>
              </div>

              {/* Credential footer: the trust line */}
              <div
                className="mx-auto mt-4 inline-flex max-w-full items-center gap-1.5 rounded-full px-4 py-1"
                style={{ backgroundColor: t.footerBg }}
              >
                <p className="font-mono text-[8.5px]" style={{ color: t.footerText }}>
                  {credentialId}
                </p>
                <span style={{ color: t.footerText }}>·</span>
                <p className="truncate text-[8px]" style={{ color: t.footerText }}>
                  {verifyUrl}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* end cert-root */}
      </div>
      {/* end cert-bg */}
    </>
  );
}
