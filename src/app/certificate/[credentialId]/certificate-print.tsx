"use client";

import Image from "next/image";
import { Printer, CheckCircle2 } from "lucide-react";

type Props = {
  recipientName: string;
  programName: string;
  programLevel: string;
  issuedBy: string;
  issuedAt: string;
  credentialId: string;
};

export function CertificatePrint({ recipientName, programName, programLevel, issuedBy, issuedAt, credentialId }: Props) {
  const date = new Date(issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const verifyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/certificate/${credentialId}`
    : `/certificate/${credentialId}`;

  return (
    <>
      {/* Print / page styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cert-root, #cert-root * { visibility: visible !important; }
          #cert-root { position: fixed; inset: 0; width: 100vw; height: 100vh; }
          #no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div id="no-print" className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <Image src="/kindle-a-techie.svg" alt="KAT Academy" width={28} height={28} />
          <span className="text-sm font-semibold text-slate-800">KAT Academy</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-[#0D1F45] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#162d5e]"
        >
          <Printer className="size-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Certificate body */}
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-slate-100 p-6 print:p-0">
        <div
          id="cert-root"
          className="relative w-full max-w-[760px] overflow-hidden bg-white shadow-2xl print:shadow-none"
          style={{ aspectRatio: "1.414 / 1" }}
        >
          {/* Outer border frame */}
          <div className="absolute inset-3 border-2 border-[#0D1F45]/20 pointer-events-none" />
          <div className="absolute inset-[14px] border border-[#c9a84c]/40 pointer-events-none" />

          {/* Navy header band */}
          <div className="absolute inset-x-0 top-0 flex h-[88px] items-center justify-between bg-[#0D1F45] px-10">
            <div className="flex items-center gap-3">
              <Image src="/kindle-a-techie.svg" alt="KAT logo" width={38} height={38} className="brightness-0 invert" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-blue-200">KAT Academy</p>
                <p className="text-[10px] text-blue-300/70">by Kindle a Techie</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-blue-200">Certificate of</p>
              <p className="text-base font-semibold uppercase tracking-[0.15em] text-white">Completion</p>
            </div>
          </div>

          {/* Body */}
          <div className="flex h-full flex-col items-center justify-center px-12 pt-[72px] pb-[56px] text-center">
            {/* Subtitle */}
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">This is to certify that</p>

            {/* Recipient name */}
            <h1
              className="mt-3 text-[2.6rem] font-light leading-tight text-[#0D1F45]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {recipientName}
            </h1>

            {/* Divider */}
            <div className="my-4 flex items-center gap-3 w-48">
              <div className="flex-1 h-px bg-[#c9a84c]/50" />
              <div className="size-1.5 rounded-full bg-[#c9a84c]" />
              <div className="flex-1 h-px bg-[#c9a84c]/50" />
            </div>

            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              has successfully completed the {programLevel} programme
            </p>

            {/* Programme name */}
            <h2 className="mt-2 text-xl font-semibold text-[#0D1F45]">{programName}</h2>

            {/* Date + issuer row */}
            <div className="mt-7 flex w-full items-end justify-between px-4">
              <div className="text-left">
                <div className="mb-1 w-32 border-b border-slate-300" />
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Date</p>
                <p className="text-[13px] font-medium text-slate-700">{date}</p>
              </div>

              <div className="flex flex-col items-center gap-1">
                <CheckCircle2 className="size-8 text-[#0D1F45]/30" />
                <p className="text-[9px] uppercase tracking-wider text-slate-400">Verified</p>
              </div>

              <div className="text-right">
                <div className="mb-1 ml-auto w-32 border-b border-slate-300" />
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Authorised by</p>
                <p className="text-[13px] font-medium text-slate-700">{issuedBy}</p>
              </div>
            </div>
          </div>

          {/* Footer band */}
          <div className="absolute inset-x-0 bottom-0 flex h-[42px] items-center justify-center gap-2 bg-[#0D1F45]/5 border-t border-[#0D1F45]/10">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Credential ID:</p>
            <p className="font-mono text-[10px] text-slate-500">{credentialId}</p>
            <span className="text-slate-300">·</span>
            <p className="text-[9px] text-slate-400">Verify at {verifyUrl}</p>
          </div>
        </div>
      </div>
    </>
  );
}
