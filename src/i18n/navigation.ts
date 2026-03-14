import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Typed, locale-aware replacements for the stock `next/link`,
 * `next/navigation` exports.
 *
 * @remarks
 * Prefer these over `next/link` and `next/navigation` everywhere in
 * `src/app/` — they transparently prepend the active locale prefix
 * when it's non-default (`/uk/users`) and strip it for the default
 * locale (`/users`), matching the `"as-needed"` strategy declared in
 * `./routing.ts`. The `pathname` argument is a **template path**
 * (`/users/[userId]`), not a concrete URL — next-intl builds the final
 * URL from `pathname` + `params` + active locale so a missing param
 * is a compile error, not a runtime 404.
 *
 * Server-side redirects from route handlers and Server Actions go
 * through the `redirect` exported here too — don't import `redirect`
 * from `next/navigation`, or you'll strip the active locale prefix.
 */
export const { Link, redirect, useRouter, usePathname, getPathname } = createNavigation(routing);
