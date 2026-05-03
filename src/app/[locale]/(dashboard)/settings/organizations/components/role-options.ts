// `value` ships verbatim as the Prisma `Role` enum; `key` indexes into
// `settings.orgs.roles.{key}.{label,description}`.

export const ROLE_OPTIONS = [
  { value: "OWNER" as const, key: "owner" as const },
  { value: "ADMIN" as const, key: "admin" as const },
  { value: "VIEWER" as const, key: "viewer" as const },
];

export const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== "OWNER");
