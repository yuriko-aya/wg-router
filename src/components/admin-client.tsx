"use client";

import { useCallback, useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { MikrotikSettingsForm } from "@/components/mikrotik-settings-form";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  configCount: number;
  createdAt: string;
}

interface AdminConfig {
  id: string;
  name: string;
  allowedAddress: string;
  publicKey: string;
  importedFromMikrotik: boolean;
  hasPrivateKey: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface SyncResult {
  mikrotikTotal: number;
  dbTotal: number;
  matched: number;
  linked: number;
  imported: Array<{
    name: string;
    publicKey: string;
    allowedAddress: string;
    mikrotikPeerId: string;
  }>;
  onlyInDb: Array<{
    id: string;
    name: string;
    publicKey: string;
    allowedAddress: string;
    userEmail: string;
  }>;
}

export function AdminClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [configs, setConfigs] = useState<AdminConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, configsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/configs"),
      ]);

      const usersData = (await usersRes.json()) as {
        users?: AdminUser[];
        error?: string;
      };
      const configsData = (await configsRes.json()) as {
        configs?: AdminConfig[];
        error?: string;
      };

      if (!usersRes.ok) {
        throw new Error(usersData.error ?? "Failed to load users");
      }
      if (!configsRes.ok) {
        throw new Error(configsData.error ?? "Failed to load configs");
      }

      setUsers(usersData.users ?? []);
      setConfigs(configsData.configs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function updateUser(
    userId: string,
    patch: { role?: Role; isActive?: boolean },
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update user");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setBusy(false);
    }
  }

  async function syncFromMikrotik() {
    setBusy(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch("/api/admin/mikrotik/sync", {
        method: "POST",
      });
      const data = (await response.json()) as SyncResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to sync from MikroTik");
      }
      setSyncResult(data);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync from MikroTik");
    } finally {
      setBusy(false);
    }
  }

  async function deleteConfig(configId: string) {
    if (!confirm("Delete this config for the user?")) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/configs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete config");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="muted">Manage users and all WireGuard configs.</p>
      </section>

      {error && (
        <div className="card border-[var(--danger)] p-4 text-[var(--danger)]">
          {error}
        </div>
      )}

      <MikrotikSettingsForm disabled={loading || busy} />

      <section className="card p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Sync from MikroTik</h2>
            <p className="muted text-sm">
              Pull WireGuard peers from the router and compare with the database.
              Peers only on MikroTik are imported into your admin account.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            disabled={loading || busy}
            onClick={() => void syncFromMikrotik()}
          >
            {busy ? "Syncing..." : "Pull & compare"}
          </button>
        </div>

        {syncResult && (
          <div className="rounded-xl border border-[var(--border)] bg-[#0d1430] p-4 text-sm space-y-3">
            <p>
              MikroTik peers: {syncResult.mikrotikTotal} · DB configs:{" "}
              {syncResult.dbTotal} · Matched: {syncResult.matched}
              {syncResult.linked > 0 && ` · Linked IDs: ${syncResult.linked}`}
            </p>

            {syncResult.imported.length > 0 && (
              <div>
                <p className="font-semibold mb-2">
                  Imported to admin ({syncResult.imported.length})
                </p>
                <ul className="space-y-1 muted">
                  {syncResult.imported.map((item) => (
                    <li key={item.mikrotikPeerId}>
                      {item.name} · {item.allowedAddress}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {syncResult.onlyInDb.length > 0 && (
              <div>
                <p className="font-semibold mb-2 text-[var(--danger)]">
                  In DB only, not on MikroTik ({syncResult.onlyInDb.length})
                </p>
                <ul className="space-y-1 muted">
                  {syncResult.onlyInDb.map((item) => (
                    <li key={item.id}>
                      {item.name} · {item.userEmail} · {item.allowedAddress}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {syncResult.imported.length === 0 &&
              syncResult.onlyInDb.length === 0 && (
                <p className="muted">Everything is in sync.</p>
              )}
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Users</h2>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left muted">
                <tr>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Configs</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--border)]">
                    <td className="py-3 pr-4">{user.email}</td>
                    <td className="py-3 pr-4">{user.role}</td>
                    <td className="py-3 pr-4">
                      {user.isActive ? "Active" : "Disabled"}
                    </td>
                    <td className="py-3 pr-4">{user.configCount}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() =>
                            void updateUser(user.id, {
                              role: user.role === Role.ADMIN ? Role.USER : Role.ADMIN,
                            })
                          }
                        >
                          {user.role === Role.ADMIN ? "Make user" : "Make admin"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busy}
                          onClick={() =>
                            void updateUser(user.id, { isActive: !user.isActive })
                          }
                        >
                          {user.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-semibold">All configs</h2>
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
                  <p className="text-sm muted">
                    {config.user.email} · {config.allowedAddress}
                    {!config.hasPrivateKey && " · no private key"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => void deleteConfig(config.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
