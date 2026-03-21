import { z } from "zod";

/**
 * Zod schemas for the auth wizards — shared by Server Actions (input
 * validation) and the client forms (RHF `zodResolver`).
 *
 * @remarks
 * Kept as a single file because the three schemas are tiny and
 * intimately related (sign-up embeds sign-in's email rules). The
 * inferred input types are re-exported so consumers can import both
 * the schema and the payload shape from one module.
 */

export const signUpSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  email: z.email(),
});

export const signInSchema = z.object({
  email: z.email(),
});

export const otpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must contain only digits"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type OTPInput = z.infer<typeof otpSchema>;
