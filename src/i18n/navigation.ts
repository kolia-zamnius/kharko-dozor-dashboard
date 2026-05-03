import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Use these instead of `next/link` / `next/navigation` everywhere in `src/app/`.
 * `pathname` is a template path (`/users/[userId]`) so a missing param is a compile
 * error, not a runtime 404. Server-side `redirect` from route handlers must come
 * from here too — `next/navigation`'s `redirect` strips the active locale prefix.
 */
export const { Link, redirect, useRouter, usePathname, getPathname } = createNavigation(routing);
