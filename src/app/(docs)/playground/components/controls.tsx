"use client";

import { Button } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/forms/input";
import { useDozor } from "@kharko/dozor-react";
import { useState } from "react";
import { Field } from "./field";
import { Section } from "./section";

/**
 * Step 3 — lifecycle buttons (state-conditional) + the identify form.
 *
 * @remarks
 * Lifecycle buttons render conditionally on `dozor.state` — the
 * resulting set is non-overlapping (Start | Pause | Resume | Stop)
 * because the underlying enum is a discriminated union.
 *
 * Identity inputs live here, beside the Identify button that consumes
 * them, so the user reads "type a User ID, click Identify" linearly
 * without scrolling back up. `userId` is required (you can't identify
 * an anonymous session); `name` and `email` become free-form `traits`
 * if non-empty.
 *
 * `traits` is dropped from the `identify()` call when both `name` and
 * `email` are blank — passing `{}` would emit an empty traits object
 * which is technically valid but pointlessly noisy.
 */
export function Controls() {
  const dozor = useDozor();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const isInitialized = dozor.state !== "not_initialized";
  const trimmedUserId = userId.trim();

  function handleIdentify() {
    if (!trimmedUserId) return;
    const traits: Record<string, string> = {};
    if (name.trim()) traits.name = name.trim();
    if (email.trim()) traits.email = email.trim();
    dozor.identify(trimmedUserId, Object.keys(traits).length ? traits : undefined);
  }

  return (
    <Section heading="3. Controls">
      <div className="flex flex-wrap gap-2">
        {dozor.state === "idle" && <Button onClick={() => dozor.start()}>Start</Button>}
        {dozor.state === "recording" && (
          <Button variant="outline" onClick={() => dozor.pause()}>
            Pause
          </Button>
        )}
        {dozor.state === "paused" && <Button onClick={() => dozor.resume()}>Resume</Button>}
        {(dozor.state === "recording" || dozor.state === "paused") && (
          <Button variant="outline" onClick={() => dozor.stop()}>
            Stop
          </Button>
        )}
      </div>
      {!isInitialized && (
        <p className="text-sm text-muted-foreground">Initialize the SDK above to enable controls.</p>
      )}

      <div className="space-y-4 rounded-md border border-border p-4">
        <p className="text-sm font-medium">Identify the current session</p>
        <Field label="User ID" htmlFor="pg-user-id">
          <Input
            id="pg-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user_123"
            disabled={!isInitialized}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name trait (optional)" htmlFor="pg-user-name">
            <Input
              id="pg-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              disabled={!isInitialized}
            />
          </Field>
          <Field label="Email trait (optional)" htmlFor="pg-user-email">
            <Input
              id="pg-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={!isInitialized}
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          onClick={handleIdentify}
          disabled={!isInitialized || !trimmedUserId}
        >
          Identify user
        </Button>
      </div>
    </Section>
  );
}
