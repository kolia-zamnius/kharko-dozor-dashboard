/**
 * Pure display-name resolver for tracked users.
 *
 * @remarks
 * Feature-scoped under `tracked-users/` because resolution is a
 * tracked-users concern, not a cross-cutting server utility. The
 * function is pure — no Prisma, no Node APIs — so it lives in the
 * client-safe `lib/data/` layer. Every consumer (server route
 * handlers composing API responses, Server Components hydrating
 * prefetch, and any future Client Component that needs to re-render
 * without a roundtrip) imports from the same path.
 *
 * Resolution order — first non-empty wins:
 *   1. `customName`                         — explicit, user-specific override
 *   2. `traits[displayNameTraitKey]`        — per-user trait lookup
 *   3. `traits[projectDefaultTraitKey]`     — project-wide trait lookup
 *   4. `externalId`                         — final fallback, always present
 *
 * Non-string trait values are coerced with `String(value)` — a numeric
 * `plan: 42` trait with a `"plan"` key should render as `"42"` rather
 * than silently falling through to the next step.
 */

export type DisplayNameInputs = {
  externalId: string;
  traits: Record<string, unknown> | null;
  customName: string | null;
  displayNameTraitKey: string | null;
  projectDefaultTraitKey: string | null;
};

function pickTraitValue(traits: Record<string, unknown> | null, key: string | null): string | null {
  if (!key || !traits) return null;
  const raw = traits[key];
  if (raw === null || raw === undefined) return null;
  const str = typeof raw === "string" ? raw : String(raw);
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDisplayName(inputs: DisplayNameInputs): string {
  const custom = inputs.customName?.trim();
  if (custom) return custom;

  const userTrait = pickTraitValue(inputs.traits, inputs.displayNameTraitKey);
  if (userTrait) return userTrait;

  const projectTrait = pickTraitValue(inputs.traits, inputs.projectDefaultTraitKey);
  if (projectTrait) return projectTrait;

  return inputs.externalId;
}
