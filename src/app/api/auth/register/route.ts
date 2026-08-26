import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getAdminEmails } from "@/lib/env";
import { jsonError } from "@/lib/api";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().max(100).optional(),
  turnstileToken: z.string().min(1, "Turnstile verification is required"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid registration data";
    return jsonError(message, 400);
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const remoteIp = forwarded?.split(",")[0]?.trim() ?? null;

  try {
    const turnstileOk = await verifyTurnstileToken(
      parsed.data.turnstileToken,
      remoteIp,
    );
    if (!turnstileOk) {
      return jsonError("Turnstile verification failed", 400);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Turnstile verification failed";
    return jsonError(message, 500);
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("An account with this email already exists", 409);
  }

  const adminEmails = getAdminEmails();
  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash,
      role: adminEmails.has(email) ? Role.ADMIN : Role.USER,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
