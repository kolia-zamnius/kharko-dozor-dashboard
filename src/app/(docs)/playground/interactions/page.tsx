import { Button } from "@/components/ui/primitives/button";
import Link from "next/link";
import { Section } from "../components/section";
import { ConsoleSection } from "./components/console-section";

/** Reaching here from `/playground` triggers a `"navigation"`-reason slice marker — replay shows two slices. */
export default function PlaygroundInteractionsPage() {
  return (
    <div className="space-y-10">
      <header>
        <Link href="/playground" className="text-muted-foreground hover:text-foreground text-sm">
          ← Back to Playground
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Playground · Interactions</h1>
        <p className="text-muted-foreground mt-2">
          More elements to exercise click / scroll / hover capture, plus a console log so you can verify recordConsole
          works.
        </p>
      </header>

      <Section heading="Click events" description="Plain buttons — every click is a recorded mouse event.">
        <div className="flex flex-wrap gap-2">
          <Button>Primary button</Button>
          <Button variant="secondary">Secondary button</Button>
          <Button variant="outline">Outline button</Button>
        </div>
      </Section>

      <ConsoleSection />

      <Section
        heading="Scroll events"
        description="Scroll inside this box — the SDK captures scroll offsets and replays them."
      >
        <div className="border-border bg-muted/30 h-48 overflow-y-auto rounded-md border p-4">
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i} className="py-1 text-sm">
              Scroll content {i + 1}
            </p>
          ))}
        </div>
      </Section>

      <Section
        heading="Hover events"
        description="Mouse-move + hover state are captured; replay reproduces cursor position."
      >
        <div className="border-border hover:bg-muted rounded-md border p-6 text-center text-sm transition-colors">
          Hover over me
        </div>
      </Section>
    </div>
  );
}
