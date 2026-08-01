"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Full-screen viewer for a note image, so a pupil can zoom in on a labelled diagram. Rendered through
 * a portal to document.body because the slide card is `overflow-hidden` and sits inside a
 * transformed (framer-motion) ancestor, which would otherwise clip a position:fixed overlay.
 *
 * Tap the backdrop, the X, or Escape to close. Tap the image to toggle full size; when zoomed it sits
 * in a scrollable box so the child can pan to any label.
 */
export function LessonImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // don't let the page scroll behind the overlay
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      <div
        className={`max-h-[92vh] max-w-[95vw] ${zoomed ? "overflow-auto" : "flex items-center justify-center"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 URL, sized to the viewport, not a layout image */}
        <img
          src={src}
          alt={alt}
          onClick={() => setZoomed((z) => !z)}
          className={zoomed ? "max-w-none cursor-zoom-out" : "max-h-[92vh] max-w-[95vw] object-contain cursor-zoom-in"}
        />
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/90">
        {zoomed ? <ZoomOut className="size-3.5" /> : <ZoomIn className="size-3.5" />}
        <span>{alt ? alt : zoomed ? "Tap image to fit" : "Tap image to zoom"}</span>
      </div>
    </div>,
    document.body,
  );
}
