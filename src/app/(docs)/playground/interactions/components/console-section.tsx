"use client";

import { Button } from "@/components/ui/primitives/button";
import { useState } from "react";
import { Section } from "../../components/section";

type ConsoleLevel = "log" | "warn" | "error";

export function ConsoleSection() {
  const [lastLog, setLastLog] = useState<string | null>(null);

  function logAt(level: ConsoleLevel) {
    const time = new Date().toLocaleTimeString();
    const message = `[playground] ${level} message at ${time}`;
    // SDK records console.* by default — the replay's console pane shows these alongside DOM events.
    console[level](message);
    setLastLog(`Logged at ${time}`);
  }

  return (
    <Section
      heading="Console capture"
      description="The SDK records console.* calls by default. Click below, then open the replay's console pane."
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => logAt("log")}>Log a message</Button>
        <Button variant="outline" onClick={() => logAt("warn")}>
          Log a warning
        </Button>
        <Button variant="outline" onClick={() => logAt("error")}>
          Log an error
        </Button>
      </div>
      {lastLog && <p className="text-sm text-muted-foreground">{lastLog}</p>}
    </Section>
  );
}
