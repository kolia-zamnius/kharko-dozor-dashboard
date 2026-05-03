import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="container mx-auto grid h-dvh place-items-center p-3">{children}</div>;
}
