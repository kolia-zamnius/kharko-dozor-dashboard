import { PlayCircleIcon, UsersIcon } from "@phosphor-icons/react";

/**
 * Single source of truth for the dashboard's top-level navigation.
 *
 * @remarks
 * Consumed by both {@link Navbar} (desktop) and {@link MobileDrawer}
 * (mobile) — adding a route here is a one-line edit that ripples to
 * both surfaces. `labelKey` is a literal string preserved by `as const`
 * so consumers can look it up via `t(item.labelKey)` inside the
 * `shell.nav` namespace without a type cast.
 */
export const navItems = [
  { labelKey: "users", href: "/users", icon: UsersIcon },
  { labelKey: "replays", href: "/replays", icon: PlayCircleIcon },
] as const;

export type NavItem = (typeof navItems)[number];
