import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { Role } from "@prisma/client";

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { configs: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      configCount: u._count.configs,
      createdAt: u.createdAt,
    })),
  });
}

export async function PATCH(request: Request) {
  const ctx = await requireAdmin();
  if (!ctx) {
    return jsonError("Forbidden", 403);
  }

  let body: {
    userId?: string;
    role?: Role;
    isActive?: boolean;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body");
  }

  if (!body.userId) {
    return jsonError("userId is required");
  }

  if (body.userId === ctx.user.id && body.isActive === false) {
    return jsonError("You cannot deactivate your own account");
  }

  if (body.userId === ctx.user.id && body.role === Role.USER) {
    return jsonError("You cannot demote your own admin account");
  }

  const data: { role?: Role; isActive?: boolean } = {};
  if (body.role === Role.ADMIN || body.role === Role.USER) {
    data.role = body.role;
  }
  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  if (Object.keys(data).length === 0) {
    return jsonError("No valid fields to update");
  }

  const user = await prisma.user.update({
    where: { id: body.userId },
    data,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  });
}
