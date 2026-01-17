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
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // Auth.js
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),

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
    .string()
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
  GMAIL_USER: z.string().email({ message: "GMAIL_USER must be a valid email address" }),
  GMAIL_APP_PASSWORD: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\s+/g, "")),

  // OAuth providers — optional so local dev works without them; the
  // provider just won't appear on the sign-in page.
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  // Vercel Cron shared secret. Optional in local dev (cron endpoints
  // are just open GETs on localhost, you can curl them manually), but
  // MUST be set in production — the cron handlers verify the
  // `Authorization: Bearer $CRON_SECRET` header that Vercel Cron adds
  // to every scheduled request, and without it anyone on the internet
  // could trigger the cleanup endpoint.
  CRON_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  throw new Error("Invalid environment variables — see logs above.");
}

export const env = parsed.data;
