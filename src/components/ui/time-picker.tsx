"use client";

import { Clock } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const STEP_MINUTES = 15;
const TIME_OPTIONS = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, i) => {
  const totalMinutes = i * STEP_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function formatTimeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * A styled stand-in for `<input type="time">` - same "HH:mm" 24-hour
 * value contract, so it's a drop-in replacement anywhere
 * `{...register("someTime")}` used `type="time"`, wired through
 * `watch`/`setValue` instead. A scrollable list rather than a native
 * spinner/clock-face, in 15-minute steps.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  className,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToSelected(node: HTMLDivElement | null) {
    if (!node) return;
    const target = value
      ? node.querySelector<HTMLElement>(`[data-time="${value}"]`)
      : node.querySelector<HTMLElement>("[data-time]");
    target?.scrollIntoView({ block: "center" });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) requestAnimationFrame(() => scrollToSelected(listRef.current));
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{value ? formatTimeLabel(value) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        <div ref={listRef} className="max-h-64 overflow-y-auto scrollbar-thin">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              data-time={t}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
                value === t && "bg-primary/10 font-medium text-primary hover:bg-primary/10"
              )}
            >
              {formatTimeLabel(t)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
