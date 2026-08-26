import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export async function withAuth<T>(
  handler: (ctx: NonNullable<Awaited<ReturnType<typeof requireSession>>>) => Promise<T>,
) {
  const ctx = await requireSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handler(ctx);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
