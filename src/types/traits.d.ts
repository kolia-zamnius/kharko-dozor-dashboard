/**
 * Trait bag from SDK `Dozor.identify()`, stored as `TrackedUser.traits` (Prisma `Json?`).
 * Cast `as SessionTraits` at read sites — that's the grep handle for the JSON→typed boundary.
 */
type SessionTraits = Record<string, unknown>;
