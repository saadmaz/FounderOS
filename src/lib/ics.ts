import type { Meeting, WorkspaceMember } from "@/lib/types";

/** RFC 5545 text escaping - backslash, comma, and semicolon are structural
 * in the format, and newlines have to become the literal two-character
 * sequence "\n" rather than an actual line break (which would corrupt the
 * line-based format). Long lines aren't folded at 75 octets here - the
 * fields this app produces (titles, short agendas) are well within what
 * every mainstream calendar app tolerates unfolded in practice. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Builds a single-event .ics file for one meeting. Recurring meetings are
 * exported as this one occurrence only, not an RRULE-based series - each
 * occurrence is already a real Meeting doc (see src/lib/recurrence.ts), so
 * there's no series to encode beyond the event being looked at.
 */
export function buildIcsEvent(
  meeting: Pick<Meeting, "id" | "title" | "scheduledAt" | "durationMinutes" | "location" | "agenda">,
  attendees: Pick<WorkspaceMember, "displayName" | "email">[]
): string {
  const start = toIcsDate(meeting.scheduledAt);
  const end = toIcsDate(meeting.scheduledAt + meeting.durationMinutes * 60_000);
  const stamp = toIcsDate(Date.now());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FounderOS//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@founderos`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(meeting.title)}`,
  ];

  if (meeting.location) {
    lines.push(`LOCATION:${escapeIcsText(meeting.location)}`);
  }

  const descriptionParts = [
    meeting.agenda,
    attendees.length > 0
      ? `Attendees: ${attendees.map((a) => a.displayName || a.email).join(", ")}`
      : undefined,
  ].filter((p): p is string => Boolean(p));
  if (descriptionParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n\n"))}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Client-side-only Blob download - same anchor-click pattern as
 * downloadCsv in src/lib/csv.ts. */
export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
