/**
 * Bridge for callers that fire outside the React tree — primarily the global
 * `MutationCache` handlers in {@link src/lib/query-client.ts}. The provider's
 * `useEffect` populates this once per locale switch. Falls back to the key
 * verbatim when not yet initialised (dev warns; prod fails-safe to a visible key
 * in the toast — better than a thrown handler).
 */

import { createTranslator, type Messages, type NestedKeyOf } from "next-intl";
import type { TranslationValues } from "next-intl";

import type { Locale } from "@/i18n/config";

/**
 * Dot-notation keys against the full `Messages` shape. Used by `mutation.meta.successKey`
 * / `errorKey` so an invalid key is a compile error at the mutation hook, not a
 * runtime missing-translation.
 */
export type MessageKey = NestedKeyOf<Messages>;

/**
 * Narrowed call shape — `createTranslator` returns an overload set (call + `.rich` /
 * `.markup` / `.raw` / `.has`); we only use the bare call, so the cast in
 * `setLocaleMessages` drops the extras to keep consumer signatures simple.
 */
interface BridgeTranslator {
  (key: MessageKey, values?: TranslationValues): string;
}

let active: BridgeTranslator | null = null;

export function setLocaleMessages(locale: Locale, messages: Messages): void {
  const translator = createTranslator({ locale, messages });
  // Cast safe — `MessageKey` already matches the overload's key constraint.
  active = translator as unknown as BridgeTranslator;
}

export function translate(key: MessageKey, values?: TranslationValues): string {
  if (!active) {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.warn("[imperative-translator] translator not initialised, falling back to key:", key);
    }
    return key;
  }
  return active(key, values);
}
