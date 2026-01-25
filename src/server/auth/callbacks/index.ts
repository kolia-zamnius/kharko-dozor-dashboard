import "server-only";
import { jwtCallback } from "@/server/auth/callbacks/jwt";
import { sessionCallback } from "@/server/auth/callbacks/session";
import { signInCallback } from "@/server/auth/callbacks/sign-in";
import type { NextAuthConfig } from "next-auth";

/**
 * Composed callback set passed to `NextAuth({ callbacks })`. Each handler
 * lives in its own file so they can be reasoned about (and eventually
 * unit-tested) in isolation from the NextAuth runtime.
 */
export const authCallbacks: NextAuthConfig["callbacks"] = {
  signIn: signInCallback,
  jwt: jwtCallback,
  session: sessionCallback,
};
