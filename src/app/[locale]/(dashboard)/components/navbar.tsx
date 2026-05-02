"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { AvatarDropdown } from "./avatar-dropdown";
import { MobileDrawer } from "./mobile-drawer";
import { navItems } from "./nav-items";

/**
 * Top-of-viewport sticky navbar for the dashboard.
 *
 * @remarks
 * Three-column grid on desktop (`md+`) — logo, centre nav, right
 * cluster — collapses to two columns on mobile where the nav folds
 * into a `MobileDrawer`. Active-link detection uses
 * `pathname.startsWith(item.href)` rather than strict equality so the
 * `/users/[userId]` detail page still highlights the "Users" tab.
 *
 * Nav entries are config-driven via {@link navItems}; adding a route
 * is a one-line edit in `nav-items.ts` and both the desktop nav and
 * the mobile drawer pick it up.
 */
export function Navbar() {
  const t = useTranslations("shell.nav");
  const pathname = usePathname();

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 grid h-14 grid-cols-[1fr_auto] items-center border-b px-4 backdrop-blur md:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center">
        <Image src="/assets/logo.svg" alt="Dozor" width={28} height={28} />
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon size={16} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-end gap-2">
        <div className="hidden md:block">
          <AvatarDropdown />
        </div>

        <MobileDrawer />
      </div>
    </header>
  );
}
