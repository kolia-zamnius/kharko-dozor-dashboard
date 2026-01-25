/**
 * Snapshot tests for the OTP email HTML builder.
 *
 * @remarks
 * One snapshot per locale. Translation edits show up in the
 * `__snapshots__/email-template.test.ts.snap` diff alongside the JSON
 * change, so a PR reviewing new Ukrainian copy sees the rendered HTML
 * at the same time as the translation string.
 *
 * The token, `<html lang>`, and the full CSS block stay identical
 * across locales — the diff surface is just the visible copy. That
 * makes "wait, why did every language just change?" visible at review
 * time if a structural tweak accidentally lands.
 */

import { describe, expect, it } from "vitest";
import type { getTranslations } from "next-intl/server";

import { LOCALES } from "@/i18n/config";

import { realTranslator } from "../../../../tests/helpers/translator";
import { otpEmailHtml } from "./email-template";

type OtpTranslator = Awaited<ReturnType<typeof getTranslations<"emailOtp">>>;

describe("otpEmailHtml", () => {
  it.each(LOCALES)("renders for locale %s", async (locale) => {
    const t = (await realTranslator(locale, "emailOtp")) as unknown as OtpTranslator;
    const html = otpEmailHtml("123456", locale, t);
    expect(html).toMatchSnapshot();
  });

  it("always embeds the provided token verbatim", async () => {
    const t = (await realTranslator("en", "emailOtp")) as unknown as OtpTranslator;
    const html = otpEmailHtml("000111", "en", t);
    expect(html).toContain("000111");
  });

  it("sets <html lang> to the provided locale", async () => {
    const t = (await realTranslator("uk", "emailOtp")) as unknown as OtpTranslator;
    const html = otpEmailHtml("123456", "uk", t);
    expect(html).toMatch(/<html lang="uk">/);
  });
});
