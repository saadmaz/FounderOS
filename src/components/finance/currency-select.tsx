"use client";

import { ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CURRENCY_NAMES = new Intl.DisplayNames(["en"], { type: "currency" });

/** Every ISO 4217 currency code the runtime knows about (LKR pinned first -
 * this workspace's default - then alphabetical), computed once at module
 * load rather than re-derived on every render. */
const CURRENCIES: { code: string; name: string }[] = (() => {
  const list = Intl.supportedValuesOf("currency").map((code) => ({
    code,
    name: CURRENCY_NAMES.of(code) ?? code,
  }));
  list.sort((a, b) => a.code.localeCompare(b.code));
  const lkrIndex = list.findIndex((c) => c.code === "LKR");
  if (lkrIndex > 0) list.unshift(list.splice(lkrIndex, 1)[0]);
  return list;
})();

/**
 * Searchable currency picker - a plain <Select> would mean scrolling
 * through ~160 ISO codes with no way to jump to one, so this is a
 * Popover+Command combobox instead: type "sri" or "lkr" and it filters by
 * either the code or the spelled-out name.
 */
export function CurrencySelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => CURRENCIES.find((c) => c.code === value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-between font-normal", className)}
          />
        }
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-medium tabular-nums">{selected.code}</span>
              <span className="text-muted-foreground"> — {selected.name}</span>
            </>
          ) : (
            value || "Select currency"
          )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search currency…" />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {CURRENCIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.name}`}
                  data-checked={c.code === value}
                  onSelect={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium tabular-nums">{c.code}</span>
                  <span className="truncate text-muted-foreground">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
