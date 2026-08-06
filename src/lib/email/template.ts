/**
 * Shared HTML shell for every transactional email FounderOS sends (password
 * reset, email verification, ...). Table-based layout with every style
 * inlined on purpose - email clients (Outlook especially) don't reliably
 * support <style> blocks, flexbox, or grid, so this sticks to the
 * lowest-common-denominator patterns that render consistently everywhere.
 *
 * Mirrors the product's own branding (src/components/auth/auth-shell.tsx):
 * dark header, primary blue #2563EB, the same "FounderOS" wordmark.
 */

const BRAND_PRIMARY = "#2563EB";
const BRAND_DARK = "#09090B";
const TEXT_PRIMARY = "#18181B";
const TEXT_MUTED = "#71717A";
const BORDER = "#E4E4E7";
const SURFACE = "#F4F4F5";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderAuthEmail(opts: {
  /** Short preview text most inboxes show next to the subject line. */
  preheader: string;
  heading: string;
  /** Plain paragraphs - each rendered as its own <p>. Keep them short. */
  paragraphs: string[];
  buttonLabel: string;
  buttonUrl: string;
  /** Shown under the button in case it doesn't render or isn't clickable. */
  footnote?: string;
}): string {
  const { preheader, heading, paragraphs, buttonLabel, buttonUrl } = opts;
  const footnote = opts.footnote ?? "If you didn't request this, you can safely ignore this email.";
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${SURFACE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SURFACE};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
            <tr>
              <td style="background-color:${BRAND_DARK};padding:24px 32px;">
                <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">⚡ FounderOS</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:600;color:${TEXT_PRIMARY};letter-spacing:-0.01em;">
                  ${escapeHtml(heading)}
                </h1>
                ${paragraphs
                  .map(
                    (p) =>
                      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${TEXT_MUTED};">${escapeHtml(p)}</p>`
                  )
                  .join("")}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:${BRAND_PRIMARY};">
                      <a
                        href="${buttonUrl}"
                        target="_blank"
                        style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                      >${escapeHtml(buttonLabel)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;border-top:1px solid ${BORDER};">
                <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">${escapeHtml(footnote)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:${TEXT_MUTED};">© ${year} FounderOS</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text alternative part - required for good deliverability and for
 * the (small but real) slice of clients that render text-only. */
export function renderAuthEmailText(opts: {
  heading: string;
  paragraphs: string[];
  buttonUrl: string;
  footnote?: string;
}): string {
  const footnote = opts.footnote ?? "If you didn't request this, you can safely ignore this email.";
  return [opts.heading, "", ...opts.paragraphs, "", opts.buttonUrl, "", footnote].join("\n");
}
