/**
 * Exhaustiveness check for discriminated unions — call from the default branch of
 * a switch on the discriminant. Static: a new variant becomes a compile error here.
 * Runtime: throws for cases the type checker can't see (untrusted data crossing an
 * HTTP boundary, `as` casts).
 */
export function assertNever(value: never): never {
  throw new Error(`Exhaustiveness check failed for: ${JSON.stringify(value)}`);
}
