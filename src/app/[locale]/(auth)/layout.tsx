import type { ReactNode } from "react";

/**
 * Auth route group layout — a full-viewport centred grid that hosts the
 * sign-in and sign-up wizards. No header, no nav, no providers beyond
 * what the root layout already wires — keeps the auth surface tightly
 * scoped and the focus on the single form in the centre.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="container mx-auto grid h-dvh place-items-center p-3">{children}</div>;
}
