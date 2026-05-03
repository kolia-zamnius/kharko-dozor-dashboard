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
 * Server-side cross-org guard so a guessed URL returns a real 404 (not a
 * 200 shell that silently fails). No prefetch — `useSessionQuery` polls live
 * and that cadence stays owned by one place (the indicator hook).
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
