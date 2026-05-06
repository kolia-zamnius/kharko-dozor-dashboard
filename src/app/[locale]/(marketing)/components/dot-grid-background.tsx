export function DotGridBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle,var(--color-foreground)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black_10%,transparent_85%)] bg-size-[24px_24px] opacity-[0.17]"
    />
  );
}
