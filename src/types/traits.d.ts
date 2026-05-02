/**
 * Free-form trait map written by the SDK via `Dozor.identify(traits)`.
 *
 * @remarks
 * Stored as Prisma `Json?` (`JsonValue`), so reads return a wide
 * `unknown`-ish type. Every server boundary that reads `TrackedUser.traits`
 * casts to this nominal alias — both the cast sites are auditable
 * (`grep "as SessionTraits"`) and the intent ("this Json is supposed to
 * be a flat string-keyed bag of arbitrary values") is documented in
 * one place.
 *
 * Declared as an **ambient global**, not a module export — no
 * `import`/`export` statements in this file means TypeScript treats it
 * as a `.d.ts` script and lifts every top-level declaration into the
 * global scope. Consumers reference `SessionTraits` directly without
 * an import line, matching how the project treats `next-auth`/`next-intl`
 * module augmentations.
 *
 * No runtime guard — the SDK's `identify()` contract guarantees a
 * plain object at the source. If a self-hoster needs strict shape
 * enforcement they can add a Zod parse at the ingest boundary.
 */
type SessionTraits = Record<string, unknown>;
