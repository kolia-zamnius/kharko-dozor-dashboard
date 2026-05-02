import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/server/auth";
import { requireResourceAccess } from "@/server/auth/permissions";
import { prisma } from "@/server/db/client";
import { isHttpError } from "@/server/http-error";
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
 * Server-side cross-org guard: a guessed URL pointing at a session in
 * a different organization (or no session at all) returns the proper
 * 404 page rather than a 200 shell that silently fails its client
 * fetch. Mirrors the users-detail page pattern.
 *
 * Session detail itself is still fetched client-side via
 * `useSessionQuery` inside the update-indicator hook — there's no
 * prefetch here on purpose. The header polls live, and we want that
 * cadence owned by one place (the hook) rather than split between
 * server prefetch and client polling.
 */
export default async function ReplayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    // Defensive — middleware should have redirected already.
    notFound();
  }

  const replay = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { project: { select: { organizationId: true } } },
  });
  if (!replay) notFound();

  try {
    await requireResourceAccess(
      session.user.id,
      session.user.activeOrganizationId,
      replay.project.organizationId,
      "VIEWER",
    );
  } catch (err) {
    if (isHttpError(err)) notFound();
    throw err;
  }

  return <ReplayShell sessionId={sessionId} />;
}
