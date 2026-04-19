import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/primitives/button";

/**
 * Global fallback for any URL inside the `[locale]/` segment that
 * doesn't match a defined route.
 *
 * @remarks
 * Renders a proper 404 surface with a "Go to Dashboard" action — the
 * button points at `/users`, which resolves correctly for both
 * audiences:
 *
 *   - **Signed-in caller** — `/users` loads the dashboard home.
 *   - **Anonymous caller** — `proxy.ts` catches `/users` on the
 *     follow-up request, sees no session, and redirects to
 *     `/sign-in?callbackUrl=/users`. One button, works for both,
 *     without this page needing to read the session itself.
 *
 * Implementation notes:
 *   - Uses `getTranslations` (async server API) instead of
 *     `useTranslations` — `not-found.tsx` can be rendered outside
 *     the normal `[locale]/layout.tsx` wrapping when `notFound()`
 *     is triggered from within that layout, and `getTranslations`
 *     doesn't depend on the client provider chain being in place.
 *   - Uses a plain `<a href>` (not `next/link`) so the click
 *     triggers a **hard navigation** — full page reload, middleware
 *     re-runs. `next/link` does soft navigation by default, which
 *     can leave the 404 UI mounted after a same-origin push; the
 *     browser stays on this component even after the router
 *     advances. Hard nav is the cheap, reliable fix for an
 *     "escape hatch" button that has to work no matter how broken
 *     the route state is.
 *
 * Route-specific 404s (`users/[userId]/not-found.tsx` for a deleted
 * tracked user) still render their own actionable UI — this fallback
 * only fires for paths that don't belong to any segment at all.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("common.notFound");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("description")}</p>
      <Button asChild className="mt-6">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard nav (see JSDoc above) */}
        <a href="/users">{t("goToDashboard")}</a>
      </Button>
    </div>
  );
}
