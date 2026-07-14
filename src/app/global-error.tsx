"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for UNCAUGHT React render errors.
 *
 * This is the only place such errors can be reported from, without it they never
 * reach Sentry. It replaces the root layout when it renders, so it must supply its
 * own <html> and <body>, and it cannot rely on anything from that layout (fonts,
 * providers, CSS variables), since whatever broke may have broken those too. Hence
 * the inline styles rather than the design system.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4EEE2",
          color: "#1A1714",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#B2401D",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            Something broke
          </p>

          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.75rem", lineHeight: 1.2 }}>
            We hit an unexpected error
          </h1>

          <p style={{ margin: "1rem 0 0", lineHeight: 1.7, color: "#6B5F52" }}>
            The problem has been reported to our team. You can try again, or head back to the
            homepage.
          </p>

          {/* The digest is the only safe handle on the error, never render error.message,
              which can leak internals to the user. */}
          {error.digest ? (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.75rem",
                color: "#9A8F84",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                cursor: "pointer",
                border: "none",
                background: "#B2401D",
                color: "#F4EEE2",
                padding: "0.7rem 1.5rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                boxShadow: "4px 4px 0 0 #1A1714",
              }}
            >
              Try again
            </button>

            {/* Deliberately a plain <a>, not next/link: this boundary only renders
                when the React tree has already failed, so a hard navigation that
                reloads the document is safer than client-side routing back into
                the broken tree. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-block",
                padding: "0.7rem 1.5rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#1A1714",
                textDecoration: "none",
                border: "1px solid #1A1714",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
