"use client";

import { Input } from "@/components/ui/forms/input";
import { Field } from "./field";
import { Section } from "./section";

/**
 * Step 4 — three side-by-side samples showing each privacy mechanism
 * the SDK supports.
 *
 * @remarks
 * The page-level `Dozor.init({ privacyMaskInputs: false })` is what
 * makes this demo readable: with the default-on input mask, every
 * `<input>` would already be masked and `data-dozor-mask` would look
 * like a no-op. Turning it off lets each of the three samples
 * demonstrate one mechanism in isolation:
 *
 *   1. Plain input → recorded verbatim
 *   2. `data-dozor-mask` → text replaced with `*` in the recording
 *   3. `data-dozor-block` → element replaced with a same-size placeholder
 *
 * Pure presentational; no hooks, no SDK calls — the SDK reads the
 * `data-*` attributes off the DOM at capture time.
 */
export function PrivacyDemo() {
  return (
    <Section heading="4. Privacy demo">
      <p className="text-sm text-muted-foreground">
        By default the SDK auto-masks every input. The playground turns that off so you can see what each privacy
        attribute does individually.
      </p>
      <div className="space-y-4">
        <Field label="Regular input — recorded as-is" htmlFor="pg-privacy-regular">
          <Input id="pg-privacy-regular" placeholder="Type something visible" />
        </Field>
        <Field label="Masked input — text replaced with asterisks via data-dozor-mask" htmlFor="pg-privacy-masked">
          <Input id="pg-privacy-masked" placeholder="Type something masked" data-dozor-mask />
        </Field>
        <div>
          <p className="text-sm font-medium">
            Blocked element — replaced with a same-size placeholder via data-dozor-block
          </p>
          <div data-dozor-block className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm">
            This whole section never reaches the recording. The replay shows a grey rectangle the same size.
          </div>
        </div>
      </div>
    </Section>
  );
}
