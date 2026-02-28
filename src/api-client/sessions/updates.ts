import type { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { SessionDetail } from "./types";

/**
 * Discriminated union describing what changed between two snapshots of
 * the same session. Every variant carries the delta magnitude so the
 * UI can render precise copy ("2 new slices, 17 new events") instead
 * of a binary "something changed".
 *
 * The `type` tag keeps consumers honest at the switch/match boundary —
 * if a new variant is added here, TypeScript will flag every exhaustive
 * rendering site without a default branch.
 */
export type SessionUpdate =
  | { type: "new-slices"; count: number }
  | { type: "new-events"; count: number }
  | { type: "ended" };

/**
 * Compare the admin's on-screen snapshot against the latest server-
 * known state and return the ordered list of differences. Order
 * matches the tooltip template: slices → events → ended.
 *
 * Returns an empty array when snapshots agree — call sites can treat
 * `updates.length > 0` as "has updates" without needing a separate
 * boolean.
 *
 * Deliberately shallow: compares counts and the `endedAt` flip only.
 * We don't diff individual slice rows because the server never mutates
 * historical slices — new data only appends. If that invariant ever
 * changes, this function becomes the single place to teach deeper diff
 * logic, which is why it's a pure standalone utility instead of being
 * inlined into the hook.
 */
export function detectSessionUpdates(snapshot: SessionDetail, latest: SessionDetail): SessionUpdate[] {
  const updates: SessionUpdate[] = [];

  const newSliceCount = latest.slices.length - snapshot.slices.length;
  if (newSliceCount > 0) {
    updates.push({ type: "new-slices", count: newSliceCount });
  }

  const newEventCount = latest.eventCount - snapshot.eventCount;
  if (newEventCount > 0) {
    updates.push({ type: "new-events", count: newEventCount });
  }

  if (snapshot.endedAt === null && latest.endedAt !== null) {
    updates.push({ type: "ended" });
  }

  return updates;
}

type UpdateTooltipTranslator = ReturnType<typeof useTranslations<"replays.detail.updateTooltip">>;

/**
 * Human-readable tooltip for the refresh button. Composes a comma-
 * separated summary of every non-empty update variant, followed by a
 * call-to-action tail sourced from the caller's localised translator.
 *
 * Returns null when there are no updates — call sites use that to
 * disable the button and suppress the tooltip entirely (no "click to
 * reload" text when there's nothing to reload).
 *
 * `t` is a scoped translator (`useTranslations("replays.detail.updateTooltip")`),
 * passed in rather than looked up inside so this module stays free of
 * `"use client"` and can be called from any caller already in client
 * context.
 */
export function formatUpdateTooltip(updates: SessionUpdate[], t: UpdateTooltipTranslator): string | null {
  if (updates.length === 0) return null;

  const parts: string[] = [];
  for (const update of updates) {
    switch (update.type) {
      case "new-slices":
        parts.push(t("newSlices", { count: update.count }));
        break;
      case "new-events":
        parts.push(t("newEvents", { count: update.count }));
        break;
      case "ended":
        parts.push(t("ended"));
        break;
      default:
        assertNever(update);
    }
  }

  return `${parts.join(", ")} • ${t("suffix")}`;
}
