import "@tanstack/react-query";

import type { TranslationValues } from "next-intl";

import type { MessageKey } from "@/i18n/imperative-translator";

/**
 * Global typing for `mutation.meta` — drives the toast-on-success /
 * toast-on-error cross-cutting concern in `src/lib/query-client.ts`.
 *
 * @remarks
 * Must live in a root-level `.d.ts` so TypeScript picks it up regardless
 * of which module imports TanStack Query first. Putting the same
 * `declare module` inside `lib/query-client.ts` (where the cache
 * handlers live) would still work, but interface merging means both
 * copies would have to stay in sync by hand — a narrower `successKey`
 * in one place would silently intersect with a broader one elsewhere
 * and erase the richer type. One declaration, one source of truth.
 *
 * Meta is **key-based** rather than prose-based: the handler reads
 * `successKey` / `errorKey` and resolves it through the module-scoped
 * `translate()` bridge, which gives us:
 *
 *   1. Compile-time validation of every toast key against the actual
 *      message JSON (invalid key → TS error at the mutation hook).
 *   2. Locale-aware resolution without threading `useTranslations` into
 *      every hook — the cache handler lives outside React.
 *   3. ICU interpolation support via `*Vars`, including the dynamic
 *      variant where the key or vars depend on the mutation variables.
 *
 * Prose used to live here directly — see the migration preamble in
 * `CLAUDE.md::Current stage` for why that was the wrong shape.
 *
 * @see src/i18n/imperative-translator.ts — MessageKey + translate() bridge.
 * @see src/lib/query-client.ts — `MutationCache.onSuccess` / `onError`
 *   consumers that read `mutation.meta`.
 */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * i18n key for the toast shown when the mutation rejects. Used only
       * if the server didn't ship a more specific message (the global
       * handler prefers `ApiError.message` when available).
       *
       * Function form reads the key from the mutation variables — rarely
       * needed for errors, included for symmetry with `successKey`.
       */
      errorKey?: MessageKey | ((variables: unknown) => MessageKey);
      /**
       * ICU variables for `errorKey` interpolation. Function form reads
       * from the variables passed to `mutate()`.
       */
      errorVars?: TranslationValues | ((variables: unknown) => TranslationValues);
      /**
       * i18n key for the toast shown on success. Function form computes
       * the key from the variables — e.g. a dual-purpose mutation that
       * picks between "Avatar regenerated" and "Organization updated"
       * based on which field was touched.
       */
      successKey?: MessageKey | ((variables: unknown) => MessageKey);
      /**
       * ICU variables for `successKey` interpolation. Function form lets
       * hooks surface variables (e.g. an email address or role name)
       * that are known only at `mutate()` time.
       */
      successVars?: TranslationValues | ((variables: unknown) => TranslationValues);
    };
  }
}
