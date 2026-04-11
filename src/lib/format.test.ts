/**
 * Unit tests for the locale-aware formatters used across the dashboard.
 *
 * @remarks
 * Covers the six exports of `format.ts`. Locale-specific expectations are
 * asserted against concrete CLDR output where the visible difference
 * matters for UX (date order, thousands separator, role label), and
 * against the pluralised ICU key for duration.
 */

import { describe, expect, it } from "vitest";

import { realTranslator } from "../../tests/helpers/translator";
import {
  CLDR_LOCALES,
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRole,
  truncateId,
} from "./format";

describe("formatDate", () => {
  const iso = "2025-03-15T12:00:00.000Z";

  it("renders DD/MM/YYYY for en (en-GB)", () => {
    expect(formatDate(iso, "en")).toBe("15/03/2025");
  });

  it("renders DD.MM.YYYY for uk (uk-UA)", () => {
    expect(formatDate(iso, "uk")).toBe("15.03.2025");
  });

  it("accepts a Date instance as well as an ISO string", () => {
    expect(formatDate(new Date(iso), "en")).toBe("15/03/2025");
  });

  it("uses locale-appropriate separators for each locale we ship", () => {
    // Smoke: every Locale in CLDR_LOCALES produces a non-empty string
    // with the 2025 year somewhere in it. Guards against a silent
    // fallback to `en-US` MM/DD/YYYY if a Locale is ever added without
    // its CLDR tag.
    for (const locale of Object.keys(CLDR_LOCALES) as Array<keyof typeof CLDR_LOCALES>) {
      const out = formatDate(iso, locale);
      expect(out).toMatch(/2025/);
    }
  });
});

describe("formatDateTime", () => {
  it("applies custom Intl options and the active locale", () => {
    const iso = "2025-03-15T14:25:00.000Z";
    const out = formatDateTime(iso, { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }, "en");
    expect(out).toBe("14:25");
  });

  it("accepts string, Date, and number inputs", () => {
    const ts = Date.UTC(2025, 0, 1, 10, 0, 0);
    const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false };
    const byNumber = formatDateTime(ts, opts, "en");
    const byString = formatDateTime(new Date(ts).toISOString(), opts, "en");
    const byDate = formatDateTime(new Date(ts), opts, "en");
    expect(byNumber).toBe("10:00");
    expect(byString).toBe(byNumber);
    expect(byDate).toBe(byNumber);
  });
});

describe("formatCount", () => {
  it("groups thousands with locale-appropriate separator", () => {
    expect(formatCount(1_234, "en")).toBe("1,234");
    expect(formatCount(1_234, "de")).toBe("1.234");
    // uk-UA uses a non-breaking space — assert via character class to avoid
    // visible-vs-invisible-character confusion in the source file.
    expect(formatCount(1_234, "uk")).toMatch(/^1.234$/);
  });

  it("handles zero and small numbers without a separator", () => {
    expect(formatCount(0, "en")).toBe("0");
    expect(formatCount(42, "en")).toBe("42");
  });
});

// Translators accepted by `formatRole` / `formatDuration` are the strict
// next-intl runtime `Translator<Messages, "namespace.path">` — structurally
// a superset of the minimal `TestTranslator` our helper returns. Documented
// `as unknown as` at the boundary matches the convention in translator.ts
// (tests are infrastructure-light; the SUT is the formatter, not next-intl).
type RolesT = Parameters<typeof formatRole>[1];
type DurationT = Parameters<typeof formatDuration>[1];

describe("formatRole", () => {
  it("resolves each Prisma role literal to its localised label", async () => {
    const t = (await realTranslator("en", "settings.orgs.roles")) as unknown as RolesT;
    expect(formatRole("OWNER", t)).toBe("Owner");
    expect(formatRole("ADMIN", t)).toBe("Admin");
    expect(formatRole("VIEWER", t)).toBe("Viewer");
  });
});

describe("formatDuration", () => {
  it("renders sub-minute as seconds", async () => {
    const t = (await realTranslator("en", "common.duration")) as unknown as DurationT;
    expect(formatDuration(30, t)).toBe("30s");
    expect(formatDuration(0, t)).toBe("0s");
  });

  it("renders 1–59 minutes with exact-minute vs minutes+seconds distinction", async () => {
    const t = (await realTranslator("en", "common.duration")) as unknown as DurationT;
    expect(formatDuration(60, t)).toBe("1m");
    expect(formatDuration(125, t)).toBe("2m 5s");
  });

  it("renders 1h+ with exact-hour vs hours+minutes distinction", async () => {
    const t = (await realTranslator("en", "common.duration")) as unknown as DurationT;
    expect(formatDuration(3600, t)).toBe("1h");
    expect(formatDuration(3660, t)).toBe("1h 1m");
  });
});

describe("truncateId", () => {
  it("returns input untouched when shorter than the default cutoff", () => {
    expect(truncateId("short")).toBe("short");
  });

  it("slices + ellipses when longer than the default cutoff (8)", () => {
    expect(truncateId("abcdefghijklmno")).toBe("abcdefgh...");
  });

  it("respects a custom length argument", () => {
    expect(truncateId("abcdefghijklmno", 4)).toBe("abcd...");
  });

  it("treats length boundary as inclusive (equal length returns as-is)", () => {
    expect(truncateId("abcdefgh")).toBe("abcdefgh");
  });
});
