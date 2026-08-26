import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import {
  getMikrotikSettingsView,
  saveMikrotikSettings,
} from "@/lib/mikrotik-settings";

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  const settings = await getMikrotikSettingsView();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  let body: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    useHttps?: boolean;
    tlsVerify?: boolean;
    wgInterface?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body");
  }

  try {
    const settings = await saveMikrotikSettings({
      host: body.host ?? "",
      port: Number(body.port ?? 443),
      username: body.username ?? "",
      password: body.password,
      useHttps: body.useHttps ?? true,
      tlsVerify: body.tlsVerify ?? false,
      wgInterface: body.wgInterface ?? "",
    });
    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save MikroTik settings";
    return jsonError(message, 400);
  }
}
