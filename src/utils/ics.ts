export interface IcsEvent {
  uid: string;
  title: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function compactDate(value: string) {
  return value.replace(/-/g, "");
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function compactDateTime(date: string, time: string) {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  return `${compactDate(date)}T${safeTime.replace(":", "")}00`;
}

function endDateForTimedEvent(event: IcsEvent) {
  if (event.endDate) return event.endDate;
  if (!event.startTime || !event.endTime) return event.startDate;
  if (!/^\d{2}:\d{2}$/.test(event.endTime)) return event.startDate;
  return event.endTime <= event.startTime ? addDays(event.startDate, 1) : event.startDate;
}

function timestamp() {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
}

export function createIcsCalendar(
  name: string,
  events: IcsEvent[],
  description = "Published WhosOn schedule"
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WhosOn//Residency Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(description)}`,
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(event.uid)}@whoson`);
    lines.push(`DTSTAMP:${timestamp()}`);

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`);
      lines.push(
        `DTEND;VALUE=DATE:${compactDate(addDays(event.endDate || event.startDate, 1))}`
      );
    } else {
      const startTime = event.startTime || "07:00";
      const endTime = /^\d{2}:\d{2}$/.test(event.endTime || "")
        ? event.endTime!
        : "12:00";
      const endDate = endDateForTimedEvent({ ...event, endTime });
      lines.push(`DTSTART:${compactDateTime(event.startDate, startTime)}`);
      lines.push(`DTEND:${compactDateTime(endDate, endTime)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadTextFile(
  contents: string,
  filename: string,
  type = "text/calendar;charset=utf-8"
) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
