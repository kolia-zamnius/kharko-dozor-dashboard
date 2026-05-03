import "server-only";
import { z } from "zod";

/**
 * All env access goes through `env` here — never `process.env.X` directly. Schema
 * parses on boot; misconfig produces a clear error before any request runs.
 */

const serverEnvSchema = z.object({
  // Pooled URL for the app, unpooled (direct) URL for `prisma migrate` and one-off scripts.
  DATABASE_URL: z.url(),
  DATABASE_URL_UNPOOLED: z.url().optional(),

  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.url().optional(),

  // Resolution chain lives in `app-url.ts`.
  APP_URL: z
    .url()
    .optional()
    .transform((v) => v?.replace(/\/$/, "")),

  // Auto-injected per Vercel deployment (bare hostname). Fallback for `APP_URL`
  // so a fresh Vercel project works without env setup.
  VERCEL_URL: z.string().optional(),

  // 16-char Google App Password (requires 2FA on the account). Whitespace stripped
  // because Google displays the code in groups of four. Both vars optional —
  // self-hoster can deploy OAuth-only with no email OTP / no invite emails.
  GMAIL_USER: z.email({ message: "GMAIL_USER must be a valid email address" }).optional(),
  GMAIL_APP_PASSWORD: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\s+/g, ""))
    .optional(),

  // Optional — provider hidden from the sign-in page when its env pair is absent.
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  // Optional at env (cron itself is optional). Enforced inside the route handler —
  // misconfigured prod returns 401, not a boot crash.
  CRON_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * At least one primary sign-in method must be configured. Passkey doesn't count
 * (it's an add-on registered after a primary-method sign-in, not an entry path).
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
