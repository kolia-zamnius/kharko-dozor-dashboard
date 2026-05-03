"use client";

import { useDozor } from "@kharko/dozor-react";
import { describePlaygroundState } from "../labels";
import { Section } from "./section";
import { StatusRow } from "./status-row";

export function StatusPanel() {
  const dozor = useDozor();

  return (
    <Section heading="2. Status">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <StatusRow label="State" value={describePlaygroundState(dozor.state)} />
        <StatusRow label="Session ID" value={dozor.sessionId ?? "—"} mono={dozor.sessionId != null} />
        <StatusRow label="Identified user" value={dozor.userId ?? "Anonymous"} mono={dozor.userId != null} />
        <StatusRow label="Events in buffer" value={String(dozor.bufferSize)} />
      </dl>
    </Section>
  );
}
