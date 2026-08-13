import type { ReactNode } from "react";

/** Small uppercase divider label for grouping a form/panel's fields into
 * scannable sections (e.g. "Contact info" / "Lead details") instead of one
 * long flat list. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="pt-1 text-[11px] font-semibold tracking-wide text-muted-foreground-2 uppercase first:pt-0">
      {children}
    </p>
  );
}
