import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { syncMikrotikPeers } from "@/lib/sync-service";
import { MikrotikError } from "@/lib/mikrotik";

export async function POST() {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  try {
    const result = await syncMikrotikPeers(ctx.user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MikrotikError) {
      return jsonError(
        error.body ? `${error.message}: ${error.body}` : error.message,
        502,
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to sync MikroTik peers";
    return jsonError(message, 400);
  }
}
