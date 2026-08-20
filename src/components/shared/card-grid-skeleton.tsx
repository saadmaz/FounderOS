/** Loading placeholder for card-grid layouts (Budgets, Meetings, Goals,
 * Ideas) - same idea as TableSkeleton, just shaped like a card grid
 * instead of a table. */
export function CardGridSkeleton({ count = 3, cardClassName = "h-36" }: { count?: number; cardClassName?: string }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${cardClassName} animate-pulse rounded-xl bg-muted`} />
      ))}
    </div>
  );
}
