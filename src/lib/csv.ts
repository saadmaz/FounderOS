/** Wraps a value in quotes (doubling any embedded quotes) whenever it
 * contains a comma, quote, or newline - most fields here (names, amounts,
 * dates) never need it, but a vendor name with a comma shouldn't silently
 * corrupt the file's column count. */
function csvField(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Builds a CSV file from a header row + data rows and triggers a browser
 * download. Client-side only (Blob/URL.createObjectURL/an in-DOM anchor
 * click) - there's no server endpoint generating this file.
 */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  // Leading BOM so Excel opens the file as UTF-8 instead of mangling
  // non-ASCII characters (e.g. the "Rs" narrow symbol from formatCurrency).
  const BOM = "﻿";
  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
