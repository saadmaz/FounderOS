"use client";

import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const VALUE_FORMAT = "yyyy-MM-dd";

/**
 * A styled stand-in for `<input type="date">`, which renders as a
 * browser-native (and in dark mode, often jarringly light) widget that
 * doesn't match the rest of the app. Same value contract as the native
 * input though ("yyyy-MM-dd" string) - it's a drop-in replacement for
 * anywhere `{...register("someDate")}` used `type="date"`, just wired
 * through `watch`/`setValue` (a controlled component) instead.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  fromDate,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Disables every date before this one, e.g. an end date that can't
   * precede the start date already chosen elsewhere in the same form. */
  fromDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parse(value, VALUE_FORMAT, new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !selected && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{selected ? format(selected, "MMM d, yyyy") : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? fromDate}
          disabled={fromDate ? { before: fromDate } : undefined}
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, VALUE_FORMAT));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
