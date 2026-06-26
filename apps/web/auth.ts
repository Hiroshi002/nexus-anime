import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { eq } from "drizzle-orm";

import { logger } from "@/lib/logging/logger";
import { db } from "@nexus/db/client";
import { users } from "@nexus/db/schema";

export class CredentialsSignin extends AuthError {
  code = "credentials";
}

const authResult = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        // Avoid a hard dependency on a not-yet-implemented service —
        // look the user up directly and rely on the provisioned role.
        try {
          const rows = await db()
            .select({ id: users.id, email: users.email, role: users.role })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          const user = rows[0];
          if (!user) return null;
          return {
            id: user.id,
            email: user.email,
            role: user.role,
          };
        } catch (err) {
          logger.warn("authorize lookup failed", { err });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.uid = user.id;
        token.role =
          (user.role as "user" | "admin" | "superadmin") ?? "user";
      } else if (account && profile && token.email) {
        const fresh = await loadUser(token.email);
        token.role = (fresh.role as "user" | "admin" | "superadmin") ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role =
          (token.role as "user" | "admin" | "superadmin") ?? "user";
      }
      if (token.uid && session.user) {
        session.user.id = `${token.uid}`;
      }
      return session;
    },
    authorized({ auth: authSession }) {
      return !!authSession?.user;
    },
  },
});

const auth = authResult.auth;
const signIn = authResult.signIn;
const signOut = authResult.signOut;
const handlers = authResult.handlers;

export { auth, signIn, signOut, handlers };

async function loadUser(email: string) {
  try {
    const rows = await db()
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return { role: rows[0]?.role ?? "user", id: rows[0]?.id ?? null };
  } catch {
    return { role: "user", id: null };
  }
}
