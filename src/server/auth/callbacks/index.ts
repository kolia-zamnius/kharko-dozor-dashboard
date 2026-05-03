import "server-only";
import { jwtCallback } from "@/server/auth/callbacks/jwt";
import { sessionCallback } from "@/server/auth/callbacks/session";
import { signInCallback } from "@/server/auth/callbacks/sign-in";
import type { NextAuthConfig } from "next-auth";

export const authCallbacks: NextAuthConfig["callbacks"] = {
  signIn: signInCallback,
  jwt: jwtCallback,
  session: sessionCallback,
};
