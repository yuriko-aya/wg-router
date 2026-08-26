"use client";

import { SessionProvider, signOut } from "next-auth/react";
import Link from "next/link";
import { Role } from "@prisma/client";

interface AppShellProps {
  children: React.ReactNode;
  email: string;
  role: Role;
}

function Shell({ children, email, role }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[rgba(8,12,28,0.75)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-semibold">
              WG Router
            </Link>
            <nav className="flex items-center gap-3 text-sm muted">
              <Link href="/dashboard" className="hover:text-white">
                My Configs
              </Link>
              {role === Role.ADMIN && (
                <Link href="/admin" className="hover:text-white">
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm muted hidden sm:inline">{email}</span>
            <span className={`badge ${role === Role.ADMIN ? "badge-admin" : "badge-user"}`}>
              {role}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <SessionProvider>
      <Shell {...props} />
    </SessionProvider>
  );
}
