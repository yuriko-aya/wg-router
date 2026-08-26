import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { resolveMikrotikConnection } from "@/lib/mikrotik-settings";
import { fetchWireGuardServerInfo, MikrotikError } from "@/lib/mikrotik";

export async function POST(request: Request) {
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
    endpointHost?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body");
  }

  try {
    const connection = await resolveMikrotikConnection({
      host: body.host,
      port: body.port,
      username: body.username,
      password: body.password,
      useHttps: body.useHttps,
      tlsVerify: body.tlsVerify,
      wgInterface: body.wgInterface,
    });

    const result = await fetchWireGuardServerInfo(connection, body.endpointHost);
    return NextResponse.json({ wireGuard: result });
  } catch (error) {
    if (error instanceof MikrotikError) {
      return jsonError(
        error.body ? `${error.message}: ${error.body}` : error.message,
        502,
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch WireGuard settings";
    return jsonError(message, 400);
  }
}
