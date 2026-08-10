"use client";

import {
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
} from "lucide-react";
import * as React from "react";
import { sanitizeRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type ActiveState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  blockquote: boolean;
};

const EMPTY_ACTIVE: ActiveState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  h1: false,
  h2: false,
  h3: false,
  blockquote: false,
};

/** If the URL has no scheme at all, assume https:// - lets people type
 * "acme.com" into the link prompt instead of the full URL. */
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Full-featured (for what a meeting note needs) rich-text editor backed by
 * a contentEditable div rather than a full editor library, since that's
 * the entire surface this app needs: text styling, headings, lists, quotes,
 * a divider, tables, and links. Output is HTML, always run through
 * `sanitizeRichText` before it escapes this component (on every change, and
 * again wherever it's rendered) so pasted markup - or a table/link inserted
 * here - can't smuggle in anything beyond that same tag/attribute allowlist.
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
  const [active, setActive] = React.useState<ActiveState>(EMPTY_ACTIVE);

  // Keep the DOM in sync when `value` changes from outside (dialog opening
  // with a different meeting) without fighting the caret on every keystroke
  // - only touch innerHTML when it's actually drifted from what's shown.
  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function updateActiveState() {
    const block = document.queryCommandValue("formatBlock").toUpperCase();
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
      h1: block === "H1",
      h2: block === "H2",
      h3: block === "H3",
      blockquote: block === "BLOCKQUOTE",
    });
  }

  function emitChange() {
    if (!ref.current) return;
    onChange(sanitizeRichText(ref.current.innerHTML));
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
    updateActiveState();
  }

  /** Headings/quote toggle off back to a plain paragraph when clicked again
   * while already active, rather than only ever turning on. */
  function toggleBlock(tag: "H1" | "H2" | "H3" | "BLOCKQUOTE") {
    ref.current?.focus();
    const current = document.queryCommandValue("formatBlock").toUpperCase();
    exec("formatBlock", `<${(current === tag ? "P" : tag).toLowerCase()}>`);
  }

  function clearFormatting() {
    ref.current?.focus();
    document.execCommand("removeFormat");
    document.execCommand("formatBlock", false, "<p>");
    emitChange();
    updateActiveState();
  }

  function insertDivider() {
    exec("insertHorizontalRule");
  }

  function insertTable() {
    const rowsInput = window.prompt("How many rows?", "3");
    if (rowsInput === null) return;
    const colsInput = window.prompt("How many columns?", "3");
    if (colsInput === null) return;
    const rows = Math.min(Math.max(Number(rowsInput) || 1, 1), 20);
    const cols = Math.min(Math.max(Number(colsInput) || 1, 1), 10);

    // Fixed, non-interpolated markup (row/col counts only control how many
    // times it repeats) - safe to hand straight to insertHTML.
    let html = "<table><tbody>";
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += r === 0 ? "<th>Header</th>" : "<td><br></td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";

    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    emitChange();
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url || !url.trim()) return;
    const href = normalizeUrl(url);

    ref.current?.focus();
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount) {
      document.execCommand("createLink", false, href);
    } else if (ref.current) {
      // No selection to link - build the anchor via the DOM (not an HTML
      // string) so nothing in the pasted URL can be parsed as markup.
      const a = document.createElement("a");
      a.href = href;
      a.textContent = href;
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (range && ref.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(a);
        range.setStartAfter(a);
        range.setEndAfter(a);
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else {
        ref.current.appendChild(a);
      }
    }
    emitChange();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    emitChange();
  }

  const buttonClass = (isActive: boolean) =>
    cn(
      "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
      isActive && "bg-secondary text-foreground"
    );

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("undo")}
          className={buttonClass(false)}
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("redo")}
          className={buttonClass(false)}
        >
          <Redo2 className="size-3.5" />
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          aria-pressed={active.bold}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          className={buttonClass(active.bold)}
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          aria-pressed={active.italic}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          className={buttonClass(active.italic)}
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          title="Underline"
          aria-label="Underline"
          aria-pressed={active.underline}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("underline")}
          className={buttonClass(active.underline)}
        >
          <Underline className="size-3.5" />
        </button>
        <button
          type="button"
          title="Strikethrough"
          aria-label="Strikethrough"
          aria-pressed={active.strikeThrough}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("strikeThrough")}
          className={buttonClass(active.strikeThrough)}
        >
          <Strikethrough className="size-3.5" />
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        <button
          type="button"
          title="Heading 1"
          aria-label="Heading 1"
          aria-pressed={active.h1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleBlock("H1")}
          className={buttonClass(active.h1)}
        >
          <Heading1 className="size-3.5" />
        </button>
        <button
          type="button"
          title="Heading 2"
          aria-label="Heading 2"
          aria-pressed={active.h2}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleBlock("H2")}
          className={buttonClass(active.h2)}
        >
          <Heading2 className="size-3.5" />
        </button>
        <button
          type="button"
          title="Heading 3"
          aria-label="Heading 3"
          aria-pressed={active.h3}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleBlock("H3")}
          className={buttonClass(active.h3)}
        >
          <Heading3 className="size-3.5" />
        </button>
        <button
          type="button"
          title="Quote"
          aria-label="Quote"
          aria-pressed={active.blockquote}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleBlock("BLOCKQUOTE")}
          className={buttonClass(active.blockquote)}
        >
          <Quote className="size-3.5" />
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        <button
          type="button"
          title="Bullet list"
          aria-label="Bullet list"
          aria-pressed={active.insertUnorderedList}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          className={buttonClass(active.insertUnorderedList)}
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          title="Numbered list"
          aria-label="Numbered list"
          aria-pressed={active.insertOrderedList}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
          className={buttonClass(active.insertOrderedList)}
        >
          <ListOrdered className="size-3.5" />
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        <button
          type="button"
          title="Divider"
          aria-label="Insert divider"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertDivider}
          className={buttonClass(false)}
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          title="Table"
          aria-label="Insert table"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertTable}
          className={buttonClass(false)}
        >
          <Table2 className="size-3.5" />
        </button>
        <button
          type="button"
          title="Link"
          aria-label="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          className={buttonClass(false)}
        >
          <LinkIcon className="size-3.5" />
        </button>

        <span className="mx-1 h-5 w-px shrink-0 bg-border" />

        <button
          type="button"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormatting}
          className={buttonClass(false)}
        >
          <Eraser className="size-3.5" />
        </button>
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
          "rich-text max-w-none overflow-auto px-2.5 py-2 text-sm leading-relaxed outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          "min-h-40",
          contentClassName
        )}
      />
    </div>
  );
}

export { RichTextEditor };
