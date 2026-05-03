import "@tanstack/react-query";

import type { TranslationValues } from "next-intl";

import type { MessageKey } from "@/i18n/imperative-translator";

/**
 * Mutation `meta` — set `successKey` / `errorKey` and the global handler in
 * {@link src/lib/query-client.ts} fires a localized toast. Function form when
 * the key depends on `mutate()` args.
 */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorKey?: MessageKey | ((variables: unknown) => MessageKey);
      errorVars?: TranslationValues | ((variables: unknown) => TranslationValues);
      successKey?: MessageKey | ((variables: unknown) => MessageKey);
      successVars?: TranslationValues | ((variables: unknown) => TranslationValues);
    };
  }
}
