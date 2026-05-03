import { z } from "zod";

// Shared by Server Actions (input validation) + client forms (RHF zodResolver).

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
