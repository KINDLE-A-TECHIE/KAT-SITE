"use client";

import { useEffect, useRef } from "react";

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
};

const SCRIPT_ID = "cf-turnstile-script";
let callbackIndex = 0;

export function TurnstileWidget({ siteKey, onSuccess, onExpire, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackName = useRef(`_ts_cb_${++callbackIndex}`);

  // Register global callbacks Cloudflare will call
  useEffect(() => {
    const name = callbackName.current;
    const win = window as unknown as Record<string, unknown>;
    win[name] = onSuccess;
    win[`${name}_expire`] = onExpire ?? null;
    win[`${name}_error`] = onError ?? null;
    return () => {
      delete win[name];
      delete win[`${name}_expire`];
      delete win[`${name}_error`];
    };
  }, [onSuccess, onExpire, onError]);

  // Inject Cloudflare script once (implicit rendering — no ?render=explicit)
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return (
    <div
      ref={containerRef}
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-theme="light"
      data-size="flexible"
      data-callback={callbackName.current}
      data-expired-callback={`${callbackName.current}_expire`}
      data-error-callback={`${callbackName.current}_error`}
    />
  );
}
