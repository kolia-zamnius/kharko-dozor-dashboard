import { cn } from "@/lib/cn";

type StatusRowProps = {
  label: string;
  value: string;
  mono?: boolean;
};

/** Fragment (not div) so the parent's `grid-cols-[max-content_1fr]` resolves columns correctly. */
export function StatusRow({ label, value, mono = false }: StatusRowProps) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(mono && "font-mono text-xs")}>{value}</dd>
    </>
  );
}
