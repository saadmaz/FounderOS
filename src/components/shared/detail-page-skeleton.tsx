/**
 * Placeholder for company/project detail pages while their data loads.
 * Mirrors the real header's shape (back link, title block, 3 stat cards,
 * optional tab bar) so the swap from skeleton to real content doesn't
 * reflow the page - a bare centered spinner works too, but replacing the
 * *entire* screen with real content in one frame reads as the page
 * jumping, especially on mobile where that's most of the viewport.
 */
export function DetailPageSkeleton({ avatar = false, tabs = 0 }: { avatar?: boolean; tabs?: number }) {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="border-b border-border px-4 py-4 lg:px-6">
        <div className="mb-4 h-3.5 w-20 rounded bg-muted" />
        <div className="flex flex-wrap items-start gap-4">
          {avatar && <div className="size-12 shrink-0 rounded-xl bg-muted" />}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-3.5 w-56 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
      {tabs > 0 && (
        <div className="flex gap-4 overflow-hidden border-b border-border px-4 py-3.5 lg:px-6">
          {Array.from({ length: tabs }).map((_, i) => (
            <div key={i} className="h-4 w-14 shrink-0 rounded bg-muted" />
          ))}
        </div>
      )}
    </div>
  );
}
