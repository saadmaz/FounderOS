/**
 * Meeting notes are authored in a small contentEditable rich-text editor
 * (see src/components/ui/rich-text-editor.tsx) and persisted as HTML. Every
 * value that comes back out of the editor and every value rendered back
 * into the page passes through `sanitizeRichText` first, so notes can never
 * carry scripts, event handlers, or arbitrary markup - only the formatting
 * tags the toolbar can produce survive, and only the handful of attributes
 * (just `<a href>`) that are actually needed.
 */
const ALLOWED_TAGS: Record<string, readonly string[]> = {
  B: [],
  STRONG: [],
  I: [],
  EM: [],
  U: [],
  S: [],
  STRIKE: [],
  DEL: [],
  P: [],
  DIV: [],
  BR: [],
  UL: [],
  OL: [],
  LI: [],
  H1: [],
  H2: [],
  H3: [],
  BLOCKQUOTE: [],
  HR: [],
  TABLE: [],
  THEAD: [],
  TBODY: [],
  TR: [],
  TH: [],
  TD: [],
  A: ["href", "target", "rel"],
};

// Only these URL schemes survive on an <a href> - blocks javascript:/data:/
// vbscript: etc. A bare "example.com" (no scheme at all) is left to the
// editor's link tool to normalize to https:// before it ever reaches here.
const SAFE_URL_SCHEME = /^(https?:|mailto:)/i;

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
    const allowedAttrs = ALLOWED_TAGS[el.tagName];
    if (!allowedAttrs) {
      // Unwrap disallowed elements (e.g. a pasted <span style=...>) instead
      // of dropping their text content.
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    if (el.tagName === "A") {
      const href = el.getAttribute("href") ?? "";
      for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      if (SAFE_URL_SCHEME.test(href)) {
        el.setAttribute("href", href);
        // target/rel are always these two fixed values, never taken from
        // user input, so it's safe to set them unconditionally here.
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    } else {
      for (const attr of Array.from(el.attributes)) {
        if (!allowedAttrs.includes(attr.name)) el.removeAttribute(attr.name);
      }
    }
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
