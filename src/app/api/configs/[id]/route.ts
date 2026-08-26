import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api";
import { deleteUserConfig, getConfigDownload } from "@/lib/config-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  return withAuth(async ({ user }) => {
    const { id } = await params;
    try {
      const result = await getConfigDownload(user.id, id);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load config";
      return jsonError(message, 404);
    }
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  return withAuth(async ({ user }) => {
    const { id } = await params;
    try {
      await deleteUserConfig(user.id, id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete config";
      return jsonError(message, 404);
    }
  });
}
