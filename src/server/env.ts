import "server-only";
import { z } from "zod";

/**
 * Validated server-side environment variables.
 *
 * All env access in the codebase MUST go through this module — never read
 * `process.env.X` directly. The schema is the single source of truth for
 * which env vars exist, what type they have, and which are required.
 *
 * On boot the schema is parsed eagerly: an invalid `.env` produces a clear
 * error at startup instead of an obscure crash deep inside a route handler
 * later. This is the t3-stack pattern — see https://create.t3.gg/en/usage/env-variables.
 *
 * `import "server-only"` guarantees this module is never bundled into the
 * client. The app currently has no `NEXT_PUBLIC_*` variables, so there is
 * no client-side counterpart.
 */

const serverEnvSchema = z.object({
  // Database — Neon serverless Postgres. Pooled URL for the app, unpooled
  // (direct) URL for `prisma migrate` and one-off scripts.
  DATABASE_URL: z.url(),
  DATABASE_URL_UNPOOLED: z.url().optional(),

  // Auth.js
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.url().optional(),

  // Absolute base URL of the running app. Consumed by `apiFetch` on the
  // server path — when a Server Component prefetches through the query
  // client (`queryClient.prefetchQuery(...)`), `fetch` runs in Node.js
  // and rejects relative URLs like `/api/foo`. We prepend this value so
  // the self-call resolves. Trailing slash is stripped for cleanliness.
  //
  // Resolution priority in `getServerBaseUrl`:
  //   1. `APP_URL` (explicit override, recommended for all environments)
  //   2. `VERCEL_URL` (auto-injected per Vercel deployment, fallback)
  //   3. `http://localhost:3000` (dev fallback)
  APP_URL: z
    .url()
    .optional()
    .transform((v) => v?.replace(/\/$/, "")),

  // Injected automatically by Vercel for every deployment — current
  // deployment hostname without protocol (e.g. `my-app-abc123.vercel.app`).
  // Used as the fallback for `APP_URL` so a fresh Vercel project works
  // without an explicit env setup.
  VERCEL_URL: z.string().optional(),

  // Email delivery — Nodemailer over Gmail SMTP. GMAIL_APP_PASSWORD is
  // a 16-character Google App Password (requires 2FA on the account;
  // generated at https://myaccount.google.com/apppasswords). Validation
  // strips incidental whitespace because Google displays the code in
  // groups of four and people copy-paste with spaces.
  //
  // Both vars are optional so a self-hoster can deploy with OAuth-only
  // sign-in (no email OTP, no invite emails). The boot-time refine at
  // the bottom of this schema asserts that at least one primary sign-in
  // method is configured.
  GMAIL_USER: z.email({ message: "GMAIL_USER must be a valid email address" }).optional(),
  GMAIL_APP_PASSWORD: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\s+/g, ""))
    .optional(),

  // OAuth providers — optional so local dev works without them; the
  // provider just won't appear on the sign-in page.
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  // Bearer secret for the cron-cleanup endpoint. Optional at the env
  // layer because the cron itself is optional — a self-hoster may not
  // deploy the cleanup schedule at all. The route handler enforces
  // "must be set in production" at request time so a misconfigured
  // deploy returns 401, not a boot crash.
  CRON_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * At least one primary (email-verifying) sign-in method must be configured —
 * otherwise the dashboard has no way to create new user accounts. Passkey
 * doesn't count: it's an add-on registered after a user has already signed
 * in via a primary method.
 *
 * The refine runs after the field-level schema, so by the time this fires
 * we know each individual var is well-typed (or absent). The job here is to
 * assert the joint constraint: `(google || github || otp)` must hold.
 *
 * `CRON_SECRET` is intentionally NOT enforced here — cron itself is
 * optional (a self-hoster may not deploy the daily-cleanup endpoint at
 * all). Authentication is enforced inside the route handler instead, so
 * a misconfigured prod deploy is a 401 from the route, not a boot crash.
 */
const refinedEnvSchema = serverEnvSchema.refine(
  (env) => {
    const google = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
    const github = Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET);
    const otp = Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
    return google || github || otp;
  },
  {
    message:
      "At least one primary sign-in method must be configured: Google OAuth (AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET), GitHub OAuth (AUTH_GITHUB_ID + AUTH_GITHUB_SECRET), or Email OTP (GMAIL_USER + GMAIL_APP_PASSWORD).",
  },
);

const parsed = refinedEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error("Invalid environment variables — see logs above.");
}

export const env = parsed.data;
