/**
 * Two user-id kinds we keep distinct: platform user (Auth.js `createUser` →
 * `session.user.id`) and SDK-tracked subject (Prisma `TrackedUser.id`). Cast
 * `as UserId` / `as TrackedUserId` at the trust boundary — route params, SDK payloads.
 */

declare const userIdBrand: unique symbol;
declare const trackedUserIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: typeof userIdBrand };
export type TrackedUserId = string & { readonly [trackedUserIdBrand]: typeof trackedUserIdBrand };
