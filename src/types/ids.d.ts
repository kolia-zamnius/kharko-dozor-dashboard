/**
 * Nominal-brand types for the two ID kinds most likely to be confused
 * in function signatures.
 *
 * @remarks
 * TypeScript is structural: a function `f(a: string, b: string)` can't
 * tell its two args apart at the call site. For `requireMember(userId,
 * orgId)` that's fine — the caller has both and domain-knowledge says
 * which is which. But `loadTrackedUserDetail(userId, requesterId)`
 * takes **two different kinds of user id** — an SDK-tracked user (the
 * subject being read) and a platform user (the admin doing the
 * reading). A swap here silently compiles and silently passes the
 * wrong identity through the permission check.
 *
 * Branding `UserId` and `TrackedUserId` with disjoint `unique symbol`
 * tags closes that door at compile time. Swap becomes:
 * ```
 * Argument of type 'TrackedUserId' is not assignable to 'UserId'.
 * ```
 *
 * Brands carry zero runtime cost — they erase to plain `string` at
 * emit. The only friction is at the trust boundary where `string`
 * enters the branded world (Next.js route params, raw SDK payloads):
 * an explicit `value as UserId` cast there is exactly the audit
 * marker we want — grep for `as UserId` and every cast site shows
 * where untrusted strings become trusted identifiers.
 *
 * Deliberately narrow scope: only the two user-ID kinds are branded.
 * `orgId` / `projectId` / `sessionId` rarely appear in the same
 * signature as each other, so the swap-prevention value is much lower
 * and the refactor cascade isn't worth it. Widen this file when a
 * real swap bug proves the additional brand is earning its keep.
 */

declare const userIdBrand: unique symbol;
declare const trackedUserIdBrand: unique symbol;

/**
 * Primary key of a platform user (the human who signs in). Provisioned
 * by Auth.js `createUser`; flows through the session as
 * `session.user.id`.
 */
export type UserId = string & { readonly [userIdBrand]: typeof userIdBrand };

/**
 * Primary key of a tracked user (the end user being recorded by the
 * SDK). Sourced from Prisma `TrackedUser.id`; appears in route params
 * for `/users/[userId]` and `/api/tracked-users/[userId]`.
 */
export type TrackedUserId = string & { readonly [trackedUserIdBrand]: typeof trackedUserIdBrand };
