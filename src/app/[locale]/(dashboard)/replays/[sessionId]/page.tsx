import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ReplayShell } from "./components/replay-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("replays.page");
  return { title: t("detailTitle") };
}

/**
 * `/replays/[sessionId]` — Server Component entry for the replay
 * player.
 *
 * @remarks
 * Pure shell: awaits Next.js 16 async `params` and hands off to
 * {@link ReplayShell}, which owns the composition root, polling, and
 * snapshot-diff lifecycle. Session detail itself is fetched client-
 * side via `useSessionQuery` inside the update-indicator hook, so
 * there's nothing to prefetch here — the header polls live, and we
 * want that cadence owned by one place (the hook), not split between
 * server prefetch and client polling.
 */
export default async function ReplayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ReplayShell sessionId={sessionId} />;
}
