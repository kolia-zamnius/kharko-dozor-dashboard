/**
 * Translator fakes for non-React paths (email builders, error-copy helpers,
 * zod error map builder) that take a `ReturnType<typeof useTranslations<Ns>>`.
 *
 * `fakeTranslator` echoes `"namespace.key"` for tests that only care a key was
 * resolved. `realTranslator` loads the actual JSON and hands off to next-intl —
 * used by email-HTML snapshot tests.
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
 * Code-side namespaces are camelCase (`emailOtp`), on-disk JSONs are kebab-case
 * (`email-otp.json`). Auto-converting beats maintaining a duplicate lookup —
 * adding `emailFoo` + `email-foo.json` Just Works.
 */
function namespaceToFilename(ns: string): string {
  return ns.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * `namespace` accepts dot-nested paths (`"settings.orgs.roles"`) — first segment
 * picks the JSON file, full path is forwarded to next-intl so nested scoping
 * matches `getTranslations({ namespace })` in production.
 */
export async function realTranslator(locale: Locale, namespace: string): Promise<TestTranslator> {
  const [topLevel, ...rest] = namespace.split(".");
  if (!topLevel) throw new Error(`realTranslator: empty namespace`);

  const filename = namespaceToFilename(topLevel);
  const path = resolve(MESSAGES_ROOT, locale, `${filename}.json`);
  const raw = await readFile(path, "utf8");
  const fileContents = JSON.parse(raw) as Record<string, unknown>;

  // next-intl walks a `messages` tree mirroring the dotted namespace, so we
  // pass the JSON under its top-level key and let `createTranslator` descend.
  const { createTranslator } = await import("next-intl");
  const t = createTranslator({
    locale,
    namespace,
    messages: { [topLevel]: fileContents },
  });
  // `rest` is implicit in `namespace`; destructured to document intent.
  void rest;
  return t as unknown as TestTranslator;
}
