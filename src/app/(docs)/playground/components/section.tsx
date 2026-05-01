import type { ReactNode } from "react";

type SectionProps = {
  heading: string;
  description?: string;
  children: ReactNode;
};

/**
 * Numbered/labelled section wrapper used by every playground page.
 *
 * @remarks
 * `description` is optional so the component subsumes the two shapes
 * the playground needs: a bare heading + children (main page steps
 * that lead with their own intro paragraph) and a heading + sub-text
 * + children (interactions page sections with no other intro).
 */
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
