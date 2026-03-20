"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  type?: "date" | "datetime-local";
  placeholder?: string;
};

/**
 * Date input that shows a real placeholder on mobile (iOS + Android).
 *
 * Problem: iOS Safari / Android Chrome show a blank field for type="date" /
 * type="datetime-local" when no value is set. The HTML placeholder attribute
 * is ignored on date inputs on these platforms.
 *
 * Solution: render as type="text" (so placeholder works) and switch to the
 * real date type synchronously via direct DOM mutation on pointerdown — BEFORE
 * the browser decides whether to open a text keyboard or the native date picker.
 * React state batching makes onFocus-based type-swaps arrive too late on iOS.
 */
export function DateInput({
  type = "date",
  placeholder = "Select date",
  value,
  onChange,
  onFocus,
  onBlur,
  className,
  disabled,
  ...props
}: DateInputProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  // Track displayed type in state so React keeps in sync.
  const [inputType, setInputType] = React.useState<string>(
    value ? type : "text"
  );

  // If value is set/cleared externally, keep the type in sync.
  React.useEffect(() => {
    const next = value ? type : "text";
    setInputType(next);
    if (ref.current) ref.current.type = next;
  }, [value, type]);

  const switchToDateType = () => {
    if (!ref.current || ref.current.type === type) return;
    // Direct DOM write is synchronous — iOS reads the new type before
    // deciding which picker to open, unlike a React setState re-render.
    ref.current.type = type;
    setInputType(type);
  };

  return (
    <input
      ref={ref}
      {...props}
      type={inputType}
      value={value}
      disabled={disabled}
      placeholder={inputType === "text" ? placeholder : undefined}
      className={cn("kat-date-input", className)}
      onPointerDown={switchToDateType}
      onFocus={(e) => {
        switchToDateType();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (!e.target.value) {
          const textType = "text";
          e.target.type = textType;
          setInputType(textType);
        }
        onBlur?.(e);
      }}
      onChange={onChange}
    />
  );
}
