"use client";

import { useMemo } from "react";

/**
 * A faint, tiled, diagonal repeat of the pupil's name laid over the lesson content. It is a deterrent,
 * not a lock: a screenshot or photo of a lesson carries the pupil's name across it, so a leaked copy
 * traces back to whoever it came from. It never blocks interaction (pointer-events: none) and stays
 * faint enough to read through on light and dark themes.
 *
 * The label is escaped for XML then URL-encoded into an inline SVG background, so a name with quotes or
 * angle brackets cannot break out of the markup.
 */
export function LessonWatermark({ label }: { label: string }) {
  const backgroundImage = useMemo(() => {
    const text = label.trim() || "KAT";
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='170'>` +
      `<text x='0' y='95' transform='rotate(-28 150 85)' ` +
      `font-family='sans-serif' font-size='14' font-weight='600' ` +
      `fill='%23808080' fill-opacity='0.11'>${escaped}</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [label]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 select-none"
      style={{ backgroundImage, backgroundRepeat: "repeat" }}
    />
  );
}
