/**
 * Scoped translator fakes for tests that exercise non-React code paths
 * (email builders, error-copy helpers, zod error map builder) which
 * accept a `ReturnType<typeof useTranslations<Namespace>>` argument.
 *
 * @remarks
 * Two flavours:
 *
 *   - `fakeTranslator(namespace)` — echoes the key verbatim as
 *     `"namespace.key"`. Used by unit tests that assert "some copy was
 *     produced" without caring about wording (e.g. asserting path
 *     prefixing in `localizeZodError`).
 *
 *   - `realTranslator(locale, namespace)` — loads the real JSON file at
 *     `src/i18n/messages/<locale>/<namespace>.json` and hands off to
 *     next-intl's `createTranslator`. Used by email-HTML snapshot tests
 *     and the few assertions that want actual localised copy.
 *
 * Both return a minimal `TestTranslator` type; call sites that hand the
 * translator to a typed consumer (e.g. `otpEmailHtml(token, locale, t)`)
 * use a single documented `as unknown as …` cast — the next-intl
 * runtime shape is a superset of what we expose, and duplicating its
 * generic plumbing here wouldn't add signal.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Locale } from "@/i18n/config";

const here = dirname(fileURLToPath(import.meta.url));
const MESSAGES_ROOT = resolve(here, "..", "..", "src", "i18n", "messages");

export type TestTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  rich: (key: string, values?: Record<string, unknown>) => string;
  markup: (key: string, values?: Record<string, unknown>) => string;
  raw: (key: string) => unknown;
  has: (key: string) => boolean;
};

export function fakeTranslator(namespace: string): TestTranslator {
  const echo = (key: string) => `${namespace}.${key}`;
  const fn = ((key: string) => echo(key)) as TestTranslator;
  fn.rich = (key: string) => echo(key);
  fn.markup = (key: string) => echo(key);
  fn.raw = (key: string) => echo(key);
  fn.has = () => true;
  return fn;
}

/**
 * Map a code-side namespace to its on-disk JSON filename.
 *
 * @remarks
 * Matches the `src/i18n/request.ts` aggregation — most namespaces map
 * 1:1 (`common` → `common.json`), but the two email namespaces use
 * camelCase in code (`emailOtp`, `emailInvite`) and kebab-case on disk
 * (`email-otp.json`, `email-invite.json`). Rather than maintain a
 * duplicate lookup here, we auto-convert camelCase → kebab-case with a
 * single regex — consistent with the kebab-case-on-disk convention, so
 * adding `emailFoo` and `email-foo.json` just works.
 */
function namespaceToFilename(ns: string): string {
  return ns.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * @param namespace - Either a single namespace (`"emailOtp"`) or a dot-nested
 *   path (`"settings.orgs.roles"`). The first segment selects the JSON file;
 *   the full path is passed to next-intl so nested scoping matches the
 *   production `getTranslations({ namespace })` behaviour.
 */
export async function realTranslator(locale: Locale, namespace: string): Promise<TestTranslator> {
  const [topLevel, ...rest] = namespace.split(".");
  if (!topLevel) throw new Error(`realTranslator: empty namespace`);

  const filename = namespaceToFilename(topLevel);
  const path = resolve(MESSAGES_ROOT, locale, `${filename}.json`);
  const raw = await readFile(path, "utf8");
  const fileContents = JSON.parse(raw) as Record<string, unknown>;

  // next-intl expects a `messages` tree that mirrors the nested namespace —
  // so we pass the JSON under its top-level key and hand the full dotted
  // namespace back to `createTranslator`, which walks down.
  const { createTranslator } = await import("next-intl");
  const t = createTranslator({
    locale,
    namespace,
    messages: { [topLevel]: fileContents },
  });
  // `rest` isn't used directly — it's implicit in `namespace` — but the
  // destructuring documents intent for readers.
  void rest;
  return t as unknown as TestTranslator;
}
