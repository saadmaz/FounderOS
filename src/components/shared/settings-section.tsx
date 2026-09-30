import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <header className="flex items-start gap-3.5 border-b border-border px-5 py-4 sm:px-6">
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-inset ring-ring-subtle">
            <Icon className="size-4 text-primary" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-6 tracking-tight">{title}</h2>
          {description && (
            <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children !== undefined && (
        <div className={cn("px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
      )}
      {footer && (
        <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3 sm:px-6">
          {footer}
        </footer>
      )}
    </section>
  );
}

export function SettingsField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[180px_1fr] sm:gap-6">
      <div className="sm:pt-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
