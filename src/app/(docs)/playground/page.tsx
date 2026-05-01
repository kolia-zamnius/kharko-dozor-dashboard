"use client";

import Link from "next/link";
import { Controls } from "./components/controls";
import { InitForm } from "./components/init-form";
import { PrivacyDemo } from "./components/privacy-demo";
import { Section } from "./components/section";
import { StatusPanel } from "./components/status-panel";

/**
 * Playground main page — composition root.
 *
 * @remarks
 * Each section reads SDK state through `useDozor()` directly, so the
 * page itself owns no state — it's pure composition. Sections were
 * extracted along the natural seams of the user's path: paste a key
 * (1), watch state (2), drive lifecycle + identify (3), explore
 * privacy attributes (4), navigate away (5).
 *
 * No server-side data, no auth, no localisation: the page sits inside
 * the `(docs)` route group and is bypassed in `proxy.ts`.
 */
export default function PlaygroundPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
        <p className="mt-2 text-muted-foreground">
          Test the SDK without wiring it into your own app — paste a key, identify a user, click around, then check
          Replays.
        </p>
      </header>

      <InitForm />
      <StatusPanel />
      <Controls />
      <PrivacyDemo />

      <Section heading="5. Try interactions on the next page">
        <p className="text-sm text-muted-foreground">
          SPA navigation creates a new slice marker — Replays will show two slices side-by-side.
        </p>
        <Link href="/playground/interactions" className="inline-block text-sm font-medium hover:underline">
          Go to Interactions →
        </Link>
      </Section>
    </div>
  );
}
