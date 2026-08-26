import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { deleteConfigById } from "@/lib/config-service";

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  const configs = await prisma.config.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  return NextResponse.json({
    configs: configs.map((c) => ({
      id: c.id,
      name: c.name,
      allowedAddress: c.allowedAddress,
      publicKey: c.publicKey,
      importedFromMikrotik: c.importedFromMikrotik,
      hasPrivateKey: Boolean(c.privateKeyEncrypted),
      createdAt: c.createdAt,
      user: c.user,
    })),
  });
}

export async function DELETE(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  let body: { configId?: string };
  try {
    body = (await request.json()) as { configId?: string };
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!body.configId) {
    return jsonError("configId is required");
  }

  try {
    await deleteConfigById(body.configId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete config";
    return jsonError(message, 404);
  }
}
