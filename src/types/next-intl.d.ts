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
 * To add a namespace: import its JSON above, add the entry to `Messages` below.
 * English is the canonical shape — every other locale must match it.
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
