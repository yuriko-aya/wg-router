import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role as PrismaRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { getAdminEmails } from "./env";
import { authConfig } from "./auth.config";
import { Role } from "./roles";
import { verifyPassword } from "./password";
import { verifyTurnstileToken } from "./turnstile";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile", type: "text" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken);
        if (!turnstileOk) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user?.passwordHash || !user.isActive) {
          return null;
        }

        const passwordOk = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
        if (!passwordOk) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
      });

      if (dbUser && !dbUser.isActive) {
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      const userId = token.id as string | undefined;
      const email = token.email?.toLowerCase();

      const dbUser = userId
        ? await prisma.user.findUnique({ where: { id: userId } })
        : email
          ? await prisma.user.findUnique({ where: { email } })
          : null;

      if (dbUser) {
        token.id = dbUser.id;
        token.role = dbUser.role as Role;
        token.isActive = dbUser.isActive;

        const adminEmails = getAdminEmails();
        if (adminEmails.has(dbUser.email.toLowerCase())) {
          token.role = Role.ADMIN;
        }
      }

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
  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email || !user.id) {
        return;
      }

      const email = user.email.toLowerCase();
      const adminEmails = getAdminEmails();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: account.providerAccountId,
          ...(adminEmails.has(email) ? { role: PrismaRole.ADMIN } : {}),
        },
      });
    },
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return { session, user };
}

export async function requireAdmin() {
  const ctx = await requireSession();
  if (!ctx || ctx.user.role !== PrismaRole.ADMIN) {
    return null;
  }
  return ctx;
}
