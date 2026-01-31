import "next-auth";
import type { Locale } from "@/i18n/config";
import type { UserId } from "./ids";

/**
 * Augmented `Session["user"]` shape for the dashboard.
 *
 * @remarks
 * The stock NextAuth `Session["user"]` type is `{ name?: string | null;
 * email?: string | null; image?: string | null }` — nullable and
 * optional throughout. Our app guarantees every field after the
 * sign-in flow runs (adapter sets an avatar, JWT callback populates
 * id / activeOrganizationId), so we narrow the shape here instead of
 * forcing every consumer to write `session.user?.id ?? ""`.
 *
 * The file must live at the module-root level (and the `import
 * "next-auth"` line must stay — it's what marks this as augmentation
 * rather than a fresh declaration) so TypeScript applies the merge
 * regardless of which file imports NextAuth first.
 *
 * Adding a field here is step 1 of 3 — it also has to be written in
 * `src/server/auth/callbacks/jwt.ts` and projected back in
 * `src/server/auth/callbacks/session.ts`, otherwise consumers will
 * read `undefined` at runtime despite the type saying otherwise.
 *
 * @see src/server/auth/callbacks/session.ts — projects token → session.
 * @see src/server/auth/callbacks/jwt.ts — writes token claims.
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
