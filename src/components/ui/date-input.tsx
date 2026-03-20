"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DateInputProps = React.ComponentProps<"input"> & {
  placeholder?: string;
};

/**
 * A date/datetime-local input that shows a placeholder hint on mobile.
 * Desktop browsers already render a format hint (dd/mm/yyyy) natively;
 * iOS Safari shows a blank field until tapped, which is confusing.
 * The overlay span is hidden on sm+ screens where the native hint appears.
 */
export function DateInput({
  className,
  placeholder = "Select date",
  value,
  ...props
}: DateInputProps) {
  return (
    <div className="relative">
      <input
        value={value}
        className={cn("kat-date-input", className)}
        {...props}
      />
      {!value && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center px-4 text-sm text-slate-400 sm:hidden"
        >
          {placeholder}
        </span>
      )}
    </div>
  );
}
