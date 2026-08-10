/**
 * Loading placeholder shaped like the table/list it's about to become
 * (header bar + a handful of rows) instead of one big pulsing rectangle.
 * A single flat block is either much taller or much shorter than the real
 * content almost every time, so swapping it for actual rows/an empty state
 * is one of the more noticeable "page jumps" in the app - this can't
 * predict the real row count, but it keeps the swap close enough that it
 * reads as content filling in rather than the layout lurching.
 */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="animate-pulse overflow-hidden rounded-xl border border-border">
      <div className="h-9 bg-surface" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-11 bg-card" />
        ))}
      </div>
    </div>
  );
}
