import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { getAuthConfigUrl } from "./auth-url";
import { isAdminRole, Role } from "./roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    isActive?: boolean;
  }
}

/**
 * Edge-compatible Auth.js config (no Prisma).
 * Used by middleware only — do not add database adapters here.
 */
export const authConfig = {
  trustHost: true,
  url: getAuthConfigUrl(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;

      if (pathname.startsWith("/api/auth")) {
        return true;
      }

      const isLoggedIn = Boolean(auth?.user?.id);
      if (!isLoggedIn) {
        return false;
      }

      if (pathname.startsWith("/admin")) {
        if (!isAdminRole(auth?.user?.role)) {
          return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
        }
      }

      return true;
    },
    jwt({ token }) {
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? Role.USER;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
