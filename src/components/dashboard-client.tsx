"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfigQrModal } from "@/components/config-qr-modal";

interface ConfigItem {
  id: string;
  name: string;
  allowedAddress: string;
  publicKey: string;
  importedFromMikrotik: boolean;
  hasPrivateKey: boolean;
  createdAt: string;
}

interface ConfigDetails {
  confText: string;
  name: string;
}

export function DashboardClient() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [limit, setLimit] = useState<number | null>(3);
  const [unlimited, setUnlimited] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingConfigId, setLoadingConfigId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ConfigDetails | null>(null);

  const atLimit = !unlimited && limit !== null && configs.length >= limit;

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/configs");
      const data = (await response.json()) as {
        configs?: ConfigItem[];
        limit?: number | null;
        unlimited?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load configs");
      }
      setConfigs(data.configs ?? []);
      setLimit(data.limit ?? 3);
      setUnlimited(data.unlimited ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSelected(null);

    try {
      const response = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        confText?: string;
        config?: ConfigItem;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create config");
      }

      if (data.confText && data.config) {
        setSelected({
          confText: data.confText,
          name: data.config.name,
        });
      }

      setName("");
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create config");
    } finally {
      setBusy(false);
    }
  }

  async function handleShow(configId: string) {
    setLoadingConfigId(configId);
    setError(null);

    try {
      const response = await fetch(`/api/configs/${configId}`);
      const data = (await response.json()) as ConfigDetails & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load config");
      }

      if (!data.confText) {
        throw new Error("Config file content is missing");
      }

      setSelected({
        confText: data.confText,
        name: data.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoadingConfigId(null);
    }
  }

  async function handleDelete(configId: string) {
    if (!confirm("Delete this config? The peer will be removed from MikroTik.")) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/configs/${configId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete config");
      }
      if (selected) {
        setSelected(null);
      }
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config");
    } finally {
      setBusy(false);
    }
  }

  const remaining =
    unlimited || limit === null ? null : Math.max(0, limit - configs.length);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">My WireGuard configs</h1>
        <p className="muted">
          {unlimited
            ? "Unlimited configs (admin account)."
            : `You can create up to ${limit} configs.${remaining !== null ? ` ${remaining} remaining.` : ""}`}
        </p>
      </section>

      {error && (
        <div className="card border-[var(--danger)] p-4 text-[var(--danger)]">
          {error}
        </div>
      )}

      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Generate new config</h2>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Config name (e.g. laptop, phone)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || atLimit}
            required
          />
          <button
            type="submit"
            className="btn btn-primary sm:min-w-40"
            disabled={busy || atLimit}
          >
            {busy ? "Working..." : "Generate"}
          </button>
        </form>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Your configs</h2>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : configs.length === 0 ? (
          <p className="muted">No configs yet.</p>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {config.name}
                    {config.importedFromMikrotik && (
                      <span className="badge badge-user ml-2">imported</span>
                    )}
                  </p>
                  <p className="text-sm muted">{config.allowedAddress}</p>
                  {!config.hasPrivateKey && (
                    <p className="text-sm muted">No private key (imported from MikroTik)</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.hasPrivateKey && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void handleShow(config.id)}
                      disabled={busy || loadingConfigId !== null}
                    >
                      {loadingConfigId === config.id
                        ? "Loading..."
                        : "Show QR / Download"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleDelete(config.id)}
                    disabled={busy || loadingConfigId !== null}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <ConfigQrModal
          name={selected.name}
          confText={selected.confText}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
