/**
 * Meeting notes are authored in a small contentEditable rich-text editor
 * (see src/components/ui/rich-text-editor.tsx) and persisted as HTML. Every
 * value that comes back out of the editor and every value rendered back
 * into the page passes through `sanitizeRichText` first, so notes can never
 * carry scripts, event handlers, or arbitrary markup - only the handful of
 * formatting tags the toolbar can produce survive.
 */
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "P", "DIV"]);

export function sanitizeRichText(html: string): string {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeChildren(doc.body);
  return doc.body.innerHTML;
}

function sanitizeChildren(parent: Element) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    const el = child as Element;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      // Unwrap disallowed elements (e.g. a pasted <span style=...>) instead
      // of dropping their text content.
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    sanitizeChildren(el);
  }
}

/** Plain-text rendering of rich notes, for compact previews like card snippets. */
export function richTextToPlainText(html: string | undefined | null): string {
  if (!html) return "";
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** True if the stored value has no actual authored content (empty string, or
 * just the empty `<p><br></p>` a contentEditable leaves behind when cleared). */
export function isRichTextEmpty(html: string | undefined | null): boolean {
  return !richTextToPlainText(html);
}
