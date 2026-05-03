/**
 * Drift sentry — translation regressions that drop `<strong>` tags or pick the
 * wrong UK case form fail the snapshot immediately. EN covers all three roles;
 * other locales fix to ADMIN to keep snapshot size reasonable.
 */

import { describe, expect, it } from "vitest";
import type { getTranslations } from "next-intl/server";

import { LOCALES } from "@/i18n/config";

import { realTranslator } from "../../../../../../../tests/helpers/translator";
import { inviteEmailHtml } from "./invite-email";

type InviteTranslator = Awaited<ReturnType<typeof getTranslations<"emailInvite">>>;

async function render(locale: (typeof LOCALES)[number], role: "OWNER" | "ADMIN" | "VIEWER" = "ADMIN"): Promise<string> {
  const t = (await realTranslator(locale, "emailInvite")) as unknown as InviteTranslator;
  return inviteEmailHtml({
    locale,
    orgName: "Acme Team",
    inviterName: "Alice Rogers",
    role,
    expiryDays: 3,
    t,
  });
}

describe("inviteEmailHtml", () => {
  it.each(LOCALES)("renders for locale %s (role=ADMIN)", async (locale) => {
    expect(await render(locale)).toMatchSnapshot();
  });

  it.each(["OWNER", "ADMIN", "VIEWER"] as const)(
    "role=%s resolves to the localised role label via ICU select",
    async (role) => {
      const html = await render("en", role);
      const expected = role[0] + role.slice(1).toLowerCase();
      expect(html).toContain(`<strong>${expected}</strong>`);
    },
  );

  it("sets <html lang> to the provided locale", async () => {
    const html = await render("de");
    expect(html).toMatch(/<html lang="de">/);
  });

  it("renders the accept link at /settings/organizations", async () => {
    const html = await render("en");
    expect(html).toMatch(/href="[^"]+\/settings\/organizations"/);
  });

  it("pluralises the expiry footer (ICU plural)", async () => {
    const html = await render("en");
    expect(html).toContain("3 days");
  });
});
