import { cn } from "@/lib/cn";

type StatusRowProps = {
  label: string;
  value: string;
  mono?: boolean;
};

/**
 * One row inside the playground's status `<dl>`.
 *
 * @remarks
 * Returns the `<dt>` and `<dd>` as siblings (Fragment, not div) so the
 * parent's `grid-cols-[max-content_1fr]` track resolves columns
 * correctly — wrapping the pair would break the two-column grid.
 */
export function StatusRow({ label, value, mono = false }: StatusRowProps) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(mono && "font-mono text-xs")}>{value}</dd>
    </>
  );
}
