"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/overlays/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import { useSwitchOrgMutation } from "@/api-client/organizations/mutations";
import { useOrganizationsQuery } from "@/api-client/organizations/queries";
import { useUserInvitesQuery } from "@/api-client/user-invites/queries";
import { useRouter } from "@/i18n/navigation";
import { useFormatters } from "@/lib/use-formatters";
import {
  ArrowsClockwiseIcon,
  BookOpenIcon,
  CheckIcon,
  GearSixIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useOptimistic, useTransition } from "react";
import { DoubleAvatar } from "./double-avatar";

/**
 * Orgs + invites read via classic (non-Suspense) hooks — navbar renders
 * before any page-level Suspense boundary. In-flight `undefined` tolerated
 * with `?.`. `onSelect={(e) => e.preventDefault()}` on the theme toggle so
 * clicking doesn't dismiss the menu.
 */
export function AvatarDropdown() {
  const t = useTranslations("shell");
  const { formatRole } = useFormatters();
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();
  const { data: orgs = [] } = useOrganizationsQuery();
  const { data: invites = [] } = useUserInvitesQuery();
  const switchOrg = useSwitchOrgMutation();
  const { resolvedTheme, setTheme } = useTheme();

  const activeOrgId = user?.activeOrganizationId ?? null;
  // `useOptimistic` flips the checkmark + identity card on click; auto-reverts
  // when the transition ends (success → fresh JWT via session.update; failure →
  // rolls back). Hides the Auth.js refetch latency.
  const [optimisticActiveOrgId, setOptimisticActiveOrgId] = useOptimistic(activeOrgId);
  const [, startTransition] = useTransition();
  const activeOrg = orgs.find((o) => o.id === optimisticActiveOrgId) ?? null;
  const inviteCount = invites.length;

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const handleSwitchOrg = (orgId: string) => {
    startTransition(async () => {
      setOptimisticActiveOrgId(orgId);
      try {
        await switchOrg.mutateAsync(orgId);
      } catch {
        // `useOptimistic` auto-reverts; toast fires via global `MutationCache.onError`.
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="cursor-pointer rounded-full outline-none focus-visible:ring-0"
        aria-label={t("avatarDropdown.ariaLabel")}
      >
        <DoubleAvatar user={user} orgImage={activeOrg?.image ?? undefined} hasNotification={inviteCount > 0} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              {user?.image ? <AvatarImage src={user.image} alt={user.name || ""} /> : null}
              <AvatarFallback />
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name || t("identity.userFallbackName")}</p>
              <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Avatar size="sm">
              {activeOrg?.image ? <AvatarImage src={activeOrg.image} alt={activeOrg.name} /> : null}
              <AvatarFallback />
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{activeOrg?.name ?? t("identity.personalSpace")}</p>
              <p className="text-muted-foreground truncate text-xs">
                {activeOrg ? formatRole(activeOrg.role) : t("identity.ownerLabel")}
              </p>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowsClockwiseIcon />
            <span>{t("actions.switchOrg")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {orgs.map((org) => {
              const isActive = org.id === optimisticActiveOrgId;
              return (
                <DropdownMenuItem
                  key={org.id}
                  disabled={isActive}
                  onSelect={() => handleSwitchOrg(org.id)}
                  className="gap-3"
                >
                  <Avatar size="sm" className="shrink-0">
                    {org.image ? <AvatarImage src={org.image} alt={org.name} /> : null}
                    <AvatarFallback />
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{org.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{formatRole(org.role)}</p>
                  </div>
                  {isActive && <CheckIcon className="shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onSelect={() => router.push("/settings/organizations")}>
          <UsersThreeIcon />
          <span>{t("actions.manageOrgs")}</span>
          {inviteCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {inviteCount}
            </Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => router.push("/settings/user")}>
          <GearSixIcon />
          <span>{t("actions.userSettings")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Docs + theme group — both are "out of the dashboard flow"
            navigations, intentionally separated from the org/settings
            block above. Docs zone lives outside the `[locale]/` pipeline
            (English-only by design); `asChild` + raw `<a href>` is the
            hard-nav escape hatch — typed `router.push` from
            `@/i18n/navigation` would prefix the locale and 404. */}
        <DropdownMenuItem asChild>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard nav: docs zone is outside the [locale]/ pipeline (see comment above). */}
          <a href="/documentation/introduction">
            <BookOpenIcon />
            <span>{t("actions.documentation")}</span>
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={toggleTheme}>
          <SunIcon className="hidden dark:block" />
          <MoonIcon className="block dark:hidden" />
          <span className="hidden dark:inline">{t("theme.light")}</span>
          <span className="inline dark:hidden">{t("theme.dark")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => signOut()} variant="destructive">
          <SignOutIcon />
          <span>{t("actions.signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
