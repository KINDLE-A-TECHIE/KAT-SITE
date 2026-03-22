"use client";

import { useEffect } from "react";

const CB = "_ts_success";
const CB_EXPIRE = "_ts_expire";
const CB_ERROR = "_ts_error";

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
};

export function TurnstileWidget({ siteKey, onSuccess, onExpire, onError }: Props) {
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    win[CB] = onSuccess;
    win[CB_EXPIRE] = onExpire ?? (() => undefined);
    win[CB_ERROR] = onError ?? (() => undefined);
    return () => {
      delete win[CB];
      delete win[CB_EXPIRE];
      delete win[CB_ERROR];
    };
  }, [onSuccess, onExpire, onError]);

  return (
    <div
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-theme="light"
      data-size="flexible"
      data-callback={CB}
      data-expired-callback={CB_EXPIRE}
      data-error-callback={CB_ERROR}
    />
  );
}
