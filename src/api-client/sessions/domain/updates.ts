import type { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { SessionDetail } from "../schemas";

/** Discriminated `type` so consumers exhaustively switch — adding a variant flags every site. */
export type SessionUpdate = { type: "new-events"; count: number } | { type: "ended" };

/**
 * Compares the admin's on-screen snapshot against the latest server state.
 * Order matches the tooltip template: events → ended. Server only appends, so
 * shallow comparison is enough. Empty array = no updates (callers use
 * `length > 0` as the has-updates flag).
 */
export function detectSessionUpdates(snapshot: SessionDetail, latest: SessionDetail): SessionUpdate[] {
  const updates: SessionUpdate[] = [];

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
 * Returns null when no updates — call sites use null to disable the button and
 * suppress the tooltip. `t` is injected so this module stays free of
 * `"use client"`.
 */
export function formatUpdateTooltip(updates: SessionUpdate[], t: UpdateTooltipTranslator): string | null {
  if (updates.length === 0) return null;

  const parts: string[] = [];
  for (const update of updates) {
    switch (update.type) {
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
