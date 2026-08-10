"use client";

import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import * as React from "react";
import { sanitizeRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

const TOOLBAR_ITEMS = [
  { command: "bold", icon: Bold, label: "Bold" },
  { command: "italic", icon: Italic, label: "Italic" },
  { command: "underline", icon: Underline, label: "Underline" },
  { command: "insertUnorderedList", icon: List, label: "Bullet list" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
] as const;

/**
 * Minimal rich-text editor for short-form content like meeting notes -
 * bold/italic/underline/lists only, backed by a contentEditable div rather
 * than a full editor library since that's the entire surface this app
 * needs. Output is HTML, always run through `sanitizeRichText` before it
 * escapes this component (on every change, and again wherever it's
 * rendered) so pasted markup can't smuggle in anything beyond that same
 * small tag allowlist.
 */
function RichTextEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
  contentClassName,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<Record<string, boolean>>({});

  // Keep the DOM in sync when `value` changes from outside (dialog opening
  // with a different meeting) without fighting the caret on every keystroke
  // - only touch innerHTML when it's actually drifted from what's shown.
  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function updateActiveState() {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
    });
  }

  function emitChange() {
    if (!ref.current) return;
    onChange(sanitizeRichText(ref.current.innerHTML));
  }

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command);
    emitChange();
    updateActiveState();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    emitChange();
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        {TOOLBAR_ITEMS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active[command] ?? false}
            onMouseDown={(e) => e.preventDefault()} // don't steal focus/selection from the editor
            onClick={() => exec(command)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              active[command] && "bg-secondary text-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        autoFocus={autoFocus}
        data-placeholder={placeholder}
        onInput={emitChange}
        onPaste={handlePaste}
        onKeyUp={updateActiveState}
        onMouseUp={updateActiveState}
        onFocus={updateActiveState}
        className={cn(
          "rich-text max-w-none overflow-y-auto px-2.5 py-2 text-sm leading-relaxed outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          "min-h-40",
          contentClassName
        )}
      />
    </div>
  );
}

export { RichTextEditor };
