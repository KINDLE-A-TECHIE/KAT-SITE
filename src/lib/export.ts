/**
 * Shared client-side export helpers (CSV download, HTML escaping).
 *
 * Extracted from analytics-panel.tsx, which had grown its own private copies. A
 * second consumer (the school NERDC report) would have made these a third copy,
 * the same duplication that let three divergent `Math.random()` reference
 * generators live in the payments code. One implementation, one place.
 *
 * Deliberately dependency-free: the project has no PDF/CSV library and does not need
 * one. CSV is a Blob download; PDF is the browser's own print-to-PDF, which is what
 * the certificate and receipt pages already do.
 */

export type CsvValue = string | number | null | undefined;

/** Quote a cell only when it contains a comma, quote or newline (RFC 4180). */
export function csvCell(value: CsvValue): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

/** Trigger a browser download of `rows` as a CSV file. Client-side only. */
export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const csv = toCsv(rows);
  // The BOM makes Excel open UTF-8 correctly. Nigerian names carry accents, and
  // without it Excel mangles them.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function escapeHtml(value: CsvValue): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
