/**
 * Module-scoped translator bridge for code that lives outside the React tree.
 *
 * @remarks
 * A handful of cross-cutting concerns fire from places where React hooks
 * are structurally unavailable — most notably `MutationCache.onSuccess`
 * / `onError` in `src/lib/query-client.ts`, which TanStack Query calls
 * on the cache singleton rather than from a component render path. Those
 * handlers still need to produce localised user copy (toasts).
 *
 * The bridge works by having the client provider tree populate a
 * module-level `Translator` instance once per locale switch; any consumer
 * imports `translate()` and gets the current locale's resolution. We
 * deliberately stop short of a full global singleton — no React context
 * registration, no `window` coupling — so server renders aren't affected
 * and SSR hydration stays isolated per request via the standard
 * `NextIntlClientProvider` path.
 *
 * If the bridge is not yet populated (an error fires before `Providers`
 * mounted the wiring `useEffect`), `translate()` returns the key itself.
 * Dev mode logs a warning so the missing wiring is loud; in production
 * the key leaks into the toast, which is still strictly better than a
 * thrown `MutationCache` handler.
 *
 * @see src/app/_providers/i18n-bridge.tsx — client-side wiring site that
 *   calls `setLocaleMessages` via `useEffect` on every locale change.
 * @see src/lib/query-client.ts — primary consumer (reads `mutation.meta`
 *   keys and resolves them through `translate`).
 * @see src/types/tanstack-query.d.ts — where `MessageKey` is threaded
 *   into the `mutationMeta` augmentation so `successKey` / `errorKey`
 *   are type-checked at mutation call sites.
 */

import { createTranslator, type Messages, type NestedKeyOf } from "next-intl";
import type { TranslationValues } from "next-intl";

import type { Locale } from "@/i18n/config";

/**
 * Dot-notation keys into the full `Messages` shape — e.g.
 * `"settings.user.profile.saveName"`. Consumed by `mutation.meta.successKey`
 * / `errorKey` so invalid keys become a compile error at the mutation
 * hook, not a runtime missing-translation at toast time.
 */
export type MessageKey = NestedKeyOf<Messages>;

/**
 * Narrow call shape of the returned translator — `createTranslator` is
 * overload-typed (callable + `.rich` / `.markup` / `.raw` / `.has`
 * members), but the bridge only ever invokes the bare call form, so we
 * expose that directly. Keeps the internal `unknown` cast local to one
 * well-commented line instead of bleeding overload complexity into every
 * consumer.
 */
interface BridgeTranslator {
  (key: MessageKey, values?: TranslationValues): string;
}

let active: BridgeTranslator | null = null;

/**
 * Populate or replace the module-scoped translator. Called from
 * `src/app/_providers/i18n-bridge.tsx` via `useEffect` so the instance tracks the
 * active locale across client-side navigations and future `<LocaleSelect>`
 * switches without a full page reload.
 */
export function setLocaleMessages(locale: Locale, messages: Messages): void {
  const translator = createTranslator({ locale, messages });
  // next-intl's generic callable exposes a rich overload set we don't use
  // here (`rich` / `markup` / `raw` / `has`). Narrowing to our single call
  // shape is safe because `MessageKey` already matches the overload's key
  // constraint; the cast just drops the extra members so downstream code
  // doesn't have to carry the generic signature.
  active = translator as unknown as BridgeTranslator;
}

/**
 * Resolve a message key to localised copy using the currently-active
 * translator. Safe to call before the bridge is wired — returns the key
 * verbatim with a dev-mode warning so the missing wiring surfaces fast.
 */
export function translate(key: MessageKey, values?: TranslationValues): string {
  if (!active) {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.warn("[imperative-translator] translator not initialised, falling back to key:", key);
    }
    return key;
  }
  return active(key, values);
}
