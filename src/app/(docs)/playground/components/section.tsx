import type { ReactNode } from "react";

type SectionProps = {
  heading: string;
  description?: string;
  children: ReactNode;
};

export function Section({ heading, description, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{heading}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
