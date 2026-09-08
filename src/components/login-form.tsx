"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!turnstileToken) {
      setError("Please complete the Turnstile challenge.");
      return;
    }

    setBusy(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        turnstileToken,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email, password, or verification.");
        setTurnstileToken("");
        turnstileRef.current?.reset();
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Sign in failed. Please try again.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-sm muted">Email</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm muted">Password</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
        />
      </label>

      <TurnstileWidget
        ref={turnstileRef}
        siteKey={turnstileSiteKey}
        onTokenChange={setTurnstileToken}
      />

      {error && (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-sm muted text-center">
        No account?{" "}
        <Link href="/register" className="text-[var(--accent)] hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
