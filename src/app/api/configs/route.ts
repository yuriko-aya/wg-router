import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api";
import { listUserConfigs, createUserConfig } from "@/lib/config-service";
import { getEnv } from "@/lib/env";
import { Role } from "@prisma/client";
import { MikrotikError } from "@/lib/mikrotik";

export async function GET() {
  return withAuth(async ({ user }) => {
    const configs = await listUserConfigs(user.id);
    const unlimited = user.role === Role.ADMIN;

    return NextResponse.json({
      configs,
      limit: unlimited ? null : getEnv().MAX_CONFIGS_PER_USER,
      unlimited,
    });
  });
}

export async function POST(request: Request) {
  return withAuth(async ({ user }) => {
    let body: { name?: string };
    try {
      body = (await request.json()) as { name?: string };
    } catch {
      return jsonError("Invalid JSON body");
    }

    try {
      const result = await createUserConfig(user.id, body.name ?? "");
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof MikrotikError) {
        return jsonError(error.userMessage(), error.status >= 500 ? 502 : 400);
      }
      const message = error instanceof Error ? error.message : "Failed to create config";
      return jsonError(message, 400);
    }
  });
}
