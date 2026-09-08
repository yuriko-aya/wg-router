"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

interface TurnstileWidgetProps {
  siteKey: string | null;
  onTokenChange: (token: string) => void;
}

export const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  function TurnstileWidget({ siteKey, onTokenChange }, ref) {
    if (!siteKey) {
      return (
        <p className="text-sm text-[var(--danger)]">
          Turnstile is not configured (set TURNSTILE_SITE_KEY or
          NEXT_PUBLIC_TURNSTILE_SITE_KEY).
        </p>
      );
    }

    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ theme: "dark", size: "flexible" }}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => {
          onTokenChange("");
          if (ref && "current" in ref && ref.current) {
            ref.current.reset();
          }
        }}
        onError={() => {
          onTokenChange("");
        }}
      />
    );
  },
);
