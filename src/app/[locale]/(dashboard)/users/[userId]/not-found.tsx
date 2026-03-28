import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/primitives/button";

/**
 * Route-specific 404 for `/users/[userId]`. Fires when `loadTrackedUserDetail`
 * returns null (deleted user) or when the authenticated admin lacks VIEWER
 * access to the owning organization — the Server Component in `page.tsx`
 * bails to `notFound()` and Next.js mounts this file.
 *
 * Takes over from the parent `(dashboard)/not-found.tsx` so we can offer
 * more actionable recovery — "back to the users list" rather than a
 * generic message.
 */
export default function UserDetailNotFound() {
  const t = useTranslations("users.detail.notFound");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("description")}</p>
      <Button asChild className="mt-6">
        <Link href="/users">{t("backButton")}</Link>
      </Button>
    </div>
  );
}
