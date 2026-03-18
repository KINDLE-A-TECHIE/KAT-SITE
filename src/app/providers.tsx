"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { PwaBootstrap } from "@/components/pwa/pwa-bootstrap";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const transitionKey = pathname.startsWith("/dashboard") ? "/dashboard" : pathname;

  return (
    <SessionProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key={transitionKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <PwaBootstrap />
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
