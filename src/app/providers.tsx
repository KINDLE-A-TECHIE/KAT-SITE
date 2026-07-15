"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { PwaBootstrap } from "@/components/pwa/pwa-bootstrap";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const transitionKey = pathname.startsWith("/dashboard") ? "/dashboard" : pathname;

  /*
   * The global `@media (prefers-reduced-motion)` rule in globals.css zeroes CSS
   * transition durations, but framer drives this one from JS, so the media query never
   * touched it: a user who asked for no motion still got a translate + fade on EVERY
   * navigation. Gate it here.
   */
  const reduceMotion = useReducedMotion();

  return (
    <SessionProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key={transitionKey}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <PwaBootstrap />
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
