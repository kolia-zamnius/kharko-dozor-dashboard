import { PlayCircleIcon, UsersIcon } from "@phosphor-icons/react";

// Consumed by `Navbar` (desktop) + `MobileDrawer` (mobile). `as const` keeps
// `labelKey` a literal so `t(item.labelKey)` works without a cast.
export const navItems = [
  { labelKey: "replays", href: "/replays", icon: PlayCircleIcon },
  { labelKey: "users", href: "/users", icon: UsersIcon },
] as const;

export type NavItem = (typeof navItems)[number];
