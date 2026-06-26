import type { DefaultSession } from "next-auth";

/**
 * Augment the NextAuth session/JWT types so `session.user.role` and
 * `session.user.id` are typed. Role values mirror the `user_role` enum in
 * packages/db/src/schema/enums.ts.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin" | "superadmin";
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: "user" | "admin" | "superadmin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string | number;
    role?: "user" | "admin" | "superadmin";
  }
}
