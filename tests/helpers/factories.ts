/**
 * Typed builder functions for test DB fixtures.
 *
 * @remarks
 * Deliberately plain functions, not a factory library (`fishery`, `rosie`).
 * Mature OSS projects (Drizzle, Hono, tRPC) moved away from factory libs
 * in 2025+ because plain async functions compose with real Prisma
 * semantics — id generation, FK constraints, `@updatedAt` triggers —
 * automatically. The ~10% LOC savings a library offers isn't worth the
 * extra dependency + the "who runs the seeded traits" question.
 *
 * Each factory accepts an explicit `{ owner }` / `{ organization }` / etc.
 * argument instead of auto-seeding its FKs. This makes test bodies read
 * declaratively — `const org = await createOrganization({ owner: alice })`
 * — and removes the "what random user owns my org?" cognitive load.
 *
 * @see tests/helpers/db.ts — the prisma client every factory writes to.
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

/**
 * Create a platform user. Email defaults to a unique `user-<uuid>@test.local`
 * so factory calls without args never collide on the `email @unique` index.
 */
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

/**
 * Create an organisation with an owner `Membership` pre-wired in a single
 * transaction. Matches the Auth.js `createUser` event's behaviour for
 * personal orgs — every org has at least one member the instant it exists.
 */
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

/**
 * Attach an existing user to an existing org with the given role.
 * Intended for scenarios like "Alice is OWNER, add Bob as VIEWER".
 */
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
  /**
   * Explicit `createdAt` for tests that assert on the session-list
   * date-range filter or the retention cron — by default Prisma stamps
   * `createdAt` at insertion time, which makes "older than 7 days"
   * scenarios un-seedable without this override.
   */
  createdAt?: Date;
}): Promise<Session> {
  const prisma = await getTestPrisma();
  return prisma.session.create({
    data: {
      externalId: args.externalId ?? `sess-${randomUUID()}`,
      projectId: args.project.id,
      trackedUserId: args.trackedUser?.id ?? null,
      startedAt: args.startedAt ?? new Date(),
      endedAt: args.endedAt ?? null,
      ...(args.createdAt ? { createdAt: args.createdAt } : {}),
    },
  });
}

/**
 * Create an OAuth `Account` row (Google / GitHub / future providers).
 *
 * Intended for tests that assert on the account-unlink flow or the
 * last-login-method guard in `DELETE /api/user/accounts/[provider]`.
 * The `providerAccountId` is randomised per call so repeated factory
 * invocations can't collide on the adapter's `(provider,
 * providerAccountId)` unique index.
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
 * Create a WebAuthn `Authenticator` row (a passkey).
 *
 * Mirrors the shape that `@simplewebauthn/server` writes on successful
 * registration — the fields outside `name` / `userId` are dummy values
 * that never get exercised cryptographically in the route handlers we
 * test (rename + delete only inspect `(credentialID, userId)`).
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
