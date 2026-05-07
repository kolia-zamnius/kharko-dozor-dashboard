/**
 * Plain async factories — not `fishery`/`rosie`. Real Prisma writes give us id
 * generation, FK constraints, and `@updatedAt` triggers for free, and explicit
 * `{ owner }` / `{ organization }` args make test bodies read declaratively
 * instead of asking "what random user owns my org?".
 */

import { randomBytes, randomUUID } from "node:crypto";

import type {
  Account,
  Authenticator,
  Invite,
  InviteStatus,
  Membership,
  Organization,
  OrgType,
  Project,
  Role,
  Session,
  TrackedUser,
  User,
} from "@/generated/prisma/client";

import { getTestPrisma } from "./db";

function randomApiKey(): string {
  return `dp_${randomBytes(16).toString("hex")}`;
}

type UserOverrides = Partial<{
  email: string;
  name: string | null;
  locale: string;
  image: string;
  activeOrganizationId: string | null;
}>;

/** Email defaults to `user-<uuid>@test.local` so unargumented calls don't collide on `email @unique`. */
export async function createUser(overrides: UserOverrides = {}): Promise<User> {
  const prisma = await getTestPrisma();
  const id = randomUUID();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${id}@test.local`,
      image: overrides.image ?? `https://example.invalid/avatar/${id}`,
      name: overrides.name ?? null,
      locale: overrides.locale ?? "en",
      activeOrganizationId: overrides.activeOrganizationId ?? null,
    },
  });
}

/** Creates the OWNER `Membership` in the same transaction — mirrors the Auth.js `createUser` event for personal orgs. */
export async function createOrganization(args: {
  owner: User;
  type?: OrgType;
  name?: string;
  image?: string;
}): Promise<Organization> {
  const prisma = await getTestPrisma();
  return prisma.organization.create({
    data: {
      name: args.name ?? `Org ${randomUUID().slice(0, 8)}`,
      image: args.image ?? `https://example.invalid/org/${randomUUID()}`,
      type: args.type ?? "TEAM",
      createdById: args.owner.id,
      memberships: {
        create: {
          userId: args.owner.id,
          role: "OWNER",
        },
      },
    },
  });
}

export async function createMembership(args: {
  user: User;
  organization: Organization;
  role?: Role;
}): Promise<Membership> {
  const prisma = await getTestPrisma();
  return prisma.membership.create({
    data: {
      userId: args.user.id,
      organizationId: args.organization.id,
      role: args.role ?? "VIEWER",
    },
  });
}

export async function createProject(args: {
  organization: Organization;
  name?: string;
  key?: string;
  defaultDisplayNameTraitKey?: string | null;
}): Promise<Project> {
  const prisma = await getTestPrisma();
  return prisma.project.create({
    data: {
      name: args.name ?? `Project ${randomUUID().slice(0, 8)}`,
      key: args.key ?? randomApiKey(),
      organizationId: args.organization.id,
      defaultDisplayNameTraitKey: args.defaultDisplayNameTraitKey ?? null,
    },
  });
}

export async function createTrackedUser(args: {
  project: Project;
  externalId?: string;
  traits?: Record<string, unknown> | null;
  customName?: string | null;
  displayNameTraitKey?: string | null;
}): Promise<TrackedUser> {
  const prisma = await getTestPrisma();
  return prisma.trackedUser.create({
    data: {
      externalId: args.externalId ?? `ext-${randomUUID()}`,
      projectId: args.project.id,
      traits: (args.traits ?? null) as Parameters<typeof prisma.trackedUser.create>[0]["data"]["traits"],
      customName: args.customName ?? null,
      displayNameTraitKey: args.displayNameTraitKey ?? null,
    },
  });
}

export async function createSession(args: {
  project: Project;
  trackedUser?: TrackedUser;
  externalId?: string;
  startedAt?: Date;
  endedAt?: Date | null;
  /** Backdating hook for date-range filter and retention-cron tests — Prisma stamps `createdAt` at insert by default. */
  createdAt?: Date;
  /** Default 50 — keeps factory rows above the throwaway-session floor. Pass `0`/small values to seed a throwaway. */
  eventCount?: number;
  /** Default 60s — keeps factory rows above the throwaway-session duration floor. */
  duration?: number;
}): Promise<Session> {
  const prisma = await getTestPrisma();
  return prisma.session.create({
    data: {
      externalId: args.externalId ?? `sess-${randomUUID()}`,
      projectId: args.project.id,
      trackedUserId: args.trackedUser?.id ?? null,
      startedAt: args.startedAt ?? new Date(),
      endedAt: args.endedAt ?? null,
      eventCount: args.eventCount ?? 50,
      duration: args.duration ?? 60,
      ...(args.createdAt ? { createdAt: args.createdAt } : {}),
    },
  });
}

/**
 * `providerAccountId` is randomised per call so repeated invocations don't
 * collide on the adapter's `(provider, providerAccountId)` unique index.
 */
export async function createAccount(args: { user: User; provider: string }): Promise<Account> {
  const prisma = await getTestPrisma();
  return prisma.account.create({
    data: {
      userId: args.user.id,
      type: "oauth",
      provider: args.provider,
      providerAccountId: randomUUID(),
    },
  });
}

/**
 * Crypto fields are dummy — the rename + delete handlers we test only inspect
 * `(credentialID, userId)`, never verify a signature.
 */
export async function createAuthenticator(args: { user: User; name?: string }): Promise<Authenticator> {
  const prisma = await getTestPrisma();
  const { randomBytes } = await import("node:crypto");
  return prisma.authenticator.create({
    data: {
      credentialID: `cred_${randomUUID()}`,
      userId: args.user.id,
      providerAccountId: randomUUID(),
      credentialPublicKey: randomBytes(32).toString("base64"),
      counter: 0,
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
      transports: "internal",
      name: args.name ?? "Test Passkey",
    },
  });
}

export async function createInvite(args: {
  organization: Organization;
  email: string;
  invitedBy: User;
  role?: Role;
  status?: InviteStatus;
  expiresAt?: Date;
}): Promise<Invite> {
  const prisma = await getTestPrisma();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  return prisma.invite.create({
    data: {
      email: args.email,
      organizationId: args.organization.id,
      role: args.role ?? "VIEWER",
      invitedById: args.invitedBy.id,
      status: args.status ?? "PENDING",
      expiresAt: args.expiresAt ?? new Date(Date.now() + THREE_DAYS_MS),
    },
  });
}
