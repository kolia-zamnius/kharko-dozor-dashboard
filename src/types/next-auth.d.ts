import "next-auth";
import "next-auth/jwt";
import type { Locale } from "@/i18n/config";
import type { UserId } from "./ids";

/**
 * Adding a field to `session.user` is 3 places: declare here, write in
 * {@link src/server/auth/callbacks/jwt.ts}, project in
 * {@link src/server/auth/callbacks/session.ts}.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: UserId;
      email: string;
      name: string;
      image: string;
      activeOrganizationId: string | null;
      locale: Locale;
    };
  }
}

/**
 * Optional because the first jwt-callback fires before the populate branch.
 * `email` / `name` / `picture` stay Auth.js-owned — not redeclared here.
 */
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    activeOrganizationId?: string | null;
    locale?: string;
  }
}
