"use client";

import { useCallback, useEffect, useState } from "react";

interface MikrotikSettingsView {
  host: string;
  port: number;
  username: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
  wgServerPublicKey: string;
  wgServerEndpoint: string;
  wgServerAddress: string;
  wgClientIpPool: string;
  hasPassword: boolean;
  configured: boolean;
  wireGuardConfigured: boolean;
}

interface MikrotikTestResult {
  ok: true;
  version?: string;
  boardName?: string;
  platform?: string;
}

interface WireGuardFetchResult {
  publicKey: string;
  listenPort: number;
  endpoint: string;
  serverAddress: string;
  clientIpPool: string;
}

const emptyForm = {
  host: "",
  port: 443,
  username: "",
  password: "",
  useHttps: true,
  tlsVerify: false,
  wgInterface: "",
  wgServerPublicKey: "",
  wgServerEndpoint: "",
  wgServerAddress: "",
  wgClientIpPool: "",
  endpointHost: "",
};

export function MikrotikSettingsForm({
  disabled,
}: {
  disabled?: boolean;
}) {
  const [form, setForm] = useState(emptyForm);
  const [hasPassword, setHasPassword] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [wireGuardConfigured, setWireGuardConfigured] = useState(false);
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
        wireGuardConfigured: false,
      };

      setForm({
        host: settings.host,
        port: settings.port,
        username: settings.username,
        password: "",
        useHttps: settings.useHttps,
        tlsVerify: settings.tlsVerify,
        wgInterface: settings.wgInterface,
        wgServerPublicKey: settings.wgServerPublicKey,
        wgServerEndpoint: settings.wgServerEndpoint,
        wgServerAddress: settings.wgServerAddress,
        wgClientIpPool: settings.wgClientIpPool,
        endpointHost: settings.wgServerEndpoint.split(":")[0] ?? settings.host,
      });
      setHasPassword(settings.hasPassword);
      setConfigured(settings.configured);
      setWireGuardConfigured(settings.wireGuardConfigured);
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

  function connectionPayload(includePassword: boolean) {
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

  function savePayload(includePassword: boolean) {
    return {
      ...connectionPayload(includePassword),
      wgServerPublicKey: form.wgServerPublicKey,
      wgServerEndpoint: form.wgServerEndpoint,
      wgServerAddress: form.wgServerAddress,
      wgClientIpPool: form.wgClientIpPool,
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
        body: JSON.stringify(savePayload(true)),
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
      setWireGuardConfigured(data.settings?.wireGuardConfigured ?? true);
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
        body: JSON.stringify(connectionPayload(true)),
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

  async function handleFetchWireGuard() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/mikrotik/wireguard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...connectionPayload(true),
          endpointHost: form.endpointHost || form.host,
        }),
      });
      const data = (await response.json()) as {
        wireGuard?: WireGuardFetchResult;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch WireGuard settings");
      }

      if (!data.wireGuard) {
        throw new Error("Router returned no WireGuard data");
      }

      setForm((current) => ({
        ...current,
        wgServerPublicKey: data.wireGuard!.publicKey,
        wgServerEndpoint: data.wireGuard!.endpoint,
        wgServerAddress: data.wireGuard!.serverAddress,
        wgClientIpPool: data.wireGuard!.clientIpPool,
        endpointHost: form.endpointHost || form.host,
      }));
      setSuccess(
        "WireGuard settings loaded from router. Review and save to apply.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch WireGuard settings",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">MikroTik connection</h2>
        <p className="muted text-sm">
          RouterOS 7.x REST API settings and WireGuard server details used in
          client configs.
          {!configured && !loading && " Not fully configured yet."}
          {configured && wireGuardConfigured && " Ready to manage peers."}
        </p>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide muted">
              REST API
            </h3>
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
          </div>

          <div className="space-y-4 border-t border-[var(--border)] pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide muted">
                WireGuard server
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={disabled || busy}
                onClick={() => void handleFetchWireGuard()}
              >
                Fetch from router
              </button>
            </div>

            <p className="text-sm muted">
              Public key and listen port come from{" "}
              <code className="text-xs">/interface/wireguard</code>. Server
              address and client pool come from{" "}
              <code className="text-xs">/ip/address</code> on the WireGuard
              interface (IPv4 and global IPv6; link-local{" "}
              <code className="text-xs">fe80::/10</code> is skipped). Override
              the endpoint hostname if clients reach the VPN on a public DNS
              name.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm muted">Server public key</span>
                <input
                  className="input font-mono text-sm"
                  value={form.wgServerPublicKey}
                  onChange={(e) =>
                    updateField("wgServerPublicKey", e.target.value)
                  }
                  disabled={disabled || busy}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm muted">Endpoint hostname</span>
                <input
                  className="input"
                  value={form.endpointHost}
                  onChange={(e) => updateField("endpointHost", e.target.value)}
                  placeholder="vpn.example.com"
                  disabled={disabled || busy}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm muted">Endpoint (host:port)</span>
                <input
                  className="input"
                  value={form.wgServerEndpoint}
                  onChange={(e) =>
                    updateField("wgServerEndpoint", e.target.value)
                  }
                  placeholder="vpn.example.com:51820"
                  disabled={disabled || busy}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm muted">Server address (client DNS)</span>
                <input
                  className="input font-mono text-sm"
                  value={form.wgServerAddress}
                  onChange={(e) =>
                    updateField("wgServerAddress", e.target.value)
                  }
                  placeholder="10.8.0.1/32,fd00:8::1/128"
                  disabled={disabled || busy}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm muted">Client IP pool</span>
                <input
                  className="input font-mono text-sm"
                  value={form.wgClientIpPool}
                  onChange={(e) => updateField("wgClientIpPool", e.target.value)}
                  placeholder="10.8.0.0/24,fd00:8::/64"
                  disabled={disabled || busy}
                />
              </label>
            </div>
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
