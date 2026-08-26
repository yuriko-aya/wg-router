import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { applyProxyHeaders } from "@/lib/auth-url";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    const headers = applyProxyHeaders(request.headers);
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/api/auth/:path*", "/dashboard/:path*", "/admin/:path*"],
};
