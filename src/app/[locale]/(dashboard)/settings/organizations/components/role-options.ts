/**
 * Role value + translation-key pairs for the role-selection dropdowns
 * on the organisation-settings page.
 *
 * @remarks
 * `value` is the Prisma `Role` enum shape (`OWNER | ADMIN | VIEWER`),
 * sent verbatim to the server. `key` points into `settings.orgs.roles`
 * in the message namespace — consumers do
 * `t(\`${opt.key}.label\`)` to render the localised label and
 * `.description` for the longer explainer.
 */
export const ROLE_OPTIONS = [
  { value: "OWNER" as const, key: "owner" as const },
  { value: "ADMIN" as const, key: "admin" as const },
  { value: "VIEWER" as const, key: "viewer" as const },
];

export const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== "OWNER");
