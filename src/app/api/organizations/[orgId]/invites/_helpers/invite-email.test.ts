/**
 * Snapshot tests for the invite email HTML builder.
 *
 * @remarks
 * Exercises the ICU `select` role interpolation via `t.markup` — the
 * rendered body inserts `<strong>Admin</strong>` (or the localised
 * role label) so a translation regression that drops the `<strong>`
 * tags, or picks the wrong case form in a language like Ukrainian,
 * fails the snapshot immediately.
 *
 * Covers all three roles in the en snapshot + spreads locales across
 * the remaining fixed role so the total file size stays reasonable
 * while every branch is still exercised.
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
      // EN copy maps OWNER → Owner, ADMIN → Admin, VIEWER → Viewer.
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
    // 3 days in English → "3 days"; 1 day would render as "1 day".
    const html = await render("en");
    expect(html).toContain("3 days");
  });
});
