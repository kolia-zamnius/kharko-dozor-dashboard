/**
 * Self-host swap point — replace `PrismaNeon` with `PrismaPg` here. No env switch
 * by design: single straight-line path beats a config nobody asked for.
 */

import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
