/**
 * Pure resolver — no Prisma, no Node APIs. Server route handlers, RSC prefetch
 * hydrators, and any future client component all import from one place.
 *
 * Resolution order, first non-empty wins:
 *   1. `customName` — explicit per-user override
 *   2. `traits[displayNameTraitKey]` — per-user trait lookup
 *   3. `traits[projectDefaultTraitKey]` — project-wide trait lookup
 *   4. `externalId` — final fallback, always present
 *
 * Non-string trait values coerce via `String(value)` — a numeric `plan: 42`
 * with a `"plan"` key renders as `"42"` rather than falling through.
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
