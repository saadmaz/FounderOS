import type { ReactNode } from "react";

/** Divider label for grouping a form/panel's fields into scannable
 * sections (e.g. "Contact info" / "Lead details") instead of one long
 * flat list. A top border on every section but the first reads as an
 * actual divider between groups, not just a small label floating in the
 * middle of a wall of fields. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-border pt-4 text-[11px] font-semibold tracking-wide text-muted-foreground-2 uppercase first:border-t-0 first:pt-0">
      {children}
    </p>
  );
}
