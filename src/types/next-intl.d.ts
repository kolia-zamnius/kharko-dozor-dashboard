import type auth from "@/i18n/messages/en/auth.json";
import type common from "@/i18n/messages/en/common.json";
import type components from "@/i18n/messages/en/components.json";
import type emailInvite from "@/i18n/messages/en/email-invite.json";
import type emailOtp from "@/i18n/messages/en/email-otp.json";
import type errors from "@/i18n/messages/en/errors.json";
import type marketing from "@/i18n/messages/en/marketing.json";
import type replays from "@/i18n/messages/en/replays.json";
import type settings from "@/i18n/messages/en/settings.json";
import type shell from "@/i18n/messages/en/shell.json";
import type users from "@/i18n/messages/en/users.json";

import type { Locale } from "@/i18n/config";

/**
 * next-intl module augmentation — makes `t("namespace.key")` calls
 * type-safe end-to-end.
 *
 * @remarks
 * `Messages` drives key-level autocomplete and the "missing key"
 * compile error; the English bundle is the canonical shape because
 * every non-default locale must match it (next-intl warns at dev
 * time when a translation file drifts from the type).
 *
 * `Locale` is pinned to our application union (`"en"` today), so
 * typed navigation helpers like `redirect({ locale })` can't be
 * called with a string we don't actually ship.
 *
 * This file lives in `src/types/` because it's a cross-bundle ambient
 * module — feature code imports nothing from it directly, it only
 * reshapes a third-party module's typings.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: {
      common: typeof common;
      errors: typeof errors;
      components: typeof components;
      shell: typeof shell;
      auth: typeof auth;
      users: typeof users;
      replays: typeof replays;
      settings: typeof settings;
      marketing: typeof marketing;
      emailOtp: typeof emailOtp;
      emailInvite: typeof emailInvite;
    };
  }
}
