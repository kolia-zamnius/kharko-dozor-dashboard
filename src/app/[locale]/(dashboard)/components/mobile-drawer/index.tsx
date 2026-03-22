"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives/avatar";
import { Badge } from "@/components/ui/primitives/badge";
import { Button } from "@/components/ui/primitives/button";
import { Separator } from "@/components/ui/primitives/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/overlays/sheet";
import { useSwitchOrgMutation } from "@/api-client/organizations/mutations";
import { useOrganizationsQuery } from "@/api-client/organizations/queries";
import { useUserInvitesQuery } from "@/api-client/user-invites/queries";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useFormatters } from "@/lib/use-formatters";
import {
  CaretDownIcon,
  GearSixIcon,
  ListIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { VisuallyHidden } from "radix-ui";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { navItems } from "../nav-items";
import { OrgList } from "./org-list";

/**
 * Mobile replacement for the desktop `AvatarDropdown` + horizontal
 * navigation.
 *
 * @remarks
 * Uses a Radix Sheet instead of a Dropdown because dropdowns on
 * touch devices clip against the viewport edge and have poor scroll
 * behaviour. The sheet slides in from the right and stacks content
 * vertically:
 *   1. Identity header (user + active-org rows).
 *   2. Collapsible "Switch organization" accordion — we render the
 *      org list inline rather than in a nested sub-sheet because
 *      stacked sheets on mobile feel heavy-handed and break the
 *      expected back-gesture.
 *   3. Main nav (driven by the same `navItems` config the desktop
 *      navbar consumes — single source of truth).
 *   4. Settings + theme + sign-out actions.
 *
 * `onOpenChange` collapses the org accordion when the drawer closes
 * so the next open doesn't start mid-expanded. Sheet title is
 * visually hidden — Radix requires one for a11y but the identity
 * header below already communicates context.
 */
export function MobileDrawer() {
  const t = useTranslations("shell");
  const tNav = useTranslations("shell.nav");
  const { formatRole } = useFormatters();
  const { data: session } = useSession();
  const user = session?.user;
  const pathname = usePathname();
  const router = useRouter();
  const { data: orgs = [] } = useOrganizationsQuery();
  const { data: invites = [] } = useUserInvitesQuery();
  const switchOrg = useSwitchOrgMutation();
  const { resolvedTheme, setTheme } = useTheme();

  const activeOrgId = user?.activeOrganizationId ?? null;
  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;
  const inviteCount = invites.length;

  const [isOpen, setIsOpen] = useState(false);
  const [orgListOpen, setOrgListOpen] = useState(false);

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setOrgListOpen(false);
      }}
    >
      <SheetTrigger
        aria-label={inviteCount > 0 ? t("drawer.openMenuWithInvites", { count: inviteCount }) : t("drawer.openMenu")}
        className="text-foreground hover:bg-muted relative inline-flex size-12 items-center justify-center rounded-md md:hidden"
      >
        <ListIcon size={20} />
        {inviteCount > 0 && (
          <span
            aria-hidden
            className="bg-destructive ring-background pointer-events-none absolute top-2.5 right-2.5 size-2.5 rounded-full ring-2"
          />
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col p-0">
        <VisuallyHidden.Root>
          <SheetTitle>{t("drawer.title")}</SheetTitle>
        </VisuallyHidden.Root>

        <SheetHeader className="gap-4">
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{activeOrg?.name ?? t("identity.personalSpace")}</p>
              <p className="text-muted-foreground truncate text-xs">
                {activeOrg ? formatRole(activeOrg.role) : t("identity.ownerLabel")}
              </p>
            </div>
          </div>

          <div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setOrgListOpen(!orgListOpen)}
            >
              <CaretDownIcon className={orgListOpen ? "rotate-180" : ""} />
              {t("actions.switchOrg")}
            </Button>

            {orgListOpen && (
              <OrgList
                orgs={orgs}
                activeOrgId={activeOrgId}
                onSelect={(id) => {
                  switchOrg.mutate(id);
                  setOrgListOpen(false);
                }}
              />
            )}
          </div>
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-auto p-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
                  )}
                >
                  <item.icon size={18} />
                  {tNav(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </div>

        <Separator />

        <div className="flex flex-col gap-1 p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              router.push("/settings/organizations");
              setIsOpen(false);
            }}
          >
            <UsersThreeIcon />
            {t("actions.manageOrgs")}
            {inviteCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {inviteCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              router.push("/settings/user");
              setIsOpen(false);
            }}
          >
            <GearSixIcon />
            {t("actions.userSettings")}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
            <SunIcon className="hidden dark:block" />
            <MoonIcon className="block dark:hidden" />
            <span className="hidden dark:inline">{t("theme.light")}</span>
            <span className="inline dark:hidden">{t("theme.dark")}</span>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <SignOutIcon />
            {t("actions.signOut")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
