"use client";

import { Button } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/forms/input";
import { useDozor } from "@kharko/dozor-react";
import { useState } from "react";
import { Field } from "./field";
import { Section } from "./section";

/**
 * Step 1 — paste the API key, hit Initialize.
 *
 * @remarks
 * Init runs with `privacyMaskInputs: false` and `autoStart: false`
 * so (1) the privacy demo below shows three mechanisms in isolation
 * and (2) the user explicitly clicks Start, exercising the lifecycle
 * state transitions.
 *
 * Identity capture is deliberately NOT here — it lives next to the
 * Identify action in `Controls` so the inputs sit beside the button
 * that consumes them.
 */
export function InitForm() {
  const dozor = useDozor();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isInitialized = dozor.state !== "not_initialized";

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("API key is required to initialize.");
      return;
    }
    setError(null);
    dozor.init({
      apiKey: apiKey.trim(),
      endpoint: "/api/ingest",
      privacyMaskInputs: false,
      autoStart: false,
    });
  }

  return (
    <Section heading="1. Initialize the SDK">
      <p className="text-sm text-muted-foreground">
        Paste an API key from one of your projects. The SDK posts recorded events to this dashboard&apos;s own ingest
        endpoint.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="API key" htmlFor="pg-api-key">
          <Input
            id="pg-api-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="dp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
            disabled={isInitialized}
            data-dozor-mask
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!isInitialized ? (
          <Button type="submit">Initialize</Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            SDK initialized. Use the controls below to start, pause, or identify a user.
          </p>
        )}
      </form>
    </Section>
  );
}
