"use client";

import { useCallback, useEffect, useState } from "react";

interface MikrotikSettingsView {
  host: string;
  port: number;
  username: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
  hasPassword: boolean;
  configured: boolean;
}

interface MikrotikTestResult {
  ok: true;
  version?: string;
  boardName?: string;
  platform?: string;
}

const emptyForm = {
  host: "",
  port: 443,
  username: "",
  password: "",
  useHttps: true,
  tlsVerify: false,
  wgInterface: "",
};

export function MikrotikSettingsForm({
  disabled,
}: {
  disabled?: boolean;
}) {
  const [form, setForm] = useState(emptyForm);
  const [hasPassword, setHasPassword] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<MikrotikTestResult | null>(
    null,
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/mikrotik");
      const data = (await response.json()) as {
        settings?: MikrotikSettingsView;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load MikroTik settings");
      }

      const settings = data.settings ?? {
        ...emptyForm,
        hasPassword: false,
        configured: false,
      };

      setForm({
        host: settings.host,
        port: settings.port,
        username: settings.username,
        password: "",
        useHttps: settings.useHttps,
        tlsVerify: settings.tlsVerify,
        wgInterface: settings.wgInterface,
      });
      setHasPassword(settings.hasPassword);
      setConfigured(settings.configured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess(null);
    setTestResult(null);
  }

  function payload(includePassword: boolean) {
    return {
      host: form.host,
      port: form.port,
      username: form.username,
      useHttps: form.useHttps,
      tlsVerify: form.tlsVerify,
      wgInterface: form.wgInterface,
      ...(includePassword && form.password ? { password: form.password } : {}),
    };
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/mikrotik", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(true)),
      });
      const data = (await response.json()) as {
        settings?: MikrotikSettingsView;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save settings");
      }

      setHasPassword(data.settings?.hasPassword ?? true);
      setConfigured(data.settings?.configured ?? true);
      setForm((current) => ({ ...current, password: "" }));
      setSuccess("MikroTik settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/mikrotik/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(true)),
      });
      const data = (await response.json()) as MikrotikTestResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Connection test failed");
      }

      setTestResult(data);
      setSuccess("Connection successful.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">MikroTik connection</h2>
        <p className="muted text-sm">
          RouterOS 7.x REST API settings used when creating or deleting peers.
          {!configured && !loading && " Not configured yet."}
        </p>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm muted">Host</span>
              <input
                className="input"
                value={form.host}
                onChange={(e) => updateField("host", e.target.value)}
                placeholder="192.168.88.1"
                disabled={disabled || busy}
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">Port</span>
              <input
                className="input"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => updateField("port", Number(e.target.value))}
                disabled={disabled || busy}
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">Username</span>
              <input
                className="input"
                value={form.username}
                onChange={(e) => updateField("username", e.target.value)}
                disabled={disabled || busy}
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm muted">
                Password{hasPassword ? " (leave blank to keep current)" : ""}
              </span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                disabled={disabled || busy}
                required={!hasPassword}
                autoComplete="new-password"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm muted">WireGuard interface</span>
              <input
                className="input"
                value={form.wgInterface}
                onChange={(e) => updateField("wgInterface", e.target.value)}
                placeholder="wg-server"
                disabled={disabled || busy}
                required
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.useHttps}
                onChange={(e) => updateField("useHttps", e.target.checked)}
                disabled={disabled || busy}
              />
              Use HTTPS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.tlsVerify}
                onChange={(e) => updateField("tlsVerify", e.target.checked)}
                disabled={disabled || busy}
              />
              Verify TLS certificate
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || busy}
              onClick={() => void handleTest()}
            >
              {busy ? "Working..." : "Test connection"}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={disabled || busy}
            >
              Save settings
            </button>
          </div>
        </form>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200">
          {success}
        </div>
      )}

      {testResult && (
        <div className="rounded-xl border border-[var(--border)] bg-[#0d1430] p-4 text-sm space-y-1">
          {testResult.boardName && <p>Board: {testResult.boardName}</p>}
          {testResult.platform && <p>Platform: {testResult.platform}</p>}
          {testResult.version && <p>Version: {testResult.version}</p>}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
    </section>
  );
}
