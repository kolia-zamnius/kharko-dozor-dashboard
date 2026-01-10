/**
 * Exhaustiveness check for discriminated unions.
 *
 * @remarks
 * Call from the default branch of a `switch` on a union's discriminant.
 * As long as every variant is handled above, `value` narrows to `never`
 * and the call type-checks. The moment someone adds a new variant to
 * the union and forgets to handle it, `value` is no longer `never` and
 * the `assertNever` call becomes a compile error — the static type
 * system points at the exact missing case instead of us finding it via
 * a runtime bug report.
 *
 * The runtime `throw` is a safety net for two scenarios the type
 * checker can't see: data crossing an HTTP boundary with an unexpected
 * shape (e.g. a backward-incompatible API) and code that was
 * strictly-typed but cast with `as`. If both paths are compile-time
 * safe, the throw is dead code — which is the point.
 *
 * @example
 * ```ts
 * type Event = { kind: "a" } | { kind: "b" };
 * function handle(e: Event) {
 *   switch (e.kind) {
 *     case "a": return 1;
 *     case "b": return 2;
 *     default: return assertNever(e); // compile error if a variant is added
 *   }
 * }
 * ```
 */
export function assertNever(value: never): never {
  throw new Error(`Exhaustiveness check failed for: ${JSON.stringify(value)}`);
}
